const me = (localStorage.getItem('cryptochat_user') || '').trim().toLowerCase();
if (!me) location.href = '/login.html';

const state = {
  activePeer: '',
  activePanel: 'chats',
  chats: [],
  invites: [],
  users: [],
  messages: [],
  cachedThreads: JSON.parse(localStorage.getItem('cryptochat_threads') || '{}'),
  typingCooldown: null,
  selectedFile: null,
  virtual: { rowHeight: 88, overscan: 8 },
  userScrolledUp: false,
  firstOpenDone: false,
  lastChatsSignature: ''
};

const el = {
  meLabel: document.getElementById('meLabel'),
  searchInput: document.getElementById('searchInput'),
  searchList: document.getElementById('searchList'),
  chatList: document.getElementById('chatList'),
  invitesList: document.getElementById('invitesList'),
  refreshBtn: document.getElementById('refreshBtn'),
  logoutBtn: document.getElementById('logoutBtn'),
  themeBtn: document.getElementById('themeBtn'),
  chatTitle: document.getElementById('chatTitle'),
  typingLabel: document.getElementById('typingLabel'),
  messagesViewport: document.getElementById('messagesViewport'),
  messagesInner: document.getElementById('messagesInner'),
  composerForm: document.getElementById('composerForm'),
  messageInput: document.getElementById('messageInput'),
  fileInput: document.getElementById('fileInput'),
  infoPanel: document.getElementById('infoPanel'),
  connectionBanner: document.getElementById('connectionBanner'),
  contextMenu: document.getElementById('contextMenu'),
  messageTemplate: document.getElementById('messageTemplate'),
  mobileBackBtn: document.getElementById('mobileBackBtn'),
  mobileNav: document.getElementById('mobileNav'),
  tabButtons: document.querySelectorAll('.tab-btn'),
  navButtons: document.querySelectorAll('.nav-btn'),
  panelMap: {
    chats: document.getElementById('chatsPanel'),
    search: document.getElementById('searchPanel'),
    invites: document.getElementById('invitesPanel')
  },
  plusBtn: document.getElementById('plusBtn'),
  uploadMenu: document.getElementById('uploadMenu'),
  uploadImageBtn: document.getElementById('uploadImageBtn')
};

el.meLabel.textContent = `@${me}`;
document.documentElement.dataset.theme = localStorage.getItem('cryptochat_theme') || 'dark';

function setConnectionBanner(isOnline) {
  el.connectionBanner.classList.toggle('hidden', isOnline);
}
window.addEventListener('online', () => setConnectionBanner(true));
window.addEventListener('offline', () => setConnectionBanner(false));
setConnectionBanner(navigator.onLine);


function isNearBottom() {
  const threshold = 60;
  const distance = el.messagesViewport.scrollHeight - el.messagesViewport.scrollTop - el.messagesViewport.clientHeight;
  return distance <= threshold;
}

function switchPanel(name) {
  state.activePanel = name;
  Object.entries(el.panelMap).forEach(([key, panel]) => panel.classList.toggle('active', key === name));
  el.tabButtons.forEach((button) => button.classList.toggle('active', button.dataset.panel === name));
  el.navButtons.forEach((button) => button.classList.toggle('active', button.dataset.panel === name));
}

function openConversationView() {
  if (window.innerWidth < 768) document.body.classList.add('conversation-open');
}

function closeConversationView() {
  document.body.classList.remove('conversation-open');
}

