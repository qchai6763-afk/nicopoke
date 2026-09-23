function brainKind() {
  const raw = (location.hash.replace(/^#/, "") || "").split("?")[0];
  const parts = raw.split("/").filter(Boolean);
  return parts[1] || "";
}

function brainStage() {
  const raw = (location.hash.replace(/^#/, "") || "").split("?")[0];
  const parts = raw.split("/").filter(Boolean);
  return parts[2] || "";
}

function brainPlaying() {
  return brainStage() === "play";
}

const PLAY_TIME_KEY = "nicopoke-playtimes-v1";
const PLAY_RANK_CUTS = {
  memory: [
    { max: 45000, title: "達人級！", medal: "🥇" },
    { max: 80000, title: "名人級！", medal: "🥈" },
    { max: 120000, title: "よくできました！", medal: "🥉" },
    { max: Infinity, title: "チャレンジ賞！", medal: "🌸" },
  ],
  kana: [
    { max: 90000, title: "達人級！", medal: "🥇" },
    { max: 150000, title: "名人級！", medal: "🥈" },
    { max: 240000, title: "よくできました！", medal: "🥉" },
    { max: Infinity, title: "チャレンジ賞！", medal: "🌸" },
  ],
  quiz: [
    { max: 60000, title: "達人級！", medal: "🥇" },
    { max: 100000, title: "名人級！", medal: "🥈" },
    { max: 160000, title: "よくできました！", medal: "🥉" },
    { max: Infinity, title: "チャレンジ賞！", medal: "🌸" },
  ],
  order: [
    { max: 60000, title: "達人級！", medal: "🥇" },
    { max: 100000, title: "名人級！", medal: "🥈" },
    { max: 175000, title: "よくできました！", medal: "🥉" },
    { max: Infinity, title: "チャレンジ賞！", medal: "🌸" },
  ],
  space: [
    { max: 85000, title: "達人級！", medal: "🥇" },
    { max: 135000, title: "名人級！", medal: "🥈" },
    { max: 200000, title: "よくできました！", medal: "🥉" },
    { max: Infinity, title: "チャレンジ賞！", medal: "🌸" },
  ],
  mood: [
    { max: 25000, title: "達人級！", medal: "🥇" },
    { max: 40000, title: "名人級！", medal: "🥈" },
    { max: 60000, title: "よくできました！", medal: "🥉" },
    { max: Infinity, title: "チャレンジ賞！", medal: "🌸" },
  ],
};

function formatPlayClock(ms) {
  const t = Math.max(0, Number(ms) || 0);
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${d}`;
}

function formatPlaySeconds(ms) {
  return (Math.max(0, Number(ms) || 0) / 1000).toFixed(1);
}

const DIFF_KEY = "nicopoke-diff-v1";
const DIFF_KINDS = ["quiz", "order", "space"];
const DIFF_SPECS = {
  space: {
    easy: { total: 5, size: 3, fill: 4, noClock: true, limitMs: 0, perRound: false },
    normal: { total: 10, size: 3, fill: 4, noClock: false, limitMs: 5000, perRound: true },
    hard: { total: 15, size: 4, fill: 6, noClock: false, limitMs: 30000, perRound: false },
  },
  order: {
    easy: { max: 5, total: 3, noClock: true, limitMs: 0 },
    normal: { max: 15, total: 3, noClock: true, limitMs: 0 },
    hard: { max: 10, total: 3, noClock: false, limitMs: 15000 },
  },
  mood: {
    easy: { noClock: true },
    normal: { noClock: true },
    hard: { noClock: true },
  },
  quiz: {
    easy: { noClock: true },
    normal: { noClock: true },
    hard: { noClock: true },
  },
};
const DIFF_HELP = {
  space: {
    easy: "見本は5回、3×3マス。時間制限はありません。",
    normal: "見本は10回、3×3マス。1問5秒です。見本と同じになったら次へ進みます。",
    hard: "見本は15回、4×4マス。全問通しで30秒です。見本と同じになったら次へ進みます。",
  },
  order: {
    easy: "1から5までを3回。時間制限はありません。",
    normal: "1から15までを3回。じっくりマイペースに。",
    hard: "1から10までを3回通し。全部で15秒です。",
  },
  quiz: {
    easy: "スマホ・エアコン・コンビニなど、身近な略語です。",
    normal: "QRコード・ETCなど、よく考えたらわかる略語です。",
    hard: "PHS・JPEGなど、正式名称が長い・あまり聞かない略語です。",
  },
};

function loadDiffMap() {
  const data = readNamespacedJson(DIFF_KEY, {}) || {};
  return data;
}

function getBrainDiff(kind) {
  const data = loadDiffMap();
  const v = data[kind];
  return v === "easy" || v === "hard" ? v : "normal";
}

function setBrainDiff(kind, level) {
  const data = loadDiffMap();
  data[kind] = level;
  writeNamespacedJson(DIFF_KEY, data);
}

function brainDiffSpec(kind, level) {
  const map = DIFF_SPECS[kind];
  if (!map) return null;
  return map[level || getBrainDiff(kind)] || map.normal;
}

function diffPickerHtml(kind) {
  if (!DIFF_KINDS.includes(kind)) return "";
  const cur = getBrainDiff(kind);
  const help = (DIFF_HELP[kind] && DIFF_HELP[kind][cur]) || "";
  return `<div class="diff-box">
      <p class="check-lab">難易度</p>
      <div class="diff-picks">
        ${["easy", "normal", "hard"]
          .map(
            (lv) =>
              `<button type="button" class="diff-btn ${cur === lv ? "on" : ""}" data-diff="${lv}">${
                lv === "easy" ? "簡単" : lv === "hard" ? "難しい" : "普通"
              }</button>`
          )
          .join("")}
      </div>
      <p class="diff-help">${escapeHtml(help)}</p>
    </div>`;
}

function playClockHtml() {
  const run = window.__playRun;
  if (run && run.noClock) return "";
  const left = run && run.limitMs && !run.clearedAt ? Math.max(0, run.endsAt - Date.now()) : 0;
  const frozen = run && run.clearedAt ? run.ms : 0;
  const label =
    run && run.limitMs && !run.clearedAt
      ? formatPlayClock(left)
      : run && run.clearedAt
        ? formatPlayClock(frozen)
        : "00:00.0";
  const warn = run && run.limitMs && !run.clearedAt && left <= 5000 ? " warn" : "";
  return `<div class="play-clock${run && run.limitMs ? " limit" : ""}"><span class="${warn.trim()}" data-play-clock>${label}</span></div>`;
}

function stopPlayClock() {
  if (window.__playTick) {
    window.clearInterval(window.__playTick);
    window.__playTick = 0;
  }
}

function ensurePlayRun(kind, opts = {}) {
  const run = window.__playRun;
  if (!run || run.kind !== kind) {
    const limitMs = Number(opts.limitMs) || 0;
    window.__playRun = {
      kind,
      startedAt: Date.now(),
      clearedAt: 0,
      ms: 0,
      entryId: 0,
      noClock: Boolean(opts.noClock),
      limitMs,
      endsAt: limitMs ? Date.now() + limitMs : 0,
      timedOut: false,
      onExpire: opts.onExpire || null,
    };
  }
  return window.__playRun;
}

function startPlayClock(kind, opts = {}) {
  const run = ensurePlayRun(kind, opts);
  if (opts.limitMs && opts.resetLimit) {
    run.limitMs = opts.limitMs;
    run.endsAt = Date.now() + opts.limitMs;
    run.timedOut = false;
    run.onExpire = opts.onExpire || run.onExpire;
  }
  if (opts.onExpire) run.onExpire = opts.onExpire;
  stopPlayClock();
  if (run.noClock && !run.limitMs) return;
  const paint = () => {
    const el = app.querySelector("[data-play-clock]");
    if (run.clearedAt) {
      if (el) el.textContent = formatPlayClock(run.ms);
      return;
    }
    if (run.limitMs) {
      const left = Math.max(0, run.endsAt - Date.now());
      if (el) {
        el.textContent = formatPlayClock(left);
        el.classList.toggle("warn", left <= 5000);
      }
      if (left <= 0) {
        stopPlayClock();
        if (!run.timedOut && typeof run.onExpire === "function") {
          run.timedOut = true;
          run.onExpire();
        }
      }
      return;
    }
    if (el) el.textContent = formatPlayClock(Date.now() - run.startedAt);
  };
  paint();
  if (!run.clearedAt) window.__playTick = window.setInterval(paint, 100);
}

function loadPlayTimes() {
  try {
    return readNamespacedJson(PLAY_TIME_KEY, {}) || {};
  } catch {
    return {};
  }
}

function playTimesFor(kind) {
  const user = currentUser();
  const uid = (user && user.id) || "guest";
  const all = loadPlayTimes();
  return ((all[uid] && all[uid][kind]) || []).slice();
}

function savePlayTime(kind, ms) {
  const user = currentUser();
  const uid = (user && user.id) || "guest";
  const all = loadPlayTimes();
  if (!all[uid]) all[uid] = {};
  if (!all[uid][kind]) all[uid][kind] = [];
  const entry = { id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, ms, at: Date.now() };
  all[uid][kind].push(entry);
  all[uid][kind] = all[uid][kind].slice(-40);
  writeNamespacedJson(PLAY_TIME_KEY, all);
  return entry;
}

function topPlayTimes(kind, n = 3) {
  return playTimesFor(kind)
    .slice()
    .sort((a, b) => a.ms - b.ms)
    .slice(0, n);
}

function playRank(kind, ms) {
  const rows = PLAY_RANK_CUTS[kind] || PLAY_RANK_CUTS.order;
  return rows.find((r) => ms <= r.max) || rows[rows.length - 1];
}

function finishPlayTimed(kind) {
  const run = ensurePlayRun(kind);
  if (!run.clearedAt) {
    run.clearedAt = Date.now();
    run.ms = Math.max(0, run.clearedAt - run.startedAt);
    if (!run.noClock) {
      const entry = savePlayTime(kind, run.ms);
      run.entryId = entry.id;
    }
  }
  stopPlayClock();
  return run;
}

function goPlayResult(kind) {
  finishPlayTimed(kind);
  location.hash = `#/brain/${kind}/result`;
  renderPlayResult(kind);
}

function freshBrainGame(kind) {
  if (kind === "memory") window.__memory = memoryFaces();
  if (kind === "kana") window.__hunt = makeWordHunt();
  if (kind === "quiz") startQuiz();
  if (kind === "order") window.__order = null;
  if (kind === "space") window.__space = null;
  if (kind === "mood") {
    stopMoodReveal();
    window.__mood = null;
  }
  if (kind === "nazo") startNazo();
}

function restartBrainGame(kind) {
  stopPlayClock();
  if (kind === "memory" && !memoryReady()) {
    location.hash = "#/brain/memory";
    renderBrain();
    return;
  }
  freshBrainGame(kind);
  if (kind === "nazo") {
    window.__playRun = null;
  } else {
    const spec = brainDiffSpec(kind);
    window.__playRun = {
      kind,
      startedAt: Date.now(),
      clearedAt: 0,
      ms: 0,
      entryId: 0,
      noClock: Boolean(spec && spec.noClock),
      limitMs: (spec && spec.limitMs) || 0,
      endsAt: spec && spec.limitMs ? Date.now() + spec.limitMs : 0,
      timedOut: false,
      onExpire: null,
    };
  }
  location.hash = `#/brain/${kind}/play`;
  renderBrain();
}

function playResultNote(kind) {
  const run = window.__playRun;
  const timeout = run && run.timedOut ? "時間切れ　" : "";
  if (kind === "quiz" && window.__quiz) {
    return `${timeout}${window.__quiz.score} / ${window.__quiz.items.length} 問 正解`;
  }
  if (kind === "mood" && window.__mood) {
    return `${timeout}${window.__mood.score} / ${window.__mood.qs.length} 問 正解`;
  }
  if (kind === "order" && window.__order) {
    return `${timeout}${window.__order.ok} / ${window.__order.total} 回 できた`;
  }
  if (kind === "space" && window.__space) {
    return `${timeout}${window.__space.ok} / ${window.__space.total} 問 できた`;
  }
  return timeout.trim();
}

function renderPlayResult(kind) {
  stopPlayClock();
  const run = window.__playRun;
  if (!run || run.kind !== kind || !run.clearedAt) {
    location.hash = `#/brain/${kind}`;
    return renderBrainIntro(kind);
  }
  const info = BRAIN_GAMES.find((g) => g.id === kind) || { title: "脳トレ" };
  const rank = playRank(kind, run.ms);
  const tops = topPlayTimes(kind, 3);
  const best = tops[0];
  const isBest = best && best.id === run.entryId;
  const note = playResultNote(kind);
  const timed = Boolean(run.limitMs) || !run.noClock;
  const title = run.timedOut ? "時間切れ" : "クリア！";
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">${escapeHtml(info.title)}</p>
      <h1 class="theme">${title}</h1>
      <div class="play-result">
        ${
          timed
            ? `<p class="play-time-label">${run.timedOut ? "今回のタイム" : "今回のクリアタイム"}</p>
        <p class="play-time-big">${formatPlaySeconds(run.ms)}秒！</p>
        <p class="play-rank"><span>${rank.medal}</span>${escapeHtml(rank.title)}</p>
        ${isBest ? `<p class="play-pb">自己ベスト更新！過去の自分をこえました</p>` : ""}`
            : `<p class="play-time-label">マイペースでおつかれさま</p>
        <p class="play-rank"><span>🌸</span>よくできました！</p>`
        }
        ${note ? `<p class="help">${escapeHtml(note)}</p>` : ""}
        ${
          timed
            ? `<p class="check-lab">あなたの歴代トップ3</p>
        <ol class="play-tops">
          ${
            tops.length
              ? tops
                  .map((row, i) => {
                    const now = row.id === run.entryId;
                    return `<li class="${now ? "now" : ""}"><em>${i + 1}</em><b>${formatPlaySeconds(
                      row.ms
                    )}秒</b>${now ? "<span>今回</span>" : ""}</li>`;
                  })
                  .join("")
              : `<li>まだ記録がありません</li>`
          }
        </ol>`
            : ""
        }
        <p class="help">だれかと比べるものではありません。昨日の自分より、楽しく続けましょう。</p>
        <button class="primary" type="button" data-play-again>もう一度挑戦する</button>
        <a class="ghost" href="#/brain">脳トレ一覧</a>
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-play-again]")?.addEventListener("click", () => restartBrainGame(kind));
}

function shuffleList(list) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function memoryPhotos() {
  const group = currentGroup();
  if (!group) return [];
  const seen = new Set();
  const photos = [];
  questsForGroup(group.id)
    .filter((q) => isPosted(q) && q.photoDataUrl)
    .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0))
    .forEach((q) => {
      if (seen.has(q.photoDataUrl)) return;
      seen.add(q.photoDataUrl);
      photos.push(q.photoDataUrl);
    });
  return photos;
}

const MEMORY_PAIR_COUNT = 10;
const MEMORY_MIN_PHOTOS = MEMORY_PAIR_COUNT + 1;

function memoryReady() {
  return memoryPhotos().length >= MEMORY_MIN_PHOTOS;
}

function memoryFaces() {
  const photos = shuffleList(memoryPhotos()).slice(0, MEMORY_PAIR_COUNT);
  if (photos.length < MEMORY_PAIR_COUNT) return { cards: [], first: null, lock: false, won: false };
  const pairs = shuffleList(photos.concat(photos)).map((face, i) => ({
    id: i,
    face,
    photo: true,
    open: false,
    done: false,
  }));
  return { cards: pairs, first: null, lock: false, won: false };
}

function ensureMemory() {
  const photos = memoryPhotos();
  const stale =
    !window.__memory ||
    window.__memory.cards.some((c) => !c.photo) ||
    window.__memory.cards.length !== MEMORY_PAIR_COUNT * 2 ||
    (!window.__memory.cards.length && photos.length >= MEMORY_MIN_PHOTOS);
  if (stale) window.__memory = memoryFaces();
  return window.__memory;
}

function neighbors4(r, c, size) {
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([nr, nc]) => nr >= 0 && nc >= 0 && nr < size && nc < size);
}

