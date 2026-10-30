(() => {
  'use strict';
  const year = String(new Date().getFullYear());
  document.querySelectorAll('[data-year]').forEach(node => { node.textContent = year; });

  const toggle = document.querySelector('[data-menu-toggle]');
  const nav = document.querySelector('[data-main-nav]');
  const closeNav = () => {
    if (!nav || !toggle) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open navigation menu');
  };
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const open = !nav.classList.contains('is-open');
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? 'Close navigation menu' : 'Open navigation menu');
    });
    nav.querySelectorAll('a').forEach(link => link.addEventListener('click', closeNav));
    window.addEventListener('keydown', e => { if (e.key === 'Escape') closeNav(); });
    document.addEventListener('click', e => {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) closeNav();
    });
    window.addEventListener('resize', () => { if (window.innerWidth > 740) closeNav(); });
  }

  const toast = document.querySelector('[data-toast]');
  let toastTimeout;
  function inform(message, type = 'success') {
    if (!toast) return;
    clearTimeout(toastTimeout);
    toast.textContent = message;
    toast.dataset.type = type;
    toast.classList.add('is-visible');
    toastTimeout = setTimeout(() => { toast.classList.remove('is-visible'); }, 5600);
  }

  const storageKey = 'gta6online-cookie-notice-acknowledged';
  const banner = document.querySelector('[data-cookie-banner]');
  function hasAcknowledged() {
    try { return localStorage.getItem(storageKey) === 'yes'; }
    catch { return false; }
  }
  if (banner && !hasAcknowledged()) banner.classList.add('is-visible');
  document.querySelectorAll('[data-accept-notice]').forEach(button => {
    button.addEventListener('click', () => {
      try {
        localStorage.setItem(storageKey, 'yes');
        if (banner) banner.classList.remove('is-visible');
        inform('Notice acknowledged. Your preference was saved on this device.');
      } catch {
        if (banner) banner.classList.remove('is-visible');
        inform('Notice closed. Your browser did not allow the preference to be saved.', 'error');
      }
    });
  });
  document.querySelectorAll('[data-clear-notice]').forEach(button => {
    button.addEventListener('click', () => {
      try {
        localStorage.removeItem(storageKey);
        if (banner) banner.classList.add('is-visible');
        inform('Notice preference cleared. The notice will appear again.');
      } catch {
        inform('Your browser blocked storage access. No preference could be cleared.', 'error');
      }
    });
  });
  document.querySelectorAll('[data-copy-invite]').forEach(button => {
    button.addEventListener('click', async () => {
      try {
        if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
        await navigator.clipboard.writeText('https://discord.gg/NAFJHVsYta');
        inform('Discord invite copied to your clipboard.');
      } catch {
        inform('Unable to copy the link automatically. Please open the Discord invite instead.', 'error');
      }
    });
  });
})();