async function api(url, options = {}) {
  const response = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function cacheThread(peer, messages) {
  state.cachedThreads[peer] = messages.slice(-1500);
  localStorage.setItem('cryptochat_threads', JSON.stringify(state.cachedThreads));
}

function autoGrow() {
  el.messageInput.style.height = 'auto';
  el.messageInput.style.height = `${Math.min(el.messageInput.scrollHeight, 180)}px`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today - target) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

function bubbleKind(list, i) {
  const c = list[i];
  const p = list[i - 1];
  const n = list[i + 1];
  const samePrev = p && p.from === c.from && dayLabel(p.createdAt) === dayLabel(c.createdAt);
  const sameNext = n && n.from === c.from && dayLabel(n.createdAt) === dayLabel(c.createdAt);
  if (samePrev && sameNext) return 'middle';
  if (!samePrev && sameNext) return 'top';
  if (samePrev && !sameNext) return 'bottom';
  return 'single';
}

function stateLabel(status) {
  return ({ sending: 'Sending…', sent: 'Sent', delivered: 'Delivered', read: 'Read', failed: 'Failed' })[status] || 'Sent';
}

function colorForUser(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i += 1) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 60% 42%)`;
}

function renderUsers() {
  el.searchList.innerHTML = '';
  if (!state.users.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = el.searchInput.value.trim().length < 2 ? 'Type at least 2 characters.' : 'No users found.';
    el.searchList.append(li);
    return;
  }

  state.users.forEach((user) => {
    const li = document.createElement('li');
    li.className = 'row between';
    li.innerHTML = `<span>@${user.username}</span>`;
    const btn = document.createElement('button');
    btn.className = 'icon-btn accent';
    btn.dataset.invite = user.username;
    btn.type = 'button';
    btn.textContent = '+';
    li.append(btn);
    el.searchList.append(li);
  });
}

function renderChats() {
  const signature = JSON.stringify(state.chats.map((c) => [c.peer, c.preview, c.unreadCount, c.messageCount, c.updatedAt]));
  if (signature === state.lastChatsSignature) return;
  state.lastChatsSignature = signature;

  const preservedTop = el.chatList.scrollTop;
  el.chatList.innerHTML = '';
  if (!state.chats.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No active chats.';
    el.chatList.append(li);
    return;
  }

  state.chats.forEach((chat) => {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.className = `chat-row ${state.activePeer === chat.peer ? 'active' : ''}`;
    btn.type = 'button';
    btn.dataset.peer = chat.peer;

    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.style.backgroundColor = colorForUser(chat.peer);
    avatar.textContent = chat.peer[0].toUpperCase();

    const body = document.createElement('div');
    body.className = 'chat-row-body';
    body.innerHTML = `<div class="row between"><strong>@${chat.peer}</strong><small class="muted">${chat.unreadCount ? `${chat.unreadCount} unread` : `${chat.messageCount} msgs`}</small></div>`;
    const preview = document.createElement('p');
    preview.className = 'muted ellipsis';
    preview.textContent = chat.preview;
    body.append(preview);

    btn.append(avatar, body);
    li.append(btn);
    el.chatList.append(li);
  });
  el.chatList.scrollTop = preservedTop;
}

function renderInvites() {
  el.invitesList.innerHTML = '';
  if (!state.invites.length) {
    const li = document.createElement('li');
    li.className = 'muted';
    li.textContent = 'No pending invites.';
    el.invitesList.append(li);
    return;
  }

  state.invites.forEach((invite) => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>@${invite.from}</strong><p class="muted">wants to chat with you.</p>`;
    const row = document.createElement('div');
    row.className = 'row';
    const accept = document.createElement('button');
    accept.className = 'icon-btn accent';
    accept.dataset.accept = invite.id;
    accept.textContent = '✓';
    const decline = document.createElement('button');
    decline.className = 'icon-btn';
    decline.dataset.decline = invite.id;
    decline.textContent = '✕';
    row.append(accept, decline);
    li.append(row);
    el.invitesList.append(li);
  });
}

function showContextMenu(x, y, messageId) {
  el.contextMenu.classList.remove('hidden');
  el.contextMenu.style.left = `${x}px`;
  el.contextMenu.style.top = `${y}px`;
  el.contextMenu.dataset.messageId = messageId;
}

function hideContextMenu() {
  el.contextMenu.classList.add('hidden');
}

function renderMessages() {
  const list = state.messages;
  if (!state.activePeer) {
    el.messagesInner.innerHTML = '<p class="muted">Select a chat to start messaging.</p>';
    return;
  }

  if (!list.length) {
    el.messagesInner.innerHTML = '<p class="muted">No messages yet.</p>';
    return;
  }

  const viewportHeight = el.messagesViewport.clientHeight || 320;
  const scrollTop = el.messagesViewport.scrollTop;
  const visibleCount = Math.ceil(viewportHeight / state.virtual.rowHeight) + state.virtual.overscan;
  const start = Math.max(0, Math.floor(scrollTop / state.virtual.rowHeight) - state.virtual.overscan);
  const end = Math.min(list.length, start + visibleCount);

  el.messagesInner.innerHTML = '';
  const before = document.createElement('div');
  before.style.height = `${start * state.virtual.rowHeight}px`;
  el.messagesInner.append(before);

  let lastDay = '';
  for (let i = start; i < end; i += 1) {
    const message = list[i];
    const day = dayLabel(message.createdAt);
    if (day !== lastDay) {
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.textContent = day;
      el.messagesInner.append(sep);
      lastDay = day;
    }

    const bubble = el.messageTemplate.content.firstElementChild.cloneNode(true);
    bubble.classList.toggle('mine', message.from === me);
    bubble.dataset.kind = bubbleKind(list, i);
    bubble.dataset.status = message.status || 'sent';
    const meta = bubble.querySelector('.bubble-meta');
    meta.textContent = message.from === me ? '' : `@${message.from}`;
    meta.classList.toggle('hidden', message.from === me);
    bubble.querySelector('.bubble-state').textContent = message.from === me ? stateLabel(message.status || 'sent') : '';
    bubble.querySelector('.bubble-time').textContent = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const content = bubble.querySelector('.bubble-content');
    if (message.text) {
      const p = document.createElement('p');
      p.textContent = message.text;
      content.append(p);
    }

    if (message.attachment?.preview || message.attachment?.dataUrl) {
      const wrap = document.createElement('div');
      wrap.className = 'image-wrap';
      wrap.innerHTML = '<div class="image-placeholder"></div>';
      const img = document.createElement('img');
      img.className = 'image-preview';
      img.src = message.attachment.preview || message.attachment.dataUrl;
      img.alt = 'attachment preview';
      img.addEventListener('load', () => wrap.classList.add('loaded'));
      wrap.append(img);
      content.append(wrap);
    }

    bubble.oncontextmenu = (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, message.id || message.clientTempId);
    };

    let touchTimer;
    bubble.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      touchTimer = setTimeout(() => showContextMenu(t.clientX, t.clientY, message.id || message.clientTempId), 550);
    }, { passive: true });
    bubble.addEventListener('touchend', () => clearTimeout(touchTimer));

    el.messagesInner.append(bubble);
  }

  const after = document.createElement('div');
  after.style.height = `${(list.length - end) * state.virtual.rowHeight}px`;
  el.messagesInner.append(after);
}