function makeWordHunt() {
  const size = 7;
  const grid = Array.from({ length: size }, () => Array(size).fill(""));
  const placed = [];
  const pool = shuffleList(FIND_WORDS);
  pool.forEach((word) => {
    if (placed.length >= 12) return;
    const letters = word.split("");
    for (let tryN = 0; tryN < 50; tryN += 1) {
      const horiz = Math.random() > 0.5;
      const r = Math.floor(Math.random() * size);
      const c = Math.floor(Math.random() * size);
      const cells = letters.map((_, i) => (horiz ? [r, c + i] : [r + i, c]));
      const fits = cells.every(([rr, cc], i) => {
        if (rr < 0 || cc < 0 || rr >= size || cc >= size) return false;
        return !grid[rr][cc] || grid[rr][cc] === letters[i];
      });
      if (!fits) continue;
      cells.forEach(([rr, cc], i) => {
        grid[rr][cc] = letters[i];
      });
      placed.push(word);
      break;
    }
  });
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      if (!grid[r][c]) grid[r][c] = KANA_FILL[Math.floor(Math.random() * KANA_FILL.length)];
    }
  }
  return {
    size,
    grid,
    words: placed,
    found: [],
    path: [],
    used: {},
  };
}

function ensureHunt() {
  if (!window.__hunt) window.__hunt = makeWordHunt();
  return window.__hunt;
}

