import { functions } from '../services/firebase-config.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-functions.js';

const card = document.getElementById('verifyCard');
const verifyCode = httpsCallable(functions, 'verifyCode');

// A QR code should link to: https://your-domain/v/<secureID>
// (per firebase.json's rewrite, /v/:code serves this same verify.html)
// This also supports ?c=<code> as a fallback/manual-share format.
const params = new URLSearchParams(window.location.search);
const pathMatch = window.location.pathname.match(/^\/v\/(.+)$/);
const codeFromURL = params.get('c') || (pathMatch ? decodeURIComponent(pathMatch[1]) : null);

function fmtDate(ts) {
  if (!ts) return 'Unknown date';
  try {
    // Firestore Timestamps serialize over the callable-functions
    // wire as { _seconds, _nanoseconds }
    const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  } catch {
    return 'Unknown date';
  }
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function renderEntryForm(errorMessage = null) {
  card.innerHTML = `
    <div class="entry-body">
      <div class="entry-title">Verify your product</div>
      <div class="entry-sub">Enter the code printed on your CHRGE+ authentication sticker.</div>
      ${errorMessage ? `<div style="color:#ffb3b3; font-size:0.83rem; margin-bottom:1rem;">${escapeHtml(errorMessage)}</div>` : ''}
      <form id="manualForm">
        <input type="text" id="manualCode" class="code-input" placeholder="CGA8-K2MX" maxlength="20" autocomplete="off" autocapitalize="characters">
        <button type="submit" class="btn btn-primary" style="width:100%; justify-content:center;" id="manualSubmitBtn">
          Verify
        </button>
      </form>
    </div>
  `;

  document.getElementById('manualForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('manualCode').value.trim();
    if (!code) return;
    runVerification(code);
  });
}

function renderLoading() {
  card.innerHTML = `
    <div class="entry-body" style="text-align:center; padding: 3.5rem 2rem;">
      <span class="spinner" style="width:22px; height:22px; margin: 0 auto;"></span>
      <div style="color:var(--paper-dim); font-size:0.88rem; margin-top:1rem;">Verifying...</div>
    </div>
  `;
}

function productBlockHTML(product) {
  if (!product) return '';
  const initials = (product.brand || product.productName || 'C')[0].toUpperCase();
  return `
    <div class="product-block">
      <div class="product-image">
        ${product.imageURL
          ? `<img src="${escapeHtml(product.imageURL)}" alt="${escapeHtml(product.productName)}">`
          : `<span style="font-family:var(--font-display); font-weight:700; color:var(--paper-faint);">${initials}</span>`}
      </div>
      <div>
        <div class="product-name">${escapeHtml(product.productName || 'CHRGE+ Product')}</div>
        <div class="product-meta">${[product.color, product.capacity].filter(Boolean).map(escapeHtml).join(' · ') || escapeHtml(product.brand || '')}</div>
      </div>
    </div>
  `;
}

function renderGenuineFirstScan(data) {
  card.innerHTML = `
    <div class="status-banner genuine">
      <div class="status-icon genuine">
        <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div class="status-title">Genuine Product</div>
      <div class="status-sub">First verified today</div>
    </div>
    <div class="result-body">
      ${productBlockHTML(data.product)}
      <div class="detail-row">
        <span class="detail-label">Status</span>
        <span class="detail-value" style="color:var(--accent);">Authentic</span>
      </div>
      ${data.batch?.batchNumber ? `
        <div class="detail-row">
          <span class="detail-label">Batch</span>
          <span class="detail-value">${escapeHtml(data.batch.batchNumber)}</span>
        </div>
      ` : ''}
      <div class="detail-row">
        <span class="detail-label">Code</span>
        <span class="detail-value">${escapeHtml(data.publicCode || '—')}</span>
      </div>
    </div>
  `;
}

