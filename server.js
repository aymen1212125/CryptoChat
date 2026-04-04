const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');
const { Client: PgClient } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseDbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || '';
const dbEnabled = Boolean(supabaseUrl && supabaseServiceRole);
const supabase = dbEnabled
  ? createClient(supabaseUrl, supabaseServiceRole, { auth: { persistSession: false, autoRefreshToken: false } })
  : null;

const seedAccountsPath = path.join(__dirname, 'data', 'seed_accounts.json');
const seededAccounts = JSON.parse(fs.readFileSync(seedAccountsPath, 'utf-8'));

const MESSAGE_STATUS = {
  sending: 'sending',
  sent: 'sent',
  delivered: 'delivered',
  read: 'read',
  failed: 'failed'
};

function safeUserView(username) {
  return { username, status: 'online' };
}

function normalizeUsername(value) {
  return (value || '').toString().trim().toLowerCase();
}

function roomKey(a, b) {
  return [a, b].sort().join('::');
}

function verifyPasswordWithPython(password, entry) {
  const proc = spawnSync('python3', [path.join(__dirname, 'python', 'auth_logic.py'), 'verify'], {
    input: JSON.stringify({ password, entry }),
    encoding: 'utf-8'
  });

  if (proc.status !== 0) throw new Error(proc.stderr || 'Password verification failed.');
  return JSON.parse(proc.stdout).valid;
}


async function runSchemaIfPossible() {
  if (!supabaseDbUrl) {
    console.warn('No SUPABASE_DB_URL provided; skipping automatic schema migration.');
    return;
  }

  const schemaSql = fs.readFileSync(path.join(__dirname, 'supabase', 'schema.sql'), 'utf-8');
  const client = new PgClient({ connectionString: supabaseDbUrl, ssl: { rejectUnauthorized: false } });

  await client.connect();
  try {
    await client.query(schemaSql);
    console.log('Schema migration applied from supabase/schema.sql');
  } finally {
    await client.end();
  }
}

function hashPasswordWithPython(password) {
  const proc = spawnSync('python3', [path.join(__dirname, 'python', 'auth_logic.py'), 'hash', password], {
    encoding: 'utf-8'
  });

  if (proc.status !== 0) throw new Error(proc.stderr || 'Password hashing failed.');
  return JSON.parse(proc.stdout);
}

async function ensureSeedUsers() {
  if (!dbEnabled) return;

  for (const account of seededAccounts) {
    const { data } = await supabase.from('profiles').select('username').eq('username', account.username).maybeSingle();
    if (!data) {
      await supabase.from('profiles').insert({ username: account.username, password: account.password });
    }
  }
}

async function getProfile(username) {
  const { data, error } = await supabase.from('profiles').select('*').eq('username', username).maybeSingle();
  if (error) throw error;
  return data;
}

async function validUsers(from, to) {
  if (!from || !to || from === to) return false;
  const { data, error } = await supabase.from('profiles').select('username').in('username', [from, to]);
  if (error) throw error;
  return data.length === 2;
}

async function ensureConnection(a, b) {
  const key = roomKey(a, b);
  const { data } = await supabase.from('connections').select('room_key').eq('room_key', key).maybeSingle();
  if (!data) {
    const { error } = await supabase.from('connections').insert({ room_key: key, user_a: a, user_b: b });
    if (error) throw error;
  }
  return key;
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', async (_req, res) => {
  if (!dbEnabled) {
    return res.status(500).json({ ok: false, error: 'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.' });
  }

  const { error } = await supabase.from('profiles').select('username').limit(1);
  if (error) return res.status(500).json({ ok: false, error: error.message });
  return res.json({ ok: true, db: 'supabase' });
});

app.post('/api/signup', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const username = normalizeUsername(req.body?.username);
  const password = (req.body?.password || '').toString();

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Username must be 3-20 chars, lowercase letters, numbers, underscore.' });
  }
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = await getProfile(username);
  if (existing) return res.status(409).json({ error: 'Username already exists.' });

  const passwordEntry = hashPasswordWithPython(password);
  const { error } = await supabase.from('profiles').insert({ username, password: passwordEntry });
  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json({ user: safeUserView(username) });
});

