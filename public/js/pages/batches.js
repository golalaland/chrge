import { requireAdmin, signOut } from '../services/auth-guard.js';
import { renderShell, showToast } from '../services/shell.js';
import { functions, db } from '../services/firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const { user } = await requireAdmin();

const app = document.getElementById('app');
app.innerHTML = renderShell('batches', renderContent(), { email: user.email });
document.getElementById('signOutBtn').addEventListener('click', signOut);

function renderContent() {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Batches</div>
        <div class="page-subtitle">Each batch generates a set of unique, cryptographically secure authentication codes.</div>
      </div>
      <button id="newBatchBtn" class="btn btn-primary">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New batch
      </button>
    </div>
    <div id="batchesTableWrap" class="table-wrap">
      <div style="padding:3rem; text-align:center; color:var(--paper-faint);"><span class="spinner"></span></div>
    </div>
  `;
}

function fmtDate(ts) {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return '—'; }
}

function statusBadge(status) {
  const map = {
    ready: 'badge-success',
    generating: 'badge-warning',
    generation_failed: 'badge-danger'
  };
  return `<span class="badge ${map[status] || 'badge-neutral'}">${(status || 'unknown').replace('_', ' ')}</span>`;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

let productsCache = [];

async function loadProductsForSelect() {
  const snap = await getDocs(query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(200)));
  productsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return productsCache;
}

async function loadBatches() {
  const wrap = document.getElementById('batchesTableWrap');
  try {
    const snap = await getDocs(query(collection(db, 'batches'), orderBy('createdAt', 'desc'), limit(200)));
    const batches = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (batches.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
          <div style="font-family:var(--font-display); font-weight:600; margin-bottom:0.3rem;">No batches yet</div>
          <div style="font-size:0.85rem;">Create a batch to generate your first set of authentication codes.</div>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr><th>Batch</th><th>Quantity</th><th>Codes generated</th><th>Status</th><th>Created</th></tr>
        </thead>
        <tbody>
          ${batches.map(b => `
            <tr>
              <td class="mono">${escapeHtml(b.batchNumber)}</td>
              <td>${new Intl.NumberFormat().format(b.quantity || 0)}</td>
              <td>${new Intl.NumberFormat().format(b.codesGenerated || 0)}</td>
              <td>${statusBadge(b.status)}</td>
              <td style="color:var(--paper-faint); font-size:0.8rem;">${fmtDate(b.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Failed to load batches:', err);
    wrap.innerHTML = `
      <div class="empty-state">
        <div style="color:#ffb3b3; font-family:var(--font-display); font-weight:600; margin-bottom:0.3rem;">Couldn't load batches</div>
        <div style="font-size:0.85rem;">${err.message || err}</div>
      </div>
    `;
  }
}

async function openNewBatchModal() {
  const products = await loadProductsForSelect();

  if (products.length === 0) {
    showToast('Create a product first — batches need a product to belong to.', 'error');
    return;
  }

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">New batch</div>
        <button id="closeModalBtn" style="background:none;border:none;color:var(--paper-faint);cursor:pointer;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="batchForm">
        <div class="form-group">
          <label class="form-label">Batch number *</label>
          <input type="text" id="batchNumber" class="form-input" placeholder="CHRGE10000-2026-07-A" required>
          <div class="form-hint">A human-readable identifier for this production run.</div>
        </div>
        <div class="form-group">
          <label class="form-label">Product *</label>
          <select id="productID" class="form-select" required>
            <option value="">Select a product...</option>
            ${products.map(p => `<option value="${p.id}">${escapeHtml(p.productName)} (${escapeHtml(p.sku)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Quantity *</label>
          <input type="number" id="quantity" class="form-input" placeholder="5000" min="1" max="20000" required>
          <div class="form-hint">Max 20,000 per batch. Generates that many unique, collision-checked codes.</div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Factory</label>
            <input type="text" id="factory" class="form-input" placeholder="Shenzhen Facility 3">
          </div>
          <div class="form-group">
            <label class="form-label">Notes</label>
            <input type="text" id="notes" class="form-input" placeholder="Optional">
          </div>
        </div>
        <div id="modalError" style="display:none; color:#ffb3b3; font-size:0.83rem; margin-bottom:1rem;"></div>
        <div id="modalProgress" style="display:none; color:var(--paper-dim); font-size:0.83rem; margin-bottom:1rem;"></div>
        <button type="submit" id="submitBatchBtn" class="btn btn-primary" style="width:100%; justify-content:center;">
          Generate batch
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('batchForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('modalError');
    const progressEl = document.getElementById('modalProgress');
    const submitBtn = document.getElementById('submitBatchBtn');
    errorEl.style.display = 'none';

    const quantity = parseInt(document.getElementById('quantity').value, 10);
    const payload = {
      batchNumber: document.getElementById('batchNumber').value.trim(),
      productID: document.getElementById('productID').value,
      quantity,
      factory: document.getElementById('factory').value.trim(),
      notes: document.getElementById('notes').value.trim()
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Generating codes...';
    progressEl.style.display = 'block';
    progressEl.textContent = quantity > 500
      ? `Generating ${quantity.toLocaleString()} cryptographically secure codes — this may take a moment for large batches.`
      : `Generating ${quantity.toLocaleString()} codes...`;

    try {
      const createBatch = httpsCallable(functions, 'createBatch');
      const result = await createBatch(payload);
      overlay.remove();
      showToast(`Batch created: ${result.data.codesGenerated.toLocaleString()} codes generated.`);
      loadBatches();
    } catch (err) {
      console.error('Create batch failed:', err);
      errorEl.textContent = err.message || 'Failed to create batch.';
      errorEl.style.display = 'block';
      progressEl.style.display = 'none';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Generate batch';
    }
  });
}

document.getElementById('newBatchBtn').addEventListener('click', openNewBatchModal);
loadBatches();
