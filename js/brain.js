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

function shiritoriTail(word) {
  const small = { ゃ: "や", ゅ: "ゆ", ょ: "よ", ぁ: "あ", ぃ: "い", ぅ: "う", ぇ: "え", ぉ: "お", っ: "つ" };
  const chars = [...String(word || "").replace(/[\s　]/g, "")].filter((ch) => ch !== "ー" && ch !== "・");
  const last = chars[chars.length - 1] || "";
  return small[last] || last;
}

function ensureShiri() {
  if (!window.__shiri) {
    const start = SHIRI_STARTS[Math.floor(Math.random() * SHIRI_STARTS.length)];
    window.__shiri = { chain: [start], ended: false, msg: "つぎの人のことばを書いてください" };
  }
  return window.__shiri;
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
  if (kind === "shiri") return renderShiri();

  app.innerHTML = chrome(
    `
      <p class="kicker">おまけ・息抜き</p>
      <h1 class="theme">脳トレ</h1>
      <p class="help">短い時間で頭をほぐすゲームです。今日の写真とは別です。</p>
      <a class="brain-card" href="#/brain/memory">
        <b>思い出神経衰弱</b>
        <span>同じ絵を2つ探します。家族の写真があれば使います。</span>
      </a>
      <a class="brain-card" href="#/brain/kana">
        <b>ひらがな探し</b>
        <span>マスの中から、たくさんのことばを見つけます。</span>
      </a>
      <a class="brain-card together" href="#/brain/shiri">
        <b>いっしょにしりとり</b>
        <span>その場の人と画面を見ながら、ことばをつなげます。</span>
      </a>
      <a class="ghost" href="#/today">今日の写真にもどる</a>
    `,
    "brain"
  );
  bindTop();
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

function renderShiri() {
  const game = ensureShiri();
  const next = shiritoriTail(game.chain[game.chain.length - 1]);
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">いっしょにできる遊び</p>
      <h1 class="theme">しりとり</h1>
      <p class="help">スマホを囲んで、ひとりずつことばを足してください。「ん」で終わりです。</p>
      <div class="shiri-chain">
        ${game.chain.map((w, i) => `<span>${i + 1}. ${escapeHtml(w)}</span>`).join("")}
      </div>
      ${
        game.ended
          ? `<p class="ok brain-ok">「ん」がつきました。${game.chain.length} ことば！</p>`
          : `<p class="shiri-next">つぎは「${escapeHtml(next)}」から</p>
             <p class="help">${escapeHtml(game.msg)}</p>
             <form data-shiri>
               <input class="pill shiri-in" name="word" maxlength="16" placeholder="${escapeHtml(next)}・・・" autocomplete="off" />
               <button class="primary" type="submit">つなげる</button>
             </form>`
      }
      <button class="ghost" type="button" data-shiri-new>はじめから</button>
    `,
    "brain"
  );
  bindTop();
  app.querySelector("[data-shiri]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const word = String(new FormData(e.target).get("word") || "")
      .trim()
      .replace(/[\s　]/g, "");
    if (word.length < 2) {
      game.msg = "2文字以上のことばにしてください";
      renderShiri();
      return;
    }
    if (!/^[ぁ-んァ-ンー]+$/.test(word)) {
      game.msg = "ひらがな（またはカタカナ）で書いてください";
      renderShiri();
      return;
    }
    const hira = word.replace(/[ァ-ン]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
    const head = hira[0];
    if (head !== next) {
      game.msg = `「${next}」から始まることばです`;
      renderShiri();
      return;
    }
    if (game.chain.includes(hira)) {
      game.msg = "同じことばは使えません";
      renderShiri();
      return;
    }
    game.chain.push(hira);
    const tail = shiritoriTail(hira);
    if (tail === "ん") {
      game.ended = true;
      game.msg = "";
    } else {
      game.msg = "スマホを次の人にわたしてください";
    }
    renderShiri();
  });
  app.querySelector("[data-shiri-new]")?.addEventListener("click", () => {
    window.__shiri = null;
    ensureShiri();
    renderShiri();
  });
}
