const KEY = "today-family-v7";

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
    const raw = localStorage.getItem(KEY);
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
    parsed.quests.forEach((q) => {
      if (!q.category) {
        const found = SLOT_CATS.find((c) => c.items.includes(q.theme));
        const cat = found || SLOT_CATS[2];
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
  localStorage.setItem(KEY, JSON.stringify(state));
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
  window.dispatchEvent(new Event("hidamari-change"));
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
  if (state.groups.some((g) => g.code === code)) return makeCode();
  return code;
}

function attachToGroup(userId, groupId) {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return;
  if (!group.memberIds.includes(userId)) group.memberIds.push(userId);
  state.memberships = state.memberships.filter((m) => m.userId !== userId);
  state.memberships.push({ userId, groupId });
}

function buildUser({ name, role, generation }) {
  const nm = String(name || "").trim().slice(0, 12);
  if (!nm) return null;
  const gen = GENERATIONS.some((g) => g.id === generation) ? generation : "adult";
  return {
    id: makeId("u"),
    name: nm,
    shortName: nm,
    handle: nm.toLowerCase(),
    role: String(role || "家族").trim().slice(0, 12) || "家族",
    generation: gen,
    icon: ICONS[state.users.length % ICONS.length],
    photo: "",
    color: USER_COLORS[state.users.length % USER_COLORS.length],
  };
}

function startGroup({ groupName, name, role, generation }) {
  const gname = String(groupName || "").trim().slice(0, 20);
  if (!gname) return { ok: false, error: "グループ名を入れてください" };
  const user = buildUser({ name, role, generation });
  if (!user) return { ok: false, error: "あなたの名前を入れてください" };
  state.users.push(user);
  const group = {
    id: makeId("g"),
    name: gname,
    code: makeCode(),
    memberIds: [user.id],
  };
  state.groups.push(group);
  state.memberships.push({ userId: user.id, groupId: group.id });
  state.currentUserId = user.id;
  notify();
  return { ok: true, group, user };
}

function joinWithCode({ code, name, role, generation }) {
  const group = state.groups.find(
    (g) => String(g.code || "").toUpperCase() === String(code || "").trim().toUpperCase()
  );
  if (!group) return { ok: false, error: "その参加コードのグループは見つかりませんでした。" };
  const user = buildUser({ name, role, generation });
  if (!user) return { ok: false, error: "あなたの名前を入れてください" };
  state.users.push(user);
  attachToGroup(user.id, group.id);
  state.currentUserId = user.id;
  notify();
  return { ok: true, group, user };
}

function addMemberToCurrentGroup({ name, role, generation }) {
  const group = currentGroup();
  if (!group) return { ok: false, error: "グループがありません" };
  const user = buildUser({ name, role, generation });
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
        state.quests.push({
          id: `q-${member.id}-${date}`,
          groupId,
          userId: member.id,
          date,
          theme: slot.theme,
          category: slot.category,
          categoryLabel: slot.categoryLabel,
          categoryEmoji: slot.categoryEmoji,
          rerollsUsed: 0,
          photoDataUrl: "",
          caption: "",
          revealed: false,
          postedAt: null,
        });
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
  quest.caption = caption.trim();
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

function guessChoices(quest) {
  if (!quest) return [];
  const pool = THEMES.filter((t) => t !== quest.theme);
  const decoys = [];
  let h = hashString(quest.id || quest.theme);
  const copy = pool.slice();
  while (decoys.length < 3 && copy.length) {
    const i = h % copy.length;
    decoys.push(copy.splice(i, 1)[0]);
    h = (h * 31 + 17) >>> 0;
  }
  const all = [quest.theme].concat(decoys);
  for (let i = all.length - 1; i > 0; i -= 1) {
    h = (h * 31 + i) >>> 0;
    const j = h % (i + 1);
    const tmp = all[i];
    all[i] = all[j];
    all[j] = tmp;
  }
  return all;
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
