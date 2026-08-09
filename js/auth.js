import { supabase } from './supabase.js';

export async function getVerifiedUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

export async function requireCustomer() {
  const user = await getVerifiedUser();
  if (!user) {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.hash}`);
    window.location.replace(`login.html?next=${next}`);
    return null;
  }
  const profile = await getProfile(user.id);
  return { user, profile };
}

export async function requireAdmin() {
  const user = await getVerifiedUser();
  if (!user) {
    window.location.replace('login.html?mode=admin&next=admin');
    return null;
  }
  const profile = await getProfile(user.id);
  if (profile.role !== 'admin') {
    sessionStorage.setItem('aatish-auth-message', 'Admin access is restricted to the kitchen team.');
    window.location.replace('index.html');
    return null;
  }
  return { user, profile };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  window.location.replace('login.html');
}

export function bindPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.togglePassword);
      if (!input) return;
      const reveal = input.type === 'password';
      input.type = reveal ? 'text' : 'password';
      button.textContent = reveal ? 'Hide' : 'Show';
      button.setAttribute('aria-label', `${reveal ? 'Hide' : 'Show'} password`);
    });
  });
}

