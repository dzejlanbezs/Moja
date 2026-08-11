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
  solRpcUrl: process.env.DICEY_SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
  btcApiUrl: process.env.DICEY_BTC_API_URL || 'https://blockstream.info/api',
  confirmations: parseInt(process.env.DICEY_CONFIRMATIONS, 10) || 3,
  pollMs: parseInt(process.env.DICEY_POLL_MS, 10) || 20000,
  maxBlocksPerPoll: 12,
  reconcileBatch: parseInt(process.env.DICEY_RECONCILE_BATCH, 10) || 6,
  watchNative: process.env.DICEY_WATCH_ETH !== '0',
  watchBtc: process.env.DICEY_WATCH_BTC !== '0',
  watchSol: process.env.DICEY_WATCH_SOL !== '0',
  ethUsdOverride: parseFloat(process.env.DICEY_ETH_USD) || 0,
  priceUrl: 'https://api.coinbase.com/v2/prices/',
};

// { eth: Map(address -> userId), btc: Map(...), sol: Map(...) }
const watched = { eth: new Map(), btc: new Map(), sol: new Map() };

/** Replaces the set of addresses being watched. Called whenever a player is added. */
function setWatchList(entries) {
  watched.eth.clear();
  watched.btc.clear();
  watched.sol.clear();
  entries.forEach((entry) => {
    if (entry.ETH) watched.eth.set(String(entry.ETH).toLowerCase(), entry.userId);
    if (entry.BTC) watched.btc.set(entry.BTC, entry.userId);
    if (entry.SOL) watched.sol.set(entry.SOL, entry.userId);
  });
}

const watchCount = () => ({ eth: watched.eth.size, btc: watched.btc.size, sol: watched.sol.size });

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

const priceCache = {};

async function spotPrice(symbol) {
  if (symbol === 'ETH' && config.ethUsdOverride) return config.ethUsdOverride;
  const cached = priceCache[symbol];
  if (cached && Date.now() - cached.at < 300000) return cached.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(config.priceUrl + symbol + '-USD/spot', { signal: controller.signal });
    clearTimeout(timer);
    const data = await res.json();
    const value = parseFloat(data && data.data && data.data.amount);
    if (value > 0) priceCache[symbol] = { value: value, at: Date.now() };
  } catch (err) {
    /* keep whatever we had; the caller decides what to do without a price */
  }
  return priceCache[symbol] ? priceCache[symbol].value : 0;
}

const ethUsd = () => spotPrice('ETH');

/** USD value of a deposit, or 0 when we cannot price it. */
async function usdValue(coin, amount) {
  if (coin === 'USDT' || coin === 'USDC') return Math.round(amount * 100) / 100;
  const price = await spotPrice(coin);
  return price ? Math.round(amount * price * 100) / 100 : 0;
}

/* ------------------------------------------------------------------ scanning */

/** Token transfers into any watched address inside a block range. */
async function tokenDeposits(fromBlock, toBlock) {
  if (!watched.eth.size) return [];
  const targets = Array.from(watched.eth.keys()).map((addr) => '0x000000000000000000000000' + addr.slice(2));
  const found = [];

  // topic filters get unwieldy with many addresses, so query in chunks
  for (let i = 0; i < targets.length; i += 100) {
    const logs = await rpc('eth_getLogs', [{
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: '0x' + toBlock.toString(16),
      address: Object.keys(TOKENS).map((sym) => TOKENS[sym].address),
      topics: [TRANSFER_TOPIC, null, targets.slice(i, i + 100)],
    }]);

    for (const log of logs || []) {
      const token = tokenByAddress(log.address);
      if (!token) continue;
      const to = addrFromTopic(log.topics[2]);
      const amount = scaled(hexToBig(log.data), token.decimals);
      found.push({
        txHash: log.transactionHash,
        from: addrFromTopic(log.topics[1]),
        to: to,
        userId: watched.eth.get(to) || null,
        coin: token.symbol,
        amount: amount,
        usd: await usdValue(token.symbol, amount),
        blockNumber: hexToInt(log.blockNumber),
      });
    }
  }
  return found;
}

/** Plain ETH transfers into any watched address inside a block range. */
async function nativeDeposits(fromBlock, toBlock) {
  if (!watched.eth.size) return [];
  const found = [];
  for (let n = fromBlock; n <= toBlock; n++) {
    const block = await rpc('eth_getBlockByNumber', ['0x' + n.toString(16), true]);
    if (!block || !block.transactions) continue;
    for (const tx of block.transactions) {
      const to = tx.to ? tx.to.toLowerCase() : '';
      if (!to || !watched.eth.has(to)) continue;
      const value = hexToBig(tx.value);
      if (value === 0n) continue;
      const amount = scaled(value, 18);
      found.push({
        txHash: tx.hash,
        from: String(tx.from).toLowerCase(),
        to: to,
        userId: watched.eth.get(to),
        coin: 'ETH',
        amount: amount,
        usd: await usdValue('ETH', amount),
        blockNumber: hexToInt(tx.blockNumber),
      });
    }
  }
  return found;
}

