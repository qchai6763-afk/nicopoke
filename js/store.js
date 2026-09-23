const KEY_BASE = "today-family-v7";
const CLOUD_ORIGIN_KEY = "nicopoke-cloud-origin-v1";
const PUBLIC_CLOUD_ORIGIN = "https://nicopoke.vercel.app";

function namespacedKey(base) {
  const path = String(location.pathname || "/")
    .replace(/\/index\.html$/i, "")
    .replace(/\/$/, "");
  if (!path || path === "/") return base;
  return `${base}:${path}`;
}

function storageKey() {
  return namespacedKey(KEY_BASE);
}

function readNamespacedJson(base, fallback) {
  const key = namespacedKey(base);
  try {
    let raw = localStorage.getItem(key);
    if (!raw && key !== base) raw = localStorage.getItem(base);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeNamespacedJson(base, value) {
  localStorage.setItem(namespacedKey(base), JSON.stringify(value));
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDateLabel(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const week = "日月火水木金土"[dt.getDay()];
  return `${m}月${d}日（${week}）`;
}

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h;
}

function slotFromHash(userId, dateKey) {
  const h = hashString(`${userId}:${dateKey}`);
  const cat = SLOT_CATS[h % SLOT_CATS.length];
  const theme = cat.items[(h >>> 8) % cat.items.length];
  return {
    theme,
    category: cat.id,
    categoryLabel: cat.label,
    categoryEmoji: cat.emoji,
  };
}

function pickSlot(except) {
  const cat = SLOT_CATS[Math.floor(Math.random() * SLOT_CATS.length)];
  const pool = cat.items.filter((t) => t !== except);
  const list = pool.length ? pool : cat.items;
  const theme = list[Math.floor(Math.random() * list.length)];
  return {
    theme,
    category: cat.id,
    categoryLabel: cat.label,
    categoryEmoji: cat.emoji,
  };
}

function addDaysKey(iso, delta) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return todayKey(dt);
}

function emptyState() {
  return {
    currentUserId: null,
    users: [],
    groups: [],
    memberships: [],
    moods: [],
    quests: [],
    guesses: [],
    comments: [],
    likes: [],
    messages: [],
  };
}

function load() {
  try {
    const key = storageKey();
    let raw = localStorage.getItem(key);
    if (!raw && key !== KEY_BASE) raw = localStorage.getItem(KEY_BASE);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.users) || !Array.isArray(parsed.groups)) {
      return emptyState();
    }
    if (!Array.isArray(parsed.likes)) parsed.likes = [];
    if (!Array.isArray(parsed.memberships)) parsed.memberships = [];
    if (!Array.isArray(parsed.quests)) parsed.quests = [];
    if (!Array.isArray(parsed.guesses)) parsed.guesses = [];
    if (!Array.isArray(parsed.comments)) parsed.comments = [];
    if (!Array.isArray(parsed.messages)) parsed.messages = [];
    if (!Array.isArray(parsed.moods)) parsed.moods = [];
    parsed.users.forEach((u) => {
      delete u.generation;
      delete u.role;
    });
    parsed.quests.forEach((q) => {
      if (!q.category) {
        const found = SLOT_CATS.find((c) => c.items.includes(q.theme));
        const cat = found || SLOT_CATS[0];
        q.category = cat.id;
        q.categoryLabel = cat.label;
        q.categoryEmoji = cat.emoji;
      }
      if (q.rerollsUsed == null) q.rerollsUsed = 0;
    });
    return parsed;
  } catch {
    return emptyState();
  }
}

let state = load();

function persist() {
  localStorage.setItem(storageKey(), JSON.stringify(state));
}

function getState() {
  return state;
}

function subscribe(listener) {
  window.addEventListener("hidamari-change", listener);
  return () => window.removeEventListener("hidamari-change", listener);
}

function notify() {
  persist();
  const group = currentGroup();
  if (group) queueCloudSync(group.id);
  window.dispatchEvent(new Event("hidamari-change"));
}

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[\s\u3000\-ー＿_]/g, "")
    .toUpperCase();
}

function findGroupByCode(code) {
  const c = normalizeCode(code);
  return state.groups.find((g) => normalizeCode(g.code) === c) || null;
}