function pathKey(r, c) {
  return `${r}:${c}`;
}

function pathWord(game) {
  return game.path.map(({ r, c }) => game.grid[r][c]).join("");
}

const BRAIN_INTRO = {
  memory: {
    title: "思い出神経衰弱",
    img: "img/brain-intro-memory.png",
    alt: "裏向きのカードと、同じ家族写真が2枚そろったイラスト",
    lead: "同じ写真のカードを、2枚セットで見つけます。10種類・20枚です。",
    steps: [
      "家族の投稿写真が11枚以上あるときだけ、はじめられます。",
      "カードを1枚押すと、家族の写真が出ます。もう1枚押して、同じ写真なら残ります。",
      "ちがう写真なら、また裏にもどります。10組全部そろえたら終わりです。",
    ],
  },
  kana: {
    title: "ひらがな探し",
    img: "img/brain-intro-kana.png",
    alt: "マスを指でひとつずつ押して、ことばをつないでいるイラスト",
    lead: "となり合うマスを、1つずつ押してことばをつなぎます。",
    steps: [
      "ことばのいちばんはじめの文字を押します。",
      "そのとなりのマスを、順番にポチポチ押していきます。",
      "ことばができたら見つかりです。押しすぎたら、同じマスをもう一度押すとひとつ戻ります。",
    ],
  },
  quiz: {
    title: "略語あてクイズ",
    img: "img/brain-intro-quiz.png",
    alt: "テレビのクイズ番組のように、大きな選択肢が3つ並んだイラスト",
    lead: "なじみの略語が、もともとは何の言葉かを当てます。難易度を選べます。",
    steps: [
      "簡単・普通・難しいから、今の調子に合うものを選びます。",
      "略を見て、3つのうち正しい正式名称を押します。",
      "ちがう答えを押しても続けられます。選んだ間違いは画面に残ります。",
    ],
  },
  order: {
    title: "数字タッチ",
    img: "img/brain-intro-order.png",
    alt: "数字を小さい順に指で押しているイラスト",
    lead: "バラバラの数字を、1から順にポチポチ押します。難易度を選べます。",
    steps: [
      "簡単・普通・難しいから選びます。数字の個数と制限時間が変わります。",
      "いちばん小さい数字から探します。まちがえたら、その回は1からやりなおします。",
      "1セット押せたら次の配置です。全部で3回できたら終わりです。難しいは3回通しで15秒です。",
    ],
  },
  space: {
    title: "かたち合わせ",
    img: "img/brain-intro-space.png",
    alt: "見本のマスと同じ位置を選んでいるイラスト",
    lead: "見本と同じマスを、同じ位置で押します。難易度を選べます。",
    steps: [
      "簡単・普通・難しいで、回数とマスの大きさが変わります。",
      "右上の小さな見本を見て、下の空のマスを押して同じ形をつくります。",
      "見本と同じになった瞬間に次へ進みます。普通は1問5秒、難しいは全問通しで30秒です。",
    ],
  },
  mood: {
    title: "きもち読み",
    img: "img/brain-intro-mood.png",
    alt: "顔を見て気持ちのマークを選んでいるイラスト",
    lead: "顔を見て、いまの気持ちに近いものを押します。",
    steps: [
      "大きな顔を、ゆっくり見てください。",
      "8つの気持ちから、いちばん近いものを押します。",
      "押した瞬間に正解・はずれと答えが出て、次の問題へ進みます。",
    ],
  },
  nazo: {
    title: "ナゾナゾひらめき",
    img: "img/brain-intro-quiz.png",
    alt: "大きな選択肢をゆっくり選んでいるイラスト",
    lead: "ダジャレやひらめきで、頭の固まりをほぐします。時間を競いません。",
    steps: [
      "制限時間はありません。ゆっくり考えてください。",
      "思い浮かんだ答えを、自分で書いてください。",
      "当たっても外れても解説が出ます。確認してから次へ進めます。",
    ],
  },
};

