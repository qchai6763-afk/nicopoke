function brainKind() {
  const raw = (location.hash.replace(/^#/, "") || "").split("?")[0];
  const parts = raw.split("/").filter(Boolean);
  return parts[1] || "";
}

function brainPlaying() {
  const raw = (location.hash.replace(/^#/, "") || "").split("?")[0];
  const parts = raw.split("/").filter(Boolean);
  return parts[2] === "play";
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

function memoryFaces() {
  const photos = memoryPhotos().slice(0, 8);
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
  const stale =
    !window.__memory ||
    window.__memory.cards.some((c) => !c.photo) ||
    (!window.__memory.cards.length && memoryPhotos().length);
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
    lead: "同じ写真のカードを、2枚セットで見つけます。",
    steps: [
      "カードを1枚押すと、家族の写真が出ます。",
      "もう1枚押します。同じ写真なら、その2枚は残ります。",
      "ちがう写真なら、また裏にもどります。全部のペアをそろえたら終わりです。",
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
    lead: "なじみの略語が、もともとは何の言葉かを当てます。",
    steps: [
      "「エアコン」などの略を見て、3つのうち正しい正式名称を押します。",
      "点が無くても、だいじな言葉が入っていれば正解になります。",
      "ちがう答えを押しても続けられます。選んだ間違いは画面に残ります。",
    ],
  },
  order: {
    title: "数字タッチ",
    img: "img/brain-intro-order.png",
    alt: "数字を小さい順に指で押しているイラスト",
    lead: "バラバラの数字を、1から順にポチポチ押します。",
    steps: [
      "いちばん小さい数字から探します。",
      "まちがえたら、また1からやりなおします。",
      "最後の数字まで押せたら終わりです。",
    ],
  },
  space: {
    title: "かたち合わせ",
    img: "img/brain-intro-space.png",
    alt: "見本のマスと同じ位置を選んでいるイラスト",
    lead: "見本と同じマスを、同じ位置で押します。",
    steps: [
      "上の見本を、よく見てください。",
      "下の空のマスを押して、同じ形をつくります。",
      "できたら「できた」を押します。何回か続きます。",
    ],
  },
  mood: {
    title: "きもち読み",
    img: "img/brain-intro-mood.png",
    alt: "顔を見て気持ちのマークを選んでいるイラスト",
    lead: "顔を見て、いまの気持ちに近いものを押します。",
    steps: [
      "大きな顔を、ゆっくり見てください。",
      "うれしい・かなしい・おこっている・おどろいている、から選びます。",
      "何問か続きます。正解でもまちがいでも、次へ進みます。",
    ],
  },
};

function renderBrainIntro(kind) {
  const info = BRAIN_INTRO[kind];
  if (!info) {
    go("/brain");
    return;
  }
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">はじめる前に</p>
      <h1 class="theme">${info.title}</h1>
      <div class="brain-intro">
        <img class="intro-photo" src="${info.img}" alt="${info.alt}" />
        <p class="intro-lead">${info.lead}</p>
        <ol class="intro-steps">
          ${info.steps.map((s) => `<li>${s}</li>`).join("")}
        </ol>
        <button class="primary" type="button" data-brain-start>ゲームをはじめる</button>
      </div>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-brain-start]")?.addEventListener("click", () => {
    location.hash = `#/brain/${kind}/play`;
    renderBrain();
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
  if (kind === "check") return renderCheck();
  if (kind === "memory") {
    if (!playing) return renderBrainIntro("memory");
    return renderMemory();
  }
  if (kind === "kana") {
    if (!playing) return renderBrainIntro("kana");
    return renderKana();
  }
  if (kind === "quiz") {
    if (!playing) return renderBrainIntro("quiz");
    return renderQuiz();
  }
  if (kind === "order") {
    if (!playing) return renderBrainIntro("order");
    return renderOrder();
  }
  if (kind === "space") {
    if (!playing) return renderBrainIntro("space");
    return renderSpace();
  }
  if (kind === "mood") {
    if (!playing) return renderBrainIntro("mood");
    return renderMood();
  }

  const user = currentUser();
  const screen = todayScreen(user.id);
  if (!screen) return renderCheckIntro();

  const rec = screen.rec;
  app.innerHTML = chrome(
    `
      <p class="kicker">今日の脳トレ</p>
      <h1 class="theme">6つの息抜き</h1>
      <p class="help">診断ではありません。チェックの結果から、星のついたものが今日のおすすめです。</p>
      <a class="ghost" href="#/brain/check">元気予報をもう一度</a>
      ${BRAIN_GAMES.map((g) => {
        const star = g.id === rec;
        return `<a class="brain-card ${star ? "rec" : ""}" href="#/brain/${g.id}">
          <b>${star ? "★ おすすめ　" : ""}${escapeHtml(g.title)}</b>
          <span>${escapeHtml(g.skill)}　／　${escapeHtml(g.blurb)}</span>
        </a>`;
      }).join("")}
      <a class="ghost" href="#/today">今日の写真にもどる</a>
    `,
    "brain"
  );
  bindTop();
}

function renderMemory() {
  const game = ensureMemory();
  if (!game.cards.length) {
    app.innerHTML = chrome(
      `
        <a class="back-link" href="#/brain">← 脳トレ一覧</a>
        <p class="kicker">思い出神経衰弱</p>
        <h1 class="theme">写真がまだありません</h1>
        <p class="help">家族が送った写真が、カードの絵になります。まず今日の一枚を送ってください。</p>
        <a class="primary" href="#/today">写真を送る</a>
      `,
      "brain"
    );
    bindTop();
    return;
  }
  const remain = game.cards.filter((c) => !c.done).length;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">思い出神経衰弱</p>
      <h1 class="theme">同じ写真をさがす</h1>
      <p class="help">家族の投稿写真がカードになっています。同じ思い出を2枚そろえてください。</p>
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
    window.__memory = memoryFaces();
    renderMemory();
  });
}

function renderKana() {
  const game = ensureHunt();
  const current = pathWord(game);
  const left = game.words.filter((w) => !game.found.includes(w));
  const done = left.length === 0;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">ひらがな探し</p>
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
      ${done ? `<p class="ok brain-ok">全部見つけました！</p>` : ""}
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
    window.__hunt = makeWordHunt();
    renderKana();
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
  const items = shuffleList(ABBREV_QUIZ).map((q) => ({
    short: q.short,
    answer: q.answer,
    also: q.also || [],
    choices: shuffleList(q.choices.slice()),
  }));
  window.__quiz = { items, i: 0, picked: null, solved: false, misses: [], history: [], score: 0 };
}

function ensureQuiz() {
  if (!window.__quiz || !Array.isArray(window.__quiz.history)) startQuiz();
  return window.__quiz;
}

function renderQuiz() {
  const game = ensureQuiz();
  const total = game.items.length;
  if (game.i >= total) {
    app.innerHTML = chrome(
      `
        <a class="back-link" href="#/brain">← 脳トレ一覧</a>
        <div class="quiz-show">
          <div class="quiz-ep">終了</div>
          <p class="quiz-q">本日の成績</p>
          <p class="quiz-score">${game.score} / ${total} 問 正解</p>
          <p class="quiz-host">ありがとうございました。また次回もよろしくお願いいたします。</p>
          <button class="quiz-next" type="button" data-quiz-again>もう一度チャレンジ</button>
        </div>
      `,
      "brain"
    );
    bindTop();
    app.querySelector("[data-quiz-again]")?.addEventListener("click", () => {
      startQuiz();
      renderQuiz();
    });
    return;
  }
  const q = game.items[game.i];
  const n = game.i + 1;
  const solved = game.solved;
  const ok = solved && quizMatches(game.picked, q);
  const missNow = game.misses || [];
  const pastHist = (game.history || []).filter((h) => h.n !== n);
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <div class="quiz-show">
        <div class="quiz-ep">第 ${n} 問　／　全 ${total} 問</div>
        <p class="quiz-q">「${escapeHtml(q.short)}」は<br />何の略？</p>
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

function ensureOrder() {
  if (!window.__order || window.__order.won) {
    window.__order = { next: 1, max: 8, won: false, layout: shuffleList([1, 2, 3, 4, 5, 6, 7, 8]) };
  }
  return window.__order;
}

function renderOrder() {
  const game = ensureOrder();
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">数字タッチ</p>
      <h1 class="theme">${game.won ? "全部押せました！" : `つぎは ${game.next}`}</h1>
      <p class="help">1から ${game.max} まで、小さい順に押してください。まちがえたら 1 からやり直しです。</p>
      <div class="num-scatter">${game.layout
        .map((n) => {
          const done = n < game.next || game.won;
          return `<button type="button" class="num-dot ${done ? "on" : ""}" data-num="${n}" ${
            game.won ? "disabled" : ""
          }>${n}</button>`;
        })
        .join("")}</div>
      <button class="ghost" type="button" data-order-new>もう一度</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-num]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.won) return;
      const n = Number(btn.dataset.num);
      if (n !== game.next) {
        game.next = 1;
        renderOrder();
        return;
      }
      game.next += 1;
      if (game.next > game.max) game.won = true;
      renderOrder();
    });
  });
  app.querySelector("[data-order-new]")?.addEventListener("click", () => {
    window.__order = null;
    renderOrder();
  });
}

