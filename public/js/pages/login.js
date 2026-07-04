import { auth } from '../services/firebase-config.js';
import { signInWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

const form = document.getElementById('loginForm');
const submitBtn = document.getElementById('submitBtn');
const errorBanner = document.getElementById('errorBanner');

// Surface the "signed in but not an admin" case from auth-guard's redirect
const params = new URLSearchParams(window.location.search);
if (params.get('error') === 'not_admin') {
  showError('That account exists but does not have admin access. Contact an existing admin to be provisioned.');
}

function showError(message) {
  errorBanner.textContent = message;
  errorBanner.classList.add('show');
}

function clearError() {
  errorBanner.classList.remove('show');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="spinner"></span> Signing in...';

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const tokenResult = await cred.user.getIdTokenResult(true);

    if (tokenResult.claims.admin !== true) {
      await signOut(auth);
      showError('That account exists but does not have admin access. Contact an existing admin to be provisioned.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign in';
      return;
    }

    window.location.href = 'dashboard.html';
  } catch (err) {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign in';

    const code = err.code || '';
    if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
      showError('Incorrect email or password.');
    } else if (code.includes('too-many-requests')) {
      showError('Too many attempts. Please wait a moment and try again.');
    } else {
      showError('Sign in failed. Please try again.');
      console.error('Login error:', err);
    }
  }
});
