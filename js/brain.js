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

function renderBrain() {
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  const kind = brainKind();
  if (kind === "memory") return renderMemory();
  if (kind === "kana") return renderKana();

  app.innerHTML = chrome(
    `
      <p class="kicker">おまけ・息抜き</p>
      <h1 class="theme">脳トレ</h1>
      <p class="help">短い時間で頭をほぐすゲームです。今日の写真とは別です。</p>
      <a class="brain-card" href="#/brain/memory">
        <b>思い出神経衰弱</b>
        <span>家族が送った写真のペアを探します。</span>
      </a>
      <a class="brain-card" href="#/brain/kana">
        <b>ひらがな探し</b>
        <span>マスの中から、たくさんのことばを見つけます。</span>
      </a>
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
      <p class="help">となり合うマスを順に押して、ことばをつくります。もう一度同じマスを押すと、ひとつ戻ります。</p>
      <p class="kana-out">${escapeHtml(current) || "ことばをなぞる"}</p>
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