function randomPattern() {
  const cells = shuffleList([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, 4);
  return cells.sort((a, b) => a - b);
}

function ensureSpace() {
  if (!window.__space) {
    window.__space = { round: 0, total: 3, target: randomPattern(), pick: [], ok: 0 };
  }
  return window.__space;
}

function renderSpace() {
  const game = ensureSpace();
  const done = game.round >= game.total;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">かたち合わせ</p>
      <h1 class="theme">${done ? `${game.ok} / ${game.total} 問 できました` : `見本 ${game.round + 1} / ${game.total}`}</h1>
      ${
        done
          ? `<button class="primary" type="button" data-space-new>もう一度</button>`
          : `<p class="help">上の見本と同じマスを、下で押してください。もう一度押すと消えます。</p>
             <p class="check-lab">見本</p>
             ${shapeTiles(game.target)}
             <p class="check-lab">あなたの答え</p>
             <div class="shape-grid play">${[0, 1, 2, 3, 4, 5, 6, 7, 8]
               .map(
                 (i) =>
                   `<button type="button" class="${game.pick.includes(i) ? "on" : ""}" data-cell="${i}"></button>`
               )
               .join("")}</div>
             <button class="primary" type="button" data-space-ok>できた</button>`
      }
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-cell]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const i = Number(btn.dataset.cell);
      if (game.pick.includes(i)) game.pick = game.pick.filter((x) => x !== i);
      else game.pick.push(i);
      renderSpace();
    });
  });
  app.querySelector("[data-space-ok]")?.addEventListener("click", () => {
    const a = game.pick.slice().sort((x, y) => x - y).join(",");
    const b = game.target.slice().sort((x, y) => x - y).join(",");
    if (a === b) game.ok += 1;
    game.round += 1;
    game.target = randomPattern();
    game.pick = [];
    renderSpace();
  });
  app.querySelector("[data-space-new]")?.addEventListener("click", () => {
    window.__space = null;
    renderSpace();
  });
}

