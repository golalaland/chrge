import { requireAdmin, signOut } from '../services/auth-guard.js';
import { renderShell, showToast } from '../services/shell.js';
import { functions } from '../services/firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const { user, claims } = await requireAdmin();

const app = document.getElementById('app');
app.innerHTML = renderShell('dashboard', renderLoadingContent(), { email: user.email });
document.getElementById('signOutBtn').addEventListener('click', signOut);

function renderLoadingContent() {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Overview</div>
        <div class="page-subtitle">Loading dashboard...</div>
      </div>
    </div>
  `;
}

function fmtNumber(n) {
  return new Intl.NumberFormat('en-US').format(n || 0);
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts._seconds ? new Date(ts._seconds * 1000) : (ts.toDate ? ts.toDate() : new Date(ts));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '—';
  }
}

function statusBadge(status) {
  const map = {
    active: 'badge-success',
    ready: 'badge-success',
    generating: 'badge-warning',
    disabled: 'badge-neutral',
    blacklisted: 'badge-danger',
    generation_failed: 'badge-danger'
  };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${(status || 'unknown').replace('_', ' ')}</span>`;
}

async function loadDashboard() {
  try {
    const getDashboardStats = httpsCallable(functions, 'getDashboardStats');
    const result = await getDashboardStats();
    renderDashboard(result.data);
  } catch (err) {
    console.error('Dashboard load failed:', err);
    renderError(err);
  }
}

function renderError(err) {
  const content = document.querySelector('.main-content');
  const isNotFound = err.code === 'functions/not-found' || err.code === 'not-found';
  content.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Overview</div>
      </div>
    </div>
    <div class="card" style="border-color: rgba(255,92,92,0.3);">
      <div style="font-family: var(--font-display); font-weight: 600; margin-bottom: 0.5rem; color: #ffb3b3;">
        Couldn't load dashboard stats
      </div>
      <div style="color: var(--paper-dim); font-size: 0.88rem; line-height: 1.6;">
        ${isNotFound
          ? "The <code style='color:var(--accent)'>getDashboardStats</code> Cloud Function isn't deployed yet. Run <code style='color:var(--accent)'>firebase deploy --only functions</code> from the project root, and make sure your Firebase config in <code style='color:var(--accent)'>firebase-config.js</code> points to the right project."
          : `Something went wrong talking to the backend: ${err.message || err}`}
      </div>
    </div>
  `;
}

function renderDashboard(stats) {
  const content = document.querySelector('.main-content');
  content.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Overview</div>
        <div class="page-subtitle">Signed in as ${claims.email || user.email}</div>
      </div>
      <button id="refreshBtn" class="btn btn-secondary">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        Refresh
      </button>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-card-label">Total Codes Generated</div>
        <div class="stat-card-value">${fmtNumber(stats.totalCodesGenerated)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Stickers Printed</div>
        <div class="stat-card-value">${fmtNumber(stats.totalStickersPrinted)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Total Verified</div>
        <div class="stat-card-value accent">${fmtNumber(stats.totalVerified)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Remaining Unused</div>
        <div class="stat-card-value">${fmtNumber(stats.remainingUnused)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Counterfeit Alerts</div>
        <div class="stat-card-value ${stats.counterfeitAlerts > 0 ? 'danger' : ''}">${fmtNumber(stats.counterfeitAlerts)}</div>
        <div class="stat-card-sub">last 30 days</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Products</div>
        <div class="stat-card-value">${fmtNumber(stats.totalProducts)}</div>
      </div>
    </div>

    <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap: 1.5rem;" class="dash-grid">
      <div>
        <div style="font-family:var(--font-display); font-weight:600; font-size:0.95rem; margin-bottom:0.9rem;">Recent Batches</div>
        <div class="table-wrap">
          ${stats.recentBatches && stats.recentBatches.length > 0 ? `
            <table>
              <thead><tr><th>Batch</th><th>Quantity</th><th>Status</th><th>Created</th></tr></thead>
              <tbody>
                ${stats.recentBatches.map(b => `
                  <tr>
                    <td class="mono">${b.batchNumber || '—'}</td>
                    <td>${fmtNumber(b.quantity)}</td>
                    <td>${statusBadge(b.status)}</td>
                    <td style="color:var(--paper-faint);">${fmtDate(b.createdAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<div class="empty-state">No batches yet. Create your first batch to generate codes.</div>`}
        </div>
      </div>

      <div>
        <div style="font-family:var(--font-display); font-weight:600; font-size:0.95rem; margin-bottom:0.9rem;">Recent Scans</div>
        <div class="table-wrap">
          ${stats.recentScans && stats.recentScans.length > 0 ? `
            <table>
              <thead><tr><th>Code</th><th>Location</th><th>Time</th></tr></thead>
              <tbody>
                ${stats.recentScans.map(s => `
                  <tr>
                    <td class="mono">${(s.publicCode || s.secureID || '—').toString().slice(0, 12)}</td>
                    <td style="color:var(--paper-faint);">${s.location || s.country || '—'}</td>
                    <td style="color:var(--paper-faint);">${fmtDate(s.scannedAt)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : `<div class="empty-state">No scans recorded yet.</div>`}
        </div>
      </div>
    </div>

    <style>
      @media (max-width: 1100px) { .dash-grid { grid-template-columns: 1fr !important; } }
    </style>
  `;

  document.getElementById('refreshBtn').addEventListener('click', () => {
    content.innerHTML = renderLoadingContent();
    loadDashboard();
  });
}

loadDashboard();
