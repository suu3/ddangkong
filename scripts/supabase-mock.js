/**
 * 로컬 실시간 테스트용 Supabase 목 서버.
 * 사용법: `node scripts/supabase-mock.js` + `.env`의 NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
 *
 * 이 앱이 쓰는 표면만 구현한다:
 *  - REST: POST/GET/PATCH /rest/v1/rooms (game_state->>revision 낙관적 잠금 포함)
 *  - Realtime (Phoenix vsn 2.0.0): phx_join / heartbeat / broadcast(바이너리 push) / presence track / phx_leave
 * 서버 -> 클라이언트 메시지는 v2 텍스트 포맷: [join_ref, ref, topic, event, payload]
 */
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// ws는 next의 전이 의존성이라 .pnpm 스토어에서 찾는다
const pnpmDir = path.join(__dirname, '..', 'node_modules', '.pnpm');
const wsDir = fs.readdirSync(pnpmDir).find(name => /^ws@\d/.test(name));
if (!wsDir) throw new Error('ws package not found under node_modules/.pnpm');
const { WebSocketServer } = require(path.join(pnpmDir, wsDir, 'node_modules', 'ws'));

const PORT = 54321;
const rooms = new Map(); // id -> row

// ---------- REST ----------
const readBody = req =>
  new Promise(resolve => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => resolve(data));
  });

const pgrst116 = res => {
  res.writeHead(406, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(
    JSON.stringify({
      code: 'PGRST116',
      message: 'JSON object requested, multiple (or no) rows returned',
      details: 'Results contain 0 rows',
      hint: null,
    })
  );
};

const json = (res, status, obj) => {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(obj));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  if (!url.pathname.startsWith('/rest/v1/rooms')) {
    return json(res, 404, { message: 'not found' });
  }

  const idFilter = (url.searchParams.get('id') || '').replace(/^eq\./, '');
  const revFilter = (url.searchParams.get('game_state->>revision') || '').replace(/^eq\./, '');

  if (req.method === 'POST') {
    const body = JSON.parse(await readBody(req));
    const payload = Array.isArray(body) ? body[0] : body;
    const row = { ...payload, created_at: new Date().toISOString() };
    rooms.set(row.id, row);
    console.log('[rest] created room', row.id, row.game_type);
    return json(res, 201, row);
  }

  if (req.method === 'GET') {
    const row = rooms.get(idFilter);
    if (!row) return pgrst116(res);
    return json(res, 200, row);
  }

  if (req.method === 'PATCH') {
    const row = rooms.get(idFilter);
    if (!row) return pgrst116(res);
    if (revFilter !== '' && String(row.game_state?.revision) !== revFilter) {
      console.log('[rest] revision conflict on', idFilter, 'expected', revFilter, 'actual', row.game_state?.revision);
      return pgrst116(res);
    }
    const body = JSON.parse(await readBody(req));
    Object.assign(row, body);
    console.log('[rest] updated room', idFilter, 'revision ->', row.game_state?.revision);
    return json(res, 200, row);
  }

  return json(res, 405, { message: 'method not allowed' });
});

// ---------- Realtime (Phoenix vsn 2.0.0 subset) ----------
const wss = new WebSocketServer({ server, path: '/realtime/v1/websocket' });
const topics = new Map(); // topic -> Set<ws>
const presence = new Map(); // topic -> Map<ws, {key, metas}>

const send = (ws, joinRef, ref, topic, event, payload) => {
  if (ws.readyState === 1) ws.send(JSON.stringify([joinRef, ref, topic, event, payload]));
};

const topicSockets = topic => {
  if (!topics.has(topic)) topics.set(topic, new Set());
  return topics.get(topic);
};

const presenceEntries = topic => {
  if (!presence.has(topic)) presence.set(topic, new Map());
  return presence.get(topic);
};

const presenceStatePayload = topic => {
  const state = {};
  for (const { key, metas } of presenceEntries(topic).values()) {
    state[key] = { metas };
  }
  return state;
};

