// Incremental indexer for Claude Code .jsonl transcripts. Transcripts are append-only, so each file
// is parsed once and later calls only read the bytes appended since. The index keeps just the facts
// the dashboard needs (spawned tool calls, tool results, task notifications, cron jobs).

import fs from 'node:fs';

interface ContentBlock {
  type?: string;
  id?: string;
  name?: string;
  text?: string;
  tool_use_id?: string;
  is_error?: boolean;
  input?: Record<string, unknown>;
  content?: unknown;
}

interface LogEntry {
  type?: string;
  content?: unknown; // queue-operation payload
  timestamp?: string;
  turnOrigin?: string;
  origin?: { kind?: string };
  uuid?: string;
  requestId?: string;
  message?: { id?: string; model?: string; stop_reason?: string | null; content?: unknown; usage?: Usage };
  toolUseResult?: unknown;
}

interface Usage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number };
  server_tool_use?: { web_search_requests?: number };
  speed?: string;
}

// Token counts for one API response.
export interface UsageRecord {
  model: string;
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
  webSearches: number;
  fast: boolean;
}

export interface SpawnInfo {
  description: string | null;
  agentType: string | null;
}

export interface ToolResultInfo {
  ts: number;
  isError: boolean;
  isAsync: boolean; // "Async agent launched" ack, not a real completion
  interrupted: boolean;
  agentId: string | null;
}

export interface Notification {
  status: string;
  ts: number;
}

export interface CronJobRecord {
  id: string;
  cron: string;
  prompt: string;
  recurring: boolean;
  humanSchedule: string | null;
  createdAt: number;
}

// What the tail of a transcript says about the agent writing it.
export type TailState = 'active' | 'ended' | 'interrupted' | null;

export interface FileIndex {
  ino: number;
  offset: number;
  leftover: Buffer; // partial last line, completed on the next read
  lastAccess: number;
  firstTs: number | null;
  lastTs: number | null;
  tail: TailState;
  spawns: Map<string, SpawnInfo>; // tool_use ids issued by this transcript
  toolResults: Map<string, ToolResultInfo>; // keyed by tool_use_id
  notifications: Map<string, Notification>; // keyed by agentId (task-id); latest wins
  cronCalls: Map<string, { name: string; input: Record<string, unknown> }>; // pending Cron* tool_use ids
  cronJobs: Map<string, CronJobRecord>; // keyed by job id
  cronDeletes: Map<string, number>; // job id -> deleted at
  scheduledFires: Map<string, number>; // fired prompt text -> latest fire time
  usage: Map<string, UsageRecord>; // API message id -> usage (one response spans several entries)
}

const CHUNK_BYTES = 1024 * 1024;
const CACHE_TTL_MS = 10 * 60 * 1000;

const cache = new Map<string, FileIndex>();

const parseTs = (s: unknown): number | null => {
  if (typeof s !== 'string') return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
};

const blocksOf = (content: unknown): ContentBlock[] =>
  Array.isArray(content) ? (content.filter((b) => b && typeof b === 'object') as ContentBlock[]) : [];

// Flattens string | [{type:'text', text}] into one string.
const textOf = (content: unknown): string => {
  if (typeof content === 'string') return content;
  return blocksOf(content)
    .map((b) => (typeof b.text === 'string' ? b.text : ''))
    .join('\n');
};

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// One API response is logged as several entries (one per content block), each repeating the usage, and
// output_tokens grows while streaming. Keyed by message id, the last entry wins = final counts.
function recordUsage(idx: FileIndex, e: LogEntry): void {
  const m = e.message;
  const u = m?.usage;
  if (!u || !m?.model || m.model === '<synthetic>') return;
  const key = m.id ?? e.requestId ?? e.uuid;
  if (!key) return;
  const write1h = num(u.cache_creation?.ephemeral_1h_input_tokens);
  const write5m = u.cache_creation
    ? num(u.cache_creation.ephemeral_5m_input_tokens)
    : num(u.cache_creation_input_tokens); // older logs: no TTL split, assume 5m
  idx.usage.set(key, {
    model: m.model,
    input: num(u.input_tokens),
    output: num(u.output_tokens),
    cacheWrite5m: write5m,
    cacheWrite1h: write1h,
    cacheRead: num(u.cache_read_input_tokens),
    webSearches: num(u.server_tool_use?.web_search_requests),
    fast: u.speed === 'fast',
  });
}

const TASK_ID_RE = /<task-id>\s*([^<\s]+)\s*<\/task-id>/;
const STATUS_RE = /<status>\s*([a-z_]+)\s*<\/status>/i;
const CRON_JOB_ID_RE = /\bjob ([0-9a-zA-Z_-]+)/;

function recordNotifications(idx: FileIndex, text: string, ts: number | null): void {
  if (ts === null || !text.includes('<task-notification>')) return;
  for (const chunk of text.split('<task-notification>').slice(1)) {
    const id = TASK_ID_RE.exec(chunk)?.[1];
    const status = STATUS_RE.exec(chunk)?.[1]?.toLowerCase();
    if (!id || !status) continue;
    const prev = idx.notifications.get(id);
    if (!prev || ts >= prev.ts) idx.notifications.set(id, { status, ts });
  }
}

