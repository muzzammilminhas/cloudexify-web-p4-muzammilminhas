import { supabase } from './supabase.js';
import { bindPasswordToggles, getVerifiedUser } from './auth.js';
import { friendlyError, setButtonLoading, showFormAlert } from './utils.js';

const form = document.getElementById('registerForm');
const alertBox = document.getElementById('formAlert');
const submitButton = document.getElementById('registerSubmit');
const passwordInput = document.getElementById('registerPassword');
const meter = document.getElementById('passwordMeter');

bindPasswordToggles();

getVerifiedUser().then((user) => {
  if (user) window.location.replace('index.html');
}).catch(() => {});

passwordInput.addEventListener('input', () => {
  const password = passwordInput.value;
  let score = 0;
  if (password.length >= 8) score += 1;
  if (/[a-zA-Z]/.test(password) && /\d/.test(password)) score += 1;
  if (password.length >= 12 && /[^a-zA-Z0-9]/.test(password)) score += 1;
  meter.style.width = `${(score / 3) * 100}%`;
  meter.style.background = score < 2 ? '#a32f36' : score === 2 ? '#c98735' : '#3d7357';
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showFormAlert(alertBox, '');
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;

  const password = passwordInput.value;
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    showFormAlert(alertBox, 'Use at least one letter and one number in your password.');
    return;
  }

  setButtonLoading(submitButton, true, 'Creating your account…');
  try {
    const fullName = document.getElementById('fullName').value.trim().replace(/\s+/g, ' ');
    const email = document.getElementById('registerEmail').value.trim().toLowerCase();
    const emailRedirectTo = new URL('login.html?confirmed=1', window.location.href).href;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName }, emailRedirectTo },
    });
    if (error) throw error;

    if (data.session) {
      sessionStorage.setItem('aatish-auth-message', 'Account created. Welcome to Aatish & Aangan.');
      window.location.replace('index.html');
      return;
    }

    document.getElementById('confirmationEmail').textContent = email;
    document.getElementById('registerFormView').hidden = true;
    document.getElementById('confirmationView').hidden = false;
    document.getElementById('confirmationView').focus?.();
  } catch (error) {
    showFormAlert(alertBox, friendlyError(error, 'We could not create your account. Please try again.'));
    setButtonLoading(submitButton, false);
  }
});