function rememberedCloudOrigin() {
  try {
    return localStorage.getItem(CLOUD_ORIGIN_KEY) || "";
  } catch {
    return "";
  }
}

function rememberCloudOrigin(url) {
  try {
    const parsed = new URL(url, location.href);
    if (!parsed.origin || parsed.origin === "null") return;
    if (isStaticHost(parsed.hostname)) return;
    localStorage.setItem(CLOUD_ORIGIN_KEY, parsed.origin);
  } catch {
    /* ignore */
  }
}

function isStaticHost(hostname) {
  const host = String(hostname || location.hostname || "");
  return /\.github\.io$/i.test(host);
}

function hasOwnCloudApi() {
  const host = String(location.hostname || "");
  if (location.protocol === "file:") return false;
  if (!host || host === "localhost" || host === "127.0.0.1") return false;
  if (isStaticHost(host)) return false;
  return true;
}

function cloudOrigin() {
  if (hasOwnCloudApi()) return String(location.origin || "").replace(/\/$/, "");
  const remembered = rememberedCloudOrigin();
  if (remembered) return String(remembered).replace(/\/$/, "");
  return PUBLIC_CLOUD_ORIGIN;
}

function cloudUrls(code) {
  const query = code
    ? `code=${encodeURIComponent(normalizeCode(code))}`
    : "ping=1";
  const origin = cloudOrigin();
  if (!origin) return [];
  return [`${origin}/api/group?${query}`];
}

function parseCloudBody(text) {
  if (!text) return null;
  const trimmed = String(text).trim();
  if (!trimmed || trimmed[0] === "<") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function isGroupPayload(data) {
  return Boolean(data && data.group && data.group.id);
}

function isUsableCloudReply(res) {
  if (!res || !res.data) return false;
  if (res.ok && (res.data.ok || res.data.stored || isGroupPayload(res.data))) return true;
  const code = res.data.errorCode;
  return Boolean(code && code !== "STORE_UNAVAILABLE");
}

async function requestCloud(path, options) {
  try {
    const headers = Object.assign(
      { Accept: "application/json" },
      (options && options.headers) || {}
    );
    const res = await fetch(path, Object.assign({ cache: "no-store", mode: "cors", credentials: "omit" }, options, { headers }));
    const text = await res.text();
    return { status: res.status, ok: res.ok, data: parseCloudBody(text), url: path };
  } catch {
    return { status: 0, ok: false, data: null, url: path };
  }
}

async function requestCloudAcrossHosts(code, options) {
  let last = { ok: false, status: 0, data: null, url: "" };
  for (const url of cloudUrls(code)) {
    const res = await requestCloud(url, options);
    last = res;
    if (isUsableCloudReply(res) || (res.ok && res.data)) {
      rememberCloudOrigin(url);
      return res;
    }
  }
  return last;
}

async function fetchCloud(code) {
  const n = normalizeCode(code);
  return requestCloudAcrossHosts(n, { headers: { "X-Join-Code": n } });
}

async function pullCloud(code) {
  const r = await fetchCloud(code);
  if (r.ok && isGroupPayload(r.data)) return r.data;
  return null;
}

async function putCloud(code, body) {
  const n = normalizeCode(code);
  if (body && body.group) body.group.code = n;
  const payload = JSON.stringify(body);
  let last = { ok: false, stop: true, data: null, status: 0 };
  for (const method of ["POST", "PUT"]) {
    const res = await requestCloudAcrossHosts(n, {
      method,
      headers: { "Content-Type": "application/json", "X-Join-Code": n },
      body: payload,
    });
    last = res;
    if (res.ok && res.data && (res.data.stored || isGroupPayload(res.data))) {
      rememberCloudOrigin(res.url);
      return { ok: true, stop: false, data: res.data };
    }
    if (res.data && res.data.errorCode === "SAVE_FAILED") {
      return { ok: false, stop: true, data: res.data, status: res.status };
    }
  }
  return { ok: false, stop: true, data: last.data, status: last.status };
}

function stripUser(user) {
  if (!user) return user;
  const copy = Object.assign({}, user);
  delete copy.generation;
  return copy;
}

function snapshotForGroup(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return null;
  const ids = new Set(group.memberIds);
  const quests = state.quests.filter((q) => q.groupId === groupId);
  const questIds = new Set(quests.map((q) => q.id));
  return {
    group: Object.assign({}, group, { code: normalizeCode(group.code), memberIds: group.memberIds.slice() }),
    users: state.users.filter((u) => ids.has(u.id)).map(stripUser),
    memberships: state.memberships.filter((m) => m.groupId === groupId),
    quests,
    guesses: state.guesses.filter((g) => questIds.has(g.questId)),
    comments: state.comments.filter((c) => questIds.has(c.questId)),
    likes: (state.likes || []).filter((l) => questIds.has(l.questId)),
  };
}

function upsertById(list, item) {
  if (!item || !item.id) return;
  const i = list.findIndex((x) => x.id === item.id);
  if (i < 0) list.push(item);
  else list[i] = item;
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
      revealed: Boolean(incoming.revealed || local.revealed),
    });
  }
  if ((incoming.postedAt || 0) > (local.postedAt || 0)) return incoming;
  return local;
}

