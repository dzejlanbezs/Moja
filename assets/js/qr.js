/* ============================================================
   Virtusjack — QR encoder

   Byte mode, error correction level M, versions 1–10. Enough for
   any crypto address or BIP21/EIP-681 payment URI. Returns a
   matrix of booleans; the caller decides how to draw it.
   ============================================================ */

(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root && root.Virtusjack) root.Virtusjack.QR = api;
  else if (root) root.VirtusjackQR = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // per version (1-10) at EC level M: data capacity, ec codewords per block, block sizes
  const VERSIONS = [
    { v: 1, capacity: 14, ecPerBlock: 10, blocks: [16] },
    { v: 2, capacity: 26, ecPerBlock: 16, blocks: [28] },
    { v: 3, capacity: 42, ecPerBlock: 26, blocks: [44] },
    { v: 4, capacity: 62, ecPerBlock: 18, blocks: [32, 32] },
    { v: 5, capacity: 84, ecPerBlock: 24, blocks: [43, 43] },
    { v: 6, capacity: 106, ecPerBlock: 16, blocks: [27, 27, 27, 27] },
    { v: 7, capacity: 122, ecPerBlock: 18, blocks: [31, 31, 31, 31] },
    { v: 8, capacity: 152, ecPerBlock: 22, blocks: [38, 38, 39, 39] },
    { v: 9, capacity: 180, ecPerBlock: 22, blocks: [36, 36, 36, 37, 37] },
    { v: 10, capacity: 213, ecPerBlock: 26, blocks: [43, 43, 43, 43, 44] },
  ];

  const ALIGNMENT = {
    1: [], 2: [6, 18], 3: [6, 22], 4: [6, 26], 5: [6, 30],
    6: [6, 34], 7: [6, 22, 38], 8: [6, 24, 42], 9: [6, 26, 46], 10: [6, 28, 50],
  };

  /* ---------------- GF(256) ---------------- */

  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (function initGf() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  const mul = (a, b) => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

  function generatorPoly(degree) {
    let poly = [1];
    for (let i = 0; i < degree; i++) {
      const next = new Array(poly.length + 1).fill(0);
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= mul(poly[j], 1);
        next[j + 1] ^= mul(poly[j], EXP[i]);
      }
      poly = next;
    }
    return poly;
  }

  function remainder(data, ecCount) {
    const gen = generatorPoly(ecCount);
    const out = new Array(ecCount).fill(0);
    for (const byte of data) {
      const factor = byte ^ out[0];
      out.shift();
      out.push(0);
      for (let i = 0; i < ecCount; i++) out[i] ^= mul(gen[i + 1], factor);
    }
    return out;
  }

  /* ---------------- bit stream ---------------- */

  function bitStream() {
    const bits = [];
    return {
      bits: bits,
      push(value, length) {
        for (let i = length - 1; i >= 0; i--) bits.push((value >> i) & 1);
      },
      bytes() {
        const out = [];
        for (let i = 0; i < bits.length; i += 8) {
          let byte = 0;
          for (let j = 0; j < 8; j++) byte = (byte << 1) | (bits[i + j] || 0);
          out.push(byte);
        }
        return out;
      },
    };
  }

  function encodeData(bytes, version) {
    const stream = bitStream();
    stream.push(0b0100, 4);                                  // byte mode
    stream.push(bytes.length, version.v < 10 ? 8 : 16);
    for (const byte of bytes) stream.push(byte, 8);

    const total = version.blocks.reduce((sum, size) => sum + size, 0);
    const capacityBits = total * 8;
    const terminator = Math.min(4, capacityBits - stream.bits.length);
    stream.push(0, terminator);
    while (stream.bits.length % 8) stream.bits.push(0);

    const data = stream.bytes();
    const pad = [0xec, 0x11];
    let i = 0;
    while (data.length < total) data.push(pad[i++ % 2]);
    return data;
  }

  /** Splits into blocks, adds ECC, then interleaves as the spec requires. */
  function buildCodewords(data, version) {
    const blocks = [];
    let offset = 0;
    for (const size of version.blocks) {
      const chunk = data.slice(offset, offset + size);
      offset += size;
      blocks.push({ data: chunk, ec: remainder(chunk, version.ecPerBlock) });
    }

    const out = [];
    const maxData = Math.max(...version.blocks);
    for (let i = 0; i < maxData; i++) {
      for (const block of blocks) if (i < block.data.length) out.push(block.data[i]);
    }
    for (let i = 0; i < version.ecPerBlock; i++) {
      for (const block of blocks) out.push(block.ec[i]);
    }
    return out;
  }

  /* ---------------- matrix ---------------- */

  function newMatrix(size) {
    const modules = [];
    const reserved = [];
    for (let i = 0; i < size; i++) {
      modules.push(new Array(size).fill(false));
      reserved.push(new Array(size).fill(false));
    }
    return { size: size, modules: modules, reserved: reserved };
  }

  function place(m, row, col, dark) {
    m.modules[row][col] = dark;
    m.reserved[row][col] = true;
  }

  function finder(m, row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const rr = row + r, cc = col + c;
        if (rr < 0 || cc < 0 || rr >= m.size || cc >= m.size) continue;
        const inRing = (r >= 0 && r <= 6 && (c === 0 || c === 6)) || (c >= 0 && c <= 6 && (r === 0 || r === 6));
        const inCore = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        place(m, rr, cc, inRing || inCore);
      }
    }
  }

  function patterns(m, version) {
    finder(m, 0, 0);
    finder(m, 0, m.size - 7);
    finder(m, m.size - 7, 0);

    for (let i = 8; i < m.size - 8; i++) {
      place(m, 6, i, i % 2 === 0);
      place(m, i, 6, i % 2 === 0);
    }

    const centers = ALIGNMENT[version.v];
    for (const row of centers) {
      for (const col of centers) {
        const nearFinder = (row <= 8 && col <= 8) || (row <= 8 && col >= m.size - 9) || (row >= m.size - 9 && col <= 8);
        if (nearFinder) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const ring = Math.max(Math.abs(r), Math.abs(c));
            place(m, row + r, col + c, ring !== 1);
          }
        }
      }
    }

    place(m, m.size - 8, 8, true); // dark module

    // reserve format areas
    for (let i = 0; i <= 8; i++) {
      if (!m.reserved[8][i]) place(m, 8, i, false);
      if (!m.reserved[i][8]) place(m, i, 8, false);
    }
    for (let i = 0; i < 8; i++) {
      if (!m.reserved[8][m.size - 1 - i]) place(m, 8, m.size - 1 - i, false);
      if (!m.reserved[m.size - 1 - i][8]) place(m, m.size - 1 - i, 8, false);
    }

    if (version.v >= 7) {
      for (let i = 0; i < 6; i++) {
        for (let j = 0; j < 3; j++) {
          place(m, m.size - 11 + j, i, false);
          place(m, i, m.size - 11 + j, false);
        }
      }
    }
  }

  function writeData(m, codewords) {
    let bitIndex = 0;
    const totalBits = codewords.length * 8;
    const bitAt = (i) => (i < totalBits ? (codewords[i >> 3] >> (7 - (i & 7))) & 1 : 0);

    let upward = true;
    for (let col = m.size - 1; col > 0; col -= 2) {
      if (col === 6) col--; // skip the vertical timing pattern
      for (let step = 0; step < m.size; step++) {
        const row = upward ? m.size - 1 - step : step;
        for (const c of [col, col - 1]) {
          if (m.reserved[row][c]) continue;
          m.modules[row][c] = bitAt(bitIndex++) === 1;
        }
      }
      upward = !upward;
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function applyMask(m, maskIndex) {
    const out = newMatrix(m.size);
    for (let r = 0; r < m.size; r++) {
      for (let c = 0; c < m.size; c++) {
        out.modules[r][c] = m.modules[r][c];
        out.reserved[r][c] = m.reserved[r][c];
        if (!m.reserved[r][c] && MASKS[maskIndex](r, c)) out.modules[r][c] = !out.modules[r][c];
      }
    }
    return out;
  }

  function formatBits(maskIndex) {
    const data = (0b00 << 3) | maskIndex;           // level M
    let value = data << 10;
    for (let i = 4; i >= 0; i--) {
      if ((value >> (i + 10)) & 1) value ^= 0x537 << i;
    }
    return ((data << 10) | value) ^ 0x5412;
  }

  function versionBits(version) {
    let value = version << 12;
    for (let i = 5; i >= 0; i--) {
      if ((value >> (i + 12)) & 1) value ^= 0x1f25 << i;
    }
    return (version << 12) | (value & 0xfff);
  }

  function writeFormat(m, maskIndex, version) {
    const bits = formatBits(maskIndex);
    const size = m.size;

    for (let i = 0; i < 15; i++) {
      const bit = ((bits >> i) & 1) === 1;

      // copy beside the top-left finder, running down then continuing bottom-left
      if (i < 6) m.modules[i][8] = bit;
      else if (i < 8) m.modules[i + 1][8] = bit;
      else m.modules[size - 15 + i][8] = bit;

      // copy along row 8, from the top-right corner back towards the finder
      if (i < 8) m.modules[8][size - 1 - i] = bit;
      else if (i === 8) m.modules[8][7] = bit;
      else m.modules[8][14 - i] = bit;
    }

    m.modules[size - 8][8] = true;

    if (version >= 7) {
      const vbits = versionBits(version);
      for (let i = 0; i < 18; i++) {
        const bit = ((vbits >> i) & 1) === 1;
        m.modules[m.size - 11 + (i % 3)][Math.floor(i / 3)] = bit;
        m.modules[Math.floor(i / 3)][m.size - 11 + (i % 3)] = bit;
      }
    }
  }

  function penalty(m) {
    const size = m.size;
    let score = 0;

    // rule 1: runs of five or more
    for (let i = 0; i < size; i++) {
      for (const horizontal of [true, false]) {
        let run = 1;
        for (let j = 1; j < size; j++) {
          const prev = horizontal ? m.modules[i][j - 1] : m.modules[j - 1][i];
          const cur = horizontal ? m.modules[i][j] : m.modules[j][i];
          if (cur === prev) run++;
          else { if (run >= 5) score += run - 2; run = 1; }
        }
        if (run >= 5) score += run - 2;
      }
    }

    // rule 2: 2x2 blocks of one colour
    for (let r = 0; r < size - 1; r++) {
      for (let c = 0; c < size - 1; c++) {
        const v = m.modules[r][c];
        if (v === m.modules[r][c + 1] && v === m.modules[r + 1][c] && v === m.modules[r + 1][c + 1]) score += 3;
      }
    }

    // rule 3: finder-like patterns
    const target = [true, false, true, true, true, false, true, false, false, false, false];
    const targetRev = target.slice().reverse();
    for (let i = 0; i < size; i++) {
      for (let j = 0; j + 11 <= size; j++) {
        for (const horizontal of [true, false]) {
          let matchA = true, matchB = true;
          for (let k = 0; k < 11; k++) {
            const cell = horizontal ? m.modules[i][j + k] : m.modules[j + k][i];
            if (cell !== target[k]) matchA = false;
            if (cell !== targetRev[k]) matchB = false;
          }
          if (matchA || matchB) score += 40;
        }
      }
    }

    // rule 4: overall balance
    let dark = 0;
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (m.modules[r][c]) dark++;
    const percent = (dark * 100) / (size * size);
    score += Math.floor(Math.abs(percent - 50) / 5) * 10;

    return score;
  }

  function toBytes(text) {
    const out = [];
    for (const ch of unescape(encodeURIComponent(text))) out.push(ch.charCodeAt(0));
    return out;
  }

  /** Encodes text and returns { size, modules } where modules[row][col] is dark. */
  function encode(text) {
    const bytes = toBytes(String(text));
    const version = VERSIONS.filter((v) => bytes.length <= v.capacity)[0];
    if (!version) throw new Error('Too much data for a version 10 QR code');

    const codewords = buildCodewords(encodeData(bytes, version), version);
    const size = version.v * 4 + 17;

    const base = newMatrix(size);
    patterns(base, version);
    writeData(base, codewords);

    let best = null;
    for (let mask = 0; mask < 8; mask++) {
      const candidate = applyMask(base, mask);
      writeFormat(candidate, mask, version.v);
      const score = penalty(candidate);
      if (!best || score < best.score) best = { score: score, matrix: candidate };
    }
    return { size: size, modules: best.matrix.modules, version: version.v };
  }

  /** Renders an encoded matrix as a standalone SVG string. */
  function svg(text, options) {
    const opts = options || {};
    const quiet = opts.quiet == null ? 4 : opts.quiet;
    const { size, modules } = encode(text);
    const total = size + quiet * 2;
    let path = '';
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (modules[r][c]) path += 'M' + (c + quiet) + ' ' + (r + quiet) + 'h1v1h-1z';
      }
    }
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges">' +
      '<rect width="' + total + '" height="' + total + '" fill="' + (opts.background || '#ffffff') + '"/>' +
      '<path d="' + path + '" fill="' + (opts.foreground || '#000000') + '"/></svg>';
  }

  return { encode: encode, svg: svg };
});