function scrollToBottom() {
  requestAnimationFrame(() => {
    el.messagesViewport.scrollTop = el.messagesViewport.scrollHeight;
  });
}

function renderInfo() {
  if (!state.activePeer) {
    el.infoPanel.innerHTML = '<p class="muted">Pick a chat to view details and actions.</p>';
    return;
  }

  const mediaCount = state.messages.filter((m) => m.attachment).length;
  el.infoPanel.innerHTML = `
    <p><strong>@${state.activePeer}</strong></p>
    <p class="muted">Messages: ${state.messages.length}</p>
    <p class="muted">Media: ${mediaCount}</p>
    <p class="muted">Typing indicator auto-hides after 3s.</p>
  `;
}

async function loadUsers() {
  const query = el.searchInput.value.trim();
  if (query.length < 2) {
    state.users = [];
    renderUsers();
    return;
  }

  const data = await api(`/api/users?me=${encodeURIComponent(me)}&query=${encodeURIComponent(query)}`);
  state.users = data.users;
  renderUsers();
}

async function loadInvites() {
  const data = await api(`/api/invites/${encodeURIComponent(me)}`);
  state.invites = data.invites;
  renderInvites();
}

async function loadChats() {
  const data = await api(`/api/chats/${encodeURIComponent(me)}`);
  state.chats = data.chats;
  renderChats();

  if (!state.activePeer && state.chats.length) {
    state.activePeer = state.chats[0].peer;
    await loadMessages();
  }
}

async function loadMessages({ forceScroll = false } = {}) {
  if (!state.activePeer) return;
  const wasNearBottom = isNearBottom();
  try {
    const data = await api(`/api/messages?me=${encodeURIComponent(me)}&peer=${encodeURIComponent(state.activePeer)}`);
    state.messages = data.messages;
    cacheThread(state.activePeer, state.messages);
  } catch {
    state.messages = state.cachedThreads[state.activePeer] || [];
  }

  el.chatTitle.textContent = `@${state.activePeer}`;
  renderMessages();
  renderInfo();
  const shouldAutoScroll = forceScroll || (!state.userScrolledUp && (wasNearBottom || !state.firstOpenDone));
  if (shouldAutoScroll) scrollToBottom();
  state.firstOpenDone = true;
  await api('/api/messages/read', { method: 'POST', body: JSON.stringify({ me, peer: state.activePeer }) }).catch(() => {});
}

async function refreshTyping() {
  if (!state.activePeer) return;
  const data = await api(`/api/typing?from=${encodeURIComponent(state.activePeer)}&to=${encodeURIComponent(me)}`).catch(() => ({ typing: false }));
  el.typingLabel.textContent = data.typing ? `${state.activePeer} is typing…` : '';
}

async function sendTyping() {
  if (!state.activePeer) return;
  if (state.typingCooldown) clearTimeout(state.typingCooldown);
  await api('/api/typing', { method: 'POST', body: JSON.stringify({ from: me, to: state.activePeer }) }).catch(() => {});
  state.typingCooldown = setTimeout(() => { state.typingCooldown = null; }, 3000);
}

function optimisticMessage(text, attachment) {
  const clientTempId = `tmp-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}`;
  const message = {
    id: clientTempId,
    clientTempId,
    from: me,
    to: state.activePeer,
    text,
    attachment,
    status: 'sending',
    createdAt: new Date().toISOString()
  };

  state.messages.push(message);
  cacheThread(state.activePeer, state.messages);
  renderMessages();
  state.userScrolledUp = false;
  scrollToBottom();
  return message;
}

