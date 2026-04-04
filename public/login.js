async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const form = document.getElementById('loginForm');
const errorEl = document.getElementById('error');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    await api('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    localStorage.setItem('cryptochat_user', username);
    location.href = '/discover.html';
  } catch (error) {
    errorEl.textContent = error.message;
  }
});