function ensureMood() {
  if (!window.__mood) {
    const qs = shuffleList(MOODS.concat(MOODS)).slice(0, 6);
    window.__mood = { i: 0, qs, score: 0 };
  }
  return window.__mood;
}

function renderMood() {
  const game = ensureMood();
  if (game.i >= game.qs.length) {
    app.innerHTML = chrome(
      `
        <a class="back-link" href="#/brain">← 脳トレ一覧</a>
        <p class="kicker">きもち読み</p>
        <h1 class="theme">${game.score} / ${game.qs.length} 問</h1>
        <p class="help">顔と気持ちを、ゆっくり合わせる練習です。</p>
        <button class="primary" type="button" data-mood-new>もう一度</button>
      `,
      "brain"
    );
    bindTop();
    app.querySelector("[data-mood-new]")?.addEventListener("click", () => {
      window.__mood = null;
      renderMood();
    });
    return;
  }
  const q = game.qs[game.i];
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">きもち読み　${game.i + 1} / ${game.qs.length}</p>
      <h1 class="theme">この人は、どんな気持ち？</h1>
      <div class="mood-hero">${moodSvg(q.id)}</div>
      <div class="palette">${MOODS.map(
        (m) => `<button type="button" class="pal wide" data-mood="${m.id}">${m.label}</button>`
      ).join("")}</div>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-mood]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.mood === q.id) game.score += 1;
      game.i += 1;
      renderMood();
    });
  });
}



