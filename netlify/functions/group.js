const { getStore } = require("@netlify/blobs");

function headers() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function normalizeCode(raw) {
  return String(raw || "")
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\-ー＿_]/g, "")
    .toUpperCase();
}

function json(statusCode, body) {
  return { statusCode, headers: headers(), body: JSON.stringify(body) };
}

function upsertById(list, item, mergeFn) {
  if (!item || !item.id) return;
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) list.push(item);
  else list[i] = mergeFn ? mergeFn(list[i], item) : item;
}

function mergeQuest(local, incoming) {
  if (!local) return incoming;
  if (!incoming) return local;
  const localPosted = Boolean(local.photoDataUrl);
  const incomingPosted = Boolean(incoming.photoDataUrl);
  if (incomingPosted && !localPosted) return incoming;
  if (localPosted && !incomingPosted) {
    return Object.assign({}, incoming, {
      photoDataUrl: local.photoDataUrl,
      caption: incoming.caption || local.caption,
      postedAt: incoming.postedAt || local.postedAt,
      revealed: incoming.revealed || local.revealed,
    });
  }
  if ((incoming.postedAt || 0) > (local.postedAt || 0)) return incoming;
  return Object.assign({}, local, incoming, {
    photoDataUrl: localPosted ? local.photoDataUrl : incoming.photoDataUrl,
  });
}

function mergeUser(local, incoming) {
  if (!local) return incoming;
  if (!incoming) return local;
  const out = Object.assign({}, local, incoming);
  if (!incoming.photo && local.photo) out.photo = local.photo;
  return out;
}

function mergeSnapshots(existing, incoming) {
  if (!incoming || !incoming.group) return existing || incoming;
  if (!existing || !existing.group) return incoming;

  const group = Object.assign({}, existing.group, incoming.group);
  group.code = normalizeCode(incoming.group.code || existing.group.code);
  group.memberIds = Array.from(
    new Set([].concat(existing.group.memberIds || [], incoming.group.memberIds || []))
  );

  const users = (existing.users || []).slice();
  (incoming.users || []).forEach((u) => upsertById(users, u, mergeUser));

  const memberships = (existing.memberships || []).filter(
    (m) => !(incoming.memberships || []).some((x) => x && x.userId === m.userId)
  );
  (incoming.memberships || []).forEach((m) => {
    if (m && m.userId) memberships.push(m);
  });

  const quests = (existing.quests || []).slice();
  (incoming.quests || []).forEach((q) => upsertById(quests, q, mergeQuest));

  const guesses = (existing.guesses || []).slice();
  (incoming.guesses || []).forEach((g) => upsertById(guesses, g));

  const comments = (existing.comments || []).slice();
  (incoming.comments || []).forEach((c) => upsertById(comments, c));

  const likes = (existing.likes || []).slice();
  (incoming.likes || []).forEach((l) => upsertById(likes, l));

  return { group, users, memberships, quests, guesses, comments, likes };
}

function openStore() {
  return getStore({
    name: "nicopoke-groups",
    consistency: "strong",
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: headers() };
  }

  if (event.queryStringParameters?.ping) {
    try {
      openStore();
      return json(200, { ok: true });
    } catch (err) {
      return json(501, { ok: false, error: "store unavailable" });
    }
  }

  const code = normalizeCode(event.queryStringParameters?.code);
  if (!/^[A-Z2-9]{4,8}$/.test(code)) {
    return json(400, { error: "bad code" });
  }

  let store;
  try {
    store = openStore();
  } catch {
    return json(501, { error: "store unavailable" });
  }

  if (event.httpMethod === "GET") {
    const data = await store.get(code, { type: "json" });
    if (!data) return json(404, { error: "not found" });
    return json(200, data);
  }

  if (event.httpMethod === "PUT") {
    let payload;
    try {
      payload = JSON.parse(event.body || "{}");
    } catch {
      return json(400, { error: "bad json" });
    }
    if (!payload || !payload.group) {
      return json(400, { error: "need group" });
    }
    payload.group.code = normalizeCode(payload.group.code || code);
    const existing = await store.get(code, { type: "json" });
    const merged = mergeSnapshots(existing, payload);
    await store.setJSON(code, merged);
    return json(200, { ok: true, group: { id: merged.group.id, code: merged.group.code } });
  }

  return json(405, { error: "method" });
};