function renderBrainIntro(kind) {
  const info = BRAIN_INTRO[kind];
  if (!info) {
    go("/brain");
    return;
  }
  const memoryBlocked = kind === "memory" && !memoryReady();
  const count = memoryPhotos().length;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">はじめる前に</p>
      <h1 class="theme">${info.title}</h1>
      <div class="brain-intro">
        ${info.img ? `<img class="intro-photo" src="${info.img}" alt="${info.alt}" />` : ""}
        <p class="intro-lead">${info.lead}</p>
        <ol class="intro-steps">
          ${info.steps.map((s) => `<li>${s}</li>`).join("")}
        </ol>
        ${
          memoryBlocked
            ? `<p class="help">いまの写真は ${count} 枚です。11枚以上そろってから遊べます。ゲームは10種類・20枚です。</p>
               <a class="primary" href="#/today">写真を送る</a>`
            : `${diffPickerHtml(kind)}<button class="primary" type="button" data-brain-start>ゲームをはじめる</button>`
        }
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-diff]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setBrainDiff(kind, btn.dataset.diff);
      renderBrainIntro(kind);
    });
  });
  app.querySelector("[data-brain-start]")?.addEventListener("click", () => {
    restartBrainGame(kind);
  });
}

function renderBrain() {
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  const kind = brainKind();
  const playing = brainPlaying();
  if (kind !== "check") stopCheckTimer();
  if (brainStage() !== "play") stopPlayClock();
  if (kind === "check") return renderCheck();
  if (kind === "memory") {
    if (brainStage() === "result") return renderPlayResult("memory");
    if (!playing) return renderBrainIntro("memory");
    return renderMemory();
  }
  if (kind === "kana") {
    if (brainStage() === "result") return renderPlayResult("kana");
    if (!playing) return renderBrainIntro("kana");
    return renderKana();
  }
  if (kind === "quiz") {
    if (brainStage() === "result") return renderPlayResult("quiz");
    if (!playing) return renderBrainIntro("quiz");
    return renderQuiz();
  }
  if (kind === "order") {
    if (brainStage() === "result") return renderPlayResult("order");
    if (!playing) return renderBrainIntro("order");
    return renderOrder();
  }
  if (kind === "space") {
    if (brainStage() === "result") return renderPlayResult("space");
    if (!playing) return renderBrainIntro("space");
    return renderSpace();
  }
  if (kind === "mood") {
    if (brainStage() === "result") return renderPlayResult("mood");
    if (!playing) return renderBrainIntro("mood");
    return renderMood();
  }
  if (kind === "nazo") {
    if (brainStage() === "result") return renderNazoResult();
    if (!playing) return renderBrainIntro("nazo");
    return renderNazo();
  }

  const user = currentUser();
  const screen = todayScreen(user.id);
  if (!screen) return renderCheckIntro();

  const rec = screen.rec;
  const ordered = BRAIN_GAMES.slice().sort((a, b) => (a.id === rec ? -1 : b.id === rec ? 1 : 0));
  app.innerHTML = chrome(
    `
      <p class="kicker">今日の脳トレ</p>
      <h1 class="theme">今日の息抜き</h1>
      <p class="help">診断ではありません。いちばん上の金色のカードが、今日のおすすめです。ナゾナゾに時間制限はありません。</p>
      <a class="ghost" href="#/brain/check">元気予報をもう一度</a>
      ${learnCtaHtml()}
      ${ordered
        .map((g) => {
          const star = g.id === rec;
          return `<a class="brain-card ${star ? "rec" : ""}" href="#/brain/${g.id}">
          ${star ? `<em class="rec-badge">★ いまおすすめ！</em>` : ""}
          <b>${escapeHtml(g.title)}</b>
          <span>${escapeHtml(g.skill)}　／　${escapeHtml(g.blurb)}</span>
        </a>`;
        })
        .join("")}
      <a class="ghost" href="#/today">今日の写真にもどる</a>
    `,
    "brain"
  );
  bindTop();
}

