// api/seed.js
// Guarda y recupera el primer turno (u/a) mediante token corto.
// Métodos:
//  - POST  { id, u, a, ttl? } -> { token }
//  - GET   ?token=...         -> { id, u, a }  (consume y elimina)

const URL_REDIS  = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_REDIS= process.env.UPSTASH_REDIS_REST_TOKEN;

function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}

async function upstash(cmd, ...args) {
  const body = JSON.stringify([cmd, ...args]);
  const r = await fetch(`${URL_REDIS}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN_REDIS}`,
      'Content-Type': 'application/json'
    },
    body
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data?.error || 'Upstash error');
  return data; // { result: ... }
}

function rndToken() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function getRawBody(req, limit = 1 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Body demasiado grande')); req.destroy(); } chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

module.exports = async (req, res) => {
  if (!URL_REDIS || !TOKEN_REDIS) {
    return json(res, 500, { error: 'Faltan credenciales Upstash' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  if (req.method === 'OPTIONS') return res.end();

  if (req.method === 'GET') {
    const token = (new URL(req.url, 'http://x')).searchParams.get('token') || '';
    if (!token) return json(res, 400, { error: 'Falta token' });

    try {
      // GET y borrar (consumible una sola vez)
      const key = `seed:${token}`;
      const data = await upstash('GET', key);
      if (!data?.result) return json(res, 404, { error: 'Token no encontrado o expirado' });

      // Intenta borrar para consumo único
      try { await upstash('DEL', key); } catch {}
      let payload;
      try { payload = JSON.parse(data.result); } catch { payload = null; }
      if (!payload) return json(res, 500, { error: 'Payload inválido' });

      return json(res, 200, payload); // { id, u, a }
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  if (req.method === 'POST') {
    try {
      const raw = await getRawBody(req);
      const body = JSON.parse(raw || '{}');
      const id = String(body.id || '').trim();
      const u  = String(body.u  || '').trim();
      const a  = String(body.a  || '').trim();
      const ttl = Math.max(10, Math.min(600, Number(body.ttl || 180))); // 3 min por defecto

      if (!u || !a) return json(res, 400, { error: 'Faltan u/a' });

      const token = rndToken();
      const key   = `seed:${token}`;
      const value = JSON.stringify({ id, u, a });

      // SETEX key ttl value
      await upstash('SETEX', key, ttl, value);

      return json(res, 200, { token, ttl });
    } catch (e) {
      return json(res, 500, { error: String(e.message || e) });
    }
  }

  res.setHeader('Allow', 'GET, POST, OPTIONS');
  return json(res, 405, { error: 'Method not allowed' });
};