app.post('/api/login', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const username = normalizeUsername(req.body?.username);
  const password = (req.body?.password || '').toString();

  if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });

  const account = await getProfile(username);
  if (!account) return res.status(401).json({ error: 'Invalid credentials.' });

  try {
    if (!verifyPasswordWithPython(password, account.password)) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }
  } catch (error) {
    return res.status(500).json({ error: `Auth failure: ${error.message}` });
  }

  return res.json({ user: safeUserView(username) });
});

app.get('/api/users', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const query = normalizeUsername(req.query.query);
  const me = normalizeUsername(req.query.me);
  if (query.length < 2) return res.json({ users: [] });

  const { data, error } = await supabase
    .from('profiles')
    .select('username')
    .ilike('username', `%${query}%`)
    .neq('username', me)
    .limit(20);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ users: data.map((row) => safeUserView(row.username)) });
});

app.get('/api/invites/:username', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const username = normalizeUsername(req.params.username);
  const { data, error } = await supabase
    .from('invites')
    .select('*')
    .eq('to_username', username)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });
  const invites = data.map((invite) => ({
    id: invite.id,
    from: invite.from_username,
    to: invite.to_username,
    status: invite.status,
    createdAt: invite.created_at
  }));
  return res.json({ invites });
});

app.post('/api/invite', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const from = normalizeUsername(req.body?.from);
  const to = normalizeUsername(req.body?.to);

  const valid = await validUsers(from, to);
  if (!valid) return res.status(400).json({ error: 'Invalid invite payload.' });

  const key = roomKey(from, to);
  const { data: existingConnection } = await supabase.from('connections').select('room_key').eq('room_key', key).maybeSingle();
  if (existingConnection) return res.status(409).json({ error: 'You are already connected.' });

  const { data: existingInvite } = await supabase
    .from('invites')
    .select('id')
    .eq('from_username', from)
    .eq('to_username', to)
    .eq('status', 'pending')
    .maybeSingle();

  if (existingInvite) return res.status(409).json({ error: 'Invite already pending.' });

  const { data, error } = await supabase
    .from('invites')
    .insert({ from_username: from, to_username: to, status: 'pending' })
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json({
    invite: {
      id: data.id,
      from,
      to,
      status: data.status,
      createdAt: data.created_at
    }
  });
});

app.post('/api/invite/respond', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const inviteId = (req.body?.inviteId || '').toString();
  const accept = Boolean(req.body?.accept);

  const { data: invite, error: inviteError } = await supabase.from('invites').select('*').eq('id', inviteId).maybeSingle();
  if (inviteError) return res.status(500).json({ error: inviteError.message });
  if (!invite || invite.status !== 'pending') return res.status(404).json({ error: 'Invite not found.' });

  const nextStatus = accept ? 'accepted' : 'declined';
  const { error: updateError } = await supabase
    .from('invites')
    .update({ status: nextStatus, responded_at: new Date().toISOString() })
    .eq('id', inviteId);

  if (updateError) return res.status(500).json({ error: updateError.message });

  if (accept) {
    const key = await ensureConnection(invite.from_username, invite.to_username);
    return res.json({ status: 'accepted', roomKey: key });
  }

  return res.json({ status: 'declined' });
});

app.get('/api/chats/:username', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const username = normalizeUsername(req.params.username);
  const { data: rooms, error } = await supabase
    .from('connections')
    .select('*')
    .or(`user_a.eq.${username},user_b.eq.${username}`)
    .order('created_at', { ascending: false });

  if (error) return res.status(500).json({ error: error.message });

  const chats = [];
  for (const room of rooms) {
    const peer = room.user_a === username ? room.user_b : room.user_a;
    const { data: lastMessage } = await supabase
      .from('messages')
      .select('*')
      .eq('room_key', room.room_key)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count: unreadCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('room_key', room.room_key)
      .eq('to_username', username)
      .neq('status', MESSAGE_STATUS.read);

    const { count: messageCount } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('room_key', room.room_key);

    chats.push({
      roomKey: room.room_key,
      peer,
      preview: lastMessage?.text || (lastMessage?.attachment ? 'Media attachment' : 'No messages yet.'),
      updatedAt: lastMessage?.created_at || room.created_at,
      unreadCount: unreadCount || 0,
      messageCount: messageCount || 0
    });
  }

  chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  return res.json({ chats });
});