function renderMemory() {
  if (!memoryReady()) {
    stopPlayClock();
    location.hash = "#/brain/memory";
    return renderBrainIntro("memory");
  }
  const game = ensureMemory();
  if (!game.cards.length) {
    app.innerHTML = chrome(
      `
        <a class="back-link" href="#/brain">← 脳トレ一覧</a>
        <p class="kicker">思い出神経衰弱</p>
        <h1 class="theme">写真がまだ足りません</h1>
        <p class="help">ちがう写真が11枚以上あるときだけ遊べます。ゲームは10種類・20枚です。</p>
        <a class="primary" href="#/today">写真を送る</a>
      `,
      "brain"
    );
    bindTop();
    return;
  }
  if (game.won) return goPlayResult("memory");
  startPlayClock("memory");
  const remain = game.cards.filter((c) => !c.done).length;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">思い出神経衰弱</p>
      ${playClockHtml()}
      <h1 class="theme">同じ写真をさがす</h1>
      <p class="help">10種類の家族写真から、同じ思い出を2枚そろえてください。全部で20枚です。</p>
      <div class="memo">
        ${game.cards
          .map((card, i) => {
            const show = card.open || card.done;
            return `<button type="button" class="memo-card ${show ? "on" : ""} ${
              card.done ? "done" : ""
            }" data-i="${i}">${show ? `<img src="${card.face}" alt="" />` : ""}</button>`;
          })
          .join("")}
      </div>
      ${game.won ? `<p class="ok brain-ok">全部そろいました！</p>` : `<p class="help">残り ${remain / 2} 組</p>`}
      <button class="ghost" type="button" data-new-memo>写真を入れ直してはじめる</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-i]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.lock || game.won) return;
      const card = game.cards[Number(btn.dataset.i)];
      if (card.open || card.done) return;
      card.open = true;
      if (game.first == null) {
        game.first = card.id;
        renderMemory();
        return;
      }
      const a = game.cards[game.first];
      if (a.face === card.face && a.id !== card.id) {
        a.done = true;
        card.done = true;
        game.first = null;
        game.won = game.cards.every((c) => c.done);
        renderMemory();
        return;
      }
      game.lock = true;
      renderMemory();
      window.setTimeout(() => {
        a.open = false;
        card.open = false;
        game.first = null;
        game.lock = false;
        renderMemory();
      }, 700);
    });
  });
  app.querySelector("[data-new-memo]")?.addEventListener("click", () => {
    restartBrainGame("memory");
  });
}

function renderKana() {
  const game = ensureHunt();
  const current = pathWord(game);
  const left = game.words.filter((w) => !game.found.includes(w));
  const done = left.length === 0 && game.words.length > 0;
  if (done) return goPlayResult("kana");
  startPlayClock("kana");
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">ひらがな探し</p>
      ${playClockHtml()}
      <h1 class="theme">${game.found.length} / ${game.words.length} ことば</h1>
      <p class="help">となり合うマスを1つずつ押して、ことばをつなぎます。同じマスをもう一度押すと、ひとつ戻ります。</p>
      <p class="kana-out">${escapeHtml(current) || "ことばをつなぐ"}</p>
      <div class="hunt" style="--n:${game.size}">
        ${game.grid
          .map((row, r) =>
            row
              .map((ch, c) => {
                const onPath = game.path.some((p) => p.r === r && p.c === c);
                const used = game.used[pathKey(r, c)];
                return `<button type="button" class="hunt-cell ${onPath ? "path" : ""} ${
                  used ? "used" : ""
                }" data-r="${r}" data-c="${c}">${escapeHtml(ch)}</button>`;
              })
              .join("")
          )
          .join("")}
      </div>
      <div class="word-list">
        ${game.words
          .map(
            (w) =>
              `<span class="${game.found.includes(w) ? "got" : ""}">${escapeHtml(w)}</span>`
          )
          .join("")}
      </div>
      <button class="ghost" type="button" data-hunt-clear>いまの線を消す</button>
      <button class="reroll" type="button" data-hunt-new>別の盤面</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll(".hunt-cell").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (done) return;
      const r = Number(btn.dataset.r);
      const c = Number(btn.dataset.c);
      const last = game.path[game.path.length - 1];
      if (last && last.r === r && last.c === c) {
        game.path.pop();
        renderKana();
        return;
      }
      if (!last) {
        game.path = [{ r, c }];
      } else {
        const near = neighbors4(last.r, last.c, game.size).some(([nr, nc]) => nr === r && nc === c);
        const already = game.path.some((p) => p.r === r && p.c === c);
        if (!near || already) {
          game.path = [{ r, c }];
        } else {
          game.path.push({ r, c });
        }
      }
      const word = pathWord(game);
      if (left.includes(word)) {
        game.found.push(word);
        game.path.forEach((p) => {
          game.used[pathKey(p.r, p.c)] = true;
        });
        game.path = [];
      }
      renderKana();
    });
  });
  app.querySelector("[data-hunt-clear]")?.addEventListener("click", () => {
    game.path = [];
    renderKana();
  });
  app.querySelector("[data-hunt-new]")?.addEventListener("click", () => {
    restartBrainGame("kana");
  });
}

function foldQuizText(s) {
  return String(s || "")
    .replace(/[・･\.．,，\s　\-ー−–—_]/g, "")
    .toLowerCase();
}

function quizTokens(s) {
  return String(s || "")
    .split(/[・･\s　]+/)
    .map(foldQuizText)
    .filter((t) => t.length >= 2);
}

function quizClose(picked, answer) {
  const p = foldQuizText(picked);
  const a = foldQuizText(answer);
  if (!p || !a) return false;
  if (p === a) return true;
  const tokens = quizTokens(answer);
  if (tokens.length >= 2 && tokens.every((t) => p.includes(t))) return true;
  return false;
}

function quizMatches(picked, q) {
  const answers = [q.answer].concat(q.also || []);
  return answers.some((ans) => quizClose(picked, ans));
}

function quizBeep(ok) {
  try {
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    const beep = (freq, t, len) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.08, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + len);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(now + t);
      o.stop(now + t + len);
    };
    if (ok) {
      beep(880, 0, 0.16);
      beep(1174, 0.18, 0.22);
    } else {
      beep(196, 0, 0.35);
    }
  } catch {
    /* ignore */
  }
}

function startQuiz() {
  const level = getBrainDiff("quiz");
  const pool = ABBREV_QUIZ.filter((q) => (q.level || "easy") === level);
  const source = pool.length ? pool : ABBREV_QUIZ;
  const items = shuffleList(source).map((q) => ({
    short: q.short,
    answer: q.answer,
    also: q.also || [],
    hint: q.hint || "",
    choices: shuffleList(q.choices.slice()),
  }));
  window.__quiz = { items, i: 0, picked: null, solved: false, misses: [], history: [], score: 0, level };
}

function ensureQuiz() {
  if (!window.__quiz || !Array.isArray(window.__quiz.history)) startQuiz();
  return window.__quiz;
}

