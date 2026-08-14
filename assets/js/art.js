/* ============================================================
   Virtusjack — swappable artwork

   Anything dropped into assets/img/{banners,games,sports,promo,
   coins,trending,nav,wins}
   replaces the built-in art for that banner, tile or thumbnail.
   The server lists what is actually there, so nothing is guessed
   and a missing file simply means the default stays.
   ============================================================ */

(function (D) {
  'use strict';

  const FOLDERS = ['banners', 'games', 'sports', 'promo', 'coins', 'trending', 'nav', 'wins', 'logo', 'mines', 'dig', 'video'];
  const EXTENSIONS = ['jpg', 'png', 'webp'];

  const manifest = { banners: {}, games: {}, sports: {}, promo: {}, coins: {}, trending: {},
    nav: {}, wins: {}, logo: {}, mines: {}, dig: {}, video: {} };
  const probes = {};
  let ready = null;
  let listed = false;   // true once the server has told us what exists

  const key = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  /** Does this URL actually load? Answered once per URL. */
  function probe(url) {
    if (probes[url]) return probes[url];
    probes[url] = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image.naturalWidth > 1);
      image.onerror = () => resolve(false);
      image.src = url;
    });
    return probes[url];
  }

  /** Without a server there is no listing, so fall back to trying the usual names. */
  function guess(folder, name) {
    const candidates = EXTENSIONS.map((ext) => 'assets/img/' + folder + '/' + name + '.' + ext);
    return candidates.reduce(
      (chain, url) => chain.then((found) => (found || probe(url).then((ok) => (ok ? url : '')))),
      Promise.resolve('')
    );
  }

  function load() {
    if (ready) return ready;
    ready = D.Api.request('GET', '/api/art')
      .then((data) => {
        FOLDERS.forEach((folder) => Object.assign(manifest[folder], (data.art && data.art[folder]) || {}));
        listed = true;
        return manifest;
      })
      .catch(() => manifest);
    return ready;
  }

  const get = (folder, name) => (manifest[folder] || {})[key(name)] || '';

  /** Any image in a folder, for artwork where the filename does not matter. */
  const first = (folder) => {
    const names = Object.keys(manifest[folder] || {});
    return names.length ? manifest[folder][names[0]] : '';
  };

  /**
   * Puts the custom image on an element as a background and marks it, so the
   * stylesheet can hide whatever the built-in artwork was drawing.
   */
  function apply(element, folder, name, marker) {
    if (!element) return Promise.resolve('');
    const flag = marker || 'has-art';

    return load().then(() => {
      const known = get(folder, name);
      // with a listing there is nothing to guess, which keeps the console clean
      const resolve = known ? Promise.resolve(known)
        : (listed ? Promise.resolve('') : guess(folder, key(name)));

      return resolve.then((url) => {
        if (!url) return '';
        return probe(url).then((ok) => {
          if (!ok) return '';
          element.style.backgroundImage = 'url("' + url + '")';
          element.classList.add(flag);
          return url;
        });
      });
    });
  }

  D.Art = { load: load, get: get, first: first, apply: apply, probe: probe, key: key };
})(window.Virtusjack);
