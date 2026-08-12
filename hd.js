/* ============================================================
   Dicey — HD wallet address derivation

   Turns one BIP39 mnemonic into a fresh deposit address per
   player per chain:

     ETH (also ERC-20)   m/44'/60'/0'/0/<index>
     BTC (native segwit) m/84'/0'/0'/0/<index>
     SOL (also SPL)      m/44'/501'/<index>'/0'
     TRX (also TRC-20)   m/44'/195'/0'/0/<index>

   Only public addresses ever leave this file. Private keys are
   derived to compute them and are never stored or exported, and
   nothing in the app can sign or move funds.
   ============================================================ */

'use strict';

const crypto = require('crypto');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest();
const ripemd160 = (buf) => crypto.createHash('ripemd160').update(buf).digest();
const hash160 = (buf) => ripemd160(sha256(buf));
const hmac512 = (key, data) => crypto.createHmac('sha512', key).update(data).digest();

/* ------------------------------------------------------------------ keccak-256 */

const RC = [
  0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n,
  0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n,
  0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an,
  0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n,
  0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an,
  0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n,
];
const ROTC = [1, 3, 6, 10, 15, 21, 28, 36, 45, 55, 2, 14, 27, 41, 56, 8, 25, 43, 62, 18, 39, 61, 20, 44];
const PILN = [10, 7, 11, 17, 18, 3, 5, 16, 8, 21, 24, 4, 15, 23, 19, 13, 12, 2, 20, 14, 22, 9, 6, 1];
const MASK64 = (1n << 64n) - 1n;
const rotl = (x, n) => ((x << BigInt(n)) | (x >> BigInt(64 - n))) & MASK64;

function permute(state) {
  const bc = new Array(5);
  for (let round = 0; round < 24; round++) {
    for (let i = 0; i < 5; i++) bc[i] = state[i] ^ state[i + 5] ^ state[i + 10] ^ state[i + 15] ^ state[i + 20];
    for (let i = 0; i < 5; i++) {
      const t = bc[(i + 4) % 5] ^ rotl(bc[(i + 1) % 5], 1);
      for (let j = 0; j < 25; j += 5) state[j + i] ^= t;
    }
    let t = state[1];
    for (let i = 0; i < 24; i++) {
      const j = PILN[i];
      const tmp = state[j];
      state[j] = rotl(t, ROTC[i]);
      t = tmp;
    }
    for (let j = 0; j < 25; j += 5) {
      for (let i = 0; i < 5; i++) bc[i] = state[j + i];
      for (let i = 0; i < 5; i++) state[j + i] ^= (~bc[(i + 1) % 5] & MASK64) & bc[(i + 2) % 5];
    }
    state[0] ^= RC[round];
  }
}

/** Keccak-256 (the Ethereum variant, not NIST SHA3-256). */
function keccak256(input) {
  const rate = 136;
  const state = new Array(25).fill(0n);
  const padded = Buffer.alloc(Math.ceil((input.length + 1) / rate) * rate);
  input.copy(padded);
  padded[input.length] = 0x01;
  padded[padded.length - 1] |= 0x80;

  for (let offset = 0; offset < padded.length; offset += rate) {
    for (let i = 0; i < rate / 8; i++) {
      state[i] ^= padded.readBigUInt64LE(offset + i * 8);
    }
    permute(state);
  }

  const out = Buffer.alloc(32);
  for (let i = 0; i < 4; i++) out.writeBigUInt64LE(state[i], i * 8);
  return out;
}

/* ------------------------------------------------------------------ encodings */

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function base58(buf) {
  let value = 0n;
  for (const byte of buf) value = value * 256n + BigInt(byte);
  let out = '';
  while (value > 0n) {
    out = B58[Number(value % 58n)] + out;
    value /= 58n;
  }
  for (const byte of buf) {
    if (byte !== 0) break;
    out = '1' + out;
  }
  return out || '1';
}

function base58Decode(text) {
  let value = 0n;
  for (const ch of text) {
    const digit = B58.indexOf(ch);
    if (digit < 0) return null;
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = '0' + hex;
  const body = value === 0n ? Buffer.alloc(0) : Buffer.from(hex, 'hex');
  let zeros = 0;
  for (const ch of text) {
    if (ch !== '1') break;
    zeros++;
  }
  return Buffer.concat([Buffer.alloc(zeros), body]);
}

const base58check = (payload) => base58(Buffer.concat([payload, sha256(sha256(payload)).slice(0, 4)]));

/** Decodes a base58check string and returns the payload, or null if the checksum is wrong. */
function base58checkDecode(text) {
  const raw = base58Decode(text);
  if (!raw || raw.length < 5) return null;
  const payload = raw.slice(0, -4);
  const want = sha256(sha256(payload)).slice(0, 4);
  return want.equals(raw.slice(-4)) ? payload : null;
}

const BECH32 = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let i = 0; i < 5; i++) if ((top >> i) & 1) chk ^= GEN[i];
  }
  return chk;
}