function renderQuiz() {
  const game = ensureQuiz();
  const total = game.items.length;
  if (game.i >= total) return goPlayResult("quiz");
  startPlayClock("quiz");
  const q = game.items[game.i];
  const n = game.i + 1;
  const solved = game.solved;
  const ok = solved && quizMatches(game.picked, q);
  const missNow = game.misses || [];
  const pastHist = (game.history || []).filter((h) => h.n !== n);
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      ${playClockHtml()}
      <div class="quiz-show">
        <div class="quiz-ep">第 ${n} 問　／　全 ${total} 問</div>
        <p class="quiz-q">「${escapeHtml(q.short)}」は<br />何の略？</p>
        ${solved ? "" : hintBlock(q.hint)}
        <div class="quiz-choices">
          ${q.choices
            .map((c, i) => {
              const letter = ["A", "B", "C"][i];
              let cls = "quiz-opt";
              const hit = quizMatches(c, q);
              if (solved && hit) cls += " yes";
              if (missNow.includes(c)) cls += " no";
              const locked = solved || missNow.includes(c);
              return `<button type="button" class="${cls}" data-quiz="${escapeHtml(c)}" ${
                locked ? "disabled" : ""
              }><em>${letter}</em>${escapeHtml(c)}</button>`;
            })
            .join("")}
        </div>
        ${
          missNow.length
            ? `<div class="quiz-hist">
                 <p>この問題で選んだ間違い</p>
                 <ul>${missNow.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
               </div>`
            : ""
        }
        ${
          pastHist.length
            ? `<div class="quiz-hist dim">
                 <p>これまでのお手つき</p>
                 <ul>${pastHist
                   .map((h) => `<li>第${h.n}問「${escapeHtml(h.short)}」→ ${escapeHtml(h.picked)}</li>`)
                   .join("")}</ul>
               </div>`
            : ""
        }
        ${
          solved
            ? `<div class="quiz-result ${ok ? "ok" : "ng"}">
                 <b>${ok ? QUIZ_OK[game.i % QUIZ_OK.length] : QUIZ_NG[game.i % QUIZ_NG.length]}</b>
                 <p>正解は「${escapeHtml(q.answer)}」</p>
               </div>
               <button class="quiz-next" type="button" data-quiz-next>${
                 n === total ? "成績を見る" : "次の問題へ"
               }</button>`
            : missNow.length
              ? `<p class="quiz-hint">その答えは違いました。ほかを押してみてください。</p>`
              : `<p class="quiz-hint">3つのうち、正しい正式名称を押してください。</p>`
        }
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-hint]")?.addEventListener("click", () => {
    const box = app.querySelector("[data-hint-box]");
    if (box) box.hidden = false;
  });
  app.querySelectorAll("[data-quiz]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.solved) return;
      const picked = btn.dataset.quiz;
      if (missNow.includes(picked)) return;
      if (quizMatches(picked, q)) {
        game.picked = picked;
        game.solved = true;
        if (!missNow.length) game.score += 1;
        quizBeep(true);
      } else {
        game.misses.push(picked);
        game.history.push({ n, short: q.short, picked });
        quizBeep(false);
      }
      renderQuiz();
    });
  });
  app.querySelector("[data-quiz-next]")?.addEventListener("click", () => {
    game.i += 1;
    game.picked = null;
    game.solved = false;
    game.misses = [];
    renderQuiz();
  });
}

function orderNums(max) {
  return Array.from({ length: max }, (_, i) => i + 1);
}

function ensureOrder() {
  if (!window.__order) {
    const spec = brainDiffSpec("order");
    const max = spec.max;
    window.__order = {
      round: 0,
      total: spec.total || 3,
      ok: 0,
      next: 1,
      max,
      won: false,
      layout: shuffleList(orderNums(max)),
      noClock: spec.noClock,
      limitMs: spec.limitMs,
      failed: false,
    };
  }
  return window.__order;
}

function resetOrderBoard(game) {
  game.next = 1;
  game.layout = shuffleList(orderNums(game.max));
}

function finishOrderRound(ok) {
  const game = window.__order;
  if (!game || game.won || game.failed) return;
  if (ok) game.ok += 1;
  game.round += 1;
  if (game.round >= game.total) {
    game.won = true;
    goPlayResult("order");
    return;
  }
  resetOrderBoard(game);
  renderOrder();
}

function renderOrder() {
  const game = ensureOrder();
  if (game.won) return goPlayResult("order");
  startPlayClock("order", {
    noClock: game.noClock,
    limitMs: game.limitMs,
    onExpire: () => {
      if (game.won || game.failed) return;
      game.failed = true;
      goPlayResult("order");
    },
  });
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">数字タッチ　${game.round + 1} / ${game.total} 回</p>
      ${playClockHtml()}
      <h1 class="theme">${game.won ? "全部押せました！" : `つぎは ${game.next}`}</h1>
      <p class="help">1から ${game.max} まで、小さい順に押してください。まちがえたら 1 からやり直しです。全部で ${
        game.total
      } 回です。${game.limitMs ? `3回通しで ${game.limitMs / 1000} 秒です。` : "時間制限はありません。"}</p>
      <div class="num-scatter n-${game.max}">${game.layout
        .map((n) => {
          const done = n < game.next || game.won;
          return `<button type="button" class="num-dot ${done ? "on" : ""}" data-num="${n}" ${
            game.won ? "disabled" : ""
          }>${n}</button>`;
        })
        .join("")}</div>
      <button class="ghost" type="button" data-order-new>はじめから</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-num]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.won || game.failed) return;
      const n = Number(btn.dataset.num);
      if (n !== game.next) {
        game.next = 1;
        renderOrder();
        return;
      }
      game.next += 1;
      if (game.next > game.max) {
        finishOrderRound(true);
        return;
      }
      renderOrder();
    });
  });
  app.querySelector("[data-order-new]")?.addEventListener("click", () => {
    restartBrainGame("order");
  });
}

function randomPattern(size = 3, fill = 4) {
  const cells = shuffleList(Array.from({ length: size * size }, (_, i) => i)).slice(0, fill);
  return cells.sort((a, b) => a - b);
}

function spacePickKey(list) {
  return (list || []).slice().sort((x, y) => x - y).join(",");
}

function spaceMatches(game) {
  return spacePickKey(game.pick) === spacePickKey(game.target);
}

function spaceTimeHelp(game) {
  if (game.perRound && game.limitMs) return `1問 ${game.limitMs / 1000} 秒です。見本と同じになったら次へ進みます。`;
  if (game.limitMs) return `全問通しで ${game.limitMs / 1000} 秒です。見本と同じになったら次へ進みます。`;
  return "時間制限はありません。見本と同じになったら次へ進みます。";
}