const broadcastToTopic = (topic, event, payload) => {
  for (const ws of topicSockets(topic)) send(ws, null, null, topic, event, payload);
};

// Binary user-broadcast push (kind=3):
// u8 kind | u8 joinRefLen | u8 refLen | u8 topicLen | u8 eventLen | u8 metaLen | u8 encoding
// | joinRef | ref | topic | userEvent | metadata | payload
const decodeBinaryPush = buf => {
  const joinRefLen = buf[1];
  const refLen = buf[2];
  const topicLen = buf[3];
  const eventLen = buf[4];
  const metaLen = buf[5];
  const encoding = buf[6];
  let o = 7;
  const read = n => {
    const s = buf.slice(o, o + n).toString('utf8');
    o += n;
    return s;
  };
  const joinRef = read(joinRefLen);
  const ref = read(refLen);
  const topic = read(topicLen);
  const userEvent = read(eventLen);
  const metadata = read(metaLen);
  const payloadRaw = buf.slice(o);
  const payload = encoding === 1 ? JSON.parse(payloadRaw.toString('utf8')) : payloadRaw;
  return { joinRef, ref, topic, userEvent, metadata, payload };
};

const handleLeave = (ws, topic) => {
  topicSockets(topic).delete(ws);
  const entry = presenceEntries(topic).get(ws);
  if (entry) {
    presenceEntries(topic).delete(ws);
    broadcastToTopic(topic, 'presence_diff', { joins: {}, leaves: { [entry.key]: { metas: entry.metas } } });
  }
};

wss.on('connection', ws => {
  ws.id = crypto.randomUUID();
  console.log('[ws] connection');

  ws.on('message', (raw, isBinary) => {
    if (isBinary) {
      const { topic, userEvent, payload } = decodeBinaryPush(raw);
      console.log('[ws] binary broadcast', topic, userEvent);
      broadcastToTopic(topic, 'broadcast', { type: 'broadcast', event: userEvent, payload });
      return;
    }

    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    // v2: [join_ref, ref, topic, event, payload] / v1: {topic, event, payload, ref}
    const [joinRef, ref, topic, event, payload] = Array.isArray(msg)
      ? msg
      : [msg.join_ref ?? null, msg.ref ?? null, msg.topic, msg.event, msg.payload];

    if (event === 'heartbeat') {
      return send(ws, null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} });
    }

    if (event === 'phx_join') {
      topicSockets(topic).add(ws);
      send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      send(ws, null, null, topic, 'presence_state', presenceStatePayload(topic));
      console.log('[ws] join', topic);
      return;
    }

    if (event === 'phx_leave') {
      handleLeave(ws, topic);
      return send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    }

    if (event === 'broadcast') {
      // v1-style text broadcast push
      broadcastToTopic(topic, 'broadcast', payload);
      return send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    }

    if (event === 'presence' && payload?.event === 'track') {
      const entries = presenceEntries(topic);
      const prev = entries.get(ws);
      const key = prev?.key ?? ws.id;
      const metas = [{ phx_ref: crypto.randomUUID(), ...payload.payload }];
      entries.set(ws, { key, metas });
      console.log('[ws] presence track', topic, JSON.stringify(payload.payload));
      broadcastToTopic(topic, 'presence_diff', {
        joins: { [key]: { metas } },
        leaves: prev ? { [key]: { metas: prev.metas } } : {},
      });
      return send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    }

    if (event === 'presence' && payload?.event === 'untrack') {
      const entries = presenceEntries(topic);
      const entry = entries.get(ws);
      if (entry) {
        entries.delete(ws);
        broadcastToTopic(topic, 'presence_diff', { joins: {}, leaves: { [entry.key]: { metas: entry.metas } } });
      }
      return send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    }

    if (event === 'access_token') return;

    if (ref != null) {
      send(ws, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
    }
  });

  ws.on('close', () => {
    for (const topic of [...topics.keys()]) {
      if (topicSockets(topic).has(ws)) handleLeave(ws, topic);
    }
  });
});

server.listen(PORT, () => console.log(`supabase-mock listening on http://localhost:${PORT}`));
