/**
 * shell.js
 * ------------------------------------------------------------
 * Builds the sidebar + shell markup shared by every admin page.
 * Keeping this in one place means adding a new nav item happens
 * once, not on every page file.
 * ------------------------------------------------------------
 */

const CHRGE_LOGO_SVG = `<svg viewBox="0 0 1942 809" fill="none">
  <g transform="translate(0,809) scale(0.1,-0.1)" fill="#F4F4F2" stroke="none">
    <path d="M2282 5120 c-97 -26 -162 -62 -221 -125 -60 -64 -94 -128 -115 -222
    -14 -62 -16 -157 -16 -712 0 -692 3 -735 54 -843 53 -111 144 -188 270 -227
    67 -21 83 -21 861 -21 448 0 814 4 841 9 265 51 419 272 394 571 l-5 65 -234
    3 c-151 1 -238 -1 -246 -8 -7 -6 -15 -35 -17 -66 -5 -58 -24 -93 -72 -128 -27
    -21 -40 -21 -609 -24 -320 -2 -596 0 -614 3 -39 7 -87 46 -111 89 -15 28 -17
    79 -19 521 -1 270 2 519 7 554 10 76 31 108 90 139 l44 22 576 0 576 0 44 -22
    c57 -30 80 -63 88 -129 l7 -54 250 0 250 0 -3 100 c-3 133 -17 196 -59 278
    -58 110 -153 182 -298 224 -54 16 -133 18 -850 20 -754 2 -793 1 -863 -17z
    M4758 5129 c-17 -9 -18 -71 -18 -1072 0 -814 3 -1066 12 -1075 9 -9 76 -12
    240 -12 214 0 228 1 238 19 6 13 10 174 10 454 0 387 2 436 16 441 9 3 298 6
    643 6 474 0 630 -3 639 -12 9 -9 12 -122 12 -448 0 -326 3 -439 12 -448 17
    -17 459 -17 476 0 9 9 12 261 12 1075 0 1040 0 1063 -19 1073 -12 6 -106 10
    -235 10 -182 0 -217 -2 -230 -16 -14 -13 -16 -65 -16 -418 0 -299 -3 -405 -12
    -414 -9 -9 -165 -12 -639 -12 -345 0 -634 3 -643 6 -14 5 -16 51 -16 414 0
    381 -1 408 -18 423 -16 15 -47 17 -233 17 -127 0 -221 -5 -231 -11z M7498
    5129 c-17 -9 -18 -71 -18 -1072 0 -814 3 -1066 12 -1075 18 -18 461 -17 477 1
    7 10 12 131 13 383 l3 369 357 3 357 2 24 -22 c22 -20 209 -311 405 -628 36
    -58 70 -108 76 -112 6 -4 129 -8 272 -8 200 0 264 3 272 13 11 13 9 17 -300
    498 -86 135 -160 253 -163 261 -5 12 4 17 37 22 131 21 295 149 356 276 53
    112 65 201 60 448 -4 204 -6 222 -31 291 -73 207 -221 312 -492 351 -96 13
    -1694 13 -1717 -1z m1601 -419 c58 -16 100 -52 127 -107 25 -49 26 -60 23
    -175 -4 -112 -6 -127 -31 -169 -19 -31 -42 -54 -80 -75 l-53 -29 -538 -3
    c-399 -2 -543 0 -553 9 -11 9 -14 62 -14 279 0 146 3 270 7 273 10 11 1074 8
    1112 -3z M10434 5125 c-181 -39 -301 -154 -352 -338 -15 -56 -17 -128 -17
    -732 0 -606 2 -676 17 -733 50 -181 159 -294 323 -337 87 -22 1617 -22 1713 0
    184 43 312 176 357 368 13 55 15 138 13 494 l-3 428 -645 0 -644 0 -58 -175
    c-32 -96 -58 -183 -58 -192 0 -17 30 -18 453 -20 l452 -3 0 -197 c0 -224 -3
    -233 -85 -275 l-44 -23 -582 0 -581 0 -44 23 c-31 16 -51 36 -66 67 -23 44
    -23 44 -23 575 0 531 0 531 23 575 15 31 35 51 66 67 l44 23 887 0 c676 0 889
    3 898 12 8 8 12 67 12 198 0 131 -4 190 -12 198 -18 18 -1959 16 -2044 -3z
    M12966 5124 c-13 -13 -16 -45 -16 -190 0 -102 4 -183 10 -195 10 -19 33 -19
    1048 -19 794 0 1041 3 1050 12 17 17 17 379 0 396 -9 9 -255 12 -1044 12 -925
    0 -1034 -2 -1048 -16z M16397 4922 c-15 -16 -17 -52 -17 -296 0 -172 -4 -285
    -10 -297 -10 -18 -24 -19 -298 -19 -244 0 -291 -2 -310 -16 -22 -15 -22 -19
    -22 -228 0 -194 2 -214 18 -229 16 -15 52 -17 304 -17 263 0 286 -1 301 -18
    15 -16 17 -52 17 -299 0 -258 1 -281 18 -296 16 -15 47 -17 230 -17 199 0 213
    1 232 20 19 19 20 33 20 303 0 207 3 286 12 295 9 9 89 12 300 12 275 0 289 1
    308 20 19 19 20 33 20 225 0 192 -1 206 -20 225 -19 19 -33 20 -308 20 -211 0
    -291 3 -300 12 -9 9 -12 88 -12 295 0 270 -1 284 -20 303 -19 19 -33 20 -233
    20 -195 0 -215 -2 -230 -18z M12962 4268 c-18 -18 -17 -1257 1 -1281 11 -16
    83 -17 1057 -15 l1045 3 3 194 c2 134 -1 198 -9 207 -10 12 -143 14 -803 14
    -603 0 -795 3 -804 12 -9 9 -12 75 -12 233 0 202 2 223 18 238 17 15 91 17
    813 19 l794 3 0 190 0 190 -1045 3 c-805 2 -1049 -1 -1058 -10z"/>
  </g>
</svg>`;

