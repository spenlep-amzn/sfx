import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findActiveSessions, findSession } from './sessions.js';

const PORT = Number(process.env.PORT) || 9000;
const FRONTEND_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'frontend');

const app = express();

app.get('/fetch-session-ids', (_req, res) => {
  try {
    const sessions = findActiveSessions();
    res.json({
      fetchedAt: Date.now(),
      sessionIds: sessions.map((s) => s.sessionId),
      sessions,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.get('/fetch-single-session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = findSession(sessionId);
    res.json(session ?? { sessionId, status: 'closed' });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.use(express.static(FRONTEND_DIR));

app.listen(PORT, () => {
  console.log(`Session visualizer running at http://localhost:${PORT}`);
});
