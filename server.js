const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

const accountsPath = path.join(__dirname, 'data', 'seed_accounts.json');
const seededAccounts = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));

const usersByName = new Map(seededAccounts.map((u) => [u.username, u]));
const invites = [];
const connections = new Map();
const messages = [];

function safeUserView(username) {
  return { username, status: 'online' };
}

function verifyPasswordWithPython(password, entry) {
  const proc = spawnSync('python3', [path.join(__dirname, 'python', 'auth_logic.py'), 'verify'], {
    input: JSON.stringify({ password, entry }),
    encoding: 'utf-8'
  });

  if (proc.status !== 0) {
    throw new Error(proc.stderr || 'Password verification failed.');
  }

  return JSON.parse(proc.stdout).valid;
}

function ensureConnection(a, b) {
  const key = [a, b].sort().join('::');
  if (!connections.has(key)) {
    connections.set(key, { participants: [a, b], createdAt: new Date().toISOString() });
  }
  return key;
}

function validateUsernames(from, to) {
  return Boolean(from && to && from !== to && usersByName.has(from) && usersByName.has(to));
}

app.use(express.json({ limit: '200kb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/users', (req, res) => {
  const query = (req.query.query || '').toString().toLowerCase().trim();
  const me = (req.query.me || '').toString().trim();

  // No suggestions: return empty until user explicitly searches.
  if (query.length < 2) {
    return res.json({ users: [] });
  }

  const list = [...usersByName.keys()]
    .filter((name) => name !== me)
    .filter((name) => name.includes(query))
    .map(safeUserView);

  return res.json({ users: list });
});

app.post('/api/login', (req, res) => {
  const username = (req.body?.username || '').toString().trim();
  const password = (req.body?.password || '').toString();

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required.' });
  }

  const account = usersByName.get(username);
  if (!account) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  try {
    if (!verifyPasswordWithPython(password, account.password)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
  } catch (error) {
    return res.status(500).json({ error: `Auth failure: ${error.message}` });
  }

  return res.json({ user: safeUserView(username) });
});

app.get('/api/invites/:username', (req, res) => {
  const username = req.params.username;
  const pending = invites.filter((invite) => invite.to === username && invite.status === 'pending');
  res.json({ invites: pending });
});

app.post('/api/invite', (req, res) => {
  const from = (req.body?.from || '').toString().trim();
  const to = (req.body?.to || '').toString().trim();

  if (!validateUsernames(from, to)) {
    return res.status(400).json({ error: 'Invalid invite payload.' });
  }

  const alreadyConnected = [...connections.values()].some((c) => c.participants.includes(from) && c.participants.includes(to));
  if (alreadyConnected) {
    return res.status(409).json({ error: 'You are already connected.' });
  }

  const existing = invites.find((invite) => invite.from === from && invite.to === to && invite.status === 'pending');
  if (existing) {
    return res.status(409).json({ error: 'Invite already pending.' });
  }

  const invite = {
    id: crypto.randomUUID(),
    from,
    to,
    status: 'pending',
    createdAt: new Date().toISOString()
  };

  invites.push(invite);
  return res.status(201).json({ invite });
});

app.post('/api/invite/respond', (req, res) => {
  const inviteId = (req.body?.inviteId || '').toString();
  const accept = Boolean(req.body?.accept);
  const invite = invites.find((item) => item.id === inviteId);

  if (!invite || invite.status !== 'pending') {
    return res.status(404).json({ error: 'Invite not found.' });
  }

  invite.status = accept ? 'accepted' : 'declined';
  invite.respondedAt = new Date().toISOString();

  if (accept) {
    const roomKey = ensureConnection(invite.from, invite.to);
    return res.json({ status: 'accepted', roomKey });
  }

  return res.json({ status: 'declined' });
});

app.get('/api/chats/:username', (req, res) => {
  const username = req.params.username;
  const chatRooms = [...connections.entries()]
    .filter(([, room]) => room.participants.includes(username))
    .map(([key, room]) => {
      const peer = room.participants.find((p) => p !== username);
      const roomMessages = messages.filter((msg) => msg.roomKey === key);
      return {
        roomKey: key,
        peer,
        createdAt: room.createdAt,
        preview: roomMessages.at(-1)?.text || 'No messages yet.',
        messageCount: roomMessages.length
      };
    });

  res.json({ chats: chatRooms });
});

app.get('/api/messages', (req, res) => {
  const me = (req.query.me || '').toString().trim();
  const peer = (req.query.peer || '').toString().trim();

  if (!validateUsernames(me, peer)) {
    return res.status(400).json({ error: 'Invalid users.' });
  }

  const roomKey = ensureConnection(me, peer);
  const roomMessages = messages.filter((msg) => msg.roomKey === roomKey);
  return res.json({ roomKey, messages: roomMessages });
});

app.post('/api/messages', (req, res) => {
  const from = (req.body?.from || '').toString().trim();
  const to = (req.body?.to || '').toString().trim();
  const text = (req.body?.text || '').toString().trim();

  if (!validateUsernames(from, to) || !text) {
    return res.status(400).json({ error: 'Invalid message payload.' });
  }

  if (text.length > 600) {
    return res.status(400).json({ error: 'Message is too long.' });
  }

  const roomKey = ensureConnection(from, to);
  const message = {
    id: crypto.randomUUID(),
    roomKey,
    from,
    to,
    text,
    createdAt: new Date().toISOString()
  };
  messages.push(message);
  res.status(201).json({ message });
});

app.listen(PORT, () => {
  console.log(`CryptoChat listening at http://localhost:${PORT}`);
});
