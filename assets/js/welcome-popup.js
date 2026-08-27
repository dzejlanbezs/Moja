/* ============================================================
   Virtusjack — welcome bonus popup

   Opens the offer once a visitor lands on the site, then keeps
   quiet for as long as data-repeat says. Works on its own — no
   dependency on the rest of the app.

   Manual control:
     VJWelcomePopup.open()    show it now
     VJWelcomePopup.close()   hide it and remember
     VJWelcomePopup.reset()   forget, so it shows again next visit
   ============================================================ */

(function () {
  'use strict';

  const STORE_KEY = 'vj_welcome_popup_seen';

  const pop = document.getElementById('vjWelcomePopup');
  if (!pop) return;

  const card = pop.querySelector('.vj-pop-card');
  const cta = pop.querySelector('[data-vj-pop-claim]');
  const repeat = (pop.dataset.repeat || '24').trim().toLowerCase();
  const delay = parseInt(pop.dataset.delay, 10) || 0;
  const claimUrl = pop.dataset.claimUrl || '';

  let lastFocus = null;

  /* localStorage throws in private mode on some browsers, so every
     touch of it is guarded and a failure just means "not seen" */
  function read() {
    try { return window.localStorage.getItem(STORE_KEY); } catch (e) { return null; }
  }

  function write(value) {
    try { window.localStorage.setItem(STORE_KEY, value); } catch (e) { /* ignore */ }
  }

  function seenRecently() {
    if (repeat === '0') return false;
    const stamp = read();
    if (!stamp) return false;
    if (repeat === 'never' || repeat === 'once') return true;
    const hours = parseFloat(repeat) || 24;
    return Date.now() - Number(stamp) < hours * 3600000;
  }

  function open() {
    if (!pop.hidden) return;
    lastFocus = document.activeElement;
    pop.hidden = false;
    document.body.classList.add('vj-pop-lock');
    /* the card, not the button — a focused button would wear a ring */
    (card || cta || pop).focus();
  }

  function close() {
    if (pop.hidden) return;
    write(String(Date.now()));
    pop.hidden = true;
    document.body.classList.remove('vj-pop-lock');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    lastFocus = null;
  }

  function claim() {
    /* preventDefault() on this event keeps the popup from navigating,
       so a register modal can take over instead */
    const event = new CustomEvent('vj:welcome-claim', { bubbles: true, cancelable: true });
    const proceed = pop.dispatchEvent(event);
    close();
    if (proceed && claimUrl) window.location.href = claimUrl;
  }

  pop.addEventListener('click', (e) => {
    if (e.target.closest('[data-vj-pop-close]')) { close(); return; }
    if (e.target.closest('[data-vj-pop-claim]')) { claim(); return; }
    if (card && !card.contains(e.target)) close();     // click on the dim backdrop
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) close();
  });

  window.VJWelcomePopup = {
    open: open,
    close: close,
    reset: function () {
      try { window.localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ }
    },
  };

  if (pop.dataset.auto === 'false' || seenRecently()) return;
  window.setTimeout(open, delay);
})();