function renderAlreadyVerified(data) {
  card.innerHTML = `
    <div class="status-banner warning">
      <div class="status-icon warning">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      </div>
      <div class="status-title">Already Activated</div>
      <div class="status-sub">This code has been verified before</div>
    </div>
    <div class="result-body">
      ${productBlockHTML(data.product)}
      <div class="detail-row">
        <span class="detail-label">First verified</span>
        <span class="detail-value">${fmtDate(data.firstVerifiedAt)}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">Total scans</span>
        <span class="detail-value">${data.scanCount || 1}</span>
      </div>
      ${data.firstCountry ? `
        <div class="detail-row">
          <span class="detail-label">First seen in</span>
          <span class="detail-value">${escapeHtml(data.firstCountry)}</span>
        </div>
      ` : ''}
      ${data.suspicious ? `
        <div class="suspicious-note">
          <strong>This code has an unusual scan pattern</strong> — it's been verified in ways that don't clearly match normal resale or gifting. This alone doesn't confirm counterfeiting, but if you have concerns about where this product came from, contact CHRGE+ support with this code.
        </div>
      ` : ''}
      <button class="try-again-btn" onclick="window.location.href='verify.html'">Verify another code</button>
    </div>
  `;
}

function renderInvalid() {
  card.innerHTML = `
    <div class="status-banner danger">
      <div class="status-icon danger">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </div>
      <div class="status-title">Invalid Code</div>
      <div class="status-sub">This authentication code does not exist</div>
    </div>
    <div class="result-body">
      <p style="color:var(--paper-dim); font-size:0.85rem; line-height:1.6; margin-bottom:1.2rem;">
        Double-check the code printed on your sticker — it's case-insensitive but every character matters. If you're confident you entered it correctly, this may indicate the product did not come from an authorized CHRGE+ source.
      </p>
      <button class="try-again-btn" onclick="window.location.href='verify.html'">Try again</button>
    </div>
  `;
}

function renderDisabledOrBlacklisted(kind) {
  const isBlacklisted = kind === 'blacklisted';
  card.innerHTML = `
    <div class="status-banner danger">
      <div class="status-icon danger">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
      </div>
      <div class="status-title">${isBlacklisted ? 'Code Blacklisted' : 'Code Disabled'}</div>
      <div class="status-sub">This code is no longer valid</div>
    </div>
    <div class="result-body">
      <p style="color:var(--paper-dim); font-size:0.85rem; line-height:1.6; margin-bottom:1.2rem;">
        ${isBlacklisted
          ? 'This code has been flagged and blacklisted by CHRGE+. If you believe this is an error, contact support with this code.'
          : 'This code has been disabled. Contact CHRGE+ support if you believe this is a mistake.'}
      </p>
      <button class="try-again-btn" onclick="window.location.href='verify.html'">Verify another code</button>
    </div>
  `;
}

function renderRateLimited() {
  card.innerHTML = `
    <div class="status-banner warning">
      <div class="status-icon warning">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#0A0A0A" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      </div>
      <div class="status-title">Too many attempts</div>
      <div class="status-sub">Please wait a moment and try again</div>
    </div>
    <div class="result-body">
      <button class="try-again-btn" onclick="window.location.href='verify.html'">Try again</button>
    </div>
  `;
}

function renderSystemError() {
  card.innerHTML = `
    <div class="entry-body" style="text-align:center;">
      <div style="color:#ffb3b3; font-family:var(--font-display); font-weight:600; margin-bottom:0.5rem;">
        Something went wrong
      </div>
      <div style="color:var(--paper-dim); font-size:0.85rem; margin-bottom:1.4rem;">
        We couldn't check this code right now. Please try again in a moment.
      </div>
      <button class="try-again-btn" onclick="window.location.href='verify.html'">Try again</button>
    </div>
  `;
}

async function runVerification(code) {
  renderLoading();

  try {
    const result = await verifyCode({ code, userAgent: navigator.userAgent });
    const data = result.data;

    switch (data.result) {
      case 'genuine_first_scan':
        renderGenuineFirstScan(data);
        break;
      case 'already_verified':
        renderAlreadyVerified(data);
        break;
      case 'invalid':
        renderInvalid();
        break;
      case 'disabled':
        renderDisabledOrBlacklisted('disabled');
        break;
      case 'blacklisted':
        renderDisabledOrBlacklisted('blacklisted');
        break;
      case 'rate_limited':
        renderRateLimited();
        break;
      default:
        renderSystemError();
    }
  } catch (err) {
    console.error('Verification failed:', err);
    renderSystemError();
  }
}

// ---- Entry point ----
if (codeFromURL) {
  runVerification(codeFromURL);
} else {
  renderEntryForm();
}
