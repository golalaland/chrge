import { requireAdmin, signOut } from '../services/auth-guard.js';
import { renderShell, showToast } from '../services/shell.js';
import { functions, db } from '../services/firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';
import { collection, query, orderBy, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const { user, claims } = await requireAdmin();

const app = document.getElementById('app');
app.innerHTML = renderShell('settings', renderContent(), { email: user.email });
document.getElementById('signOutBtn').addEventListener('click', signOut);

function renderContent() {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Settings</div>
        <div class="page-subtitle">Manage admin access to this dashboard.</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.5rem;">
      <div style="font-family:var(--font-display); font-weight:600; margin-bottom:1rem;">Grant admin access</div>
      <div style="color:var(--paper-dim); font-size:0.85rem; margin-bottom:1.2rem; line-height:1.55;">
        The person must already have a Firebase Authentication account (create one in the Firebase Console → Authentication → Add User, or have them sign up if you build a public sign-up flow later). This grants them admin rights on the account that already exists for that email.
      </div>
      <form id="provisionForm" style="display:flex; gap:0.7rem; align-items:flex-end; flex-wrap:wrap;">
        <div class="form-group" style="flex:1; min-width:220px; margin-bottom:0;">
          <label class="form-label">Email</label>
          <input type="email" id="provisionEmail" class="form-input" placeholder="teammate@chrgeplus.com" required>
        </div>
        <button type="submit" id="provisionBtn" class="btn btn-primary">Grant admin</button>
      </form>
      <div id="provisionError" style="display:none; color:#ffb3b3; font-size:0.83rem; margin-top:0.8rem;"></div>
    </div>

    <div id="adminsTableWrap" class="table-wrap">
      <div style="padding:3rem; text-align:center; color:var(--paper-faint);"><span class="spinner"></span></div>
    </div>
  `;
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return '—'; }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

async function loadAdmins() {
  const wrap = document.getElementById('adminsTableWrap');
  try {
    const snap = await getDocs(query(collection(db, 'admins'), orderBy('grantedAt', 'desc')));
    const admins = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    wrap.innerHTML = `
      <table>
        <thead><tr><th>Email</th><th>Status</th><th>Granted</th></tr></thead>
        <tbody>
          ${admins.map(a => `
            <tr>
              <td>${escapeHtml(a.email)} ${a.uid === user.uid ? '<span class="badge badge-neutral" style="margin-left:0.5rem;">you</span>' : ''}</td>
              <td><span class="badge ${a.active ? 'badge-success' : 'badge-neutral'}">${a.active ? 'active' : 'revoked'}</span></td>
              <td style="color:var(--paper-faint); font-size:0.8rem;">${fmtDate(a.grantedAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Failed to load admins:', err);
    wrap.innerHTML = `<div class="empty-state">Couldn't load admin list: ${err.message || err}</div>`;
  }
}

document.getElementById('provisionForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const errorEl = document.getElementById('provisionError');
  const btn = document.getElementById('provisionBtn');
  const email = document.getElementById('provisionEmail').value.trim();
  errorEl.style.display = 'none';

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const provisionAdmin = httpsCallable(functions, 'provisionAdmin');
    await provisionAdmin({ email });
    showToast(`Admin access granted to ${email}.`);
    document.getElementById('provisionEmail').value = '';
    loadAdmins();
  } catch (err) {
    console.error('Provision failed:', err);
    errorEl.textContent = err.message || 'Failed to grant admin access. Make sure this email has an existing Firebase Auth account.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.textContent = 'Grant admin';
  }
});

loadAdmins();
