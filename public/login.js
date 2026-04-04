const form = document.getElementById('authForm');
const tabLogin = document.getElementById('tabLogin');
const tabSignup = document.getElementById('tabSignup');
const submitBtn = document.getElementById('submitAuth');
const errorEl = document.getElementById('authError');

const state = { mode: 'login' };

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function setMode(mode) {
  state.mode = mode;
  const signup = mode === 'signup';
  submitBtn.textContent = signup ? 'Create account' : 'Sign in';
  tabSignup.classList.toggle('active', signup);
  tabLogin.classList.toggle('active', !signup);
  tabSignup.setAttribute('aria-selected', signup ? 'true' : 'false');
  tabLogin.setAttribute('aria-selected', signup ? 'false' : 'true');
  errorEl.textContent = '';
}

tabLogin.addEventListener('click', () => setMode('login'));
tabSignup.addEventListener('click', () => setMode('signup'));

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorEl.textContent = '';

  const username = document.getElementById('username').value.trim().toLowerCase();
  const password = document.getElementById('password').value;

  if (!/^[a-z0-9_]{3,20}$/.test(username)) {
    errorEl.textContent = 'Use 3-20 chars: lowercase letters, numbers, underscore.';
    return;
  }

  if (password.length < 8) {
    errorEl.textContent = 'Password must be at least 8 characters.';
    return;
  }

  try {
    const endpoint = state.mode === 'signup' ? '/api/signup' : '/api/login';
    const data = await api(endpoint, {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });

    localStorage.setItem('cryptochat_user', data.user.username);
    localStorage.setItem('cryptochat_theme', localStorage.getItem('cryptochat_theme') || 'dark');
    location.href = '/chat.html';
  } catch (error) {
    errorEl.textContent = error.message;
  }
});