/* ---- safety net: compare what we credited with what the chain holds ---- */

const BALANCE_OF = '0x70a08231';
const expectedKey = (address, asset) => 'bal:' + address + ':' + asset;

/** Records that `amount` of `asset` reached `address`, so reconciliation ignores it. */
function noteCredited(state, address, asset, amount) {
  const key = expectedKey(String(address).toLowerCase(), asset);
  const seen = state.get(key);
  if (seen === undefined) return;   // not baselined yet; the first sweep will set it
  state.set(key, seen + amount);
}

async function ethBalance(address) {
  return scaled(hexToBig(await rpc('eth_getBalance', [address, 'latest'])), 18);
}

async function tokenBalance(address, token) {
  const data = BALANCE_OF + '000000000000000000000000' + address.slice(2);
  const result = await rpc('eth_call', [{ to: token.address, data: data }, 'latest']);
  return scaled(hexToBig(result), token.decimals);
}

/**
 * Walks a slice of the watched Ethereum addresses and credits anything the
 * live scan missed — a restart, a skipped block, a flaky node.
 */
async function reconcile(state, cursor) {
  const addresses = Array.from(watched.eth.keys());
  if (!addresses.length) return [];

  const size = Math.min(config.reconcileBatch, addresses.length);
  const start = cursor.index % addresses.length;
  const slice = [];
  for (let i = 0; i < size; i++) slice.push(addresses[(start + i) % addresses.length]);
  cursor.index = (start + size) % addresses.length;

  const found = [];
  for (const address of slice) {
    const userId = watched.eth.get(address);
    const assets = [{ symbol: 'ETH', read: () => ethBalance(address) }];
    Object.keys(TOKENS).forEach((sym) => {
      assets.push({ symbol: sym, read: () => tokenBalance(address, TOKENS[sym]) });
    });

    for (const asset of assets) {
      try {
        const actual = await asset.read();
        const key = expectedKey(address, asset.symbol);
        const expected = state.get(key);

        // first time we look at an address we only take a baseline, so a
        // restored backup never re-credits balances that are already there
        if (expected === undefined) { state.set(key, actual); continue; }

        if (actual > expected + 1e-12) {
          const amount = actual - expected;
          state.set(key, actual);
          found.push({
            txHash: 'reconcile:' + address + ':' + asset.symbol + ':' + actual,
            from: '', to: address, userId: userId,
            coin: asset.symbol, amount: amount,
            usd: await usdValue(asset.symbol, amount),
            blockNumber: 0,
            reconciled: true,
          });
        } else if (actual < expected) {
          state.set(key, actual);   // funds were swept out
        }
      } catch (err) { /* try again on the next sweep */ }
    }
  }
  return found;
}

/* ---- bitcoin: poll the address API for a rise in total received ---- */

async function btcDeposits(state) {
  const found = [];
  for (const [address, userId] of watched.btc) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(config.btcApiUrl + '/address/' + address, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json();
      const funded = (data.chain_stats && data.chain_stats.funded_txo_sum) || 0;
      const key = 'btc:' + address;
      const seen = state.get(key);

      if (seen == null) { state.set(key, funded); continue; }   // first sight: take a baseline
      if (funded <= seen) continue;

      const amount = (funded - seen) / 1e8;
      state.set(key, funded);
      found.push({
        txHash: 'btc:' + address + ':' + funded,
        from: '', to: address, userId: userId,
        coin: 'BTC', amount: amount,
        usd: await usdValue('BTC', amount),
        blockNumber: 0,
      });
    } catch (err) { /* try again next poll */ }
  }
  return found;
}

/* ---- solana: poll balances for a rise ---- */