function ensureSpace() {
  if (!window.__space) {
    const spec = brainDiffSpec("space");
    window.__space = {
      round: 0,
      total: spec.total,
      size: spec.size,
      fill: spec.fill,
      target: randomPattern(spec.size, spec.fill),
      pick: [],
      ok: 0,
      noClock: spec.noClock,
      limitMs: spec.limitMs,
      perRound: spec.perRound,
      failed: false,
      lock: false,
    };
  }
  return window.__space;
}

function resetSpaceRoundClock() {
  const game = window.__space;
  const run = window.__playRun;
  if (!game || !game.perRound || !run || !game.limitMs) return;
  run.timedOut = false;
  run.limitMs = game.limitMs;
  run.endsAt = Date.now() + game.limitMs;
}

function advanceSpace(ok) {
  const game = window.__space;
  const run = window.__playRun;
  if (!game || game.failed) return;
  if (ok) game.ok += 1;
  game.round += 1;
  game.pick = [];
  game.target = randomPattern(game.size, game.fill);
  game.lock = false;
  if (run) run.timedOut = false;
  if (game.round >= game.total) return goPlayResult("space");
  resetSpaceRoundClock();
  renderSpace();
}

function expireSpaceRound() {
  const game = window.__space;
  if (!game || game.failed) return;
  advanceSpace(false);
}

function renderSpaceFail() {
  stopPlayClock();
  const game = ensureSpace();
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">かたち合わせ</p>
      <h1 class="theme">時間切れ</h1>
      <div class="play-result">
        <p class="play-rank"><span>⏰</span>失敗</p>
        <p class="help">全問通しで ${game.limitMs / 1000} 秒に間に合いませんでした。見本 ${game.round} / ${
          game.total
        } まで進みました。</p>
        <button class="primary" type="button" data-space-retry>はじめから</button>
        <a class="ghost" href="#/brain">やめる</a>
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-space-retry]")?.addEventListener("click", () => {
    restartBrainGame("space");
  });
}

