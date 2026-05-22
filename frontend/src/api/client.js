const API_BASE_URL = 'http://localhost:8000';

function getAccessToken() {
  return localStorage.getItem('token');
}

function authHeaders() {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  return res;
}

export { API_BASE_URL, apiFetch, authHeaders, getAccessToken };
