const me = localStorage.getItem('cryptochat_user');
if (!me) location.href = '/login.html';

const params = new URLSearchParams(location.search);
const peer = (params.get('peer') || '').trim();
if (!peer) location.href = '/discover.html';

document.getElementById('chatTitle').textContent = `@${peer}`;
document.getElementById('subTitle').textContent = `Secure direct chat as @${me}`;

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function renderMessages(rows) {
  const wrap = document.getElementById('messages');
  wrap.innerHTML = '';

  if (!rows.length) {
    wrap.innerHTML = '<div class="placeholder">No messages yet. Start the conversation.</div>';
    return;
  }

  rows.forEach((message) => {
    const bubble = document.createElement('article');
    bubble.className = `msg ${message.from === me ? 'me' : ''}`;

    const meta = document.createElement('span');
    meta.className = 'meta';
    const when = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    meta.textContent = `${message.from} • ${when}`;

    const body = document.createElement('p');
    body.className = 'body';
    body.textContent = message.text;

    bubble.append(meta, body);
    wrap.appendChild(bubble);
  });

  wrap.scrollTop = wrap.scrollHeight;
}

async function loadMessages() {
  const payload = await api(`/api/messages?me=${encodeURIComponent(me)}&peer=${encodeURIComponent(peer)}`);
  renderMessages(payload.messages);
}

document.getElementById('messageForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = document.getElementById('messageInput');
  const text = input.value.trim();
  if (!text) return;

  await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ from: me, to: peer, text })
  });

  input.value = '';
  await loadMessages();
});

document.getElementById('backBtn').addEventListener('click', () => {
  location.href = '/discover.html';
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('cryptochat_user');
  location.href = '/login.html';
});

loadMessages().catch((error) => alert(error.message));
setInterval(() => loadMessages().catch(() => {}), 3500);
