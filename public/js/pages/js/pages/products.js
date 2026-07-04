import { requireAdmin, signOut } from '../services/auth-guard.js';
import { renderShell, showToast } from '../services/shell.js';
import { functions, db } from '../services/firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const { user } = await requireAdmin();

const app = document.getElementById('app');
app.innerHTML = renderShell('products', renderContent(), { email: user.email });
document.getElementById('signOutBtn').addEventListener('click', signOut);

function renderContent() {
  return `
    <div class="page-header">
      <div>
        <div class="page-title">Products</div>
        <div class="page-subtitle">The catalog of items you'll generate authentication codes for.</div>
      </div>
      <button id="newProductBtn" class="btn btn-primary">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        New product
      </button>
    </div>
    <div id="productsTableWrap" class="table-wrap">
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

async function loadProducts() {
  const wrap = document.getElementById('productsTableWrap');
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    const products = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (products.length === 0) {
      wrap.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          <div style="font-family:var(--font-display); font-weight:600; margin-bottom:0.3rem;">No products yet</div>
          <div style="font-size:0.85rem;">Create your first product to start generating authentication batches.</div>
        </div>
      `;
      return;
    }

    wrap.innerHTML = `
      <table>
        <thead>
          <tr><th>Product</th><th>SKU</th><th>Brand</th><th>Color</th><th>Capacity</th><th>Created</th></tr>
        </thead>
        <tbody>
          ${products.map(p => `
            <tr>
              <td style="font-weight:500;">${escapeHtml(p.productName)}</td>
              <td class="mono">${escapeHtml(p.sku)}</td>
              <td style="color:var(--paper-dim);">${escapeHtml(p.brand)}</td>
              <td style="color:var(--paper-dim);">${escapeHtml(p.color || '—')}</td>
              <td style="color:var(--paper-dim);">${escapeHtml(p.capacity || '—')}</td>
              <td style="color:var(--paper-faint); font-size:0.8rem;">${fmtDate(p.createdAt)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  } catch (err) {
    console.error('Failed to load products:', err);
    wrap.innerHTML = `
      <div class="empty-state">
        <div style="color:#ffb3b3; font-family:var(--font-display); font-weight:600; margin-bottom:0.3rem;">Couldn't load products</div>
        <div style="font-size:0.85rem;">${err.message || err}</div>
      </div>
    `;
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function openNewProductModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <div class="modal-title">New product</div>
        <button id="closeModalBtn" style="background:none;border:none;color:var(--paper-faint);cursor:pointer;">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <form id="productForm">
        <div class="form-group">
          <label class="form-label">Product name *</label>
          <input type="text" id="productName" class="form-input" placeholder="CHRGE+ 10000mAh Power Bank" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">SKU *</label>
            <input type="text" id="sku" class="form-input" placeholder="CHRGE-PB-10K" required>
          </div>
          <div class="form-group">
            <label class="form-label">Brand *</label>
            <input type="text" id="brand" class="form-input" placeholder="CHRGE+" required>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Color</label>
            <input type="text" id="color" class="form-input" placeholder="Void Black">
          </div>
          <div class="form-group">
            <label class="form-label">Capacity</label>
            <input type="text" id="capacity" class="form-input" placeholder="10000mAh">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Description</label>
          <textarea id="description" class="form-textarea" placeholder="Optional product description"></textarea>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Manufacturing date</label>
            <input type="date" id="manufacturingDate" class="form-input">
          </div>
          <div class="form-group">
            <label class="form-label">Expiration (optional)</label>
            <input type="date" id="expirationDate" class="form-input">
          </div>
        </div>
        <div id="modalError" style="display:none; color:#ffb3b3; font-size:0.83rem; margin-bottom:1rem;"></div>
        <button type="submit" id="submitProductBtn" class="btn btn-primary" style="width:100%; justify-content:center;">
          Create product
        </button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('closeModalBtn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  document.getElementById('productForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById('modalError');
    const submitBtn = document.getElementById('submitProductBtn');
    errorEl.style.display = 'none';

    const payload = {
      productName: document.getElementById('productName').value.trim(),
      sku: document.getElementById('sku').value.trim(),
      brand: document.getElementById('brand').value.trim(),
      color: document.getElementById('color').value.trim(),
      capacity: document.getElementById('capacity').value.trim(),
      description: document.getElementById('description').value.trim(),
      manufacturingDate: document.getElementById('manufacturingDate').value || null,
      expirationDate: document.getElementById('expirationDate').value || null
    };

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Creating...';

    try {
      const createProduct = httpsCallable(functions, 'createProduct');
      await createProduct(payload);
      overlay.remove();
      showToast('Product created.');
      loadProducts();
    } catch (err) {
      console.error('Create product failed:', err);
      errorEl.textContent = err.message || 'Failed to create product.';
      errorEl.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create product';
    }
  });
}

document.getElementById('newProductBtn').addEventListener('click', openNewProductModal);
loadProducts();
