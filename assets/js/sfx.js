/* ============================================================
   Virtusjack — sound

   Every sound is synthesised on the spot with the Web Audio API,
   so the site stays dependency free and ships no audio files.
   Browsers only allow audio after the player has interacted, so
   the context is created on the first sound and resumed if the
   browser had it suspended.
   ============================================================ */

(function (D) {
  'use strict';

  const KEY = 'virtusjack.sound';
  let ctx = null;
  let on = true;

  try { on = localStorage.getItem(KEY) !== 'off'; } catch (err) { on = true; }

  function audio() {
    if (!on) return null;
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return null;
    if (!ctx) ctx = new Ctor();
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  /** One shaped tone. Frequency can glide from `from` to `to`. */
  function tone(opts) {
    const ac = audio();
    if (!ac) return;
    const now = ac.currentTime + (opts.delay || 0);
    const length = opts.length || 0.16;
    const osc = ac.createOscillator();
    const gain = ac.createGain();

    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.from, now);
    if (opts.to && opts.to !== opts.from) osc.frequency.exponentialRampToValueAtTime(Math.max(30, opts.to), now + length);

    const peak = (opts.gain == null ? 0.16 : opts.gain);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(peak, now + Math.min(0.02, length / 3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

    osc.connect(gain).connect(ac.destination);
    osc.start(now);
    osc.stop(now + length + 0.02);
  }

  /** A burst of filtered noise — card slides, mines, coins landing. */
  function noise(opts) {
    const ac = audio();
    if (!ac) return;
    const now = ac.currentTime + (opts.delay || 0);
    const length = opts.length || 0.12;
    const frames = Math.max(1, Math.floor(ac.sampleRate * length));
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) {
      const fade = 1 - i / frames;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }

    const src = ac.createBufferSource();
    src.buffer = buffer;

    const filter = ac.createBiquadFilter();
    filter.type = opts.type || 'bandpass';
    filter.frequency.setValueAtTime(opts.freq || 1400, now);
    if (opts.sweepTo) filter.frequency.exponentialRampToValueAtTime(Math.max(60, opts.sweepTo), now + length);
    filter.Q.value = opts.q == null ? 0.8 : opts.q;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(opts.gain == null ? 0.2 : opts.gain, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + length);

    src.connect(filter).connect(gain).connect(ac.destination);
    src.start(now);
    src.stop(now + length + 0.02);
  }

  const SOUNDS = {
    /* dealing and clicking */
    card() { noise({ freq: 2600, sweepTo: 700, length: 0.13, gain: 0.16, q: 0.7 }); },
    flip() { tone({ from: 520, to: 900, length: 0.12, type: 'triangle', gain: 0.12 }); },
    click() { tone({ from: 700, to: 460, length: 0.05, type: 'square', gain: 0.06 }); },
    tick() { noise({ freq: 3200, length: 0.04, gain: 0.08, q: 2 }); },

    /* finding something good */
    gem() {
      tone({ from: 1180, to: 1760, length: 0.12, type: 'triangle', gain: 0.13 });
      tone({ from: 1760, to: 2340, length: 0.16, type: 'sine', gain: 0.09, delay: 0.07 });
    },
    /* and something bad */
    mine() {
      noise({ freq: 900, sweepTo: 90, length: 0.5, gain: 0.3, type: 'lowpass', q: 0.6 });
      tone({ from: 180, to: 48, length: 0.42, type: 'sawtooth', gain: 0.16 });
    },

    /* results */
    win() {
      [0, 0.09, 0.18].forEach((delay, i) => {
        tone({ from: [660, 880, 1320][i], to: [880, 1100, 1600][i], length: 0.2, type: 'triangle', gain: 0.12, delay: delay });
      });
    },
    big() {
      [0, 0.1, 0.2, 0.32].forEach((delay, i) => {
        tone({ from: [660, 990, 1320, 1760][i], length: 0.34, type: 'triangle', gain: 0.13, delay: delay });
      });
    },
    lose() {
      tone({ from: 420, to: 160, length: 0.34, type: 'sawtooth', gain: 0.11 });
      tone({ from: 300, to: 110, length: 0.4, type: 'sine', gain: 0.09, delay: 0.05 });
    },
    push() { tone({ from: 520, to: 520, length: 0.18, type: 'sine', gain: 0.1 }); },

    /* movement */
    spin() {
      const ac = audio();
      if (!ac) return;
      for (let i = 0; i < 14; i++) noise({ freq: 2400, length: 0.03, gain: 0.05, q: 3, delay: i * 0.075 });
    },
    drop() { tone({ from: 900, to: 300, length: 0.22, type: 'sine', gain: 0.1 }); },
    cash() {
      [0, 0.07, 0.15].forEach((delay) => noise({ freq: 5200, length: 0.09, gain: 0.1, q: 4, delay: delay }));
      tone({ from: 1320, to: 1980, length: 0.22, type: 'triangle', gain: 0.1, delay: 0.04 });
    },
  };

  const play = (name) => {
    const sound = SOUNDS[name];
    if (!sound || !on) return;
    try { sound(); } catch (err) { /* a browser that will not play is not worth an error */ }
  };

  function setOn(state) {
    on = !!state;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (err) { /* private mode */ }
    if (on) play('click');
  }

  D.Sfx = {
    play: play,
    get enabled() { return on; },
    toggle() { setOn(!on); return on; },
    set: setOn,
    sounds: Object.keys(SOUNDS),
  };
})(window.Virtusjack);