function recordCronResult(idx: FileIndex, b: ContentBlock, tur: Record<string, unknown> | null, ts: number): void {
  const call = idx.cronCalls.get(b.tool_use_id!);
  if (!call) return;
  idx.cronCalls.delete(b.tool_use_id!);
  if (b.is_error) return;

  if (call.name === 'CronCreate') {
    const id = str(tur?.id) ?? CRON_JOB_ID_RE.exec(textOf(b.content))?.[1] ?? null;
    const cron = str(call.input.cron);
    if (!id || !cron) return;
    idx.cronJobs.set(id, {
      id,
      cron,
      prompt: str(call.input.prompt) ?? '',
      recurring: typeof tur?.recurring === 'boolean' ? tur.recurring : call.input.recurring !== false,
      humanSchedule: str(tur?.humanSchedule),
      createdAt: ts,
    });
  } else if (call.name === 'CronDelete') {
    const id = str(call.input.id);
    if (id) idx.cronDeletes.set(id, ts);
  }
}

function indexEntry(idx: FileIndex, e: LogEntry): void {
  const ts = parseTs(e.timestamp);
  if (ts !== null) {
    if (idx.firstTs === null) idx.firstTs = ts;
    if (idx.lastTs === null || ts > idx.lastTs) idx.lastTs = ts;
  }

  // Background agents report back via <task-notification>; it's enqueued first, delivered as a user turn later.
  if (e.type === 'queue-operation') {
    recordNotifications(idx, textOf(e.content), ts);
    return;
  }

  const content = e.message?.content;

  if (e.type === 'assistant') {
    recordUsage(idx, e);
    const blocks = blocksOf(content);
    for (const b of blocks) {
      if (b.type !== 'tool_use' || typeof b.id !== 'string') continue;
      idx.spawns.set(b.id, {
        description: str(b.input?.description),
        agentType: str(b.input?.subagent_type),
      });
      if (b.name === 'CronCreate' || b.name === 'CronDelete') {
        idx.cronCalls.set(b.id, { name: b.name, input: b.input ?? {} });
      }
    }
    if (e.message?.stop_reason === 'end_turn') idx.tail = 'ended';
    else if (blocks.length) idx.tail = 'active'; // thinking / text / tool_use in flight
    return;
  }

  if (e.type === 'user') {
    const text = textOf(content);
    recordNotifications(idx, text, ts);
    if (text.startsWith('[Request interrupted by user')) {
      idx.tail = 'interrupted';
    } else {
      idx.tail = 'active'; // new prompt or tool result -> model is about to respond
    }
    if (ts !== null && (e.turnOrigin === 'scheduled' || e.origin?.kind === 'scheduled')) {
      idx.scheduledFires.set(text, ts);
    }

    const tur = e.toolUseResult && typeof e.toolUseResult === 'object' ? (e.toolUseResult as Record<string, unknown>) : null;
    for (const b of blocksOf(content)) {
      if (b.type !== 'tool_result' || typeof b.tool_use_id !== 'string' || ts === null) continue;
      const resultText = textOf(b.content);
      idx.toolResults.set(b.tool_use_id, {
        ts,
        isError: b.is_error === true,
        isAsync: tur?.isAsync === true || tur?.status === 'async_launched',
        interrupted: resultText.includes('[Request interrupted by user'),
        agentId: str(tur?.agentId),
      });
      recordCronResult(idx, b, tur, ts);
    }
  }
  // attachment, system, progress, file-history-snapshot, ...: no bearing on what we track
}

function freshIndex(ino: number): FileIndex {
  return {
    ino,
    offset: 0,
    leftover: Buffer.alloc(0),
    lastAccess: 0,
    firstTs: null,
    lastTs: null,
    tail: null,
    spawns: new Map(),
    toolResults: new Map(),
    notifications: new Map(),
    cronCalls: new Map(),
    cronJobs: new Map(),
    cronDeletes: new Map(),
    scheduledFires: new Map(),
    usage: new Map(),
  };
}

// Reads only bytes appended since the last call. Resets if the file was replaced or truncated.
export function indexFile(file: string): FileIndex | null {
  let fd: number;
  try {
    fd = fs.openSync(file, 'r');
  } catch {
    cache.delete(file);
    return null;
  }
  try {
    const { size, ino } = fs.fstatSync(fd);
    let idx = cache.get(file);
    if (!idx || idx.ino !== ino || size < idx.offset) {
      idx = freshIndex(ino);
      cache.set(file, idx);
    }
    idx.lastAccess = Date.now();

    while (idx.offset < size) {
      const buf = Buffer.alloc(Math.min(CHUNK_BYTES, size - idx.offset));
      const n = fs.readSync(fd, buf, 0, buf.length, idx.offset);
      if (n <= 0) break;
      idx.offset += n;

      // Split on the '\n' byte so multi-byte UTF-8 chars are never cut in half.
      let data = Buffer.concat([idx.leftover, buf.subarray(0, n)]);
      let nl: number;
      while ((nl = data.indexOf(0x0a)) !== -1) {
        const line = data.subarray(0, nl).toString('utf8').trim();
        data = data.subarray(nl + 1);
        if (!line) continue;
        try {
          indexEntry(idx, JSON.parse(line) as LogEntry);
        } catch {
          // corrupt line; skip it
        }
      }
      idx.leftover = Buffer.from(data);
    }
    return idx;
  } finally {
    fs.closeSync(fd);
  }
}

export function sweepCache(): void {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [file, idx] of cache) if (idx.lastAccess < cutoff) cache.delete(file);
}
