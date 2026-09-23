const SCREEN_KEY = "nicopoke-screen-v1";
const CHECK_SECS = [30, 35, 10, 10, 25, 30];

function loadScreens() {
  try {
    return readNamespacedJson(SCREEN_KEY, {}) || {};
  } catch {
    return {};
  }
}

function todayScreen(userId) {
  if (!userId) return null;
  const row = loadScreens()[userId];
  if (!row || row.date !== todayKey()) return null;
  return row;
}

function saveScreen(userId, payload) {
  const all = loadScreens();
  all[userId] = { ...payload, date: todayKey() };
  writeNamespacedJson(SCREEN_KEY, all);
}

function stopCheckTimer() {
  if (window.__checkTick) {
    window.clearInterval(window.__checkTick);
    window.__checkTick = 0;
  }
}

function startCheckTimer(seconds, onExpire) {
  stopCheckTimer();
  const started = Date.now();
  const total = Math.max(1, Number(seconds) || 30) * 1000;
  const bar = () => app.querySelector("[data-check-bar]");
  const lab = () => app.querySelector("[data-check-sec]");
  const paint = () => {
    const left = Math.max(0, total - (Date.now() - started));
    const pct = (left / total) * 100;
    if (bar()) bar().style.width = `${pct}%`;
    if (lab()) lab().textContent = `のこり ${Math.ceil(left / 1000)} 秒`;
    if (left <= 0) {
      stopCheckTimer();
      onExpire();
    }
  };
  paint();
  window.__checkTick = window.setInterval(paint, 120);
}

function weekLabel(d = new Date()) {
  return "日月火水木金土"[d.getDay()];
}

function moodVisual(kind, photo) {
  const mood = MOODS.find((m) => m.id === kind) || MOODS[0];
  const src = photo || (mood.photos && mood.photos[0]) || mood.photo;
  return `<img class="mood-photo" src="${src}" alt="人の顔の写真" />`;
}

function toHira(s) {
  return String(s || "")
    .trim()
    .replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60))
    .replace(/\s/g, "")
    .toLowerCase();
}

function parseWeek(raw) {
  const t = String(raw || "")
    .replace(/\s/g, "")
    .replace(/曜日/g, "")
    .replace(/ようび/g, "");
  const one = t.charAt(0);
  return "日月火水木金土".includes(one) ? one : "";
}

function keypadHtml(name) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "消す", "0"];
  return `<div class="keypad" data-pad="${name}">${keys
    .map((k) => `<button type="button" class="key ${k === "消す" ? "wide" : ""}" data-key="${k}">${k}</button>`)
    .join("")}</div>`;
}

function shapeTiles(cells, highlight, size = 3, extraClass = "") {
  const n = size * size;
  const cls = `shape-grid size-${size} ${extraClass}`.trim();
  return `<div class="${cls}" aria-hidden="true">${Array.from({ length: n }, (_, i) =>
    `<span class="${cells.includes(i) ? "on" : ""} ${highlight === i ? "hi" : ""}"></span>`
  ).join("")}</div>`;
}

function pickAnimalSet() {
  const user = currentUser();
  const dayPick = hashString(`${todayKey()}:${(user && user.id) || "x"}:animal`) % ANIMAL_SETS.length;
  const retake = Boolean(window.__check && window.__check.animalSet);
  return retake ? shuffleList(ANIMAL_SETS)[0] : ANIMAL_SETS[dayPick];
}

function startCheck() {
  const mood = shuffleList(MOODS)[0];
  window.__check = {
    i: 0,
    scores: {},
    picked: [],
    nums: [],
    words: CHECK_WORDS.slice(),
    mood: mood.id,
    moodPhoto: shuffleList((mood.photos || [mood.photo]).slice())[0],
    abbrev: shuffleList(ABBREV_QUIZ)[0],
    shape: [0, 1, 3],
    shapePick: null,
    animalSet: pickAnimalSet(),
    lang: "",
    lang2: "",
    langReview: null,
    month: "",
    day: "",
    week: "",
    moodText: "",
    mem: [],
    phase: "ask",
  };
}