function mergeUser(local, incoming) {
  if (!local) return incoming;
  if (!incoming) return local;
  const out = Object.assign({}, local, incoming);
  if (!incoming.photo && local.photo) out.photo = local.photo;
  return out;
}

function mergeSnapshot(snap) {
  if (!snap || !snap.group) return false;
  const before = JSON.stringify(snapshotForGroup(snap.group.id) || {});
  const incoming = snap.group;
  incoming.code = normalizeCode(incoming.code);
  incoming.memberIds = Array.from(new Set(incoming.memberIds || []));
  const gi = state.groups.findIndex((g) => g.id === incoming.id || normalizeCode(g.code) === incoming.code);
  if (gi < 0) state.groups.push(incoming);
  else {
    const cur = state.groups[gi];
    cur.name = incoming.name || cur.name;
    cur.code = incoming.code;
    cur.id = incoming.id;
    cur.memberIds = Array.from(new Set((cur.memberIds || []).concat(incoming.memberIds)));
  }
  (snap.users || []).forEach((u) => {
    const clean = stripUser(u);
    const i = state.users.findIndex((x) => x.id === clean.id);
    if (i < 0) state.users.push(clean);
    else state.users[i] = mergeUser(state.users[i], clean);
  });
  (snap.memberships || []).forEach((m) => {
    if (!m || !m.userId) return;
    state.memberships = state.memberships.filter((x) => x.userId !== m.userId);
    state.memberships.push(m);
  });
  (snap.quests || []).forEach((q) => {
    const i = state.quests.findIndex((x) => x.id === q.id);
    if (i < 0) state.quests.push(q);
    else state.quests[i] = mergeQuest(state.quests[i], q);
  });
  (snap.guesses || []).forEach((g) => upsertById(state.guesses, g));
  (snap.comments || []).forEach((c) => upsertById(state.comments, c));
  if (!state.likes) state.likes = [];
  (snap.likes || []).forEach((l) => upsertById(state.likes, l));
  const after = JSON.stringify(snapshotForGroup(incoming.id) || {});
  return before !== after;
}

