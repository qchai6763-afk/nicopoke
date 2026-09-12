function brainKind() {
  const raw = (location.hash.replace(/^#/, "") || "").split("?")[0];
  const parts = raw.split("/").filter(Boolean);
  return parts[1] || "";
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

function makeSudoku4() {
  let grid = [
    [1, 2, 3, 4],
    [3, 4, 1, 2],
    [2, 1, 4, 3],
    [4, 3, 2, 1],
  ];
  const map = shuffleList([1, 2, 3, 4]);
  grid = grid.map((row) => row.map((n) => map[n - 1]));
  if (Math.random() > 0.5) {
    const t = grid[0];
    grid[0] = grid[1];
    grid[1] = t;
  }
  if (Math.random() > 0.5) {
    const t = grid[2];
    grid[2] = grid[3];
    grid[3] = t;
  }
  const puzzle = grid.map((row) => row.slice());
  let hidden = 0;
  while (hidden < 6) {
    const r = Math.floor(Math.random() * 4);
    const c = Math.floor(Math.random() * 4);
    if (puzzle[r][c]) {
      puzzle[r][c] = 0;
      hidden += 1;
    }
  }
  return { solution: grid, board: puzzle, given: puzzle.map((row) => row.map((n) => n !== 0)) };
}

function ensureSudoku() {
  if (!window.__sudoku) window.__sudoku = makeSudoku4();
  return window.__sudoku;
}

function memoryFaces() {
  const photos = albumFor(currentUser().id)
    .map((q) => q.photoDataUrl)
    .filter(Boolean)
    .slice(0, 6);
  const marks = photos.length >= 3 ? photos : MEMORY_MARKS.slice(0, 6);
  const pairs = shuffleList(marks.concat(marks)).map((face, i) => ({
    id: i,
    face,
    photo: String(face).startsWith("data:"),
    open: false,
    done: false,
  }));
  return { cards: pairs, first: null, lock: false, won: false };
}

function ensureMemory() {
  if (!window.__memory) window.__memory = memoryFaces();
  return window.__memory;
}

function scrambleWord(word) {
  let letters = word.split("");
  for (let n = 0; n < 8; n += 1) {
    letters = shuffleList(letters);
    if (letters.join("") !== word) break;
  }
  return letters;
}

function ensureKana() {
  if (!window.__kana) {
    const item = KANA_WORDS[Math.floor(Math.random() * KANA_WORDS.length)];
    window.__kana = {
      item,
      tiles: scrambleWord(item.word).map((ch, i) => ({ ch, i, used: false })),
      typed: "",
      won: false,
    };
  }
  return window.__kana;
}

function renderBrain() {
  const user = currentUser();
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  const kind = brainKind();
  if (kind === "sudoku") return renderSudoku();
  if (kind === "memory") return renderMemory();
  if (kind === "kana") return renderKana();

  app.innerHTML = chrome(
    `
      <p class="kicker">おまけ・息抜き</p>
      <h1 class="theme">脳トレ</h1>
      <p class="help">短い時間で頭をほぐすゲームです。今日の写真とは別です。</p>
      <a class="brain-card" href="#/brain/sudoku">
        <b>ナンプレ</b>
        <span>1から4の数字を、マスに入れるかんたん版です。</span>
      </a>
      <a class="brain-card" href="#/brain/memory">
        <b>思い出神経衰弱</b>
        <span>同じ絵を2つ探します。家族の写真があれば使います。</span>
      </a>
      <a class="brain-card" href="#/brain/kana">
        <b>ひらがなパズル</b>
        <span>ばらばらの文字を、ことばの順にならべます。</span>
      </a>
      <a class="ghost" href="#/today">今日の写真にもどる</a>
    `,
    "brain"
  );
  bindTop();
}

function renderSudoku() {
  const game = ensureSudoku();
  const done = game.board.every((row, r) => row.every((n, c) => n === game.solution[r][c]));
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">かんたんナンプレ</p>
      <h1 class="theme">4マス</h1>
      <p class="help">タテ・ヨコ・2×2のマスで、1〜4が1回ずつです。</p>
      <div class="sudo">
        ${game.board
          .map(
            (row, r) =>
              `<div class="sudo-row">${row
                .map((n, c) => {
                  const given = game.given[r][c];
                  return `<button type="button" class="sudo-cell ${given ? "given" : ""} ${
                    n && n !== game.solution[r][c] ? "bad" : ""
                  }" data-r="${r}" data-c="${c}">${n || ""}</button>`;
                })
                .join("")}</div>`
          )
          .join("")}
      </div>
      ${done ? `<p class="ok brain-ok">できました！</p>` : `<p class="help">空のマスを押すと、数字が進みます。</p>`}
      <button class="ghost" type="button" data-new-sudo>別の問題</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll(".sudo-cell").forEach((btn) => {
    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);
    if (game.given[r][c]) return;
    btn.addEventListener("click", () => {
      const cur = game.board[r][c];
      game.board[r][c] = cur >= 4 ? 0 : cur + 1;
      renderSudoku();
    });
  });
  app.querySelector("[data-new-sudo]")?.addEventListener("click", () => {
    window.__sudoku = makeSudoku4();
    renderSudoku();
  });
}

function renderMemory() {
  const game = ensureMemory();
  const remain = game.cards.filter((c) => !c.done).length;
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">思い出神経衰弱</p>
      <h1 class="theme">同じ絵をさがす</h1>
      <div class="memo">
        ${game.cards
          .map((card, i) => {
            const show = card.open || card.done;
            const inner = card.photo
              ? `<img src="${card.face}" alt="" />`
              : `<span>${card.face}</span>`;
            return `<button type="button" class="memo-card ${show ? "on" : ""} ${
              card.done ? "done" : ""
            }" data-i="${i}">${show ? inner : ""}</button>`;
          })
          .join("")}
      </div>
      ${game.won ? `<p class="ok brain-ok">全部そろいました！</p>` : `<p class="help">残り ${remain / 2} 組</p>`}
      <button class="ghost" type="button" data-new-memo>はじめから</button>
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
  const game = ensureKana();
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">ひらがなパズル</p>
      <div class="kana-mark">${game.item.mark}</div>
      <p class="help">${escapeHtml(game.item.say)}</p>
      <p class="kana-out">${escapeHtml(game.typed) || "　"}</p>
      <div class="kana-tiles">
        ${game.tiles
          .map(
            (t) =>
              `<button type="button" class="kana-tile" data-i="${t.i}" ${t.used ? "disabled" : ""}>${escapeHtml(
                t.ch
              )}</button>`
          )
          .join("")}
      </div>
      ${game.won ? `<p class="ok brain-ok">正解！ ${escapeHtml(game.item.word)}</p>` : ""}
      <button class="ghost" type="button" data-kana-reset>やりなおす</button>
      <button class="reroll" type="button" data-kana-next>別のことば</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelectorAll("[data-i]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (game.won) return;
      const tile = game.tiles.find((t) => String(t.i) === btn.dataset.i);
      if (!tile || tile.used) return;
      tile.used = true;
      game.typed += tile.ch;
      if (game.typed === game.item.word) game.won = true;
      if (game.typed.length >= game.item.word.length && !game.won) {
        game.typed = "";
        game.tiles.forEach((t) => {
          t.used = false;
        });
      }
      renderKana();
    });
  });
  app.querySelector("[data-kana-reset]")?.addEventListener("click", () => {
    game.typed = "";
    game.won = false;
    game.tiles.forEach((t) => {
      t.used = false;
    });
    renderKana();
  });
  app.querySelector("[data-kana-next]")?.addEventListener("click", () => {
    window.__kana = null;
    ensureKana();
    renderKana();
  });
}
