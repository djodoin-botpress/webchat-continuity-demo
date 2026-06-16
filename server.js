import express from 'express';
import cookieParser from 'cookie-parser';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 8000;
const CLIENT_ID = process.env.CLIENT_ID;
const WEBCHAT_API_URL = process.env.WEBCHAT_API_URL || 'https://webchat.botpress.cloud';

if (!CLIENT_ID) {
  console.error('CLIENT_ID env var is required.');
  console.error('Get it from Botpress Cloud → Webchat → Advanced → Configuration → clientId');
  console.error('Then run:  CLIENT_ID=<your-client-id> npm start');
  process.exit(1);
}

const USERS_FILE = path.join(__dirname, '.data', 'users.json');
await mkdir(path.dirname(USERS_FILE), { recursive: true });

async function readUsers() {
  try {
    return JSON.parse(await readFile(USERS_FILE, 'utf8'));
  } catch {
    return {};
  }
}

async function writeUsers(users) {
  await writeFile(USERS_FILE, JSON.stringify(users, null, 2));
}

async function createBotpressUser(name) {
  const res = await fetch(`${WEBCHAT_API_URL}/${CLIENT_ID}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Botpress createUser ${res.status}: ${text}`);
  }
  return JSON.parse(text);
}

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/config', (_req, res) => {
  res.json({ clientId: CLIENT_ID });
});

app.get('/api/me', async (req, res) => {
  const username = req.cookies.username;
  if (!username) return res.json({ user: null });
  const users = await readUsers();
  const record = users[username];
  if (!record) return res.json({ user: null });
  res.json({
    user: {
      username,
      userId: record.userId,
      userKey: record.userKey,
      conversationId: record.conversationId ?? null,
    },
  });
});

app.post('/api/login', async (req, res) => {
  const raw = String(req.body?.username ?? '').trim().toLowerCase();
  if (!/^[a-z0-9_-]{2,32}$/.test(raw)) {
    return res.status(400).json({ error: 'username must be 2-32 chars: a-z, 0-9, _, -' });
  }

  const users = await readUsers();
  if (!users[raw]) {
    try {
      const result = await createBotpressUser(raw);
      users[raw] = {
        userId: result.user.id,
        userKey: result.key,
        conversationId: null,
        createdAt: new Date().toISOString(),
      };
      await writeUsers(users);
    } catch (e) {
      return res.status(502).json({ error: e.message });
    }
  }

  res.cookie('username', raw, { sameSite: 'lax', maxAge: 30 * 24 * 60 * 60 * 1000 });
  const { userId, userKey, conversationId } = users[raw];
  res.json({ username: raw, userId, userKey, conversationId: conversationId ?? null });
});

app.post('/api/logout', (_req, res) => {
  res.clearCookie('username');
  res.json({ ok: true });
});

app.post('/api/conversation', async (req, res) => {
  const username = req.cookies.username;
  if (!username) return res.status(401).json({ error: 'not logged in' });
  const conversationId = String(req.body?.conversationId ?? '').trim();
  if (!conversationId) return res.status(400).json({ error: 'conversationId required' });
  const users = await readUsers();
  if (!users[username]) return res.status(404).json({ error: 'unknown user' });
  users[username].conversationId = conversationId;
  await writeUsers(users);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Webchat continuity demo: http://localhost:${PORT}`);
  console.log(`  clientId:  ${CLIENT_ID}`);
  console.log(`  user store: ${USERS_FILE}`);
});
