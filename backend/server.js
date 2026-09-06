// AvaxGuard backend - zero-dependency native http server
// Avalanche Fuji C-Chain allowance security scanner
// Node >= 18 (native fetch). Run: node server.js
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

// ---------- load .env (zero-dependency, 不覆盖已有环境变量) ----------
(function loadEnv() {
  try {
    const envFile = path.join(__dirname, '.env');
    if (!fs.existsSync(envFile)) return;
    const content = fs.readFileSync(envFile, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
      }
    }
  } catch (e) { /* best-effort */ }
})();

// ---------- config ----------
const PORT = process.env.PORT || 3001;
const RPC = process.env.FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc';
// demo token: MockUSDC (fill after deployment to Fuji)
const MOCK_USDC = process.env.MOCK_USDC_ADDR || '0x0000000000000000000000000000000000000000';
// demo spender presets (address:label)
const RISK_SPENDERS = parseRisk(process.env.RISK_SPENDERS || '');
// DeepSeek AI 润色 (可选: 不配置则纯规则引擎)
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const DEEPSEEK_URL = process.env.DEEPSEEK_URL || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

// thresholds in raw units (MockUSDC has 6 decimals)
const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
const HIGH_THRESHOLD = BigInt(1000) * BigInt(1e6); // >= 1000 mUSDC

// ---------- tiny helpers ----------
function parseRisk(s) {
  const map = {};
  if (!s) return map;
  for (const pair of s.split(',')) {
    const [addr, label] = pair.split(':');
    if (addr) map[addr.toLowerCase()] = label || 'unknown';
  }
  return map;
}

function parseBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

// eth_call to RPC (read-only)
async function ethCall(to, data, from) {
  const body = {
    jsonrpc: '2.0', id: 1, method: 'eth_call',
    params: [{ to, data, ...(from ? { from } : {}) }, 'latest'],
  };
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (json.error) throw new Error('eth_call failed: ' + JSON.stringify(json.error));
  return json.result;
}

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(method + ' failed: ' + JSON.stringify(json.error));
  return json.result;
}

// ABI encode: selector + 2 x 32-byte padded args (no dynamic types needed)
function encodeAllowance(owner, spender) {
  const sel = '0xdd62ed3e'; // allowance(address,address)
  return sel + pad(owner) + pad(spender);
}
function encodeApprove(spender, amount) {
  const sel = '0x095ea7b3'; // approve(address,uint256)
  return sel + pad(spender) + amount.replace(/^0x/, '').padStart(64, '0');
}
function pad(hexAddr) {
  return hexAddr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
}
function parseUint(hexResult) {
  return BigInt(hexResult || '0x0');
}
function isMaxUint(hexResult) {
  return (hexResult || '').toLowerCase() === MAX_UINT.toLowerCase();
}
function isAddr(s) {
  return typeof s === 'string' && /^0x[0-9a-fA-F]{40}$/.test(s);
}
// default demo tokens/spenders come from env (single source of truth)
const ZERO_ADDR = '0x0000000000000000000000000000000000000000';
function defaultTokens() {
  return (isAddr(MOCK_USDC) && MOCK_USDC.toLowerCase() !== ZERO_ADDR) ? [MOCK_USDC.toLowerCase()] : [];
}
function defaultSpenders() {
  return Object.keys(RISK_SPENDERS);
}

// ---------- rules engine (no AI required) ----------
function grade(tokenAddr, spender, allowanceHex) {
  const label = RISK_SPENDERS[spender.toLowerCase()] || '';
  if (isMaxUint(allowanceHex)) {
    return { level: 'critical', label, reason: '无限授权: dApp 可随时转走你全部余额' };
  }
  const amt = parseUint(allowanceHex);
  if (amt === 0n) return { level: 'none', label, reason: '无授权' };
  if (amt >= HIGH_THRESHOLD) {
    return { level: 'high', label, reason: '大额授权: 超过 1000 测试币, 建议 revoke' };
  }
  return { level: 'medium', label, reason: '存在授权额度, 若不使用建议 revoke' };
}

function buildReport(items) {
  const critical = items.filter((i) => i.grade.level === 'critical');
  const high = items.filter((i) => i.grade.level === 'high');
  const medium = items.filter((i) => i.grade.level === 'medium');
  const total = critical.length + high.length + medium.length;

  // 无风险
  if (!total) return '你的钱包很干净, 没有发现活跃的授权, 资产状态良好。';

  // 通俗一句话式报告 (不用复杂统计)
  const names = (arr) => arr.map((i) => i.grade.label || i.spender.slice(0, 10)).join('、');
  const parts = [];
  if (critical.length) {
    parts.push(`${critical.length} 个 dApp (${names(critical)}) 持有你的无限授权, 一旦被黑可转走你全部资产, 强烈建议立即撤销`);
  }
  if (high.length) {
    parts.push(`${high.length} 个 dApp (${names(high)}) 持有大额授权, 建议撤销后改用小额授权`);
  }
  if (medium.length) {
    parts.push(`${medium.length} 个 dApp (${names(medium)}) 还留着少量授权, 如果不用了建议也撤销`);
  }
  return '扫描发现 ' + parts.join('; ') + '。';
}

