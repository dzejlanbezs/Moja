/* ============================================================
   Dicey — Ethereum deposit watching

   Read-only on purpose. Players send straight to the house
   address, so nothing here ever holds a private key, signs a
   transaction or moves funds. All it does is notice incoming
   ETH / USDT / USDC and report them so they can be credited.
   ============================================================ */

'use strict';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const TOKENS = {
  USDT: { address: '0xdac17f958d2ee523a2206206994597c13d831ec7', decimals: 6, stable: true },
  USDC: { address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', decimals: 6, stable: true },
};

const config = {
  rpcUrl: process.env.DICEY_RPC_URL || 'https://ethereum-rpc.publicnode.com',
  house: (process.env.DICEY_HOUSE_ADDRESS || '0xd124c4ce3fd72f9d25df8eb279266f07c2abc3f6').toLowerCase(),
  confirmations: parseInt(process.env.DICEY_CONFIRMATIONS, 10) || 3,
  pollMs: parseInt(process.env.DICEY_POLL_MS, 10) || 20000,
  maxBlocksPerPoll: 12,
  watchNative: process.env.DICEY_WATCH_ETH !== '0',
  ethUsdOverride: parseFloat(process.env.DICEY_ETH_USD) || 0,
  priceUrl: 'https://api.coinbase.com/v2/prices/ETH-USD/spot',
};

let rpcId = 0;
let online = false;
let lastError = '';

/* ------------------------------------------------------------------ rpc */

async function rpc(method, params) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(config.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method: method, params: params || [] }),
      signal: controller.signal,
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error.message || 'RPC error');
    online = true;
    lastError = '';
    return data.result;
  } catch (err) {
    online = false;
    lastError = err.message;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const hexToInt = (hex) => parseInt(hex, 16);
const hexToBig = (hex) => BigInt(hex && hex !== '0x' ? hex : '0x0');
const addrFromTopic = (topic) => '0x' + String(topic).slice(-40).toLowerCase();

function scaled(raw, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  return Number(whole) + Number(frac) / Number(divisor);
}

const tokenByAddress = (address) => {
  const key = Object.keys(TOKENS).filter((sym) => TOKENS[sym].address === String(address).toLowerCase())[0];
  return key ? Object.assign({ symbol: key }, TOKENS[key]) : null;
};

/* ------------------------------------------------------------------ price */

let priceCache = { value: 0, at: 0 };

async function ethUsd() {
  if (config.ethUsdOverride) return config.ethUsdOverride;
  if (priceCache.value && Date.now() - priceCache.at < 300000) return priceCache.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(config.priceUrl, { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    const value = parseFloat(data && data.data && data.data.amount);
    if (value > 0) priceCache = { value: value, at: Date.now() };
  } catch (err) {
    /* keep whatever we had; the caller decides what to do without a price */
  }
  return priceCache.value;
}

/** USD value of a deposit, or 0 when we cannot price it (ETH with no feed). */
async function usdValue(coin, amount) {
  if (coin === 'USDT' || coin === 'USDC') return Math.round(amount * 100) / 100;
  const price = await ethUsd();
  return price ? Math.round(amount * price * 100) / 100 : 0;
}

/* ------------------------------------------------------------------ scanning */

/** Token transfers into the house address inside a block range. */
async function tokenDeposits(fromBlock, toBlock) {
  const logs = await rpc('eth_getLogs', [{
    fromBlock: '0x' + fromBlock.toString(16),
    toBlock: '0x' + toBlock.toString(16),
    address: Object.keys(TOKENS).map((sym) => TOKENS[sym].address),
    topics: [TRANSFER_TOPIC, null, '0x000000000000000000000000' + config.house.slice(2)],
  }]);

  return Promise.all((logs || []).map(async (log) => {
    const token = tokenByAddress(log.address);
    if (!token) return null;
    const amount = scaled(hexToBig(log.data), token.decimals);
    return {
      txHash: log.transactionHash,
      from: addrFromTopic(log.topics[1]),
      coin: token.symbol,
      amount: amount,
      usd: await usdValue(token.symbol, amount),
      blockNumber: hexToInt(log.blockNumber),
    };
  })).then((rows) => rows.filter(Boolean));
}

/** Plain ETH transfers into the house address inside a block range. */
async function nativeDeposits(fromBlock, toBlock) {
  const found = [];
  for (let n = fromBlock; n <= toBlock; n++) {
    const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true]);
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      if (!tx.to || tx.to.toLowerCase() !== config.house) continue;
      const value = hexToBig(tx.value);
      if (value === 0n) continue;
      const amount = scaled(value, 18);
      found.push({
        txHash: tx.hash,
        from: String(tx.from).toLowerCase(),
        coin: 'ETH',
        amount: amount,
        usd: await usdValue('ETH', amount),
        blockNumber: hexToInt(tx.blockNumber),
      });
    }
  }
  return found;
}

