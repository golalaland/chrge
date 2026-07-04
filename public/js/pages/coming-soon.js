import { requireAdmin, signOut } from '../services/auth-guard.js';
import { renderShell } from '../services/shell.js';

export async function renderComingSoon(pageId, title, description) {
  const { user } = await requireAdmin();
  const app = document.getElementById('app');

  const content = `
    <div class="page-header">
      <div>
        <div class="page-title">${title}</div>
        <div class="page-subtitle">${description}</div>
      </div>
    </div>
    <div class="card" style="text-align:center; padding:4rem 2rem;">
      <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="var(--paper-faint)" stroke-width="1.5" style="margin-bottom:1rem;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <div style="font-family:var(--font-display); font-weight:600; margin-bottom:0.4rem;">Not built in this pass</div>
      <div style="color:var(--paper-dim); font-size:0.88rem; max-width:440px; margin:0 auto;">
        The data model and Firestore rules already account for this section. It's staged as the next build phase — see the project README for the plan.
      </div>
    </div>
  `;

  app.innerHTML = renderShell(pageId, content, { email: user.email });
  document.getElementById('signOutBtn').addEventListener('click', signOut);
}
