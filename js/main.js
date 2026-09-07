const app = document.getElementById("app");

const ICO = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3v12H4V8z"/><circle cx="12" cy="14" r="3.5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 19c1.5-3.2 4-5 7-5s5.5 1.8 7 5"/></svg>',
};

function route() {
  const raw = (location.hash.replace(/^#/, "") || "/login").split("?")[0];
  const [path] = raw.split("/").filter(Boolean);
  return path || "login";
}

function go(path) {
  location.hash = path;
}

window.addEventListener("hashchange", render);
window.addEventListener("hidamari-change", render);

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function avatarMark(user, extraClass = "") {
  if (!user) return "";
  const cls = `avatar ${extraClass}`.trim();
  if (user.photo) {
    return `<span class="${cls}"><img src="${user.photo}" alt="" /></span>`;
  }
  return `<span class="${cls}">${user.icon || (user.shortName || user.name).slice(0, 1)}</span>`;
}

function compressPhoto(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 1000;
      let w = img.width;
      let h = img.height;
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      done(canvas.toDataURL("image/jpeg", 0.78));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function cropToSquare(file, done) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 280;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const min = Math.min(img.width, img.height);
      const sx = (img.width - min) / 2;
      const sy = (img.height - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      done(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function ago(ts) {
  if (!ts) return "まだ";
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m}分前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.round(h / 24)}日前`;
}

function roleLine(user) {
  return user.role || "家族";
}

function closedBanner(group) {
  return `<div class="closed"><b>グループ</b> ${escapeHtml(group.name)}　参加コードで入れます</div>`;
}

function statusRow(group, viewerId) {
  const rows = familyStatus(group.id);
  const othersPosted = rows.filter((r) => r.posted && r.user.id !== viewerId);
  const waiting = rows.filter((r) => !r.posted);
  const notice =
    waiting.some((r) => r.user.id === viewerId) && othersPosted.length
      ? `<div class="notice">${escapeHtml(othersPosted[0].user.name)}（${escapeHtml(
          othersPosted[0].user.role
        )}）が先に写真を送りました<small>あなたの番です。</small></div>`
      : othersPosted.length && !waiting.some((r) => r.user.id === viewerId)
        ? `<div class="notice">メンバーが動き始めました<small>写真を見て、お題を推理すると頭の体操になります。</small></div>`
        : "";

  return `
    ${notice}
    <div class="status">
      ${rows
        .map((r) => {
          const you = r.user.id === viewerId ? "（あなた）" : "";
          return `<div class="st ${r.posted ? "on" : ""}">
            <div class="dot"></div>
            <b>${escapeHtml(r.user.shortName)}${you}</b>
            <span>${r.posted ? "投稿済み" : "まだ"}</span>
            <span>${r.streak ? `🔥${r.streak}日` : "連続なし"} · 正解${r.score}</span>
          </div>`;
        })
        .join("")}
    </div>
  `;
}

function chrome(inner, active) {
  const user = currentUser();
  const group = currentGroup();
  const n = streakFor(user.id);
  const risk = streakAtRisk(user.id);
  const pop = window.__streakPop || 0;
  return `
    <div class="phone">
      <header class="top">
        <div class="brand">
          <div class="mascot" aria-hidden="true"></div>
          <div>
            <div class="logo">にこぽけ</div>
            <p class="family-name">${group ? escapeHtml(group.name) : "家族グループ"} · ${escapeHtml(
              user.shortName
            )}（${escapeHtml(user.role || "家族")}）</p>
          </div>
        </div>
        <div class="top-actions">
          <div class="streak-mini ${risk ? "risk" : ""} ${n ? "on" : ""}">🔥 ${n}日</div>
          <a href="#/me" class="avatar-link">${avatarMark(user)}</a>
        </div>
      </header>
      <main class="screen">${inner}</main>
      <nav class="tabbar">
        <a href="#/today" class="${active === "today" ? "active" : ""}">${ICO.cam}<span>今日のお題</span></a>
        <a href="#/feed" class="${active === "feed" ? "active" : ""}">${ICO.grid}<span>家族の写真</span></a>
        <a href="#/me" class="${active === "me" ? "active" : ""}">${ICO.me}<span>わたし</span></a>
      </nav>
      ${
        pop
          ? `<div class="pop" data-pop>
              <div class="pop-card">
                <div class="pop-fire">🔥</div>
                <b>${pop}日連続達成！</b>
                <p>家族とのひとコマ、また明日も。</p>
                <button type="button" data-pop-ok>つづける</button>
              </div>
            </div>`
          : ""
      }
    </div>
  `;
}

function bindTop() {
  app.querySelector("[data-pop-ok]")?.addEventListener("click", () => {
    window.__streakPop = 0;
    render();
  });
  app.querySelector("[data-pop]")?.addEventListener("click", (e) => {
    if (e.target.hasAttribute("data-pop")) {
      window.__streakPop = 0;
      render();
    }
  });
}

function personFields(prefix, defaults = {}) {
  const roleOpts = ROLES.map(
    (r) =>
      `<option value="${escapeHtml(r)}" ${defaults.role === r ? "selected" : ""}>${escapeHtml(r)}</option>`
  ).join("");
  return `
    <label>名前
      <input class="pill" name="${prefix}-name" maxlength="12" required placeholder="例）はな" value="${escapeHtml(
        defaults.name || ""
      )}" />
    </label>
    <label>続柄
      <select class="pill" name="${prefix}-role">${roleOpts}</select>
    </label>
  `;
}

function readPerson(form, prefix) {
  const data = new FormData(form);
  return {
    name: data.get(`${prefix}-name`),
    role: data.get(`${prefix}-role`),
  };
}

function renderLogin() {
  const { users } = getState();
  const err = window.__gateError || "";
  window.__gateError = "";
  app.innerHTML = `
    <div class="gate">
      <div class="badge">家族グループ</div>
      <h1>にこぽけ</h1>
      <p>グループをつくるか、参加コードで同じグループに入れます。別のスマホから入るときは、同じ公開ページを開いてください。</p>
      ${err ? `<p class="gate-err">${escapeHtml(err)}</p>` : ""}
      ${
        users.length
          ? `<p class="kicker">この端末のアカウント</p>
             <div class="people">
               ${users
                 .map(
                   (u) => `
                 <button type="button" data-login="${u.id}">
                   ${avatarMark(u)}
                   <span><b>${escapeHtml(u.name)}</b><span class="sub">${escapeHtml(roleLine(u))}</span></span>
                 </button>`
                 )
                 .join("")}
             </div>`
          : ""
      }
      <p class="kicker" style="margin-top:22px">グループをつくる</p>
      <form data-start>
        <label>グループ名
          <input class="pill" name="group" maxlength="20" required placeholder="例）たなか家" />
        </label>
        ${personFields("start")}
        <button class="primary" type="submit">つくる</button>
      </form>
      <p class="kicker" style="margin-top:18px">参加コードで入る</p>
      <form data-join>
        <label>参加コード
          <input class="pill code-in" name="code" maxlength="8" required placeholder="6文字" />
        </label>
        ${personFields("join")}
        <button class="ghost" type="submit">参加する</button>
      </form>
    </div>
  `;
  app.querySelectorAll("[data-login]").forEach((btn) => {
    btn.addEventListener("click", () => {
      login(btn.dataset.login);
      go("/today");
    });
  });
  app.querySelector("[data-start]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = e.target.querySelector("[type=submit]");
    if (submit) submit.disabled = true;
    const person = readPerson(e.target, "start");
    const result = await startGroup({
      groupName: new FormData(e.target).get("group"),
      ...person,
    });
    if (!result.ok) {
      window.__gateError = result.error;
      renderLogin();
      return;
    }
    go("/today");
  });
  app.querySelector("[data-join]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = e.target.querySelector("[type=submit]");
    if (submit) submit.disabled = true;
    const person = readPerson(e.target, "join");
    const result = await joinWithCode({
      code: new FormData(e.target).get("code"),
      ...person,
    });
    if (!result.ok) {
      window.__gateError = result.error;
      renderLogin();
      return;
    }
    go("/today");
  });
}

function renderToday() {
  const user = currentUser();
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  const quest = todayQuestFor(user.id, group.id);
  const posted = isPosted(quest);
  const streak = streakFor(user.id);
  const risk = streakAtRisk(user.id);

  const riskNote = risk
    ? `<div class="notice risk-note">🔥 ${streak}日連続が、今日で途切れそうです<small>いま一枚送ると、記録がつながります。</small></div>`
    : "";

  const editor = posted
    ? ""
    : `<div class="theme-edit">
         <div class="cat-chip">${quest.categoryEmoji || "🎲"} ${escapeHtml(quest.categoryLabel || "お題")}</div>
         <p class="lefts">スロット残り ${rerollsLeft(quest)} / ${MAX_REROLLS} 回</p>
         <button class="reroll" type="button" data-reroll ${rerollsLeft(quest) ? "" : "disabled"}>
           別のお題にする
         </button>
         <b>自分で書く</b>
         <form data-theme>
           <input class="pill" name="theme" value="${escapeHtml(quest.theme)}" maxlength="24" />
           <div class="row2">
             <button class="pill-btn" type="submit">このお題にする</button>
           </div>
         </form>
       </div>`;

  const preview = window.__photoPreview;
  const stage = posted
    ? `<div class="stage">
         <img src="${quest.photoDataUrl}" alt="" />
         <div class="done-chip">家族に送りました</div>
       </div>
       ${
         quest.revealed
           ? `<p class="text">お題は家族に公開されています</p>`
           : `<button class="ghost" data-reveal type="button">お題を家族に教える</button>`
       }
       <a class="primary" href="#/feed">家族の写真を見る</a>`
    : preview
      ? `<div class="stage"><img src="${preview}" alt="プレビュー" /></div>
         <div class="preview-actions">
           <button class="primary" type="button" data-confirm>この写真で送る</button>
           <button class="ghost" type="button" data-clear-preview>選びなおす</button>
         </div>`
      : `<label class="pick-photo">
           📷 カメラで撮る／アルバムから選ぶ
           <input type="file" accept="image/*" capture="environment" />
         </label>
         <p class="help">選んだ写真は、ここで確認してから送れます。</p>`;

  app.innerHTML = chrome(
    `
      ${closedBanner(group)}
      ${statusRow(group, user.id)}
      ${riskNote}
      <div class="streak ${streak ? "pulse" : ""}">${escapeHtml(streakLabel(streak))}</div>
      <p class="kicker">${formatDateLabel(todayKey())}　あなただけが見えるお題</p>
      <h1 class="theme">${escapeHtml(quest.theme)}</h1>
      <p class="help">家族には、写真を出すまでお題は秘密です。</p>
      ${editor}
      ${stage}
    `,
    "today"
  );

  bindTop();

  const input = app.querySelector('input[type="file"]');
  if (input) {
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      compressPhoto(file, (url) => {
        window.__photoPreview = url;
        render();
      });
    });
  }
  app.querySelector("[data-confirm]")?.addEventListener("click", () => {
    if (!window.__photoPreview) return;
    postPhoto(quest.id, { photoDataUrl: window.__photoPreview, caption: "" });
    window.__photoPreview = "";
    go("/feed");
  });
  app.querySelector("[data-clear-preview]")?.addEventListener("click", () => {
    window.__photoPreview = "";
    render();
  });
  app.querySelector("[data-reveal]")?.addEventListener("click", () => revealTheme(quest.id));
  app.querySelector("[data-theme]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    setQuestTheme(quest.id, new FormData(e.target).get("theme"));
  });
  app.querySelector("[data-reroll]")?.addEventListener("click", () => rerollQuest(quest.id));
}

function postCard(quest, viewerId) {
  const who = userById(quest.userId);
  const mine = quest.userId === viewerId;
  const posted = isPosted(quest);
  const themeOn = canSeeTheme(quest, viewerId);
  const guesses = guessesFor(quest.id);
  const myGuesses = guesses.filter((g) => g.userId === viewerId);
  const last = myGuesses[myGuesses.length - 1];
  const won = myGuesses.some((g) => g.correct);
  const comments = commentsFor(quest.id);
  const likes = likeCount(quest.id);
  const liked = hasLiked(quest.id, viewerId);
  const openTalk = posted;

  const media = posted
    ? `<img src="${quest.photoDataUrl}" alt="" />
       ${themeOn ? `<div class="tag">お題：${escapeHtml(quest.theme)}</div>` : `<div class="tag">お題は秘密</div>`}`
    : `<div class="locked"><div><span>🔒</span><em>waiting</em></div></div>`;

  const choices = posted && !mine && !themeOn ? guessChoices(quest) : [];

  const guessUi =
    posted && !mine && !themeOn
      ? `<p class="help">これ、何のお題やろ？　ボタンでも、文字でも。</p>
         <div class="chips">
           ${choices
             .map(
               (c) =>
                 `<button class="chip" type="button" data-chip="${quest.id}" data-value="${escapeHtml(
                   c
                 )}" ${won ? "disabled" : ""}>${escapeHtml(c)}</button>`
             )
             .join("")}
         </div>
         <div class="actions">
           <form data-guess="${quest.id}">
             <input class="pill" name="guess" placeholder="お題を書いて当てる" ${won ? "disabled" : ""} />
             <button class="pill-btn" ${won ? "disabled" : ""}>当てる</button>
           </form>
         </div>
         ${
           last
             ? `<p class="${last.correct ? "ok" : "ng"}">${last.correct ? "正解です" : "まだちがいます"}　「${escapeHtml(
                 last.text
               )}」</p>`
             : ""
         }`
      : "";

  const revealUi =
    mine && posted && !quest.revealed
      ? `<button class="ghost" data-reveal="${quest.id}" type="button">お題を家族に教える</button>`
      : "";

  const waitCopy = !posted
    ? `<p class="text">${escapeHtml(who.name)}さんは、まだ今日の一枚を待っています。</p>`
    : "";

  return `
    <article class="post">
      <div class="post-head">
        ${avatarMark(who)}
        <div><b>${escapeHtml(who.name)}</b><small>${escapeHtml(quest.categoryEmoji || "")} ${escapeHtml(
          who.role || "家族"
        )}　${posted ? ago(quest.postedAt) : "waiting"}</small></div>
      </div>
      <div class="frame">${media}</div>
      ${waitCopy}
      ${
        posted
          ? `<div class="react">
               <button type="button" class="like-btn ${liked ? "on" : ""}" data-like="${quest.id}" ${
                 mine ? "disabled" : ""
               }>${liked ? "❤️" : "♡"} いいね ${likes}</button>
               <span class="react-n">💬 ${comments.length}</span>
             </div>`
          : ""
      }
      ${guessUi}
      ${revealUi}
      ${
        openTalk
          ? `<p class="help">面白いひとことをどうぞ。いいね争い、はじまります。</p>
             <div class="thread">
              ${comments
                .map((c) => {
                  const cu = userById(c.userId);
                  return `<div class="bubble ${c.userId === viewerId ? "me" : ""}">${avatarMark(
                    cu,
                    "tiny"
                  )}<div><b>${escapeHtml(cu.shortName)}</b>${escapeHtml(c.text)}</div></div>`;
                })
                .join("")}
            </div>
            <form class="composer" data-comment="${quest.id}">
              <input class="pill" name="text" placeholder="コメントを書く" />
              <button class="pill-btn" type="submit">送る</button>
            </form>`
          : posted
            ? ""
            : ""
      }
    </article>
  `;
}

function bindFeedActions() {
  app.querySelectorAll("[data-guess]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitGuess(form.dataset.guess, new FormData(form).get("guess"));
    });
  });
  app.querySelectorAll("[data-chip]").forEach((btn) => {
    btn.addEventListener("click", () => {
      submitGuess(btn.dataset.chip, btn.dataset.value);
    });
  });
  app.querySelectorAll("[data-comment]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      addComment(form.dataset.comment, new FormData(form).get("text"));
    });
  });
  app.querySelectorAll("[data-reveal]").forEach((btn) => {
    btn.addEventListener("click", () => revealTheme(btn.dataset.reveal));
  });
  app.querySelectorAll("[data-like]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLike(btn.dataset.like));
  });
}

function renderFeed() {
  const user = currentUser();
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  const unlocked = hasPostedToday(user.id, group.id);

  if (!unlocked) {
    app.innerHTML = chrome(
      `
      ${closedBanner(group)}
      ${statusRow(group, user.id)}
      ${
        streakAtRisk(user.id)
          ? `<div class="notice risk-note">🔥 連続記録が今日で途切れそうです<small>写真を送ると、家族のいいね競争にも参加できます。</small></div>`
          : ""
      }
      <div class="lockbox">
         <div class="lockico">🔒</div>
         <h2>家族の写真はまだ鍵</h2>
         <p>自分が今日の一枚を送ると開きます。<br />先に動いた家族のあとについていけます。</p>
         <a class="primary" href="#/today">今日のお題を撮る</a>
       </div>`,
      "feed"
    );
    bindTop();
    return;
  }

  const today = todayKey();
  const quests = questsForGroup(group.id).filter((q) => q.date === today);
  const others = quests.filter((q) => q.userId !== user.id);
  const mine = quests.find((q) => q.userId === user.id);
  const board = todayBoard(group.id);
  const top = board[0];
  const fun = board.flatMap((b) => b.comments.map((c) => ({ ...c, owner: b.user }))).sort((a, b) => b.at - a.at)[0];

  app.innerHTML = chrome(
    `
      ${closedBanner(group)}
      ${statusRow(group, user.id)}
      ${
        top
          ? `<div class="board">
               <p class="kicker">今日のいいね王</p>
               <div class="board-row">${avatarMark(top.user, "md")} <div><b>${escapeHtml(
                 top.user.name
               )}</b><span>❤️ ${top.likes}　💬 ${top.comments.length}</span></div></div>
               ${
                 fun && userById(fun.userId)
                   ? `<p class="fun">今日のひとこと 「${escapeHtml(fun.text)}」 — ${escapeHtml(
                       userById(fun.userId).shortName
                     )}</p>`
                   : ""
               }
             </div>`
          : ""
      }
      ${others.map((q) => postCard(q, user.id)).join("")}
      ${mine ? `<p class="kicker">あなたの今日</p>${postCard(mine, user.id)}` : ""}
    `,
    "feed"
  );

  bindTop();
  bindFeedActions();
}

function renderMe() {
  const user = currentUser();
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  const members = groupMembers(group.id);
  const mineStreak = streakFor(user.id);
  const mineScore = correctCount(user.id);

  app.innerHTML = chrome(
    `
      ${closedBanner(group)}
      <div class="hero-me">
        ${avatarMark(user, "xl")}
        <label class="cam-icon">
          写真でアイコン
          <input type="file" accept="image/*" capture="user" hidden />
        </label>
      </div>
      <div>
        <b>${escapeHtml(user.name)}</b>
        <small class="text">${escapeHtml(roleLine(user))}</small>
      </div>
      <div class="streak pulse">${escapeHtml(streakLabel(mineStreak))}</div>
      ${
        streakAtRisk(user.id)
          ? `<div class="notice risk-note">今日まだ送っていません。連続が途切れます。</div>`
          : ""
      }
      <div class="stats">
        <div class="stat"><span class="text" style="margin:0">連続投稿</span><b>🔥 ${mineStreak}日</b></div>
        <div class="stat"><span class="text" style="margin:0">お題の正解</span><b>${mineScore}回</b></div>
        <div class="stat"><span class="text" style="margin:0">もらったいいね</span><b>❤️ ${likesReceived(
          user.id
        )}</b></div>
      </div>
      <form data-name>
        <p class="kicker">表示名</p>
        <div class="actions">
          <input class="pill" name="name" value="${escapeHtml(user.name)}" maxlength="12" />
          <button class="pill-btn" type="submit">保存</button>
        </div>
      </form>
      <p class="kicker" style="margin-top:18px">アイコン</p>
      <p class="help">カメラで撮るか、絵文字を選んでください。丸く切り抜かれます。</p>
      <div class="icons">
        ${ICONS.map(
          (ic) =>
            `<button type="button" class="${!user.photo && user.icon === ic ? "on" : ""}" data-icon="${ic}">${ic}</button>`
        ).join("")}
      </div>
      <p class="kicker">このグループ</p>
      <div class="invite">
        <b>${escapeHtml(group.name)}</b>
        <span class="text">参加コード</span>
        <div class="code">${escapeHtml(group.code)}</div>
        <button class="pill-btn" type="button" data-copy-code>コードをコピー</button>
        <p class="help">友だちや家族にこのコードを伝えて、ログイン画面の「参加コードで入る」から同じグループに入れます。</p>
      </div>
      <form data-add>
        <p class="kicker">この端末にメンバーを追加</p>
        ${personFields("add")}
        <button class="pill-btn" type="submit">追加する</button>
      </form>
      <p class="kicker">家族から見える記録</p>
      <p class="help">正解数と連続日数は、同じグループのメンバーにも表示されます。</p>
      ${members
        .map((m) => {
          const you = m.id === user.id ? "（あなた）" : "";
          return `<div class="member">
            ${avatarMark(m)}
            <div><b>${escapeHtml(m.name)}${you}</b><small>${escapeHtml(m.role || "家族")}</small></div>
            <div class="nums">🔥 ${streakFor(m.id)}日<br />正解 ${correctCount(m.id)}<br />❤️ ${likesReceived(
              m.id
            )}</div>
          </div>`;
        })
        .join("")}
      <p class="kicker" style="margin-top:18px">わたしのアルバム</p>
      <p class="help">お題と写真の組み合わせが、ここに残ります。</p>
      <div class="album">
        ${
          albumFor(user.id)
            .map(
              (q) => `<div class="cell"><img src="${q.photoDataUrl}" alt="" /><p>${escapeHtml(
                q.categoryEmoji || ""
              )} ${escapeHtml(q.theme)}<br /><span class="text">${formatDateLabel(q.date)}</span></p></div>`
            )
            .join("") || "<p class='text'>まだ写真がありません。</p>"
        }
      </div>
      <button class="ghost" type="button" data-logout>ログアウト</button>
      <a class="ghost yobo-link" href="yobo-app.html">脳トレ・おしゃべりカード</a>
    `,
    "me"
  );
  bindTop();
  app.querySelector("[data-logout]")?.addEventListener("click", () => {
    window.__photoPreview = "";
    logout();
    go("/login");
  });
  app.querySelector("[data-copy-code]")?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(group.code);
      const btn = app.querySelector("[data-copy-code]");
      if (btn) btn.textContent = "コピーしました";
    } catch {
      window.prompt("このコードをコピーしてください", group.code);
    }
  });
  app.querySelector("[data-add]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const result = addMemberToCurrentGroup(readPerson(e.target, "add"));
    if (!result.ok) window.alert(result.error);
  });
  app.querySelector("[data-name]")?.addEventListener("submit", (e) => {
    e.preventDefault();
    updateProfile({ name: new FormData(e.target).get("name") });
  });
  app.querySelectorAll("[data-icon]").forEach((btn) => {
    btn.addEventListener("click", () => updateProfile({ icon: btn.dataset.icon }));
  });
  const file = app.querySelector(".cam-icon input");
  file?.addEventListener("change", () => {
    const f = file.files?.[0];
    if (!f) return;
    cropToSquare(f, (photo) => updateProfile({ photo }));
  });
}

function render() {
  const path = route();
  const user = currentUser();
  if (!user && path !== "login") {
    go("/login");
    return;
  }
  if (user && !currentGroup()) {
    logout();
    go("/login");
    return;
  }
  if (user && path === "login") {
    go("/today");
    return;
  }
  if (path === "login") return renderLogin();
  if (path === "feed") return renderFeed();
  if (path === "me") return renderMe();
  return renderToday();
}

render();
refreshFromCloud().then((changed) => {
  if (changed) render();
});
window.setInterval(() => {
  refreshFromCloud().then((changed) => {
    if (changed) render();
  });
}, 8000);