// ---------- AI polish (DeepSeek, 可选) ----------
// 规则引擎先出事实报告, AI 只润色措辞不改变事实结论。
// 失败/超时/未配 key 时静默回退到规则引擎原文。
async function aiPolish(baseReport, items) {
  if (!DEEPSEEK_API_KEY) return baseReport;
  const summary = items.map((i) => ({
    spender: i.spender,
    level: i.grade.level,
    label: i.grade.label || '',
    allowance: i.amountHuman,
  }));
  const prompt = [
    '你是区块链钱包安全助手。以下是链上授权扫描的事实报告(规则引擎生成)。',
    '请用通俗易懂的中文, 用一两句话简单告诉用户结果和建议, 不要长篇大论。',
    '重要规则:',
    '1. 以下方"结构化数据(JSON)"为准, label 字段是 dApp 名称(正常中文, 不是乱码),',
    '   直接引用 label 作为 dApp 名, 不要重复写两次名字。',
    '2. 保留关键事实(哪些 dApp、什么风险、建议做什么), 不要新增或虚构数据。',
    '3. 不要改变风险结论, 不要说任何字段是乱码或无法识别。',
    '4. 直接输出一两句话, 不要加前缀或解释, 不要用标题或列表。',
    '',
    '事实报告:',
    baseReport,
    '',
    '结构化数据(JSON):',
    JSON.stringify(summary),
  ].join('\n');
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 15000); // 15s 超时
    const res = await fetch(DEEPSEEK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + DEEPSEEK_API_KEY,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 1000,
      }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return baseReport;
    const json = await res.json();
    const msg = json?.choices?.[0]?.message;
    // reasoning 模型 (如 deepseek-v4-flash) 正式回答在 content,
    // 若为空(思考被 max_tokens 截断)则回退规则引擎原文
    const text = msg?.content;
    if (text && text.trim()) return text.trim();
    return baseReport;
  } catch (e) {
    logEvent('ai_polish_fallback', { reason: e.message });
    return baseReport;
  }
}

// ---------- scan ----------
async function scanTokens(owner, tokens, spenders) {
  const out = [];
  for (const token of tokens) {
    for (const spender of spenders) {
      const allowanceHex = await ethCall(token, encodeAllowance(owner, spender));
      const amt = parseUint(allowanceHex);
      out.push({
        token,
        spender,
        allowance: amt.toString(),
        allowanceHex,
        amountHuman: isMaxUint(allowanceHex) ? '∞' : (Number(amt) / 1e6).toFixed(amt > 0n ? 2 : 0),
        grade: grade(token, spender, allowanceHex),
      });
    }
  }
  return out;
}

// ---------- event log (JSONL, evidence 用) ----------
const LOG_FILE = path.join(__dirname, 'events.jsonl');
function logEvent(type, payload) {
  try {
    const line = JSON.stringify({ ts: new Date().toISOString(), type, ...payload }) + '\n';
    fs.appendFileSync(LOG_FILE, line);
    console.log(line.trim());
  } catch (e) { /* log is best-effort */ }
}