function ensureCheck() {
  if (!window.__check) startCheck();
  return window.__check;
}

function finishCheckItem(ok, domain) {
  const game = ensureCheck();
  game.scores[domain] = ok ? 1 : 0;
  game.i += 1;
  game.picked = [];
  game.nums = [];
  game.shapePick = null;
  game.lang = "";
  game.lang2 = "";
  game.langReview = null;
  game.moodText = "";
  game.month = "";
  game.day = "";
  game.week = "";
  if (game.i >= 6) return finishCheck();
  renderCheckPlay();
}

function finishCheck() {
  stopCheckTimer();
  const game = ensureCheck();
  const user = currentUser();
  const screenList = BRAIN_GAMES.filter((g) => g.domain !== "insight");
  const ranked = screenList.slice().sort((a, b) => {
    const sa = game.scores[a.domain] ?? 1;
    const sb = game.scores[b.domain] ?? 1;
    return sa - sb;
  });
  const tired = ranked.filter((g) => (game.scores[g.domain] ?? 1) === 0);
  const rec =
    tired[0] ||
    BRAIN_GAMES[hashString(`${(user && user.id) || "x"}:${todayKey()}`) % BRAIN_GAMES.length];
  const payload = {
    scores: game.scores,
    rec: rec.id,
    tired: tired.map((g) => g.id),
  };
  if (user) saveScreen(user.id, payload);
  game.phase = "done";
  game.result = payload;
  location.hash = "#/brain/check/result";
  renderCheckResult();
}

