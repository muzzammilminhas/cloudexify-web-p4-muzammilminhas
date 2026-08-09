import { supabase } from './supabase.js';
import { bindPasswordToggles, getProfile, getVerifiedUser } from './auth.js';
import { friendlyError, setButtonLoading, showFormAlert, showToast } from './utils.js';

const form = document.getElementById('loginForm');
const alertBox = document.getElementById('formAlert');
const submitButton = document.getElementById('loginSubmit');
const modeButtons = [...document.querySelectorAll('[data-login-mode]')];
const params = new URLSearchParams(window.location.search);
let loginMode = params.get('mode') === 'admin' || params.get('next') === 'admin' ? 'admin' : 'customer';

function setMode(mode) {
  loginMode = mode;
  modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.loginMode === mode));
  document.getElementById('loginEyebrow').textContent = mode === 'admin' ? 'Protected kitchen access' : 'Welcome to the table';
  document.getElementById('loginHeading').textContent = mode === 'admin' ? 'Enter the kitchen pass.' : 'Sign in for supper.';
  document.getElementById('loginIntro').textContent = mode === 'admin'
    ? 'Only approved admin profiles can open live orders and menu controls.'
    : 'Continue to the live menu, your dastarkhwan and kitchen updates.';
  document.getElementById('registerPrompt').hidden = mode === 'admin';
  submitButton.textContent = mode === 'admin' ? 'Open admin dashboard' : 'Sign in';
  const url = new URL(window.location.href);
  if (mode === 'admin') url.searchParams.set('mode', 'admin'); else url.searchParams.delete('mode');
  window.history.replaceState({}, '', url);
}

async function routeSignedInUser() {
  const user = await getVerifiedUser();
  if (!user) return false;
  const profile = await getProfile(user.id);
  if (loginMode === 'admin' && profile.role !== 'admin') return false;
  window.location.replace(loginMode === 'admin' ? 'admin.html' : 'index.html');
  return true;
}

modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.loginMode)));
bindPasswordToggles();
setMode(loginMode);

const existingMessage = sessionStorage.getItem('aatish-auth-message');
if (existingMessage) {
  sessionStorage.removeItem('aatish-auth-message');
  showFormAlert(alertBox, existingMessage);
}

routeSignedInUser().catch(() => {});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showFormAlert(alertBox, '');
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;

  setButtonLoading(submitButton, true, loginMode === 'admin' ? 'Checking admin role…' : 'Signing in…');
  try {
    const email = document.getElementById('loginEmail').value.trim().toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    const profile = await getProfile(data.user.id);
    if (loginMode === 'admin' && profile.role !== 'admin') {
      await supabase.auth.signOut();
      throw new Error('This customer account does not have admin access.');
    }
    showToast('Your session is ready.', 'success', 'Welcome back');
    window.location.replace(loginMode === 'admin' ? 'admin.html' : 'index.html');
  } catch (error) {
    showFormAlert(alertBox, friendlyError(error, error.message || 'We could not sign you in.'));
    setButtonLoading(submitButton, false);
  }
});

