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

function blobToken() {
  return (
    process.env.BLOB_READ_WRITE_TOKEN ||
    process.env.NICOPOKE_BLOB_TOKEN ||
    process.env.VERCEL_BLOB_READ_WRITE_TOKEN ||
    ""
  );
}

function storeIdFromToken(token) {
  const envId = String(process.env.BLOB_STORE_ID || "").replace(/^store_/, "");
  if (envId) return envId;
  const parts = String(token || "").split("_");
  // vercel_blob_rw_<storeId>_<secret>
  let id = parts[3] || "";
  if (id === "store" && parts[4]) id = parts[4];
  return id;
}

function blobPath(key) {
  return `${PREFIX}${key}.json`;
}

const BLOB_APIS = ["https://blob.vercel-storage.com", "https://vercel.com/api/blob"];

function blobHeaders(token, storeId) {
  const headers = {
    Authorization: `Bearer ${token}`,
    "x-api-version": "12",
  };
  if (storeId) headers["x-vercel-blob-store-id"] = storeId;
  return headers;
}

async function readJsonUrl(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json().catch(() => null);
  } catch {
    return null;
  }
}

async function blobRequest(api, query, token, storeId, method, body) {
  const res = await fetch(`${api}/?${query}`, {
    method,
    headers: Object.assign({}, blobHeaders(token, storeId), body
      ? {
          "x-vercel-blob-access": "public",
          "x-add-random-suffix": "0",
          "x-allow-overwrite": "1",
          "x-content-type": "application/json",
        }
      : {}),
    body,
    cache: "no-store",
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { ok: res.ok, status: res.status, text, json };
}

function blobStore(token) {
  const storeId = storeIdFromToken(token);
  return {
    async get(key) {
      const path = blobPath(key);
      if (token) {
        for (const api of BLOB_APIS) {
          try {
            const meta = await blobRequest(
              api,
              `url=${encodeURIComponent(path)}`,
              token,
              storeId,
              "GET"
            );
            if (meta.ok && meta.json) {
              const fromMeta = parseGroup(await readJsonUrl(meta.json.url || meta.json.downloadUrl));
              if (fromMeta) return fromMeta;
            }
          } catch {
            /* try next */
          }
        }
      }
      if (storeId) {
        const fromPublic = parseGroup(
          await readJsonUrl(`https://${storeId}.public.blob.vercel-storage.com/${path}`)
        );
        if (fromPublic) return fromPublic;
      }
      return null;
    },
    async set(key, data) {
      const path = blobPath(key);
      if (!token) throw new Error("blob token missing");
      const payload = JSON.stringify(data);
      let last = "no attempt";
      for (const api of BLOB_APIS) {
        try {
          const res = await blobRequest(
            api,
            `pathname=${encodeURIComponent(path)}`,
            token,
            storeId,
            "PUT",
            payload
          );
          last = `${api} ${res.status} ${res.text.slice(0, 180)}`;
          if (!res.ok) continue;
          const written =
            parseGroup(await readJsonUrl(res.json && res.json.url)) || parseGroup(data);
          if (written) return written;
        } catch (err) {
          last = `${api} ${String((err && err.message) || err)}`;
        }
      }
      throw new Error(`blob save failed: ${last}`);
    },
  };
}

function makeStore() {
  return blobStore(blobToken());
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
      send(res, 200, {
        ok: true,
        store: STORE_NAME,
        blob: Boolean(blobToken()),
        oidc: Boolean(process.env.VERCEL_OIDC_TOKEN),
        storeId: Boolean(storeIdFromToken(blobToken())),
      });
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
        fail(res, 404, "NOT_FOUND", { code, key: code, blob: Boolean(blobToken()) });
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
        send(res, 200, {
          ok: true,
          stored: true,
          errorCode: null,
          store: STORE_NAME,
          blob: Boolean(blobToken()),
          group: { id: merged.group.id, code, key: code },
        });
      } catch (err) {
        fail(res, 500, "SAVE_FAILED", { message: String((err && err.message) || err), blob: Boolean(blobToken()) });
      }
      return;
    }

    fail(res, 405, "METHOD");
  } catch (err) {
    fail(res, 500, "STORE_UNAVAILABLE", { message: String((err && err.message) || err) });
  }
};