function renderSpace() {
  const game = ensureSpace();
  if (game.failed) return renderSpaceFail();
  if (game.round >= game.total) return goPlayResult("space");
  const cells = game.size * game.size;
  startPlayClock("space", {
    noClock: game.noClock,
    limitMs: game.limitMs,
    onExpire: () => {
      if (game.failed || game.lock) return;
      if (game.perRound) {
        expireSpaceRound();
        return;
      }
      game.failed = true;
      renderSpace();
    },
  });
  app.innerHTML = chrome(
    `
      <div class="space-play">
        <div class="space-head">
          <div class="space-copy">
            <a class="back-link" href="#/brain">← 脳トレ一覧</a>
            <p class="kicker">かたち合わせ</p>
            ${playClockHtml()}
            <h1 class="theme">見本 ${game.round + 1} / ${game.total}</h1>
            <p class="help">右上の見本と同じマスを押してください。もう一度押すと消えます。${spaceTimeHelp(game)}</p>
          </div>
          <aside class="space-sample">
            <p class="check-lab">見本</p>
            ${shapeTiles(game.target, undefined, game.size, "mini")}
          </aside>
        </div>
        <p class="check-lab">あなたの答え</p>
        <div class="shape-grid play size-${game.size}">${Array.from({ length: cells }, (_, i) =>
          `<button type="button" class="${game.pick.includes(i) ? "on" : ""}" data-cell="${i}"></button>`
        ).join("")}</div>
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-cell]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.failed || game.lock) return;
      const i = Number(btn.dataset.cell);
      if (game.pick.includes(i)) game.pick = game.pick.filter((x) => x !== i);
      else game.pick.push(i);
      btn.classList.toggle("on", game.pick.includes(i));
      if (spaceMatches(game)) {
        game.lock = true;
        advanceSpace(true);
      }
    });
  });
}

function stopMoodReveal() {
  if (window.__moodReveal) {
    window.clearTimeout(window.__moodReveal);
    window.__moodReveal = 0;
  }
}

function ensureMood() {
  if (!window.__mood) {
    const pool = MOODS.flatMap((m) =>
      (m.photos || [m.photo]).map((photo) => ({ id: m.id, label: m.label, photo }))
    );
    window.__mood = { i: 0, qs: shuffleList(pool).slice(0, 6), score: 0, lock: false, reveal: null };
  }
  return window.__mood;
}

function renderMood() {
  const game = ensureMood();
  if (game.i >= game.qs.length) return goPlayResult("mood");
  startPlayClock("mood", { noClock: true });
  const q = game.qs[game.i];
  const reveal = game.reveal;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">きもち読み　${game.i + 1} / ${game.qs.length}</p>
      ${playClockHtml()}
      ${
        reveal
          ? `<p class="mood-judge ${reveal.ok ? "ok" : "ng"}">${reveal.ok ? "正解！" : "はずれ"}</p>
             <p class="mood-answer">答えは「${escapeHtml(q.label)}」です</p>`
          : `<h1 class="theme">この人は、どんな気持ち？</h1>`
      }
      <div class="mood-hero">${moodVisual(q.id, q.photo)}</div>
      <div class="palette">${MOODS.map((m) => {
        let cls = "pal wide";
        if (reveal) {
          if (m.id === q.id) cls += " yes";
          if (m.id === reveal.picked && !reveal.ok) cls += " no";
        }
        return `<button type="button" class="${cls}" data-mood="${m.id}" ${
          reveal ? "disabled" : ""
        }>${escapeHtml(m.label)}</button>`;
      }).join("")}</div>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-mood]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.lock || game.reveal) return;
      const picked = btn.dataset.mood;
      const ok = picked === q.id;
      if (ok) game.score += 1;
      game.lock = true;
      game.reveal = { ok, picked };
      renderMood();
      stopMoodReveal();
      window.__moodReveal = window.setTimeout(() => {
        game.i += 1;
        game.lock = false;
        game.reveal = null;
        renderMood();
      }, 900);
    });
  });
}

const NAZO_KEY = "nicopoke-nazo-v1";
const NAZO_ROUND = 8;

function nazoTypedOk(typed, q) {
  const t = toHira(typed);
  if (!t) return false;
  const extras = {
    トイレットペーパー: ["ぺーぱー", "ペーパー", "トイレットぺーパー"],
    年: ["とし", "ねんれい", "年齢"],
    影: ["かげ"],
    鉛筆: ["えんぴつ", "エンピツ"],
    "自分の影": ["じぶんのかげ"],
    "鏡に映った自分": ["かがみ", "鏡", "かがみにうつったじぶん"],
    足し算: ["たしざん"],
    秘密: ["ひみつ"],
    本: ["ほん"],
    食後: ["しょくご"],
    Tシャツ: ["てぃーしゃつ", "ティーシャツ", "tしゃつ"],
    引っ張りだこ: ["ひっぱりだこ"],
    お隣: ["おとなり", "隣"],
    抽選会: ["ちゅうせんかい"],
    キウイ: ["きうい", "きういふるーつ"],
    湯船: ["ゆぶね"],
    錨: ["いかり"],
    耳: ["みみ"],
    写真: ["しゃしん"],
    水仙: ["すいせん"],
    神輿: ["みこし"],
    昆布茶: ["こぶちゃ"],
    電話: ["でんわ"],
    酸っぱい: ["すっぱい"],
    焼きもち: ["やきもち"],
    キャプテン: ["きゃぷてん"],
  };
  const answers = [q.answer].concat(q.also || []).concat(extras[q.answer] || []);
  return answers.some((a) => toHira(a) === t);
}

function startNazo() {
  const items = shuffleList(NAZO_QUIZ)
    .slice(0, NAZO_ROUND)
    .map((q) => ({
      id: q.id,
      question: q.question,
      answer: q.answer,
      category: q.category,
      explanation: q.explanation,
    }));
  window.__nazo = { items, i: 0, solved: false, typed: "", ok: false, score: 0, firsts: [] };
}

function ensureNazo() {
  if (!window.__nazo || !Array.isArray(window.__nazo.items)) startNazo();
  return window.__nazo;
}

function loadNazoStore() {
  try {
    return readNamespacedJson(NAZO_KEY, {}) || {};
  } catch {
    return {};
  }
}

function nazoUserStore() {
  const user = currentUser();
  const uid = (user && user.id) || "guest";
  const all = loadNazoStore();
  const row = all[uid] || { best: 0, solved: [] };
  if (!Array.isArray(row.solved)) row.solved = [];
  return { uid, all, row };
}

function saveNazoRound(game) {
  const { uid, all, row } = nazoUserStore();
  const solved = new Set(row.solved.concat(game.firsts || []));
  game.items.forEach((q, idx) => {
    if (idx < game.i || (idx === game.i && game.solved)) solved.add(q.id);
  });
  const prevBest = Number(row.best) || 0;
  const next = {
    best: Math.max(prevBest, game.score),
    solved: Array.from(solved),
  };
  all[uid] = next;
  writeNamespacedJson(NAZO_KEY, all);
  return { ...next, prevBest };
}

function nazoMedal(score, total) {
  if (score >= total) return { medal: "🥇", title: "ひらめき達人！" };
  if (score >= Math.ceil(total * 0.75)) return { medal: "🥈", title: "名人級！" };
  if (score >= Math.ceil(total * 0.5)) return { medal: "🥉", title: "よくできました！" };
  return { medal: "🌸", title: "チャレンジ賞！" };
}

function renderNazo() {
  stopPlayClock();
  const game = ensureNazo();
  if (game.i >= game.items.length) {
    location.hash = "#/brain/nazo/result";
    return renderNazoResult();
  }
  const q = game.items[game.i];
  const n = game.i + 1;
  const total = game.items.length;
  const store = nazoUserStore().row;
  const already = store.solved.includes(q.id);
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">ナゾナゾ　${n} / ${total}　${escapeHtml(q.category)}</p>
      <div class="nazo-card">
        <p class="nazo-q">${escapeHtml(q.question)}</p>
        ${
          game.solved
            ? `<div class="nazo-aha ${game.ok ? "" : "ng"}">
                 <p class="nazo-aha-title">${game.ok ? "なるほど！" : "おしい！"}</p>
                 ${
                   game.ok
                     ? `<p class="nazo-medal">${
                         game.firsts.includes(q.id) ? "🏅 新しいメダル" : "🌸 ひらめきました"
                       }</p>`
                     : `<p class="nazo-exp">正解は「${escapeHtml(q.answer)}」です。</p>`
                 }
                 <p class="nazo-exp">${escapeHtml(q.explanation)}</p>
                 <button class="primary" type="button" data-nazo-next>${
                   n === total ? "結果を見る" : "次の問題へ進む"
                 }</button>
               </div>`
            : `<p class="help">選択肢はありません。思い浮かんだ答えを書いてください。</p>
               <input class="pill nazo-in" data-nazo-in maxlength="24" placeholder="答えを書く" value="${escapeHtml(
                 game.typed || ""
               )}" />
               <button class="primary" type="button" data-nazo-ok>これで答える</button>
               <p class="nazo-hint">ゆっくりで大丈夫。時間は数えません。</p>`
        }
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-nazo-in]")?.addEventListener("input", (e) => {
    game.typed = e.target.value;
  });
  app.querySelector("[data-nazo-ok]")?.addEventListener("click", () => {
    if (game.solved) return;
    game.ok = nazoTypedOk(game.typed, q);
    game.solved = true;
    if (game.ok) {
      game.score += 1;
      if (!already) game.firsts.push(q.id);
      quizBeep(true);
    }
    renderNazo();
  });
  app.querySelector("[data-nazo-next]")?.addEventListener("click", () => {
    game.i += 1;
    game.solved = false;
    game.ok = false;
    game.typed = "";
    if (game.i >= game.items.length) {
      location.hash = "#/brain/nazo/result";
      renderNazoResult();
      return;
    }
    renderNazo();
  });
}

function renderNazoResult() {
  stopPlayClock();
  const game = window.__nazo;
  if (!game || !game.items) return renderBrainIntro("nazo");
  const total = game.items.length;
  const prevBest = nazoUserStore().row.best || 0;
  const saved = saveNazoRound(game);
  const rank = nazoMedal(game.score, total);
  const isBest = game.score > prevBest;
  const got = (saved.solved || []).length;
  const book = NAZO_QUIZ.length;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">ナゾナゾひらめき</p>
      <h1 class="theme">おつかれさま！</h1>
      <div class="play-result nazo-result">
        <p class="play-time-label">今回のなるほど</p>
        <p class="play-time-big">${game.score} / ${total} 問！</p>
        <p class="play-rank"><span>${rank.medal}</span>${escapeHtml(rank.title)}</p>
        ${isBest ? `<p class="play-pb">自己ベスト更新！昨日の自分をこえました</p>` : ""}
        <p class="help">いちばんよかった回：${saved.best} / ${total} 問</p>
        <p class="check-lab">ひらめき図鑑</p>
        <p class="nazo-book">${got} / ${book} 問 わかった</p>
        <p class="help">だれかと比べるものではありません。制限時間もないので、また好きなときにどうぞ。</p>
        <button class="primary" type="button" data-play-again>もう一度ひらめく</button>
        <a class="ghost" href="#/brain">脳トレ一覧</a>
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-play-again]")?.addEventListener("click", () => restartBrainGame("nazo"));
}



