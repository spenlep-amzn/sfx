// Finds every live Claude Code session on this machine and reports its status
// (idle | working | permission | question) by reading the tail of its .jsonl log.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { sessionCost, type SessionCost } from './cost.js';
import { findScheduledJobs, type ScheduledJob } from './scheduled.js';
import { findSubagents, loadSessionTranscripts, type SubagentNode } from './subagents.js';

const CLAUDE_DIR = process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude');
const SESSIONS_DIR = path.join(CLAUDE_DIR, 'sessions');
const PROJECTS_DIR = path.join(CLAUDE_DIR, 'projects');

const TAIL_BYTES = 128 * 1024;
const STREAMING_STALE_MS = 8000; // text-only assistant entry newer than this = still streaming

export type SessionStatus = 'idle' | 'working' | 'permission' | 'question';

export interface ActiveSession {
  sessionId: string;
  pid: number;
  name: string | null;
  cwd: string;
  startedAt: number;
  status: SessionStatus;
  reportedStatus: string | null; // what Claude itself wrote in the session file
  logPath: string | null;
}

// Shape of ~/.claude/sessions/<pid>.json (only the fields we use)
interface SessionFile {
  pid: number;
  sessionId: string;
  cwd?: string;
  startedAt?: number;
  name?: string;
  status?: string;
}

interface ContentBlock {
  type: string;
  name?: string;
  text?: string;
}

interface LogEntry {
  type?: string;
  subtype?: string;
  isSidechain?: boolean;
  message?: { stop_reason?: string | null; content?: unknown };
}

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM'; // exists, owned by someone else
  }
};

// ~/.claude/projects/<encoded-cwd>: every non-alphanumeric char becomes '-'
const encodeCwd = (cwd: string): string => cwd.replace(/[^a-zA-Z0-9]/g, '-');

function readSessions(): SessionFile[] {
  let files: string[];
  try {
    files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith('.json'));
  } catch {
    return [];
  }
  const sessions: SessionFile[] = [];
  for (const f of files) {
    try {
      const s = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), 'utf8')) as SessionFile;
      if (s && s.pid && s.sessionId && isAlive(s.pid)) sessions.push(s);
    } catch {
      // half-written or unreadable session file; skip it
    }
  }
  return sessions;
}

// The session file names the sessionId, so the log is <projects>/<encoded-cwd>/<sessionId>.jsonl.
// Long paths can be encoded differently, so fall back to scanning every project dir.
function findLog(session: SessionFile): string | null {
  const name = `${session.sessionId}.jsonl`;
  const direct = path.join(PROJECTS_DIR, encodeCwd(session.cwd || ''), name);
  if (fs.existsSync(direct)) return direct;
  try {
    for (const dir of fs.readdirSync(PROJECTS_DIR)) {
      const p = path.join(PROJECTS_DIR, dir, name);
      if (fs.existsSync(p)) return p;
    }
  } catch {
    // no projects dir yet
  }
  return null;
}

function readTailLines(file: string): { lines: string[]; mtimeMs: number } {
  const fd = fs.openSync(file, 'r');
  try {
    const { size, mtimeMs } = fs.fstatSync(fd);
    const start = Math.max(0, size - TAIL_BYTES);
    const buf = Buffer.alloc(size - start);
    fs.readSync(fd, buf, 0, buf.length, start);
    const lines = buf.toString('utf8').split('\n');
    if (start > 0) lines.shift(); // first line is probably cut mid-entry
    return { lines: lines.filter(Boolean), mtimeMs };
  } finally {
    fs.closeSync(fd);
  }
}

const contentBlocks = (entry: LogEntry): ContentBlock[] => {
  const c = entry.message && entry.message.content;
  return Array.isArray(c) ? (c as ContentBlock[]) : [];
};

const wasInterrupted = (entry: LogEntry): boolean =>
  contentBlocks(entry).some(
    (b) => b.type === 'text' && typeof b.text === 'string' && b.text.startsWith('[Request interrupted by user')
  );

// Walk the log backwards; the first entry that says something about state wins.
export function detectStatusFromLog(file: string, now = Date.now()): SessionStatus {
  const { lines, mtimeMs } = readTailLines(file);
  const stale = now - mtimeMs > STREAMING_STALE_MS;

  for (let i = lines.length - 1; i >= 0; i--) {
    let e: LogEntry;
    try {
      e = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    if (e.isSidechain) continue; // subagent chatter

    switch (e.type) {
      case 'system':
        if (e.subtype === 'turn_duration') return 'idle';
        continue;

      case 'assistant': {
        const stop = e.message && e.message.stop_reason;
        const toolUses = contentBlocks(e).filter((b) => b.type === 'tool_use');
        if (stop === 'end_turn') return 'idle';
        if (toolUses.length) {
          // tool_use is the last thing logged, so the tool hasn't produced a result yet
          return toolUses.some((b) => b.name === 'AskUserQuestion') ? 'question' : 'permission';
        }
        return stale ? 'idle' : 'working'; // text/thinking only
      }

      case 'user':
        return wasInterrupted(e) ? 'idle' : 'working';

      case 'progress':
        return 'working';

      default:
        continue; // file-history-snapshot, attachment, mode, ai-title, last-prompt, ...
    }
  }
  return 'idle';
}

function toActiveSession(s: SessionFile): ActiveSession {
  const logPath = findLog(s);
  return {
    sessionId: s.sessionId,
    pid: s.pid,
    name: s.name || null,
    cwd: s.cwd || '',
    startedAt: s.startedAt || 0,
    status: logPath ? detectStatusFromLog(logPath) : 'idle', // no log yet = brand-new session
    reportedStatus: s.status || null,
    logPath,
  };
}

export function findActiveSessions(): ActiveSession[] {
  return readSessions()
    .map(toActiveSession)
    .sort((a, b) => a.startedAt - b.startedAt);
}

export interface SessionDetail extends ActiveSession {
  subagents: SubagentNode[]; // top-level Agent spawns; nested spawns live in .children
  scheduledJobs: ScheduledJob[]; // live CronCreate jobs, soonest first
  cost: SessionCost; // estimated API cost, main session + all sub-agents
}

// null = no live process owns this sessionId any more (closed, or never existed)
export function findSession(sessionId: string): SessionDetail | null {
  const s = readSessions().find((x) => x.sessionId === sessionId);
  if (!s) return null;
  const session = toActiveSession(s);
  const query = {
    sessionId: session.sessionId,
    logPath: session.logPath,
    projectsDir: PROJECTS_DIR,
    startedAt: session.startedAt,
  };
  const transcripts = loadSessionTranscripts(query);
  return {
    ...session,
    subagents: findSubagents(query, transcripts),
    scheduledJobs: findScheduledJobs(transcripts, session.startedAt),
    cost: sessionCost(transcripts),
  };
}
