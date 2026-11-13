/* =============================================
   API Helper — all fetch calls go here
   ============================================= */

// Auto-detect: same origin in production, localhost in dev
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api'
  : '/api';

function getToken() {
  return localStorage.getItem('challan_token');
}

function getOfficer() {
  const d = localStorage.getItem('challan_officer');
  return d ? JSON.parse(d) : null;
}

async function apiFetch(endpoint, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 || res.status === 403) {
    // Token expired — redirect to login
    localStorage.removeItem('challan_token');
    localStorage.removeItem('challan_officer');
    if (!window.location.href.includes('login')) window.location.href = '/';
  }

  return { ok: res.ok, status: res.status, data };
}

// Convenience methods
const api = {
  get:    (url)         => apiFetch(url, { method: 'GET' }),
  post:   (url, body)   => apiFetch(url, { method: 'POST',  body: JSON.stringify(body) }),
  patch:  (url, body)   => apiFetch(url, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (url)         => apiFetch(url, { method: 'DELETE' }),
};

// Auth guard — call on every protected page
function requireAuth() {
  if (!getToken()) {
    window.location.href = '/';
    return false;
  }
  return true;
}

// Show toast notification
function showToast(msg, type = 'success') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position:fixed; bottom:1.5rem; right:1.5rem;
      display:flex; flex-direction:column; gap:.5rem; z-index:9999;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  const colors = { success: '#065f46,#d1fae5', error: '#991b1b,#fee2e2', warning: '#92400e,#fef3c7', info: '#0c4a6e,#e0f2fe' };
  const [clr, bg] = (colors[type] || colors.info).split(',');
  toast.style.cssText = `
    background:${bg}; color:${clr};
    padding:.7rem 1.1rem; border-radius:8px;
    font-size:.88rem; font-weight:500;
    box-shadow:0 4px 12px rgba(0,0,0,.15);
    max-width:320px; animation: fadeIn .2s ease;
  `;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Format currency
function formatCurrency(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
}

// Format date
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// Status badge HTML
function statusBadge(s) {
  const map = { Pending:'badge-pending', Paid:'badge-paid', Disputed:'badge-disputed', Cancelled:'badge-cancelled', Waived:'badge-waived' };
  return `<span class="badge ${map[s]||'badge-pending'}">${s}</span>`;
}

function severityBadge(s) {
  const map = { Minor:'badge-minor', Moderate:'badge-moderate', Major:'badge-major', Critical:'badge-critical' };
  return `<span class="badge ${map[s]||''}">${s}</span>`;
}

// Populate officer info in sidebar
function renderSidebarOfficer() {
  const o = getOfficer();
  if (!o) return;
  const el = document.getElementById('sidebar-officer');
  if (el) el.innerHTML = `
    <div class="name">${o.full_name}</div>
    <div class="badge">${o.badge_number} · ${o.rank}</div>
  `;
}

// Logout
function logout() {
  localStorage.removeItem('challan_token');
  localStorage.removeItem('challan_officer');
  window.location.href = '/';
}

// Highlight active nav link
function setActiveNav(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}