function attachmentPayload(file) {
  return new Promise((resolve) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve({ filename: file.name, mime: file.type, dataUrl: reader.result, preview: reader.result });
    reader.readAsDataURL(file);
  });
}

el.searchInput.addEventListener('input', () => loadUsers().catch(() => {}));
el.refreshBtn.addEventListener('click', () => Promise.all([loadInvites(), loadChats(), loadUsers()]));
el.messagesViewport.addEventListener('scroll', () => {
  state.userScrolledUp = !isNearBottom();
  renderMessages();
});

el.searchList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-invite]');
  if (!button) return;
  await api('/api/invite', { method: 'POST', body: JSON.stringify({ from: me, to: button.dataset.invite }) });
  await loadInvites();
});

el.invitesList.addEventListener('click', async (event) => {
  const accept = event.target.closest('button[data-accept]');
  const decline = event.target.closest('button[data-decline]');
  if (!accept && !decline) return;

  await api('/api/invite/respond', {
    method: 'POST',
    body: JSON.stringify({ inviteId: accept?.dataset.accept || decline?.dataset.decline, accept: Boolean(accept) })
  });
  await loadInvites();
  await loadChats();
});

el.chatList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-peer]');
  if (!button) return;
  state.activePeer = button.dataset.peer;
  renderChats();
  state.userScrolledUp = false;
  await loadMessages({ forceScroll: true });
  openConversationView();
});

el.messageInput.addEventListener('input', () => {
  autoGrow();
  sendTyping();
});

el.plusBtn.addEventListener('click', () => {
  el.uploadMenu.classList.toggle('hidden');
});

el.uploadImageBtn.addEventListener('click', () => {
  el.uploadMenu.classList.add('hidden');
  el.fileInput.click();
});

el.fileInput.addEventListener('change', () => {
  state.selectedFile = el.fileInput.files?.[0] || null;
});

el.composerForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!state.activePeer) return;

  const text = el.messageInput.value.trim();
  const attachment = await attachmentPayload(state.selectedFile);
  if (!text && !attachment) return;

  const optimistic = optimisticMessage(text, attachment);
  el.messageInput.value = '';
  autoGrow();
  state.selectedFile = null;
  el.fileInput.value = '';

  try {
    const data = await api('/api/messages', {
      method: 'POST',
      body: JSON.stringify({ from: me, to: state.activePeer, text, attachment, clientTempId: optimistic.clientTempId })
    });
    const idx = state.messages.findIndex((m) => m.clientTempId === optimistic.clientTempId);
    if (idx !== -1) state.messages[idx] = data.message;
    cacheThread(state.activePeer, state.messages);
    renderMessages();
    await loadChats();
  } catch {
    optimistic.status = 'failed';
    renderMessages();
  }
});

el.contextMenu.addEventListener('click', (event) => {
  const action = event.target.closest('button[data-action]')?.dataset.action;
  if (!action) return;
  const row = state.messages.find((m) => m.id === el.contextMenu.dataset.messageId || m.clientTempId === el.contextMenu.dataset.messageId);
  hideContextMenu();
  if (!row) return;

  if (action === 'reply') el.messageInput.value = `↪ ${row.text || 'media'}\n`;
  if (action === 'forward') el.messageInput.value = `FWD: ${row.text || '[media]'}\n`;
  if (action === 'edit' && row.from === me) el.messageInput.value = row.text || '';
  autoGrow();
  el.messageInput.focus();
});

document.addEventListener('click', (event) => {
  if (!event.target.closest('.context-menu') && !event.target.closest('#plusBtn') && !event.target.closest('#uploadMenu')) {
    hideContextMenu();
    el.uploadMenu.classList.add('hidden');
  }
});

el.mobileBackBtn.addEventListener('click', () => {
  closeConversationView();
});

el.tabButtons.forEach((button) => {
  button.addEventListener('click', () => switchPanel(button.dataset.panel));
});

el.navButtons.forEach((button) => {
  button.addEventListener('click', () => {
    switchPanel(button.dataset.panel);
    closeConversationView();
  });
});

el.logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('cryptochat_user');
  location.href = '/login.html';
});

el.themeBtn.addEventListener('click', () => {
  const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  localStorage.setItem('cryptochat_theme', next);
});

(async () => {
  switchPanel('chats');
  await Promise.all([loadChats(), loadInvites()]);
  await loadUsers();
  if (state.activePeer) await loadMessages();
  renderInfo();
})();

setInterval(() => {
  Promise.all([loadChats(), loadInvites()]).catch(() => {});
  if (state.activePeer) {
    loadMessages({ forceScroll: false }).catch(() => {});
    refreshTyping().catch(() => {});
  }
}, 3000);
