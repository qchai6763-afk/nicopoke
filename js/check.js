const SCREEN_KEY = "nicopoke-screen-v1";
const CHECK_SEC = 40;

function loadScreens() {
  try {
    return JSON.parse(localStorage.getItem(SCREEN_KEY) || "{}") || {};
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
  localStorage.setItem(SCREEN_KEY, JSON.stringify(all));
}

function stopCheckTimer() {
  if (window.__checkTick) {
    window.clearInterval(window.__checkTick);
    window.__checkTick = 0;
  }
}

function startCheckTimer(onExpire) {
  stopCheckTimer();
  const started = Date.now();
  const total = CHECK_SEC * 1000;
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

function moodVisual(kind) {
  const mood = MOODS.find((m) => m.id === kind);
  if (mood && mood.photo) {
    return `<img class="mood-photo" src="${mood.photo}" alt="表情の写真" />`;
  }
  return moodSvg(kind);
}

function moodSvg(kind) {
  const face = {
    happy: { mouth: "M9 16 Q12 19 15 16", brow: "" },
    sad: { mouth: "M9 18 Q12 15 15 18", brow: "" },
    angry: { mouth: "M9 17 L15 17", brow: '<path d="M7 8 L11 10" /><path d="M17 8 L13 10" />' },
    wow: { mouth: "M11 15 Q12 19 13 15 Q12 14 11 15", brow: "" },
  }[kind] || { mouth: "M9 16 Q12 19 15 16", brow: "" };
  const eyeY = kind === "sad" ? 10.5 : 10;
  return `<svg class="mood-svg" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#ffe7a8" stroke="#c48a2a" stroke-width="1.2"/>
    <circle cx="9" cy="${eyeY}" r="1.1" fill="#4a3f3a"/>
    <circle cx="15" cy="${eyeY}" r="1.1" fill="#4a3f3a"/>
    ${face.brow}
    <path d="${face.mouth}" fill="none" stroke="#4a3f3a" stroke-width="1.4" stroke-linecap="round"/>
  </svg>`;
}

function shapeTiles(cells, highlight) {
  return `<div class="shape-grid" aria-hidden="true">${[0, 1, 2, 3, 4, 5, 6, 7, 8]
    .map((i) => `<span class="${cells.includes(i) ? "on" : ""} ${highlight === i ? "hi" : ""}"></span>`)
    .join("")}</div>`;
}

function startCheck() {
  window.__check = {
    i: 0,
    scores: {},
    picked: [],
    nums: [],
    words: CHECK_WORDS.slice(),
    mood: shuffleList(MOODS)[0].id,
    shape: [0, 1, 3],
    shapePick: null,
    lang: "",
    month: "",
    day: "",
    week: "",
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
  if (game.i >= 6) return finishCheck();
  renderCheckPlay();
}

function finishCheck() {
  stopCheckTimer();
  const game = ensureCheck();
  const user = currentUser();
  const ranked = BRAIN_GAMES.slice().sort((a, b) => {
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
    startCheckTimer(() => {
      const game = ensureCheck();
      const domain = ["memory", "language", "exec", "space", "social", "meaning"][game.i];
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
        <li>ことば・数字・図形を、自分で入力したり押したりします。</li>
        <li>各問に約 ${CHECK_SEC} 秒あります。ゆっくりで大丈夫です。</li>
        <li>終わると、今日にぴったりの脳トレに星がつきます。</li>
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
      ${checkTimerHtml()}
      ${body(game)}
    `,
    { timer: true }
  );
  bindCheckQuestion(game);
}

function renderQOrient() {
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
  const weeks = "日月火水木金土".split("");
  return `
    <h1 class="theme">きょうは、何月何日？</h1>
    <p class="help">カレンダーを見ずに、数字で書くか、下のボタンで月・日・曜日を選んでください。</p>
    <p class="check-lab">月（数字）</p>
    <input class="pill" data-month-in inputmode="numeric" maxlength="2" placeholder="例）9" />
    <p class="check-lab">日（数字）</p>
    <input class="pill" data-day-in inputmode="numeric" maxlength="2" placeholder="例）15" />
    <p class="check-lab">月</p>
    <div class="palette" data-pal="month">${months
      .map((m) => `<button type="button" class="pal" data-v="${m}">${m}</button>`)
      .join("")}</div>
    <p class="check-lab">日</p>
    <div class="palette" data-pal="day">${days
      .map((d) => `<button type="button" class="pal" data-v="${d}">${d}</button>`)
      .join("")}</div>
    <p class="check-lab">曜日</p>
    <div class="palette" data-pal="week">${weeks
      .map((w) => `<button type="button" class="pal" data-v="${w}">${w}曜日</button>`)
      .join("")}</div>
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function renderQLang() {
  const chips = shuffleList(["いぬ", "いるか", "ねこ", "うま", "いのしし", "とり"]);
  return `
    <h1 class="theme">「い」から始まる<br />動物のなまえ</h1>
    <p class="help">思い浮かんだら、下に書くか、ことばを押してください。</p>
    <input class="pill" data-lang-in maxlength="12" placeholder="例）いぬ" />
    <div class="palette">${chips
      .map((c) => `<button type="button" class="pal" data-lang="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("")}</div>
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
  const opts = [
    { id: "a", cells: [0, 1, 3] },
    { id: "b", cells: [0, 1, 2] },
    { id: "c", cells: [1, 4, 7] },
    { id: "d", cells: [2, 5, 8] },
  ];
  return `
    <h1 class="theme">見本と同じ形はどれ？</h1>
    <p class="help">上の見本を見て、同じ位置が塗ってあるものを押してください。</p>
    <p class="check-lab">見本</p>
    ${shapeTiles(game.shape)}
    <div class="shape-choices">${opts
      .map(
        (o) =>
          `<button type="button" class="shape-opt" data-shape="${o.id}">${shapeTiles(o.cells)}</button>`
      )
      .join("")}</div>
  `;
}

function renderQSocial(game) {
  return `
    <h1 class="theme">この人は、どんな気持ち？</h1>
    <p class="help">顔を見て、いちばん近い気持ちを押してください。</p>
    <div class="mood-hero">${moodVisual(game.mood)}</div>
    <div class="palette">${MOODS.map(
      (m) => `<button type="button" class="pal wide" data-mood="${m.id}">${m.label}</button>`
    ).join("")}</div>
  `;
}

function renderQMeaning() {
  const q = ABBREV_QUIZ.find((x) => x.short === "リモコン") || ABBREV_QUIZ[0];
  const chips = shuffleList(q.choices.slice());
  return `
    <h1 class="theme">「${escapeHtml(q.short)}」は何の略？</h1>
    <p class="help">思い出した正式名称を書くか、ことばを押してください。</p>
    <input class="pill" data-lang-in maxlength="24" placeholder="例）リモートコントロール" />
    <div class="palette">${chips
      .map((c) => `<button type="button" class="pal" data-lang="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("")}</div>
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function bindCheckQuestion(game) {
  const step = game.i;
  app.querySelectorAll("[data-pal] .pal").forEach((btn) => {
    btn.addEventListener("click", () => {
      const pal = btn.parentElement.dataset.pal;
      app.querySelectorAll(`[data-pal="${pal}"] .pal`).forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      game[pal] = btn.dataset.v;
    });
  });
  app.querySelector("[data-month-in]")?.addEventListener("input", (e) => {
    game.month = e.target.value;
  });
  app.querySelector("[data-day-in]")?.addEventListener("input", (e) => {
    game.day = e.target.value;
  });
  app.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      game.lang = btn.dataset.lang;
      app.querySelectorAll("[data-lang]").forEach((b) => b.classList.remove("on"));
      btn.classList.add("on");
      const inp = app.querySelector("[data-lang-in]");
      if (inp) inp.value = game.lang;
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
  app.querySelectorAll("[data-shape]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const ok = btn.dataset.shape === "a";
      finishCheckItem(ok, "space");
    });
  });
  app.querySelectorAll("[data-mood]").forEach((btn) => {
    btn.addEventListener("click", () => {
      finishCheckItem(btn.dataset.mood === game.mood, "social");
    });
  });
  app.querySelectorAll("[data-mem]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const w = btn.dataset.mem;
      if (game.mem.includes(w)) {
        game.mem = game.mem.filter((x) => x !== w);
        btn.classList.remove("on");
      } else if (game.mem.length < 3) {
        game.mem.push(w);
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
        game.week === weekLabel(d);
      finishCheckItem(ok, "memory");
      return;
    }
    if (step === 1) {
      const raw = String(game.lang || "").trim().replace(/\s/g, "").toLowerCase();
      const ok = I_ANIMAL_OK.some((a) => a.replace(/\s/g, "").toLowerCase() === raw);
      finishCheckItem(ok, "language");
      return;
    }
    if (step === 5) {
      const q = ABBREV_QUIZ.find((x) => x.short === "リモコン") || ABBREV_QUIZ[0];
      const ok = quizMatches(game.lang, q);
      finishCheckItem(ok, "meaning");
    }
  });
}

function renderCheckResult() {
  stopCheckTimer();
  const user = currentUser();
  const row = (user && todayScreen(user.id)) || ensureCheck().result || {};
  const rec = BRAIN_GAMES.find((g) => g.id === row.rec) || BRAIN_GAMES[0];
  const tired = BRAIN_GAMES.filter((g) => (row.tired || []).includes(g.id));
  const note = tired.length
    ? tired.map((g) => g.skill).join("、")
    : "どの項目も、今日はおだやかです";
  renderCheckShell(`
    <p class="kicker">今日の脳の元気予報</p>
    <h1 class="theme">チェックおわり</h1>
    <div class="brain-intro">
      <p class="intro-lead">これは診断ではありません。今日の調子の目安です。</p>
      <p class="help">${escapeHtml(note)} ${tired.length ? "が、少しお疲れ気味かもしれません。" : ""}</p>
      <p class="check-lab">今日のあなたにぴったりの脳トレ</p>
      <a class="brain-card rec" href="#/brain/${rec.id}">
        <b>★ おすすめ　${escapeHtml(rec.title)}</b>
        <span>${escapeHtml(rec.skill)}　／　${escapeHtml(rec.blurb)}</span>
      </a>
      <a class="primary" href="#/brain/${rec.id}">この脳トレを見る</a>
      <a class="ghost" href="#/brain">6つの脳トレ一覧</a>
    </div>
  `);
}

function renderCheck() {
  const playing = brainPlaying();
  const game = window.__check;
  if (playing && game && game.phase === "done") return renderCheckResult();
  if (playing && game) return renderCheckPlay();
  return renderCheckIntro();
}
