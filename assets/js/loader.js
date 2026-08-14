/* ============================================================
   Virtusjack — loading screens

   Two seconds of it: once when the site opens, and again when the
   sportsbook does. The mark spins by default; drop intro.mp4 or
   sports.mp4 into assets/video and that plays instead.
   ============================================================ */

(function (D) {
  'use strict';

  const HOLD_MS = 2000;
  const boot = document.getElementById('bootLoader');
  let busy = false;

  const MARKS = {
    logo:
      '<svg viewBox="0 0 64 64" aria-hidden="true">' +
        '<rect x="2" y="2" width="60" height="60" rx="17" fill="#00e676"/>' +
        '<circle cx="22" cy="22" r="5.2" fill="#04150c"/><circle cx="42" cy="22" r="5.2" fill="#04150c"/>' +
        '<circle cx="22" cy="42" r="5.2" fill="#04150c"/><circle cx="42" cy="42" r="5.2" fill="#04150c"/>' +
      '</svg>',
    sports:
      '<svg viewBox="0 0 64 64" aria-hidden="true">' +
        '<circle cx="32" cy="32" r="26" fill="none" stroke="#ffcc33" stroke-width="3.4"/>' +
        '<path d="M32 16.5l9.5 6.9-3.6 11.2H26.1L22.5 23.4 32 16.5Z" fill="#ffcc33"/>' +
        '<path d="M32 5v11.5M9 26.8l13.2-1M55 26.8l-13.2-1M18.5 55.5l7.6-20.9M45.5 55.5L37.9 34.6" ' +
          'fill="none" stroke="#ffcc33" stroke-width="3"/>' +
      '</svg>',
  };

  /** The clip an operator dropped in, if the manifest knows about one. */
  function clipFor(key) {
    return D.Art && D.Art.get ? D.Art.get('video', key) : '';
  }

  function fill(node, mark, key) {
    const clip = clipFor(key);
    node.innerHTML = clip
      ? '<video class="loader-clip" src="' + clip + '" autoplay muted playsinline></video>'
      : '<span class="loader-mark ' + key + '">' + MARKS[mark] + '</span>' +
        '<span class="loader-ring"></span>';
  }

  /**
   * Shows a screen for two seconds. `key` picks the artwork: `logo` for the
   * site, `sports` for the sportsbook.
   */
  function show(key) {
    if (busy) return Promise.resolve();
    busy = true;

    const node = D.h('<div class="loader" role="status" aria-label="Loading"><div class="loader-inner"></div></div>');
    const inner = node.querySelector('.loader-inner');
    fill(inner, key === 'sports' ? 'sports' : 'logo', key);
    document.body.appendChild(node);

    return new Promise((resolve) => {
      setTimeout(() => {
        node.classList.add('gone');
        setTimeout(() => { node.remove(); busy = false; resolve(); }, 380);
      }, HOLD_MS);
    });
  }

  /* ---- the splash that is already in the page when the browser gets here ---- */

  if (boot) {
    busy = true;
    const inner = boot.querySelector('.loader-inner');
    // the manifest usually lands well inside the two seconds; if it does not,
    // the built-in animation simply keeps playing
    if (D.Art) {
      D.Art.load().then(() => { if (clipFor('intro')) fill(inner, 'logo', 'intro'); });
    }
    setTimeout(() => {
      boot.classList.add('gone');
      setTimeout(() => { boot.remove(); busy = false; }, 380);
    }, HOLD_MS);
  }

  D.Loader = { show: show, holdMs: HOLD_MS, get busy() { return busy; } };
})(window.Virtusjack);