async function solDeposits(state) {
  const found = [];
  for (const [address, userId] of watched.sol) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(config.solRpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getBalance', params: [address] }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      const data = await res.json();
      if (!data.result) continue;
      const lamports = data.result.value || 0;
      const key = 'sol:' + address;
      const seen = state.get(key);

      if (seen == null) { state.set(key, lamports); continue; }
      if (lamports <= seen) { state.set(key, lamports); continue; }

      const amount = (lamports - seen) / 1e9;
      state.set(key, lamports);
      found.push({
        txHash: 'sol:' + address + ':' + lamports,
        from: '', to: address, userId: userId,
        coin: 'SOL', amount: amount,
        usd: await usdValue('SOL', amount),
        blockNumber: 0,
      });
    } catch (err) { /* try again next poll */ }
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

  // token transfer into one of our deposit addresses, wherever it was routed from
  for (const log of receipt.logs || []) {
    if (String(log.topics[0]).toLowerCase() !== TRANSFER_TOPIC) continue;
    const to = addrFromTopic(log.topics[2]);
    if (!watched.eth.has(to)) continue;
    const token = tokenByAddress(log.address);
    if (!token) continue;
    const amount = scaled(hexToBig(log.data), token.decimals);
    return {
      txHash: txHash.toLowerCase(),
      from: addrFromTopic(log.topics[1]),
      to: to,
      userId: watched.eth.get(to),
      coin: token.symbol,
      amount: amount,
      usd: await usdValue(token.symbol, amount),
      blockNumber: hexToInt(receipt.blockNumber),
      confirmations: confirmations,
      enough: confirmations >= config.confirmations,
    };
  }

  const tx = await rpc('eth_getTransactionByHash', [txHash]);
  const to = tx && tx.to ? tx.to.toLowerCase() : '';
  if (to && watched.eth.has(to) && hexToBig(tx.value) > 0n) {
    const amount = scaled(hexToBig(tx.value), 18);
    return {
      txHash: txHash.toLowerCase(),
      from: String(tx.from).toLowerCase(),
      to: to,
      userId: watched.eth.get(to),
      coin: 'ETH',
      amount: amount,
      usd: await usdValue('ETH', amount),
      blockNumber: hexToInt(receipt.blockNumber),
      confirmations: confirmations,
      enough: confirmations >= config.confirmations,
    };
  }

  throw new Error('That transaction did not send ETH, USDT or USDC to a Dicey deposit address');
}

/**
 * Polls new blocks and hands every incoming deposit to onDeposit().
 * cursor.get() / cursor.set() let the caller persist the scan position.
 */
function watch(store, onDeposit) {
  let running = false;
  const reconcileCursor = { index: 0 };

  async function report(list) {
    for (const deposit of list) {
      // keep the ledger in step so the safety net does not credit this twice
      if (!deposit.reconciled && deposit.to) noteCredited(store.state, deposit.to, deposit.coin, deposit.amount);
      try { await onDeposit(deposit); } catch (err) { console.error('deposit handler:', err.message); }
    }
  }

  async function ethereum() {
    const latest = hexToInt(await rpc('eth_blockNumber', []));
    const safeTip = latest - config.confirmations;
    let from = store.block.get();

    if (!from) { store.block.set(safeTip); return; }   // first run: start from now
    if (safeTip <= from) return;                        // nothing new yet
    if (safeTip - from > config.maxBlocksPerPoll) {
      // public nodes refuse deep history; skip ahead rather than fail forever
      from = safeTip - config.maxBlocksPerPoll;
    }

    const found = await tokenDeposits(from + 1, safeTip);
    if (config.watchNative) found.push(...await nativeDeposits(from + 1, safeTip));
    await report(found);
    store.block.set(safeTip);
  }

  async function tick() {
    if (running) return;
    running = true;
    try {
      await ethereum();
    } catch (err) {
      console.error('chain watcher (eth):', err.message);
    }
    try {
      if (config.watchBtc && watched.btc.size) await report(await btcDeposits(store.state));
    } catch (err) {
      console.error('chain watcher (btc):', err.message);
    }
    try {
      if (config.watchSol && watched.sol.size) await report(await solDeposits(store.state));
    } catch (err) {
      console.error('chain watcher (sol):', err.message);
    }
    try {
      await report(await reconcile(store.state, reconcileCursor));
    } catch (err) {
      console.error('chain watcher (reconcile):', err.message);
    }
    running = false;
  }

  tick();
  const timer = setInterval(tick, config.pollMs);
  if (timer.unref) timer.unref();
  return { tick: tick };
}

async function status() {
  try {
    const block = hexToInt(await rpc('eth_blockNumber', []));
    return { online: true, block: block, watching: watchCount(), confirmations: config.confirmations, ethUsd: await ethUsd() };
  } catch (err) {
    return { online: false, error: err.message, watching: watchCount(), confirmations: config.confirmations };
  }
}

module.exports = {
  config: config,
  tokens: TOKENS,
  setWatchList: setWatchList,
  watchCount: watchCount,
  verifyTx: verifyTx,
  watch: watch,
  status: status,
  spotPrice: spotPrice,
  ethUsd: ethUsd,
  get online() { return online; },
  get lastError() { return lastError; },
};