const NAV_ITEMS = [
  { group: 'Overview', items: [
    { id: 'dashboard', label: 'Dashboard', href: 'dashboard.html', icon: 'grid' }
  ]},
  { group: 'Catalog', items: [
    { id: 'products', label: 'Products', href: 'products.html', icon: 'box' },
    { id: 'batches', label: 'Batches', href: 'batches.html', icon: 'layers' },
    { id: 'codes', label: 'Codes', href: 'codes.html', icon: 'hash' }
  ]},
  { group: 'Operations', items: [
    { id: 'print', label: 'Print Queue', href: 'print.html', icon: 'printer' },
    { id: 'scans', label: 'Scan Activity', href: 'scans.html', icon: 'activity' }
  ]},
  { group: 'System', items: [
    { id: 'settings', label: 'Settings', href: 'settings.html', icon: 'settings' }
  ]}
];

const ICONS = {
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  layers: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>',
  hash: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'
};

export function renderShell(activePageId, contentHTML, adminInfo = {}) {
  const email = adminInfo.email || '';
  const initial = email ? email[0].toUpperCase() : 'A';

  const navGroups = NAV_ITEMS.map(group => `
    <div class="nav-group">
      <div class="nav-label">${group.group}</div>
      ${group.items.map(item => `
        <a href="${item.href}" class="nav-link ${item.id === activePageId ? 'active' : ''}">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[item.icon]}</svg>
          ${item.label}
        </a>
      `).join('')}
    </div>
  `).join('');

  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="sidebar-logo">${CHRGE_LOGO_SVG}</div>
        <nav style="flex:1;">${navGroups}</nav>
        <div class="sidebar-footer">
          <div class="admin-badge">
            <div class="admin-avatar">${initial}</div>
            <div style="flex:1; min-width:0;">
              <div class="admin-email">${email}</div>
            </div>
            <button id="signOutBtn" class="btn-ghost" style="background:none;border:none;cursor:pointer;color:var(--paper-faint);padding:0.3rem;" title="Sign out">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </aside>
      <main class="main-content">
        ${contentHTML}
      </main>
    </div>
  `;
}

export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 4000);
}
