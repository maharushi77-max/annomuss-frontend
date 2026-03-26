// frontend/api.js — include this in every HTML page
const API_BASE = 'http://localhost:5000'; // change to your backend port

async function apiFetch(endpoint, options = {}) {
  const token = localStorage.getItem('token');
  
  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    }
  });

  // If 401 — token expired or missing, redirect to login
  if (res.status === 401) {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
    return null;
  }

  return res;
}