function toLightSnapshot(snap) {
  if (!snap) return null;
  return {
    group: snap.group,
    users: (snap.users || []).map((u) => Object.assign({}, u)),
    memberships: snap.memberships || [],
    quests: (snap.quests || []).map((q) =>
      Object.assign({}, q, {
        photoDataUrl: "",
        hasPhoto: Boolean(q.photoDataUrl),
      })
    ),
    guesses: snap.guesses || [],
    comments: snap.comments || [],
    likes: snap.likes || [],
  };
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function pushCloud(groupId) {
  const snap = snapshotForGroup(groupId);
  if (!snap) return false;
  for (let i = 0; i < 3; i += 1) {
    const result = await putCloud(snap.group.code, snap);
    if (result.ok) return true;
    if (result.stop) break;
    await sleep(350 * (i + 1));
  }
  const light = await putCloud(snap.group.code, toLightSnapshot(snap));
  return Boolean(light.ok);
}

let cloudTimer = 0;
let cloudRetryCount = 0;
function queueCloudSync(groupId) {
  window.clearTimeout(cloudTimer);
  cloudTimer = window.setTimeout(async () => {
    const ok = await pushCloud(groupId);
    if (ok) {
      cloudRetryCount = 0;
      return;
    }
    cloudRetryCount += 1;
    if (cloudRetryCount < 8) {
      const wait = Math.min(30000, 1200 * cloudRetryCount * cloudRetryCount);
      cloudTimer = window.setTimeout(() => queueCloudSync(groupId), wait);
    }
  }, 400);
}

async function refreshFromCloud() {
  const group = currentGroup();
  if (!group) return false;
  const remote = await pullCloud(group.code);
  if (!remote) return false;
  const changed = mergeSnapshot(remote);
  if (changed) persist();
  return changed;
}

function currentUser() {
  return state.users.find((u) => u.id === state.currentUserId) || null;
}

function login(userId) {
  state.currentUserId = userId;
  notify();
}

function logout() {
  state.currentUserId = null;
  notify();
}

function currentGroup() {
  const user = currentUser();
  if (!user) return null;
  const membership = state.memberships.find((m) => m.userId === user.id);
  if (!membership) return null;
  return state.groups.find((g) => g.id === membership.groupId) || null;
}

function groupMembers(groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return [];
  return group.memberIds
    .map((id) => state.users.find((u) => u.id === id))
    .filter(Boolean);
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  if (state.groups.some((g) => normalizeCode(g.code) === code)) return makeCode();
  return code;
}

function attachToGroup(userId, groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (!group.memberIds.includes(userId)) group.memberIds.push(userId);
  state.memberships = state.memberships.filter((m) => m.userId !== userId);
  state.memberships.push({ userId, groupId });
}

function buildUser({ name }) {
  const nm = String(name || "").trim().slice(0, 12);
  if (!nm) return null;
  return {
    id: makeId("u"),
    name: nm,
    shortName: nm,
    handle: nm.toLowerCase(),
    icon: ICONS[state.users.length % ICONS.length],
    photo: "",
    color: USER_COLORS[state.users.length % USER_COLORS.length],
  };
}

function joinErrorFromCloud(remote) {
  const errorCode = remote && remote.data && remote.data.errorCode;
  if (errorCode === "NOT_FOUND") {
    return "その参加コードのグループは、まだ共有保存されていません。つくった人のスマホで参加コードを開き、グループを作り直してから入力してください。";
  }
  if (errorCode === "BAD_CODE" || (remote.status === 400 && remote.data)) {
    return "参加コードの形式が正しくありません。4〜8文字の英数字か確かめてください。";
  }
  if (errorCode === "STORE_UNAVAILABLE" || errorCode === "SAVE_FAILED" || remote.status === 501) {
    return "グループの共有サーバーに保存できません。VercelのBlobがつながっているか確かめてください。";
  }
  if (!remote.data || remote.status === 0) {
    return "グループの共有サーバーに接続できませんでした。通信を確かめて、もう一度試してください。";
  }
  if (remote.status >= 500) {
    return "グループの共有サーバーに接続できません。少し待ってからもう一度試してください。";
  }
  return "グループを探せませんでした。参加コードをもう一度確認してください。";
}

async function startGroup({ groupName, name }) {
  const gname = String(groupName || "").trim().slice(0, 20);
  if (!gname) return { ok: false, error: "グループ名を入れてください" };
  const user = buildUser({ name });
  if (!user) return { ok: false, error: "あなたの名前を入れてください" };
  let code = makeCode();
  for (let i = 0; i < 8; i += 1) {
    const remote = await fetchCloud(code);
    if (remote.ok && remote.data?.group) {
      code = makeCode();
      continue;
    }
    break;
  }
  state.users.push(user);
  const group = {
    id: makeId("g"),
    name: gname,
    code,
    memberIds: [user.id],
  };
  state.groups.push(group);
  state.memberships.push({ userId: user.id, groupId: group.id });
  state.currentUserId = user.id;
  persist();
  notify();
  const uploaded = await pushCloud(group.id);
  if (!uploaded) {
    state.currentUserId = null;
    persist();
    notify();
    return {
      ok: false,
      error: "グループを友だちと共有できませんでした。通信を確かめて、もう一度「つくる」を押してください。",
    };
  }
  return { ok: true, group, user };
}

async function joinWithCode({ code, name }) {
  const normalized = normalizeCode(code);
  if (!normalized) return { ok: false, error: "参加コードを入れてください" };
  if (!/^[A-Z2-9]{4,8}$/.test(normalized)) {
    return { ok: false, error: "参加コードは4〜8文字の英数字です" };
  }
  let remote = await fetchCloud(normalized);
  if (!remote.ok || !remote.data?.group) {
    for (let i = 0; i < 4; i += 1) {
      await sleep(400 * (i + 1));
      remote = await fetchCloud(normalized);
      if (remote.ok && remote.data?.group) break;
    }
  }
  if (remote.ok && remote.data && remote.data.group) {
    mergeSnapshot(remote.data);
  }
  let group = findGroupByCode(normalized);
  if (!group) {
    return { ok: false, error: joinErrorFromCloud(remote) };
  }
  const user = buildUser({ name });
  if (!user) return { ok: false, error: "あなたの名前を入れてください" };
  state.users.push(user);
  attachToGroup(user.id, group.id);
  persist();
  const uploaded = await pushCloud(group.id);
  state.currentUserId = user.id;
  notify();
  if (!uploaded) {
    queueCloudSync(group.id);
    return {
      ok: true,
      group,
      user,
      warn: "参加はできました。共有サーバーへの保存は、自動でもう一度送ります。",
    };
  }
  return { ok: true, group, user };
}

function addMemberToCurrentGroup({ name }) {
  const group = currentGroup();
  if (!group) return { ok: false, error: "グループがありません" };
  const user = buildUser({ name });
  if (!user) return { ok: false, error: "名前を入れてください" };
  state.users.push(user);
  attachToGroup(user.id, group.id);
  notify();
  return { ok: true, user };
}

function ensureTodayQuests(groupId) {
  const date = todayKey();
  const members = groupMembers(groupId);
  members.forEach((member) => {
    const exists = state.quests.find(
      (q) => q.groupId === groupId && q.userId === member.id && q.date === date
    );
    if (!exists) {
        const slot = slotFromHash(member.id, date);
        const questId = `q-${member.id}-${date}`;
        state.quests.push({
          id: questId,
          groupId,
          userId: member.id,
          date,
          theme: slot.theme,
          themeOptions: makeThemeTrio(questId, slot.theme, 0),
          category: slot.category,
          categoryLabel: slot.categoryLabel,
          categoryEmoji: slot.categoryEmoji,
          rerollsUsed: 0,
          photoDataUrl: "",
          caption: "",
          revealed: false,
          postedAt: null,
        });
    } else if (!isPosted(exists)) {
      const staleTheme = !THEMES.includes(exists.theme);
      const staleOptions =
        !Array.isArray(exists.themeOptions) ||
        exists.themeOptions.some((t) => t !== exists.theme && !THEMES.includes(t));
      if (staleTheme) {
        const slot = slotFromHash(member.id, date);
        exists.theme = slot.theme;
        exists.category = slot.category;
        exists.categoryLabel = slot.categoryLabel;
        exists.categoryEmoji = slot.categoryEmoji;
        exists.themeOptions = makeThemeTrio(exists.id, exists.theme, exists.rerollsUsed || 0);
      } else if (staleOptions) {
        exists.themeOptions = makeThemeTrio(exists.id, exists.theme, exists.rerollsUsed || 0);
      }
    }
  });
  persist();
}

function questsForGroup(groupId) {
  ensureTodayQuests(groupId);
  return state.quests
    .filter((q) => q.groupId === groupId)
    .sort((a, b) => {
      if (a.date === b.date) return (b.postedAt || 0) - (a.postedAt || 0);
      return a.date < b.date ? 1 : -1;
    });
}

function getQuest(id) {
  return state.quests.find((q) => q.id === id) || null;
}

function canSeeTheme(quest, viewerId) {
  if (!quest) return false;
  if (quest.userId === viewerId) return true;
  if (quest.revealed) return true;
  return state.guesses.some(
    (g) => g.questId === quest.id && g.userId === viewerId && g.correct
  );
}

function isPosted(quest) {
  return Boolean(quest?.photoDataUrl);
}

function todayQuestFor(userId, groupId) {
  ensureTodayQuests(groupId);
  return (
    state.quests.find(
      (q) => q.userId === userId && q.groupId === groupId && q.date === todayKey()
    ) || null
  );
}

function hasPostedToday(userId, groupId) {
  return isPosted(todayQuestFor(userId, groupId));
}

function randomTheme(except) {
  return pickSlot(except).theme;
}

function rerollsLeft(quest) {
  return Math.max(0, MAX_REROLLS - (quest.rerollsUsed || 0));
}

function rerollQuest(questId) {
  const quest = getQuest(questId);
  if (!quest || isPosted(quest)) return { ok: false, left: 0 };
  if (rerollsLeft(quest) <= 0) return { ok: false, left: 0 };
  const next = pickSlot(quest.theme);
  quest.theme = next.theme;
  quest.category = next.category;
  quest.categoryLabel = next.categoryLabel;
  quest.categoryEmoji = next.categoryEmoji;
  quest.rerollsUsed = (quest.rerollsUsed || 0) + 1;
  quest.themeOptions = makeThemeTrio(quest.id, quest.theme, quest.rerollsUsed);
  notify();
  return { ok: true, left: rerollsLeft(quest) };
}

function setQuestTheme(questId, theme) {
  const quest = getQuest(questId);
  if (!quest || isPosted(quest)) return { ok: false, error: "投稿あとにお題は変えられません" };
  const t = String(theme || "").trim().slice(0, 24);
  if (!t) return { ok: false, error: "お題を入れてください" };
  const found = SLOT_CATS.find((c) => c.items.includes(t));
  quest.theme = t;
  if (!Array.isArray(quest.themeOptions) || !quest.themeOptions.includes(t)) {
    quest.themeOptions = makeThemeTrio(quest.id, t, quest.rerollsUsed || 0);
  }
  if (found) {
    quest.category = found.id;
    quest.categoryLabel = found.label;
    quest.categoryEmoji = found.emoji;
  }
  notify();
  return { ok: true, theme: t };
}

function albumFor(userId) {
  return state.quests
    .filter((q) => q.userId === userId && isPosted(q))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

function updateProfile({ name, icon, photo, clearPhoto }) {
  const user = currentUser();
  if (!user) return;
  if (typeof name === "string" && name.trim()) {
    const nm = name.trim().slice(0, 12);
    user.name = nm;
    user.shortName = nm;
  }
  if (icon) {
    user.icon = icon;
    user.photo = "";
  }
  if (photo) user.photo = photo;
  if (clearPhoto) user.photo = "";
  notify();
}

function postedDates(userId) {
  const dates = new Set();
  state.quests.forEach((q) => {
    if (q.userId === userId && isPosted(q)) dates.add(q.date);
  });
  return dates;
}

function streakFor(userId) {
  const dates = postedDates(userId);
  let cursor = todayKey();
  if (!dates.has(cursor)) {
    cursor = addDaysKey(cursor, -1);
    if (!dates.has(cursor)) return 0;
  }
  let n = 0;
  while (dates.has(cursor)) {
    n += 1;
    cursor = addDaysKey(cursor, -1);
  }
  return n;
}

function correctCount(userId) {
  const ids = new Set(
    state.guesses.filter((g) => g.userId === userId && g.correct).map((g) => g.questId)
  );
  return ids.size;
}

function streakLabel(n) {
  if (!n) return "🔥 まだ連続なし";
  return `🔥 ${n}日連続達成！`;
}

function streakAtRisk(userId) {
  const dates = postedDates(userId);
  const today = todayKey();
  const yest = addDaysKey(today, -1);
  return dates.has(yest) && !dates.has(today);
}

function postPhoto(questId, { photoDataUrl, caption }) {
  const quest = getQuest(questId);
  if (!quest) return;
  const before = streakFor(quest.userId);
  quest.photoDataUrl = photoDataUrl;
  quest.caption = String(caption || "").trim();
  quest.postedAt = Date.now();
  const after = streakFor(quest.userId);
  window.__streakPop = after > before || after === 1 ? after : 0;
  notify();
}

function familyStatus(groupId) {
  return groupMembers(groupId).map((member) => {
    const quest = todayQuestFor(member.id, groupId);
    return {
      user: member,
      posted: isPosted(quest),
      postedAt: quest?.postedAt || null,
      streak: streakFor(member.id),
      score: correctCount(member.id),
    };
  });
}

function shuffleSeeded(items, seed) {
  const all = items.slice();
  let h = hashString(String(seed));
  for (let i = all.length - 1; i > 0; i -= 1) {
    h = (h * 31 + i) >>> 0;
    const j = h % (i + 1);
    const tmp = all[i];
    all[i] = all[j];
    all[j] = tmp;
  }
  return all;
}

function pickFromPool(pool, count, seed) {
  const copy = pool.slice();
  const picked = [];
  let h = hashString(String(seed));
  while (picked.length < count && copy.length) {
    const i = h % copy.length;
    picked.push(copy.splice(i, 1)[0]);
    h = (h * 31 + 17) >>> 0;
  }
  return picked;
}

function makeThemeTrio(questId, selectedTheme, salt) {
  const seed = `${questId}:${salt}`;
  const extras = pickFromPool(
    THEMES.filter((t) => t !== selectedTheme),
    2,
    seed
  );
  return shuffleSeeded([selectedTheme].concat(extras), `${seed}:ord`);
}

function themeTrio(quest) {
  if (!quest) return [];
  if (
    Array.isArray(quest.themeOptions) &&
    quest.themeOptions.length === 3 &&
    quest.themeOptions.includes(quest.theme)
  ) {
    return quest.themeOptions;
  }
  quest.themeOptions = makeThemeTrio(quest.id, quest.theme, quest.rerollsUsed || 0);
  persist();
  return quest.themeOptions;
}

function guessChoices(quest) {
  if (!quest) return [];
  const decoys = pickFromPool(
    THEMES.filter((t) => t !== quest.theme),
    2,
    quest.id || quest.theme
  );
  return shuffleSeeded([quest.theme].concat(decoys), `${quest.id || quest.theme}:guess`);
}

function revealTheme(questId) {
  const quest = getQuest(questId);
  if (!quest) return;
  quest.revealed = true;
  notify();
}

function submitGuess(questId, text) {
  const user = currentUser();
  const quest = getQuest(questId);
  const guessText = text.trim();
  if (!user || !quest || !guessText) return null;
  const normalize = (s) => s.replace(/\s+/g, "").toLowerCase();
  const correct = normalize(guessText) === normalize(quest.theme) || quest.theme.includes(guessText) || guessText.includes(quest.theme);
  const guess = {
    id: `guess-${Date.now()}`,
    questId,
    userId: user.id,
    text: guessText,
    correct,
    at: Date.now(),
  };
  state.guesses.push(guess);
  if (correct) {
    window.__guessPop = { theme: quest.theme };
  }
  notify();
  return guess;
}

function guessesFor(questId) {
  return state.guesses.filter((g) => g.questId === questId);
}

function addComment(questId, text) {
  const user = currentUser();
  const body = text.trim();
  if (!user || !body) return;
  state.comments.push({
    id: `c-${Date.now()}`,
    questId,
    userId: user.id,
    text: body,
    at: Date.now(),
  });
  notify();
}

function commentsFor(questId) {
  return state.comments.filter((c) => c.questId === questId);
}

function likesFor(questId) {
  return (state.likes || []).filter((l) => l.questId === questId);
}

function likeCount(questId) {
  return likesFor(questId).length;
}

function hasLiked(questId, userId) {
  return likesFor(questId).some((l) => l.userId === userId);
}

function toggleLike(questId) {
  const user = currentUser();
  const quest = getQuest(questId);
  if (!user || !quest || !isPosted(quest) || quest.userId === user.id) return;
  if (!state.likes) state.likes = [];
  const i = state.likes.findIndex((l) => l.questId === questId && l.userId === user.id);
  if (i >= 0) state.likes.splice(i, 1);
  else {
    state.likes.push({
      id: `like-${Date.now()}`,
      questId,
      userId: user.id,
      at: Date.now(),
    });
  }
  notify();
}

function todayBoard(groupId) {
  const today = todayKey();
  return questsForGroup(groupId)
    .filter((q) => q.date === today && isPosted(q))
    .map((q) => ({
      quest: q,
      user: userById(q.userId),
      likes: likeCount(q.id),
      comments: commentsFor(q.id),
    }))
    .sort((a, b) => b.likes - a.likes || b.comments.length - a.comments.length);
}

function likesReceived(userId) {
  return state.quests
    .filter((q) => q.userId === userId && isPosted(q))
    .reduce((n, q) => n + likeCount(q.id), 0);
}

function userById(id) {
  return state.users.find((u) => u.id === id) || null;
}