function hrpExpand(hrp) {
  const out = [];
  for (const ch of hrp) out.push(ch.charCodeAt(0) >> 5);
  out.push(0);
  for (const ch of hrp) out.push(ch.charCodeAt(0) & 31);
  return out;
}

function convertBits(data, from, to, pad) {
  let acc = 0, bits = 0;
  const out = [];
  const maxv = (1 << to) - 1;
  for (const value of data) {
    acc = (acc << from) | value;
    bits += from;
    while (bits >= to) { bits -= to; out.push((acc >> bits) & maxv); }
  }
  if (pad && bits) out.push((acc << (to - bits)) & maxv);
  return out;
}

/** bech32 encode, used for native segwit (bc1…) addresses. */
function bech32(hrp, data) {
  const values = hrpExpand(hrp).concat(data);
  const mod = polymod(values.concat([0, 0, 0, 0, 0, 0])) ^ 1;
  const checksum = [];
  for (let i = 0; i < 6; i++) checksum.push((mod >> (5 * (5 - i))) & 31);
  return hrp + '1' + data.concat(checksum).map((v) => BECH32[v]).join('');
}

/** True when text is a bech32 (or bech32m) string with the given prefix and a sound checksum. */
function bech32Valid(hrp, text) {
  const lower = text.toLowerCase();
  if (text !== lower && text !== text.toUpperCase()) return false;
  if (lower.indexOf(hrp + '1') !== 0) return false;
  const data = [];
  for (const ch of lower.slice(hrp.length + 1)) {
    const value = BECH32.indexOf(ch);
    if (value < 0) return false;
    data.push(value);
  }
  if (data.length < 6) return false;
  const mod = polymod(hrpExpand(hrp).concat(data));
  return mod === 1 || mod === 0x2bc830a3;   // bech32 or bech32m (taproot)
}

/* ------------------------------------------------------------------ secp256k1 / bip32 */

const N = 0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;

function pubkey(priv, compressed) {
  const ecdh = crypto.createECDH('secp256k1');
  ecdh.setPrivateKey(priv);
  return ecdh.getPublicKey(null, compressed ? 'compressed' : 'uncompressed');
}

function masterKey(seed, curveKey) {
  const digest = hmac512(Buffer.from(curveKey, 'utf8'), seed);
  return { key: digest.slice(0, 32), chainCode: digest.slice(32) };
}

/** BIP32 private child derivation; hardened when index >= 2^31. */
function ckdPriv(node, index) {
  const data = Buffer.alloc(37);
  if (index >= 0x80000000) {
    data[0] = 0;
    node.key.copy(data, 1);
  } else {
    pubkey(node.key, true).copy(data, 0);
  }
  data.writeUInt32BE(index >>> 0, 33);

  const digest = hmac512(node.chainCode, data);
  const child = (BigInt('0x' + digest.slice(0, 32).toString('hex')) + BigInt('0x' + node.key.toString('hex'))) % N;
  if (child === 0n) throw new Error('Invalid derivation index');
  return {
    key: Buffer.from(child.toString(16).padStart(64, '0'), 'hex'),
    chainCode: digest.slice(32),
  };
}

/** SLIP-0010 ed25519 derivation; every level must be hardened. */
function ckdPrivEd(node, index) {
  const data = Buffer.alloc(37);
  data[0] = 0;
  node.key.copy(data, 1);
  data.writeUInt32BE((index | 0x80000000) >>> 0, 33);
  const digest = hmac512(node.chainCode, data);
  return { key: digest.slice(0, 32), chainCode: digest.slice(32) };
}

function derive(seed, path) {
  const parts = path.replace(/^m\//, '').split('/');
  let node = masterKey(seed, 'Bitcoin seed');
  for (const part of parts) {
    const hardened = part.endsWith("'");
    const index = parseInt(hardened ? part.slice(0, -1) : part, 10) + (hardened ? 0x80000000 : 0);
    node = ckdPriv(node, index);
  }
  return node;
}

function deriveEd(seed, indexes) {
  let node = masterKey(seed, 'ed25519 seed');
  for (const index of indexes) node = ckdPrivEd(node, index);
  return node;
}

function ed25519Public(seed32) {
  const der = Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed32]);
  const key = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  return crypto.createPublicKey(key).export({ format: 'der', type: 'spki' }).slice(-32);
}

