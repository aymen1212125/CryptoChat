const me = localStorage.getItem('cryptochat_user');
if (!me) location.href = '/login.html';

document.getElementById('meLabel').textContent = `Logged in as @${me}`;

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function item(html) {
  const li = document.createElement('li');
  li.innerHTML = html;
  return li;
}

async function loadChats() {
  const { chats } = await api(`/api/chats/${encodeURIComponent(me)}`);
  const list = document.getElementById('chatList');
  list.innerHTML = '';

  if (!chats.length) {
    list.appendChild(item('No active chats yet.'));
    return;
  }

  chats.forEach((chat) => {
    list.appendChild(item(`
      <div class="row between">
        <div><strong>@${chat.peer}</strong><br><small>${chat.preview}</small></div>
        <button class="secondary" data-chat="${chat.peer}">Open</button>
      </div>
    `));
  });
}

async function loadInvites() {
  const { invites } = await api(`/api/invites/${encodeURIComponent(me)}`);
  const list = document.getElementById('invitesList');
  list.innerHTML = '';

  if (!invites.length) {
    list.appendChild(item('No pending invites.'));
    return;
  }

  invites.forEach((invite) => {
    list.appendChild(item(`
      <div>@${invite.from} invited you</div>
      <div class="row">
        <button data-accept="${invite.id}">Accept</button>
        <button class="secondary" data-decline="${invite.id}">Decline</button>
      </div>
    `));
  });
}

async function searchUsers() {
  const query = document.getElementById('searchInput').value.trim();
  const list = document.getElementById('searchList');
  list.innerHTML = '';

  if (query.length < 2) {
    list.appendChild(item('Start typing at least 2 letters to search users.'));
    return;
  }

  const { users } = await api(`/api/users?me=${encodeURIComponent(me)}&query=${encodeURIComponent(query)}`);

  if (!users.length) {
    list.appendChild(item('No matching users found.'));
    return;
  }

  users.forEach((user) => {
    list.appendChild(item(`
      <div class="row between">
        <span>@${user.username}</span>
        <button data-invite="${user.username}">Invite</button>
      </div>
    `));
  });
}

document.getElementById('searchInput').addEventListener('input', () => {
  searchUsers().catch((error) => alert(error.message));
});

document.getElementById('searchList').addEventListener('click', async (event) => {
  const inviteBtn = event.target.closest('button[data-invite]');
  if (!inviteBtn) return;

  try {
    await api('/api/invite', {
      method: 'POST',
      body: JSON.stringify({ from: me, to: inviteBtn.dataset.invite })
    });
    alert(`Invite sent to @${inviteBtn.dataset.invite}`);
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('invitesList').addEventListener('click', async (event) => {
  const acceptBtn = event.target.closest('button[data-accept]');
  const declineBtn = event.target.closest('button[data-decline]');
  if (!acceptBtn && !declineBtn) return;

  const inviteId = acceptBtn?.dataset.accept || declineBtn?.dataset.decline;
  const accept = Boolean(acceptBtn);

  await api('/api/invite/respond', {
    method: 'POST',
    body: JSON.stringify({ inviteId, accept })
  });

  await loadInvites();
  await loadChats();
});

document.getElementById('chatList').addEventListener('click', (event) => {
  const chatBtn = event.target.closest('button[data-chat]');
  if (!chatBtn) return;
  location.href = `/chat.html?peer=${encodeURIComponent(chatBtn.dataset.chat)}`;
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  await loadInvites();
  await loadChats();
});

document.getElementById('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem('cryptochat_user');
  location.href = '/login.html';
});

searchUsers().catch(() => {});
loadInvites().catch((error) => alert(error.message));
loadChats().catch((error) => alert(error.message));