function renderCheckShell(inner, { timer } = {}) {
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/today">← 今日の写真</a>
      ${inner}
    `,
    "brain"
  );
  bindTop();
  if (timer) {
    const game = ensureCheck();
    const sec = CHECK_SECS[game.i] || 30;
    startCheckTimer(sec, () => {
      const cur = ensureCheck();
      if (cur.i === 1 && !cur.langReview) {
        showAnimalReview(false, true);
        return;
      }
      const domain = ["memory", "language", "exec", "space", "social", "meaning"][cur.i];
      finishCheckItem(false, domain);
    });
  }
}

function renderCheckIntro() {
  stopCheckTimer();
  renderCheckShell(`
    <p class="kicker">今日の脳の元気予報</p>
    <h1 class="theme">6つのやさしいチェック</h1>
    <div class="brain-intro">
      <p class="intro-lead">病院の診断ではありません。いまの調子を見る、お天気予報のようなものです。</p>
      <ol class="intro-steps">
        <li>ことばや数字は、自分で書いて答えます。曜日はボタンで選べます。</li>
        <li>問題ごとに時間がちがいます。数字ならべと形合わせは 10 秒です。</li>
        <li>終わると、今日の元気予報の結果とおすすめが出ます。</li>
      </ol>
      <button class="primary" type="button" data-check-go>チェックをはじめる</button>
      <button class="ghost" type="button" data-check-later>先に写真を見る</button>
    </div>
  `);
  app.querySelector("[data-check-go]")?.addEventListener("click", () => {
    startCheck();
    location.hash = "#/brain/check/play";
    renderCheckPlay();
  });
  app.querySelector("[data-check-later]")?.addEventListener("click", () => {
    window.__deferBrainCheck = true;
    go("/today");
  });
}

function checkTimerHtml() {
  return `<div class="check-time"><div class="check-track"><i data-check-bar></i></div><span data-check-sec></span></div>`;
}

function renderCheckPlay() {
  const game = ensureCheck();
  if (game.phase === "done") return renderCheckResult();
  const n = game.i + 1;
  const reviewing = game.i === 1 && Boolean(game.langReview);
  const body = [
    renderQOrient,
    renderQLang,
    renderQExec,
    renderQSpace,
    renderQSocial,
    renderQMeaning,
  ][game.i];
  renderCheckShell(
    `
      <p class="kicker">元気予報　${n} / 6</p>
      ${reviewing ? "" : checkTimerHtml()}
      ${body(game)}
    `,
    { timer: !reviewing }
  );
  bindCheckQuestion(game);
}

function renderQOrient() {
  const weeks = "日月火水木金土".split("");
  return `
    <h1 class="theme">きょうは、何月何日？</h1>
    <p class="help">カレンダーを見ずに、月と日を書いて、曜日を押してください。</p>
    <p class="check-lab">月</p>
    <input class="pill" data-month-in inputmode="numeric" maxlength="2" placeholder="月の数字" />
    ${keypadHtml("month")}
    <p class="check-lab">日</p>
    <input class="pill" data-day-in inputmode="numeric" maxlength="2" placeholder="日の数字" />
    ${keypadHtml("day")}
    <p class="check-lab">曜日</p>
    <div class="palette week-pal">${weeks
      .map((w) => `<button type="button" class="pal" data-week="${w}">${w}曜日</button>`)
      .join("")}</div>
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function renderQLang(game) {
  const set = game.animalSet || ANIMAL_SETS[0];
  if (game.langReview) {
    const review = game.langReview;
    const examples = animalExamples(set);
    const yours = [game.lang, game.lang2].filter(Boolean).join(" / ") || "（まだ書けていません）";
    return `
      <h1 class="theme">「${escapeHtml(set.kana)}」から始まる<br />動物を 2つ</h1>
      <div class="nazo-aha ${review.ok ? "" : "ng"}">
        <p class="nazo-aha-title">${review.ok ? "正解！" : review.timed ? "時間切れ" : "おしい！"}</p>
        <p class="nazo-exp">あなたの答え：${escapeHtml(yours)}</p>
        <p class="nazo-exp">たとえば「${escapeHtml(set.kana)}」なら、${escapeHtml(examples)} などです。</p>
        <p class="nazo-exp">「${escapeHtml(set.kana)}」から始まるちがう動物を、2つ思い出す問題です。</p>
        <button class="primary" type="button" data-check-next>次の問題へ進む</button>
      </div>
    `;
  }
  return `
    <h1 class="theme">「${escapeHtml(set.kana)}」から始まる<br />動物を 2つ書いてください</h1>
    <p class="help">選択肢はありません。思い出したなまえを、2つ自分で書いてください。</p>
    <p class="check-lab">1つ目</p>
    <input class="pill nazo-in" data-lang-in maxlength="12" placeholder="なまえを書く" value="${escapeHtml(
      game.lang || ""
    )}" />
    <p class="check-lab">2つ目</p>
    <input class="pill nazo-in" data-lang2-in maxlength="12" placeholder="もうひとつ書く" value="${escapeHtml(
      game.lang2 || ""
    )}" />
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function renderQExec() {
  const nums = shuffleList([1, 2, 3, 4, 5]);
  return `
    <h1 class="theme">小さい数字から順に</h1>
    <p class="help">1 → 2 → 3 → 4 → 5 の順に、ボタンを押してください。</p>
    <p class="kana-out" data-num-out>ここから</p>
    <div class="num-scatter">${nums
      .map((n) => `<button type="button" class="num-dot" data-num="${n}">${n}</button>`)
      .join("")}</div>
  `;
}

function renderQSpace(game) {
  return `
    <h1 class="theme">見本と同じ形をつくる</h1>
    <p class="help">上の見本を見て、下のマスを自分で押して同じ位置を塗ってください。</p>
    <p class="check-lab">見本</p>
    ${shapeTiles(game.shape)}
    <p class="check-lab">あなたの答え</p>
    <div class="shape-grid play">${[0, 1, 2, 3, 4, 5, 6, 7, 8]
      .map(
        (i) =>
          `<button type="button" class="${(game.picked || []).includes(i) ? "on" : ""}" data-cell="${i}"></button>`
      )
      .join("")}</div>
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function hintBlock(text) {
  if (!text) return "";
  return `<button class="hint-btn" type="button" data-hint>ヒントを見る</button>
    <p class="hint-box" hidden data-hint-box>${escapeHtml(text)}</p>`;
}

function renderQSocial(game) {
  const labels = shuffleList(MOODS.slice());
  return `
    <h1 class="theme">この人は、どんな気持ち？</h1>
    <p class="help">写真の顔を見て、いちばん近い気持ちを押してください。</p>
    <div class="mood-hero">${moodVisual(game.mood, game.moodPhoto)}</div>
    <div class="palette">${labels
      .map((m) => `<button type="button" class="pal wide" data-mood="${m.id}">${m.label}</button>`)
      .join("")}</div>
  `;
}

function renderQMeaning(game) {
  const q = game.abbrev || ABBREV_QUIZ[0];
  return `
    <h1 class="theme">「${escapeHtml(q.short)}」は何の略？</h1>
    <p class="help">もとのことばを、自分で書いてください。</p>
    <input class="pill" data-lang-in maxlength="24" placeholder="もとのことば" />
    ${hintBlock(q.hint)}
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function animalExamples(set, n = 4) {
  return (set.items || [])
    .slice(0, n)
    .map((item) => item.key)
    .join("、");
}

function animalKey(typed, set) {
  const t = toHira(typed);
  if (!t) return "";
  const hit = (set.items || []).find((item) => item.ok.some((a) => toHira(a) === t));
  return hit ? hit.key : "";
}

function twoAnimalsOk(a, b, set) {
  const k1 = animalKey(a, set);
  const k2 = animalKey(b, set);
  return Boolean(k1 && k2 && k1 !== k2);
}

function showAnimalReview(ok, timed) {
  const game = ensureCheck();
  stopCheckTimer();
  game.langReview = { ok: Boolean(ok), timed: Boolean(timed) };
  if (typeof quizBeep === "function") quizBeep(ok);
  renderCheckPlay();
}

function bindCheckQuestion(game) {
  const step = game.i;
  const bindField = (sel, key) => {
    app.querySelector(sel)?.addEventListener("input", (e) => {
      game[key] = e.target.value;
    });
  };
  bindField("[data-month-in]", "month");
  bindField("[data-day-in]", "day");
  bindField("[data-lang-in]", "lang");
  bindField("[data-lang2-in]", "lang2");
  app.querySelectorAll("[data-week]").forEach((btn) => {
    btn.addEventListener("click", () => {
      game.week = btn.dataset.week;
      app.querySelectorAll("[data-week]").forEach((b) => b.classList.toggle("on", b === btn));
    });
  });
  app.querySelector("[data-hint]")?.addEventListener("click", () => {
    const box = app.querySelector("[data-hint-box]");
    if (box) box.hidden = false;
  });
  app.querySelector("[data-check-next]")?.addEventListener("click", () => {
    const ok = Boolean(game.langReview && game.langReview.ok);
    finishCheckItem(ok, "language");
  });
  app.querySelectorAll("[data-mood]").forEach((btn) => {
    btn.addEventListener("click", () => {
      finishCheckItem(btn.dataset.mood === game.mood, "social");
    });
  });
  app.querySelectorAll("[data-pad]").forEach((pad) => {
    pad.querySelectorAll("[data-key]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = pad.dataset.pad;
        const key = btn.dataset.key;
        let cur = String(game[name] || "");
        if (key === "消す") cur = cur.slice(0, -1);
        else if (cur.length < 2) cur += key;
        game[name] = cur;
        const inp = app.querySelector(name === "month" ? "[data-month-in]" : "[data-day-in]");
        if (inp) inp.value = game[name];
      });
    });
  });
  app.querySelectorAll("[data-num]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const n = Number(btn.dataset.num);
      const next = game.nums.length + 1;
      if (n !== next) {
        game.nums = [];
        app.querySelector("[data-num-out]").textContent = "もう一度、1 から";
        app.querySelectorAll("[data-num]").forEach((b) => b.classList.remove("on"));
        return;
      }
      game.nums.push(n);
      btn.classList.add("on");
      app.querySelector("[data-num-out]").textContent = game.nums.join(" → ");
      if (game.nums.length === 5) finishCheckItem(true, "exec");
    });
  });
  app.querySelectorAll("[data-cell]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.cell);
      if (game.picked.includes(i)) {
        game.picked = game.picked.filter((x) => x !== i);
        btn.classList.remove("on");
      } else {
        game.picked.push(i);
        btn.classList.add("on");
      }
    });
  });
  app.querySelector("[data-check-ok]")?.addEventListener("click", () => {
    if (step === 0) {
      const d = new Date();
      const ok =
        Number(game.month) === d.getMonth() + 1 &&
        Number(game.day) === d.getDate() &&
        parseWeek(game.week) === weekLabel(d);
      finishCheckItem(ok, "memory");
      return;
    }
    if (step === 1) {
      const set = game.animalSet || ANIMAL_SETS[0];
      showAnimalReview(twoAnimalsOk(game.lang, game.lang2, set), false);
      return;
    }
    if (step === 3) {
      const a = (game.picked || []).slice().sort((x, y) => x - y).join(",");
      const b = game.shape.slice().sort((x, y) => x - y).join(",");
      finishCheckItem(a === b, "space");
      return;
    }
    if (step === 5) {
      const q = game.abbrev || ABBREV_QUIZ[0];
      finishCheckItem(quizMatches(game.lang, q), "meaning");
    }
  });
}

function checkStage() {
  const raw = (location.hash.replace(/^#/, "") || "").split("?")[0];
  const parts = raw.split("/").filter(Boolean);
  return parts[2] || "";
}

function renderCheckResult() {
  stopCheckTimer();
  const user = currentUser();
  const game = window.__check;
  const row = (user && todayScreen(user.id)) || (game && game.result);
  if (!row) return renderCheckIntro();
  const rec = BRAIN_GAMES.find((g) => g.id === row.rec) || BRAIN_GAMES[0];
  const tired = new Set(row.tired || []);
  const scores = row.scores || {};
  const rows = BRAIN_GAMES.filter((g) => g.domain !== "insight")
    .map((g) => {
      const ok = (scores[g.domain] ?? 1) === 1;
      return `<li class="${ok ? "up" : "low"}"><b>${escapeHtml(g.skill)}</b><span>${
        ok ? "きょうは元気" : "少しお疲れ気味"
      }</span></li>`;
    })
    .join("");
  const note = tired.size
    ? "少しお疲れのところを、やさしく動かすのがおすすめです。"
    : "どれも元気そうです。今日は気分転換に、この脳トレをどうぞ。";
  renderCheckShell(`
    <p class="kicker">今日の脳の元気予報</p>
    <h1 class="theme">診断結果</h1>
    <p class="help">病院の診断ではありません。今日の調子の目安です。</p>
    <ul class="check-report">${rows}</ul>
    <div class="check-rec">
      <p class="check-lab">今日のおすすめ</p>
      <p class="theme rec-name">${escapeHtml(rec.title)}</p>
      <p class="help">${escapeHtml(note)}</p>
    </div>
    <a class="primary" href="#/brain/${rec.id}">おすすめの脳トレへ進む</a>
    <a class="ghost" href="#/brain">脳トレ一覧</a>
  `);
}

function renderCheck() {
  const stage = checkStage();
  const game = window.__check;
  if (stage === "result") return renderCheckResult();
  if (game && game.phase === "done" && stage === "play") return renderCheckResult();
  if (stage === "play") {
    ensureCheck();
    return renderCheckPlay();
  }
  return renderCheckIntro();
}