// ---------- http server ----------
function send(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  const url = req.url.split('?')[0];

  // static frontend
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    const file = path.join(__dirname, '..', 'frontend', 'index.html');
    try {
      const html = fs.readFileSync(file, 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    } catch {
      send(res, 404, { ok: false, error: 'frontend/index.html not found' });
      return;
    }
  }

  try {
    if (req.method === 'GET' && url === '/api/health') {
      const blockHex = await rpc('eth_blockNumber', []);
      send(res, 200, { ok: true, rpc: RPC, block: parseInt(blockHex, 16), time: new Date().toISOString() });
      return;
    }

    if (req.method === 'POST' && url === '/api/scan') {
      const body = await parseBody(req);
      const owner = (body.address || '').toLowerCase();
      if (!isAddr(owner)) { send(res, 400, { ok: false, error: 'address 格式错误' }); return; }
      // 未显式传 tokens/spenders 时用环境变量默认 (前端只需发 address)
      const tokens = ((body.tokens || []).filter(isAddr)).map((a) => a.toLowerCase());
      const spenders = ((body.spenders || []).filter(isAddr)).map((a) => a.toLowerCase());
      const effTokens = tokens.length ? tokens : defaultTokens();
      const effSpenders = spenders.length ? spenders : defaultSpenders();
      if (!effTokens.length) { send(res, 400, { ok: false, error: '未配置默认 token (需 MOCK_USDC_ADDR 环境变量)' }); return; }
      if (!effSpenders.length) { send(res, 400, { ok: false, error: '未配置默认 spender (需 RISK_SPENDERS 环境变量)' }); return; }
      const items = await scanTokens(owner, effTokens, effSpenders);
      logEvent('scan', { owner, tokens: effTokens.length, spenders: effSpenders.length, active: items.filter((i) => i.grade.level !== 'none').length });
      send(res, 200, { ok: true, owner, items });
      return;
    }

    if (req.method === 'POST' && url === '/api/report') {
      const body = await parseBody(req);
      const items = Array.isArray(body.items) ? body.items : [];
      const baseReport = buildReport(items);
      // 省额度: 只有存在风险项(非 none)才调 AI 润色, 全"无授权"直接用规则引擎
      const hasRisk = items.some((i) => i.grade && i.grade.level && i.grade.level !== 'none');
      const report = hasRisk ? await aiPolish(baseReport, items) : baseReport;
      const usedAI = hasRisk && !!DEEPSEEK_API_KEY && report !== baseReport;
      logEvent('report', { items: items.length, usedAI });
      send(res, 200, { ok: true, report, aiPolish: usedAI, fallback: !usedAI });
      return;
    }

    if (req.method === 'POST' && url === '/api/preview') {
      // simulate approve(spender, 0) via eth_call (read-only, no broadcast)
      const body = await parseBody(req);
      const token = (body.token || '').toLowerCase();
      const owner = (body.owner || '').toLowerCase();
      const spender = (body.spender || '').toLowerCase();
      if (!isAddr(token) || !isAddr(owner) || !isAddr(spender)) {
        send(res, 400, { ok: false, error: 'token/owner/spender 格式错误' }); return;
      }
      const beforeHex = await ethCall(token, encodeAllowance(owner, spender));
      const before = parseUint(beforeHex).toString();
      const beforeHuman = isMaxUint(beforeHex) ? '∞' : (Number(before) / 1e6).toFixed(before !== '0' ? 2 : 0);
      // eth_call the approve tx from owner: succeeds => simulation ok (state unchanged)
      await ethCall(token, encodeApprove(spender, '0x0'), owner);
      const after = '0';
      const afterHuman = '0';
      const verdict = before === '0' ? 'NO_ACTION_NEEDED' : 'READY_TO_REVOKE';
      logEvent('preview', { token, owner, spender, before, after, verdict });
      send(res, 200, {
        ok: true, simulated: true,
        note: 'eth_call 模拟结果, 未广播链上交易',
        before, after, beforeHuman, afterHuman,
        verdict,
      });
      return;
    }

    if (req.method === 'POST' && url === '/api/verify') {
      const body = await parseBody(req);
      const txHash = (body.txHash || '').toLowerCase();
      if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) { send(res, 400, { ok: false, error: 'txHash 格式错误' }); return; }
      const receipt = await rpc('eth_getTransactionReceipt', [txHash]);
      if (!receipt) { send(res, 200, { ok: false, status: 'PENDING', txHash }); return; }
      const status = parseInt(receipt.status, 16) === 1 ? 'SUCCESS' : 'FAILED';
      // 链上回读: 若传了 token/owner/spender, 成功后再确认 allowance 已归零
      // (证明 revoke 真实生效, 而非只看交易状态)
      let allowanceAfter = null;
      if (status === 'SUCCESS') {
        const token = (body.token || '').toLowerCase();
        const owner = (body.owner || '').toLowerCase();
        const spender = (body.spender || '').toLowerCase();
        if (isAddr(token) && isAddr(owner) && isAddr(spender)) {
          const afterHex = await ethCall(token, encodeAllowance(owner, spender));
          allowanceAfter = parseUint(afterHex).toString();
        }
      }
      logEvent('verify', { txHash, status, blockNumber: parseInt(receipt.blockNumber, 16), allowanceAfter });
      send(res, 200, {
        ok: status === 'SUCCESS',
        status,
        txHash,
        blockNumber: parseInt(receipt.blockNumber, 16),
        from: receipt.from,
        to: receipt.to,
        gasUsed: parseInt(receipt.gasUsed, 16),
        allowanceAfter,
        revokeConfirmed: allowanceAfter !== null && allowanceAfter === '0',
      });
      return;
    }

    send(res, 404, { ok: false, error: 'not found: ' + url });
  } catch (e) {
    send(res, 500, { ok: false, error: e.message });
  }
});

server.listen(PORT, () => {
  console.log('AvaxGuard backend listening on http://localhost:' + PORT);
  console.log('Fuji RPC: ' + RPC);
});