/* ------------------------------------------------------------------ mnemonic */

function mnemonicToSeed(mnemonic, passphrase) {
  const normalized = mnemonic.normalize('NFKD').trim().replace(/\s+/g, ' ');
  return crypto.pbkdf2Sync(normalized, 'mnemonic' + (passphrase || ''), 2048, 64, 'sha512');
}

/* ------------------------------------------------------------------ addresses */

/** EIP-55 mixed-case checksum address. */
function ethChecksum(hex) {
  const lower = hex.toLowerCase();
  const hash = keccak256(Buffer.from(lower, 'utf8')).toString('hex');
  let out = '0x';
  for (let i = 0; i < lower.length; i++) {
    out += parseInt(hash[i], 16) >= 8 ? lower[i].toUpperCase() : lower[i];
  }
  return out;
}

function ethAddress(seed, index) {
  const node = derive(seed, "m/44'/60'/0'/0/" + index);
  const pub = pubkey(node.key, false).slice(1);
  return ethChecksum(keccak256(pub).slice(-20).toString('hex'));
}

function btcAddress(seed, index) {
  const node = derive(seed, "m/84'/0'/0'/0/" + index);
  const program = hash160(pubkey(node.key, true));
  return bech32('bc', [0].concat(convertBits(program, 8, 5, true)));
}

function btcLegacyAddress(seed, index) {
  const node = derive(seed, "m/44'/0'/0'/0/" + index);
  return base58check(Buffer.concat([Buffer.from([0x00]), hash160(pubkey(node.key, true))]));
}

function solAddress(seed, index) {
  const node = deriveEd(seed, [44, 501, index, 0]);
  return base58(ed25519Public(node.key));
}

/**
 * Tron shares Ethereum's secp256k1 key and keccak hash, so the address is the
 * same 20 bytes wearing a different coat: prefix 0x41, then base58check.
 */
function tronAddress(seed, index) {
  const node = derive(seed, "m/44'/195'/0'/0/" + index);
  const pub = pubkey(node.key, false).slice(1);
  return base58check(Buffer.concat([Buffer.from([0x41]), keccak256(pub).slice(-20)]));
}

/**
 * One address per chain for one player. Tokens ride the chain they live on:
 * USDT and USDC on Ethereum use the ETH address, on Solana the SOL address
 * and on Tron the TRX address.
 */
function addressesFor(seed, index) {
  return {
    ETH: ethAddress(seed, index),
    BTC: btcAddress(seed, index),
    SOL: solAddress(seed, index),
    TRX: tronAddress(seed, index),
  };
}

/* ------------------------------------------------------------------ validation */

/**
 * Does this look like a real address on that chain? Checksums are verified, so a
 * withdrawal cannot be sent to a mistyped address that only *looks* plausible.
 */
function validAddress(chain, address) {
  const text = String(address || '').trim();
  if (!text) return false;

  if (chain === 'ETH') {
    if (!/^0x[0-9a-fA-F]{40}$/.test(text)) return false;
    const body = text.slice(2);
    if (body === body.toLowerCase() || body === body.toUpperCase()) return true;
    return ethChecksum(body.toLowerCase()) === text;   // mixed case means EIP-55
  }

  if (chain === 'TRX') {
    if (!/^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(text)) return false;
    const payload = base58checkDecode(text);
    return !!payload && payload.length === 21 && payload[0] === 0x41;
  }

  if (chain === 'SOL') {
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text)) return false;
    const raw = base58Decode(text);
    return !!raw && raw.length === 32;
  }

  if (chain === 'BTC') {
    if (/^(bc1|BC1)/.test(text)) return bech32Valid('bc', text);
    const payload = base58checkDecode(text);
    return !!payload && payload.length === 21 && (payload[0] === 0x00 || payload[0] === 0x05);
  }

  return true;   // an unknown chain is not ours to judge
}

module.exports = {
  keccak256: keccak256,
  mnemonicToSeed: mnemonicToSeed,
  addressesFor: addressesFor,
  ethAddress: ethAddress,
  btcAddress: btcAddress,
  btcLegacyAddress: btcLegacyAddress,
  solAddress: solAddress,
  tronAddress: tronAddress,
  validAddress: validAddress,
  base58: base58,
  base58Decode: base58Decode,
  bech32: bech32,
  convertBits: convertBits,
};
