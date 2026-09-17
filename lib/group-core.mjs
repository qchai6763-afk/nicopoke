const STORE_NAME = "nicopoke-groups";

export function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Join-Code",
  };
}

export function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u3000\-ー＿_]/g, "")
    .toUpperCase();
}

function blobKey(code) {
  return normalizeCode(code);
}

function json(status, body) {
  if (body && !body.store) body.store = STORE_NAME;
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function fail(status, errorCode, extra) {
  return json(
    status,
    Object.assign(
      {
        ok: false,
        error: errorCode,
        errorCode,
        store: STORE_NAME,
      },
      extra || {}
    )
  );
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
  group.code = blobKey(incoming.group.code || existing.group.code);
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

function parseBlob(data) {
  if (!data) return null;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (data && data.group) {
    data.group.code = blobKey(data.group.code);
    return data;
  }
  return null;
}

function decodeMaybe(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function codeFromRequest(request, payload) {
  const url = new URL(request.url);
  const candidates = [
    url.searchParams.get("code"),
    request.headers.get("x-join-code"),
    payload && payload.group && payload.group.code,
  ];
  let rawReceived = "";
  for (const raw of candidates) {
    if (raw == null || raw === "") continue;
    if (!rawReceived) rawReceived = String(raw);
    const n = blobKey(decodeMaybe(raw));
    if (/^[A-Z2-9]{4,8}$/.test(n)) return { raw: String(raw), code: n };
  }
  return { raw: rawReceived, code: blobKey(decodeMaybe(rawReceived)) };
}

async function loadGroup(store, code) {
  const key = blobKey(code);
  const direct = parseBlob(await store.get(key));
  if (direct) return { key, data: direct, tried: [key], via: "direct" };
  return { key, data: null, tried: [key], listedKeys: [] };
}

export async function handleGroupRequest(request, store) {
  try {
    if (request.method === "OPTIONS") {
      return new Response("", { status: 204, headers: corsHeaders() });
    }

    const url = new URL(request.url);
    if (url.searchParams.get("ping")) {
      return json(200, { ok: true, store: STORE_NAME });
    }

    if (!store || typeof store.get !== "function" || typeof store.set !== "function") {
      return fail(501, "STORE_UNAVAILABLE", {
        debug: { store: STORE_NAME, hit: false },
      });
    }

    let payload = null;
    const isWrite = request.method === "PUT" || request.method === "POST";
    if (isWrite) {
      try {
        payload = await request.json();
      } catch (err) {
        return fail(400, "BAD_JSON", {
          message: String((err && err.message) || err),
          debug: { store: STORE_NAME, hit: false },
        });
      }
    }

    const parsedCode = codeFromRequest(request, payload);
    const code = parsedCode.code;
    if (!/^[A-Z2-9]{4,8}$/.test(code)) {
      return fail(400, "BAD_CODE", {
        debug: { store: STORE_NAME, received: parsedCode.raw, normalized: code },
      });
    }

    if (request.method === "GET") {
      const found = await loadGroup(store, code);
      if (!found.data) {
        return fail(404, "NOT_FOUND", { code, key: found.key });
      }
      return json(200, found.data);
    }

    if (isWrite) {
      if (!payload || !payload.group) {
        return fail(400, "NEED_GROUP", { debug: { store: STORE_NAME, key: code } });
      }
      payload.group.code = code;
      try {
        const found = await loadGroup(store, code);
        const merged = mergeSnapshots(found.data, payload);
        await store.set(code, merged);
        const check = parseBlob(await store.get(code));
        if (!check) throw new Error("save completed but get returned empty");
        return json(200, {
          ok: true,
          stored: true,
          errorCode: null,
          store: STORE_NAME,
          group: { id: merged.group.id, code, key: code },
        });
      } catch (err) {
        return fail(500, "SAVE_FAILED", {
          message: String((err && err.message) || err),
        });
      }
    }

    return fail(405, "METHOD");
  } catch (err) {
    return fail(500, "STORE_UNAVAILABLE", {
      message: String((err && err.message) || err),
    });
  }
}