app.get('/api/messages', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const me = normalizeUsername(req.query.me);
  const peer = normalizeUsername(req.query.peer);
  const valid = await validUsers(me, peer);
  if (!valid) return res.status(400).json({ error: 'Invalid users.' });

  const key = roomKey(me, peer);
  const { data: connection } = await supabase.from('connections').select('room_key').eq('room_key', key).maybeSingle();
  if (!connection) return res.status(403).json({ error: 'No active chat connection with this user.' });

  await supabase
    .from('messages')
    .update({ status: MESSAGE_STATUS.delivered, delivered_at: new Date().toISOString() })
    .eq('room_key', key)
    .eq('to_username', me)
    .eq('status', MESSAGE_STATUS.sent);

  const { data, error } = await supabase.from('messages').select('*').eq('room_key', key).order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });

  return res.json({
    roomKey: key,
    messages: data.map((row) => ({
      id: row.id,
      clientTempId: row.client_temp_id,
      roomKey: row.room_key,
      from: row.from_username,
      to: row.to_username,
      text: row.text,
      attachment: row.attachment,
      status: row.status,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
      readAt: row.read_at
    }))
  });
});

app.post('/api/messages', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const from = normalizeUsername(req.body?.from);
  const to = normalizeUsername(req.body?.to);
  const text = (req.body?.text || '').toString().trim();
  const attachment = req.body?.attachment || null;
  const clientTempId = (req.body?.clientTempId || '').toString().trim();

  const valid = await validUsers(from, to);
  if (!valid || (!text && !attachment)) return res.status(400).json({ error: 'Invalid message payload.' });
  if (text.length > 3000) return res.status(400).json({ error: 'Message is too long.' });

  const key = await ensureConnection(from, to);

  const { data, error } = await supabase
    .from('messages')
    .insert({
      room_key: key,
      from_username: from,
      to_username: to,
      text,
      attachment,
      status: MESSAGE_STATUS.sent,
      client_temp_id: clientTempId
    })
    .select('*')
    .single();

  if (error) return res.status(500).json({ error: error.message });

  return res.status(201).json({
    message: {
      id: data.id,
      clientTempId: data.client_temp_id,
      roomKey: data.room_key,
      from: data.from_username,
      to: data.to_username,
      text: data.text,
      attachment: data.attachment,
      status: data.status,
      createdAt: data.created_at
    }
  });
});

app.post('/api/messages/read', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const me = normalizeUsername(req.body?.me);
  const peer = normalizeUsername(req.body?.peer);
  const valid = await validUsers(me, peer);
  if (!valid) return res.status(400).json({ error: 'Invalid users.' });

  const key = roomKey(me, peer);
  const { error } = await supabase
    .from('messages')
    .update({ status: MESSAGE_STATUS.read, read_at: new Date().toISOString() })
    .eq('room_key', key)
    .eq('to_username', me)
    .neq('status', MESSAGE_STATUS.read);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

app.post('/api/typing', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const from = normalizeUsername(req.body?.from);
  const to = normalizeUsername(req.body?.to);
  const valid = await validUsers(from, to);
  if (!valid) return res.status(400).json({ error: 'Invalid users.' });

  const { error } = await supabase
    .from('typing_status')
    .upsert({ from_username: from, to_username: to, updated_at: new Date().toISOString() }, { onConflict: 'from_username,to_username' });

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

app.get('/api/typing', async (req, res) => {
  if (!dbEnabled) return res.status(500).json({ error: 'Database is not configured.' });

  const from = normalizeUsername(req.query.from);
  const to = normalizeUsername(req.query.to);
  const { data, error } = await supabase
    .from('typing_status')
    .select('updated_at')
    .eq('from_username', from)
    .eq('to_username', to)
    .maybeSingle();

  if (error) return res.status(500).json({ error: error.message });
  const ms = data ? Date.now() - new Date(data.updated_at).getTime() : Infinity;
  return res.json({ typing: ms <= 3000 });
});

(async () => {
  if (dbEnabled) {
    try {
      await runSchemaIfPossible();
      await ensureSeedUsers();
      console.log('Supabase database connected and demo users ensured.');
    } catch (error) {
      console.error('Supabase bootstrap failed:', error.message);
    }
  } else {
    console.warn('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  app.listen(PORT, () => {
    console.log(`CryptoChat listening at http://localhost:${PORT}`);
  });
})();