/* ------------------------------------------------------------------ public api */

/**
 * Verifies a single transaction hash a player pasted in.
 * Resolves with the deposit details or throws with a readable reason.
 */
async function verifyTx(txHash) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('That does not look like a transaction hash');

  const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
  if (!receipt) throw new Error('Transaction not found yet — wait for it to be mined');
  if (receipt.status && hexToInt(receipt.status) !== 1) throw new Error('That transaction failed on-chain');

  const latest = hexToInt(await rpc('eth_blockNumber', []));
  const confirmations = latest - hexToInt(receipt.blockNumber) + 1;

  // token transfer into the house address, wherever it was routed from
  for (const log of receipt.logs || []) {
    if (String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    if (addrFromTopic(log.topics[2]) !== config.house) continue;
    const token = tokenByAddress(log.address);
    if (!token) continue;
    const amount = scaled(hexToBig(log.data), token.decimals);
    return {
      txHash: txHash.toLowerCase(),
      from: addrFromTopic(log.topics[1]),
      coin: token.symbol,
      amount: amount,
      usd: await usdValue(token.symbol, amount),
      blockNumber: hexToInt(receipt.blockNumber),
      confirmations: confirmations,
      enough: confirmations >= config.confirmations,
    };
  }

  const tx = await rpc('eth_getTransactionByHash', [txHash]);
  if (tx && tx.to && tx.to.toLowerCase() === config.house && hexToBig(tx.value) > 0n) {
    const amount = scaled(hexToBig(tx.value), 18);
    return {
      txHash: txHash.toLowerCase(),
      from: String(tx.from).toLowerCase(),
      coin: 'ETH',
      amount: amount,
      usd: await usdValue('ETH', amount),
      blockNumber: hexToInt(receipt.blockNumber),
      confirmations: confirmations,
      enough: confirmations >= config.confirmations,
    };
  }

  throw new Error('That transaction did not send ETH, USDT or USDC to our deposit address');
}

/**
 * Polls new blocks and hands every incoming deposit to onDeposit().
 * cursor.get() / cursor.set() let the caller persist the scan position.
 */
function watch(cursor, onDeposit) {
  let running = false;

  async function tick() {
    if (running) return;
    running = true;
    try {
      const latest = hexToInt(await rpc('eth_blockNumber', []));
      const safeTip = latest - config.confirmations;
      let from = cursor.get();

      if (!from) { cursor.set(safeTip); return; }            // first run: start from now
      if (safeTip <= from) return;                            // nothing new yet
      if (safeTip - from > config.maxBlocksPerPoll) {
        // public nodes refuse deep history; skip ahead rather than fail forever
        from = safeTip - config.maxBlocksPerPoll;
      }

      const to = safeTip;
      const found = await tokenDeposits(from + 1, to);
      if (config.watchNative) found.push(...await nativeDeposits(from + 1, to));

      for (const deposit of found) {
        try { await onDeposit(deposit); } catch (err) { console.error('deposit handler:', err.message); }
      }
      cursor.set(to);
    } catch (err) {
      console.error('chain watcher:', err.message);
    } finally {
      running = false;
    }
  }

  tick();
  const timer = setInterval(tick, config.pollMs);
  if (timer.unref) timer.unref();
  return { tick: tick };
}

async function status() {
  try {
    const block = hexToInt(await rpc('eth_blockNumber', []));
    return { online: true, block: block, house: config.house, confirmations: config.confirmations, ethUsd: await ethUsd() };
  } catch (err) {
    return { online: false, error: err.message, house: config.house, confirmations: config.confirmations };
  }
}

module.exports = {
  config: config,
  tokens: TOKENS,
  verifyTx: verifyTx,
  watch: watch,
  status: status,
  ethUsd: ethUsd,
  get online() { return online; },
  get lastError() { return lastError; },
};
