/**
 * HoopStats API — Cloudflare Workers
 * Endpoints: /auth/register, /auth/login, /data/:entity
 */

// ==================== CORS ====================
const ALLOWED_ORIGINS = [
  'https://statstalking.com',
  'https://api.statstalking.com',
  'http://localhost:8910',
  'http://127.0.0.1:8910'
];

function getCORSHeaders(origin) {
  const allowOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function cors(res, origin) {
  const corsHdrs = origin ? getCORSHeaders(origin) : CORS_HEADERS;
  return new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), ...corsHdrs } });
}

function _json(data, status = 200, origin) {
  const corsHdrs = origin ? getCORSHeaders(origin) : CORS_HEADERS;
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...corsHdrs } });
}

function _error(msg, status = 400, origin) {
  return _json({ error: msg }, status, origin);
}

// ==================== Crypto Utils ====================
async function hashPassword(password, salt) {
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateId() {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== JWT ====================
async function signJWT(payload, secret) {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const parts = [
    btoaUrl(JSON.stringify(header)),
    btoaUrl(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 * 30 }))
  ];
  const toSign = parts.join('.');
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
  const sigStr = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return toSign + '.' + btoaUrl(sigStr);
}

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const encoder = new TextEncoder();
    const toSign = parts[0] + '.' + parts[1];
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(toSign));
    const expectedSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (expectedSig !== fromBtoaUrl(parts[2])) return null;
    const payload = JSON.parse(fromBtoaUrl(parts[1]));
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch { return null; }
}

function btoaUrl(str) {
  return btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBtoaUrl(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return decodeURIComponent(escape(atob(str)));
}

// ==================== Auth Middleware ====================
async function authenticate(request, env) {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return await verifyJWT(auth.slice(7), env.JWT_SECRET);
}

// ==================== Router ====================
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const origin = request.headers.get('Origin') || '';

  // Curried helpers with origin
  const json = (data, status) => _json(data, status, origin);
  const error = (msg, status) => _error(msg, status, origin);

  // CORS preflight
  if (method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCORSHeaders(origin) });
  }

  // POST /auth/register
  if (path === '/auth/register' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return error('Invalid JSON'); }
    const { email, password, name } = body;
    if (!email || !password) return error('Email and password required');
    if (password.length < 6) return error('Password must be at least 6 characters');

    // Check if email exists
    const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
    if (existing) return error('Email already registered', 409);

    const id = generateId();
    const salt = generateSalt();
    const passwordHash = salt + ':' + await hashPassword(password, salt);
    const now = Math.floor(Date.now() / 1000);

    await env.DB.prepare('INSERT INTO users (id, email, password_hash, name, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, email, passwordHash, name || email.split('@')[0], now).run();

    const token = await signJWT({ sub: id, email }, env.JWT_SECRET);
    return json({ token, user: { id, email, name: name || email.split('@')[0] } });
  }

  // POST /auth/login
  if (path === '/auth/login' && method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return error('Invalid JSON'); }
    const { email, password } = body;
    if (!email || !password) return error('Email and password required');

    const user = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
    if (!user) return error('Invalid email or password', 401);

    const [salt, storedHash] = user.password_hash.split(':');
    const computedHash = await hashPassword(password, salt);
    if (computedHash !== storedHash) return error('Invalid email or password', 401);

    const token = await signJWT({ sub: user.id, email: user.email }, env.JWT_SECRET);
    return json({ token, user: { id: user.id, email: user.email, name: user.name } });
  }

  // POST /data/:entity (teams | players | games)
  const dataMatch = path.match(/^\/data\/(teams|players|games)$/);
  if (dataMatch && method === 'POST') {
    const payload = await authenticate(request, env);
    if (!payload) return error('Unauthorized', 401);

    const entity = dataMatch[1];
    let body;
    try { body = await request.json(); } catch { return error('Invalid JSON'); }
    const { data, source } = body;
    if (!data) return error('Data field required');

    const now = Math.floor(Date.now() / 1000);
    await env.DB.prepare(
      'INSERT INTO user_data (user_id, data_key, data_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, data_key) DO UPDATE SET data_json = ?, updated_at = ?'
    ).bind(payload.sub, entity, JSON.stringify(data), now, JSON.stringify(data), now).run();

    return json({ success: true, synced: entity });
  }

  // GET /stats — simple health check
  if (path === '/stats' && method === 'GET') {
    const userCount = await env.DB.prepare('SELECT COUNT(*) as count FROM users').first();
    return json({ status: 'ok', users: userCount.count });
  }

  return error('Not found', 404);
}

// ==================== Worker Entry ====================
export default {
  async fetch(request, env) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      console.error(e);
      return _error('Internal Server Error: ' + e.message, 500);
    }
  }
};
