const STORE_NAME = "nicopoke-groups";
const PREFIX = "nicopoke-groups/";

function cors(res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Join-Code");
}

function send(res, status, body) {
  cors(res);
  if (body && !body.store) body.store = STORE_NAME;
  res.status(status).send(JSON.stringify(body));
}

function fail(res, status, errorCode, extra) {
  send(
    res,
    status,
    Object.assign(
      { ok: false, error: errorCode, errorCode, store: STORE_NAME },
      extra || {}
    )
  );
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u3000\-ー＿_]/g, "")
    .toUpperCase();
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

function parseGroup(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (data && data.group) {
    data.group.code = normalizeCode(data.group.code);
    return data;
  }
  return null;
}

function header(req, name) {
  const value = req.headers[name] || req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function codeFromReq(req, payload) {
  const url = new URL(req.url, "http://localhost");
  const candidates = [
    url.searchParams.get("code"),
    header(req, "x-join-code"),
    payload && payload.group && payload.group.code,
  ];
  let rawReceived = "";
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    if (!rawReceived) rawReceived = String(raw);
    const n = normalizeCode(raw);
    if (/^[A-Z2-9]{4,8}$/.test(n)) return n;
  }
  return normalizeCode(rawReceived);
}

function memoryStore() {
  const g = globalThis;
  if (!g.__nicopokeGroups) g.__nicopokeGroups = new Map();
  const map = g.__nicopokeGroups;
  return {
    async get(key) {
      return map.get(key) || null;
    },
    async set(key, data) {
      map.set(key, data);
    },
  };
}

function blobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.NICOPOKE_BLOB_TOKEN || "";
}

function storeIdFromToken(token) {
  const match = String(token).match(/^vercel_blob_rw_([^_]+)_/);
  return match ? match[1] : "";
}

function blobPath(key) {
  return `${PREFIX}${key}.json`;
}

function blobHeaders(token) {
  const storeId = storeIdFromToken(token);
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-api-version": "12",
  };
  if (storeId) headers["x-vercel-blob-store-id"] = storeId;
  return headers;
}

function blobStore(token) {
  const storeId = storeIdFromToken(token);
  return {
    async get(key) {
      const path = blobPath(key);
      if (storeId) {
        const published = await fetch(
          `https://${storeId}.public.blob.vercel-storage.com/${path}`,
          { cache: "no-store" }
        );
        if (published.ok) return published.json();
      }
      const res = await fetch(
        `https://blob.vercel-storage.com/?pathname=${encodeURIComponent(path)}`,
        { method: "GET", headers: blobHeaders(token), cache: "no-store" }
      );
      if (!res.ok) return null;
      const payload = await res.json().catch(() => null);
      if (payload && payload.url) {
        const file = await fetch(payload.url, { cache: "no-store" });
        if (file.ok) return file.json();
      }
      return payload && payload.group ? payload : null;
    },
    async set(key, data) {
      const path = blobPath(key);
      const res = await fetch(
        `https://blob.vercel-storage.com/?pathname=${encodeURIComponent(path)}`,
        {
          method: "PUT",
          headers: Object.assign({}, blobHeaders(token), {
            "x-vercel-blob-access": "public",
            "x-add-random-suffix": "0",
            "x-allow-overwrite": "1",
            "x-content-type": "application/json",
          }),
          body: JSON.stringify(data),
        }
      );
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`blob save failed (${res.status}): ${detail.slice(0, 300)}`);
      }
    },
  };
}

function makeStore() {
  const token = blobToken();
  return token ? blobStore(token) : memoryStore();
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.status(204).end();
      return;
    }

    const url = new URL(req.url, "http://localhost");
    if (url.searchParams.get("ping")) {
      send(res, 200, { ok: true, store: STORE_NAME });
      return;
    }

    const store = makeStore();
    const payload = req.method === "POST" || req.method === "PUT" ? req.body : null;
    const code = codeFromReq(req, payload);
    if (!/^[A-Z2-9]{4,8}$/.test(code)) {
      fail(res, 400, "BAD_CODE");
      return;
    }

    if (req.method === "GET") {
      const data = parseGroup(await store.get(code));
      if (!data) {
        fail(res, 404, "NOT_FOUND", { code, key: code });
        return;
      }
      send(res, 200, data);
      return;
    }

    if (req.method === "POST" || req.method === "PUT") {
      if (!payload || !payload.group) {
        fail(res, 400, "NEED_GROUP");
        return;
      }
      payload.group.code = code;
      try {
        const existing = parseGroup(await store.get(code));
        const merged = mergeSnapshots(existing, payload);
        await store.set(code, merged);
        const check = parseGroup(await store.get(code));
        if (!check) throw new Error("save completed but get returned empty");
        send(res, 200, {
          ok: true,
          stored: true,
          errorCode: null,
          store: STORE_NAME,
          group: { id: merged.group.id, code, key: code },
        });
      } catch (err) {
        fail(res, 500, "SAVE_FAILED", { message: String((err && err.message) || err) });
      }
      return;
    }

    fail(res, 405, "METHOD");
  } catch (err) {
    fail(res, 500, "STORE_UNAVAILABLE", { message: String((err && err.message) || err) });
  }
};
