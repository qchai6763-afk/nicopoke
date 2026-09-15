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
  const mood = MOODS.find((m) => m.id === kind) || MOODS[0];
  return `<img class="mood-photo" src="${mood.photo}" alt="人の顔の写真" />`;
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
  location.hash = "#/brain";
  renderBrain();
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
        <li>ことばや数字は、自分で書いて答えます。答えのボタンは出ません。</li>
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
  if (game.phase === "done") {
    location.hash = "#/brain";
    return renderBrain();
  }
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
  return `
    <h1 class="theme">きょうは、何月何日？</h1>
    <p class="help">カレンダーを見ずに、自分で数字と曜日を書いてください。</p>
    <p class="check-lab">月</p>
    <input class="pill" data-month-in inputmode="numeric" maxlength="2" placeholder="月の数字" />
    ${keypadHtml("month")}
    <p class="check-lab">日</p>
    <input class="pill" data-day-in inputmode="numeric" maxlength="2" placeholder="日の数字" />
    ${keypadHtml("day")}
    <p class="check-lab">曜日</p>
    <input class="pill" data-week-in maxlength="4" placeholder="曜日を書く" />
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function renderQLang() {
  return `
    <h1 class="theme">「い」から始まる<br />動物のなまえ</h1>
    <p class="help">思い出したなまえを、自分で書いてください。</p>
    <input class="pill" data-lang-in maxlength="12" placeholder="なまえを書く" />
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

function renderQSocial(game) {
  return `
    <h1 class="theme">この人は、どんな気持ち？</h1>
    <p class="help">写真の顔を見て、気持ちを自分で書いてください。</p>
    <div class="mood-hero">${moodVisual(game.mood)}</div>
    <input class="pill" data-mood-in maxlength="12" placeholder="気持ちを書く" />
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function renderQMeaning() {
  const q = ABBREV_QUIZ.find((x) => x.short === "リモコン") || ABBREV_QUIZ[0];
  return `
    <h1 class="theme">「${escapeHtml(q.short)}」は何の略？</h1>
    <p class="help">もとのことばを、自分で書いてください。</p>
    <input class="pill" data-lang-in maxlength="24" placeholder="もとのことば" />
    <button class="primary" type="button" data-check-ok>これで答える</button>
  `;
}

function moodAnswerOk(typed, moodId) {
  const t = toHira(typed);
  if (!t) return false;
  const map = {
    happy: ["うれしい", "たのしい", "よろこ", "えがお", "わらい", "しあわせ", "嬉"],
    sad: ["かなしい", "かなし", "なみだ", "ないている", "さびしい", "悲"],
    angry: ["おこっている", "おこり", "いかり", "むかつく", "はらだち", "怒"],
    wow: ["おどろいている", "おどろき", "びっくり", "おどろいた", "驚"],
  };
  return (map[moodId] || []).some((k) => t.includes(toHira(k)) || toHira(k).includes(t));
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
  bindField("[data-week-in]", "week");
  bindField("[data-lang-in]", "lang");
  bindField("[data-mood-in]", "moodText");
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
      finishCheckItem(I_ANIMAL_OK.some((a) => toHira(a) === toHira(game.lang)), "language");
      return;
    }
    if (step === 3) {
      const a = (game.picked || []).slice().sort((x, y) => x - y).join(",");
      const b = game.shape.slice().sort((x, y) => x - y).join(",");
      finishCheckItem(a === b, "space");
      return;
    }
    if (step === 4) {
      finishCheckItem(moodAnswerOk(game.moodText, game.mood), "social");
      return;
    }
    if (step === 5) {
      const q = ABBREV_QUIZ.find((x) => x.short === "リモコン") || ABBREV_QUIZ[0];
      finishCheckItem(quizMatches(game.lang, q), "meaning");
    }
  });
}

function renderCheck() {
  const playing = brainPlaying();
  const game = window.__check;
  if (playing && game && game.phase === "done") {
    location.hash = "#/brain";
    return renderBrain();
  }
  if (playing && game) return renderCheckPlay();
  return renderCheckIntro();
}
