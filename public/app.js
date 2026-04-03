const state = {
  me: null,
  chats: [],
  activeRoom: null,
};

const els = {
  loginPanel: document.getElementById('loginPanel'),
  chatPanel: document.getElementById('chatPanel'),
  loginForm: document.getElementById('loginForm'),
  username: document.getElementById('username'),
  password: document.getElementById('password'),
  loginError: document.getElementById('loginError'),
  togglePassword: document.getElementById('togglePassword'),
  meLabel: document.getElementById('meLabel'),
  userSearch: document.getElementById('userSearch'),
  searchResults: document.getElementById('searchResults'),
  invitesList: document.getElementById('invitesList'),
  chatList: document.getElementById('chatList'),
  refreshBtn: document.getElementById('refreshBtn'),
  emptyState: document.getElementById('emptyState'),
  chatView: document.getElementById('chatView'),
  chatTitle: document.getElementById('chatTitle'),
  messages: document.getElementById('messages'),
  messageForm: document.getElementById('messageForm'),
  messageInput: document.getElementById('messageInput'),
};

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function maskPasswordPreview(password) {
  return `${password[0] ?? '*'}${'*'.repeat(Math.max(password.length - 2, 2))}${password.at(-1) ?? '*'}`;
}

function renderSearchUsers(users) {
  els.searchResults.innerHTML = '';
  users.forEach((u) => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="list-row"><span>@${u.username}</span><button class="secondary" data-invite="${u.username}">Invite</button></div>`;
    els.searchResults.appendChild(li);
  });
}

function renderInvites(invites) {
  els.invitesList.innerHTML = '';
  if (!invites.length) {
    els.invitesList.innerHTML = '<li>No pending invites</li>';
    return;
  }
  invites.forEach((invite) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div>@${invite.from} invited you</div>
      <div class="list-row">
        <button data-accept="${invite.id}">Accept</button>
        <button class="secondary" data-decline="${invite.id}">Decline</button>
      </div>`;
    els.invitesList.appendChild(li);
  });
}

function renderChats() {
  els.chatList.innerHTML = '';
  if (!state.chats.length) {
    els.chatList.innerHTML = '<li>No active channels</li>';
    return;
  }

  state.chats.forEach((chat) => {
    const li = document.createElement('li');
    li.innerHTML = `<button class="secondary" data-room="${chat.roomKey}" style="width:100%; text-align:left;">
      <div class="list-row"><strong>@${chat.peer}</strong><span class="pill">secured</span></div>
      <small>${chat.preview}</small>
    </button>`;
    els.chatList.appendChild(li);
  });
}

function renderActiveChat() {
  const chat = state.chats.find((c) => c.roomKey === state.activeRoom);
  if (!chat) {
    els.emptyState.classList.remove('hidden');
    els.chatView.classList.add('hidden');
    return;
  }

  els.emptyState.classList.add('hidden');
  els.chatView.classList.remove('hidden');
  els.chatTitle.textContent = `Channel with @${chat.peer}`;
  els.messages.innerHTML = '';

  chat.messages.forEach((message) => {
    const div = document.createElement('div');
    div.className = `msg ${message.from === state.me ? 'me' : ''}`;
    const when = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    div.innerHTML = `<span class="meta">${message.from} • ${when}</span>${message.text}`;
    els.messages.appendChild(div);
  });

  els.messages.scrollTop = els.messages.scrollHeight;
}

async function refreshAll() {
  if (!state.me) return;

  const [usersPayload, invitesPayload, chatsPayload] = await Promise.all([
    api(`/api/users?me=${encodeURIComponent(state.me)}&query=${encodeURIComponent(els.userSearch.value || '')}`),
    api(`/api/invites/${encodeURIComponent(state.me)}`),
    api(`/api/chats/${encodeURIComponent(state.me)}`),
  ]);

  state.chats = chatsPayload.chats;

  if (state.activeRoom && !state.chats.some((c) => c.roomKey === state.activeRoom)) {
    state.activeRoom = null;
  }

  renderSearchUsers(usersPayload.users);
  renderInvites(invitesPayload.invites);
  renderChats();
  renderActiveChat();
}

els.togglePassword.addEventListener('click', () => {
  const isPwd = els.password.type === 'password';
  els.password.type = isPwd ? 'text' : 'password';
  els.togglePassword.textContent = isPwd ? 'Hide' : 'Show';
});

els.loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  els.loginError.textContent = '';

  try {
    const username = els.username.value.trim();
    const password = els.password.value;
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    state.me = username;
    els.meLabel.textContent = `Logged in as @${username}`;
    els.loginPanel.classList.add('hidden');
    els.chatPanel.classList.remove('hidden');
    await refreshAll();
  } catch (error) {
    els.loginError.textContent = error.message;
  }
});

els.userSearch.addEventListener('input', () => refreshAll());
els.refreshBtn.addEventListener('click', () => refreshAll());

els.searchResults.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-invite]');
  if (!button) return;

  try {
    await api('/api/invite', {
      method: 'POST',
      body: JSON.stringify({ from: state.me, to: button.dataset.invite }),
    });
    await refreshAll();
  } catch (error) {
    alert(error.message);
  }
});

els.invitesList.addEventListener('click', async (event) => {
  const accept = event.target.closest('button[data-accept]');
  const decline = event.target.closest('button[data-decline]');
  if (!accept && !decline) return;

  const inviteId = accept?.dataset.accept || decline?.dataset.decline;
  const accepted = Boolean(accept);

  await api('/api/invite/respond', {
    method: 'POST',
    body: JSON.stringify({ inviteId, accept: accepted }),
  });

  await refreshAll();
});

els.chatList.addEventListener('click', (event) => {
  const btn = event.target.closest('button[data-room]');
  if (!btn) return;
  state.activeRoom = btn.dataset.room;
  renderActiveChat();
});

els.messageForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const active = state.chats.find((c) => c.roomKey === state.activeRoom);
  if (!active) return;

  await api('/api/messages', {
    method: 'POST',
    body: JSON.stringify({ from: state.me, to: active.peer, text: els.messageInput.value }),
  });
  els.messageInput.value = '';
  await refreshAll();
});

// A tiny utility exposed for any admin panel extension.
window.maskPasswordPreview = maskPasswordPreview;
