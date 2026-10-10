const app = document.getElementById("app");

const ICO = {
  cam: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 8h3l2-3h6l2 3h3v12H4V8z"/><circle cx="12" cy="14" r="3.5"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><circle cx="16.5" cy="16.5" r="3"/></svg>',
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

function escapeHtml(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const VISIBLE_COMMENTS = 5;

function commentsOpen(questId) {
  return Boolean((window.__openComments || {})[questId]);
}

function avatarMark(user, extraClass = "") {
  if (!user) return "";
  const cls = `avatar ${extraClass}`.trim();
  if (user.photo) {
    return `<span class="${cls}"><img src="${user.photo}" alt="" /></span>`;
  }
  return `<span class="${cls}">${user.icon || (user.shortName || user.name).slice(0, 1)}</span>`;
}

function readExifOrientation(buffer) {
  const view = new DataView(buffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xffd8) return 1;
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    const marker = view.getUint16(offset, false);
    offset += 2;
    if (marker === 0xffe1) {
      if (offset + 8 > view.byteLength) return 1;
      const size = view.getUint16(offset, false);
      if (view.getUint32(offset + 2, false) !== 0x45786966) return 1;
      const little = view.getUint16(offset + 8, false) === 0x4949;
      const start = offset + 8;
      if (start + 8 > view.byteLength) return 1;
      const ifd = start + view.getUint32(start + 4, little);
      if (ifd + 2 > view.byteLength) return 1;
      const entries = view.getUint16(ifd, little);
      for (let i = 0; i < entries; i += 1) {
        const entry = ifd + 2 + i * 12;
        if (entry + 12 > view.byteLength) break;
        if (view.getUint16(entry, little) === 0x0112) {
          return view.getUint16(entry + 8, little) || 1;
        }
      }
      return 1;
    }
    if ((marker & 0xff00) !== 0xff00) break;
    if (offset + 2 > view.byteLength) break;
    offset += view.getUint16(offset, false);
  }
  return 1;
}

function orientedSize(w, h, orientation) {
  return orientation >= 5 && orientation <= 8 ? { width: h, height: w } : { width: w, height: h };
}

function drawOrientedImage(ctx, img, dw, dh, orientation) {
  ctx.save();
  switch (orientation) {
    case 2:
      ctx.translate(dw, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, dw, dh);
      break;
    case 3:
      ctx.translate(dw, dh);
      ctx.rotate(Math.PI);
      ctx.drawImage(img, 0, 0, dw, dh);
      break;
    case 4:
      ctx.translate(0, dh);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0, dw, dh);
      break;
    case 5:
      ctx.rotate(0.5 * Math.PI);
      ctx.scale(1, -1);
      ctx.drawImage(img, 0, 0, dh, dw);
      break;
    case 6:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(0, -dw);
      ctx.drawImage(img, 0, 0, dh, dw);
      break;
    case 7:
      ctx.rotate(0.5 * Math.PI);
      ctx.translate(dh, -dw);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, dh, dw);
      break;
    case 8:
      ctx.rotate(-0.5 * Math.PI);
      ctx.translate(-dh, 0);
      ctx.drawImage(img, 0, 0, dh, dw);
      break;
    default:
      ctx.drawImage(img, 0, 0, dw, dh);
      break;
  }
  ctx.restore();
}

function loadImageElement(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("decode"));
    };
    img.src = url;
  });
}

async function decodePhoto(file) {
  if (!file) throw new Error("empty");
  let orientation = 1;
  try {
    const buf = await file.arrayBuffer();
    orientation = readExifOrientation(buf);
  } catch {
    orientation = 1;
  }
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { img: bitmap, orientation: 1, close: () => bitmap.close && bitmap.close() };
    } catch {
      try {
        const bitmap = await createImageBitmap(file);
        return { img: bitmap, orientation, close: () => bitmap.close && bitmap.close() };
      } catch {
        /* fall through */
      }
    }
  }
  const img = await loadImageElement(file);
  return { img, orientation, close: () => {} };
}

function compressPhoto(file, done) {
  const max = 560;
  const quality = 0.72;
  decodePhoto(file)
    .then(({ img, orientation, close }) => {
      const natural = orientedSize(img.width, img.height, orientation);
      let w = natural.width;
      let h = natural.height;
      if (!w || !h) {
        close();
        window.alert("この画像は使えません。別の写真を選んでください。");
        return;
      }
      if (Math.max(w, h) > max) {
        const s = max / Math.max(w, h);
        w = Math.round(w * s);
        h = Math.round(h * s);
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      drawOrientedImage(ctx, img, w, h, orientation);
      close();
      done(canvas.toDataURL("image/jpeg", quality));
    })
    .catch(() => {
      window.alert("写真を読み込めませんでした。フォルダーから選ぶか、もう一度カメラで撮ってください。");
    });
}

function cropToSquare(file, done) {
  decodePhoto(file)
    .then(({ img, orientation, close }) => {
      const natural = orientedSize(img.width, img.height, orientation);
      if (!natural.width || !natural.height) {
        close();
        window.alert("この画像は使えません。別の写真を選んでください。");
        return;
      }
      const size = 280;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const tmp = document.createElement("canvas");
      tmp.width = natural.width;
      tmp.height = natural.height;
      const tctx = tmp.getContext("2d");
      drawOrientedImage(tctx, img, natural.width, natural.height, orientation);
      close();
      const min = Math.min(natural.width, natural.height);
      const sx = (natural.width - min) / 2;
      const sy = (natural.height - min) / 2;
      canvas.getContext("2d").drawImage(tmp, sx, sy, min, min, 0, 0, size, size);
      done(canvas.toDataURL("image/jpeg", 0.82));
    })
    .catch(() => {
      window.alert("写真を読み込めませんでした。フォルダーから選ぶか、もう一度カメラで撮ってください。");
    });
}

function bindFileInputs(root, onFile) {
  root.querySelectorAll('input[type="file"]').forEach((input) => {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      if (!file) return;
      onFile(file);
      window.setTimeout(() => {
        try {
          input.value = "";
        } catch {
          /* ignore */
        }
      }, 0);
    });
  });
}

function photoPickHtml(kind) {
  const cam = kind === "icon" ? "user" : "environment";
  return `
    <div class="photo-picks">
      <label class="pick-photo">
        フォルダーから選ぶ
        <input type="file" accept="image/*" />
      </label>
      <label class="pick-photo alt">
        カメラで撮る
        <input type="file" accept="image/*" capture="${cam}" />
      </label>
    </div>`;
}

function ago(ts) {
  if (!ts) return "まだ";
  const m = Math.max(1, Math.round((Date.now() - ts) / 60000));
  if (m < 60) return `${m}分前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}時間前`;
  return `${Math.round(h / 24)}日前`;
}

function statusRow(group, viewerId) {
  const rows = familyStatus(group.id);
  const othersPosted = rows.filter((r) => r.posted && r.user.id !== viewerId);
  const waiting = rows.filter((r) => !r.posted);
  const notice =
    waiting.some((r) => r.user.id === viewerId) && othersPosted.length
      ? `<div class="notice">${escapeHtml(othersPosted[0].user.name)}さんが先に写真を送りました<small>あなたの番です。</small></div>`
      : othersPosted.length && !waiting.some((r) => r.user.id === viewerId)
        ? `<div class="notice">みんなの写真が届いています<small>見て、おしゃべりしてみましょう。</small></div>`
        : "";

  return `
    ${notice}
    <div class="status">
      ${rows
        .map((r) => {
          const you = r.user.id === viewerId ? "（あなた）" : "";
          return `<div class="st ${r.posted ? "on" : ""}">
            ${avatarMark(r.user, "sm")}
            <b>${escapeHtml(r.user.shortName)}${you}</b>
            <span>${r.posted ? "投稿済み" : "まだ"}</span>
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
  const hideTabs = typeof brainPlaying === "function" && brainPlaying();
  return `
    <div class="phone">
      <header class="top">
        <div class="brand">
          <div class="mascot" aria-hidden="true"></div>
          <div>
            <div class="logo">にこぽけ</div>
            <p class="family-name">${group ? escapeHtml(group.name) : "グループ"} · ${escapeHtml(
              user.shortName
            )}</p>
          </div>
        </div>
        <div class="top-actions">
          <div class="streak-mini ${risk ? "risk" : ""} ${n ? "on" : ""}">🔥 ${n}日</div>
          <a href="#/me" class="avatar-link">${avatarMark(user)}</a>
        </div>
      </header>
      <main class="screen${hideTabs ? " play-fill" : ""}">${
        window.__gateWarn
          ? `<div class="notice">${escapeHtml(window.__gateWarn)}</div>`
          : ""
      }${inner}</main>
      ${
        hideTabs
          ? ""
          : `<nav class="tabbar">
        <a href="#/today" class="${active === "today" ? "active" : ""}">${ICO.cam}<span>今日</span></a>
        <a href="#/feed" class="${active === "feed" ? "active" : ""}">${ICO.grid}<span>家族</span></a>
        <a href="#/brain" class="${active === "brain" ? "active" : ""}">${ICO.play}<span>息抜き</span></a>
        <a href="#/me" class="${active === "me" ? "active" : ""}">${ICO.me}<span>わたし</span></a>
      </nav>`
      }
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
  return `
    <label>名前
      <input class="pill" name="${prefix}-name" maxlength="12" required placeholder="例）はな" value="${escapeHtml(
        defaults.name || ""
      )}" />
    </label>
  `;
}

function privacyListHtml() {
  return `
    <ul class="privacy-list">
      <li>写真・一言コメント・名前・いいね・返事ボタン・お題との関係投票・コメントは、グループの共有サーバーに保存されます。参加コードを知っている人は、これらを見られます。</li>
      <li>脳トレの記録と元気予報の結果は、このスマホの中だけに残ります。家族には送られません。</li>
      <li>写真に自分以外の人が写るときは、送る前にその人に聞いてください。</li>
      <li>送った写真は、日がたってもアルバムに残り、「思い出神経衰弱」のカードとしてグループのみんなに表示されます。</li>
      <li>自分の写真は、いつでも消せます。消すと共有サーバーからも消え、神経衰弱にも出なくなります。</li>
      <li>グループから退出すると、自分の写真はすべて消え、名前は「退出したメンバー」になります。</li>
    </ul>`;
}

function agreeFieldHtml() {
  return `<label class="agree"><input type="checkbox" name="agree" required /> 「保存されるもの」を読んで、同意します</label>`;
}

function readPerson(form, prefix) {
  const data = new FormData(form);
  return {
    name: data.get(`${prefix}-name`),
  };
}

function renderLogin() {
  const users = getState().users.filter((u) => !u.left);
  const err = window.__gateError || "";
  const warn = window.__gateWarn || "";
  window.__gateError = "";
  window.__gateWarn = "";
  app.innerHTML = `
    <div class="gate">
      <div class="badge">にこぽけ</div>
      <h1>今日の一枚を、<br />みんなで。</h1>
      <p>曜日ごとのお題で、いまの生活の一枚を送ります。病院・老人ホーム・認知症予防の教室などで一緒に始めた家族が、写真を見ておしゃべりします。</p>
      ${err ? `<p class="gate-err">${escapeHtml(err)}</p>` : ""}
      ${warn ? `<p class="gate-warn">${escapeHtml(warn)}</p>` : ""}
      ${
        users.length
          ? `<div class="gate-card">
             <p class="kicker">この端末のアカウント</p>
             <div class="people">
               ${users
                 .map(
                   (u) => `
                 <button type="button" data-login="${u.id}">
                   ${avatarMark(u)}
                   <span><b>${escapeHtml(u.name)}</b></span>
                 </button>`
                 )
                 .join("")}
             </div>
           </div>`
          : ""
      }
      <div class="gate-card">
        <p class="kicker">保存されるもの</p>
        ${privacyListHtml()}
      </div>
      <div class="gate-card">
        <p class="kicker">グループをつくる</p>
        <form data-start>
          <label>グループ名
            <input class="pill" name="group" maxlength="20" required placeholder="例）たなか家" />
          </label>
          ${personFields("start")}
          ${agreeFieldHtml()}
          <button class="primary" type="submit">つくる</button>
        </form>
      </div>
      <div class="gate-card">
        <p class="kicker">参加コードで入る</p>
        <form data-join>
          <label>参加コード
            <input class="pill code-in" name="code" maxlength="8" required placeholder="6文字" autocomplete="off" />
          </label>
          ${personFields("join")}
          ${agreeFieldHtml()}
          <button class="ghost" type="submit">参加する</button>
        </form>
      </div>
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
    if (submit) {
      submit.disabled = true;
      submit.textContent = "保存しています…";
    }
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
    if (result.warn) window.__gateWarn = result.warn;
    go("/today");
  });
  app.querySelector("[data-join]")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = e.target.querySelector("[type=submit]");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "探しています…";
    }
    const person = readPerson(e.target, "join");
    const result = await joinWithCode({
      code: String(new FormData(e.target).get("code") || "").trim(),
      ...person,
    });
    if (!result.ok) {
      window.__gateError = result.error;
      renderLogin();
      return;
    }
    if (result.warn) window.__gateWarn = result.warn;
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
  if (!quest) {
    app.innerHTML = chrome(
      `<p class="help">今日のお題を用意できませんでした。一度ログアウトして、入り直してください。</p>`,
      "today"
    );
    bindTop();
    return;
  }
  const posted = isPosted(quest);
  const streak = streakFor(user.id);
  const risk = streakAtRisk(user.id);

  const riskNote = risk
    ? `<div class="notice risk-note">🔥 ${streak}日連続が、今日で途切れそうです<small>いま一枚送ると、記録がつながります。</small></div>`
    : "";

  const editor = `<div class="day-theme">
         <p class="kicker">${quest.bonus ? "もう一枚" : "あなたの今日のお題"}</p>
         <p class="day-theme-text">${escapeHtml(quest.categoryEmoji || "")} ${escapeHtml(quest.theme)}</p>
       </div>`;

  const preview = window.__photoPreview;
  const stage = posted
    ? `<div class="stage">
         <img src="${quest.photoDataUrl}" alt="" />
         <div class="done-chip">送りました</div>
       </div>
       <p class="theme-mine">今日のお題　${escapeHtml(quest.theme)}</p>
       ${quest.caption ? `<p class="caption-line">「${escapeHtml(quest.caption)}」</p>` : ""}
       <a class="primary" href="#/feed">みんなの写真を見る</a>
       <a class="ghost" href="#/brain">脳トレで息抜き</a>`
    : preview
      ? `<div class="hold-editor">
         <div data-mosaic-host></div>
         <p class="help">持っているものの上を、指でなぞって隠します。</p>
         <label class="caption-label">持っているもの
           <input class="pill" data-secret maxlength="20" placeholder="例）ほうじ茶" value="${escapeHtml(window.__secretDraft || "")}" />
         </label>
         <label class="caption-label" data-reading-row ${hasKanji(window.__secretDraft) ? "" : "hidden"}>よみがな（ひらがなで）
           <input class="pill" data-reading maxlength="30" placeholder="例）ほうじちゃ" value="${escapeHtml(window.__readingDraft || "")}" />
         </label>
         <p class="kicker">最初のヒント</p>
         <div class="chips">
           ${HOLD_HINTS.map(
             (hint) =>
               `<button type="button" class="chip ${window.__usageHint === hint ? "on" : ""}" data-usage-hint="${escapeHtml(hint)}">${escapeHtml(hint)}</button>`
           ).join("")}
         </div>
         <div class="preview-actions">
           <button class="primary" type="button" data-confirm>この写真で送る</button>
           <button class="ghost" type="button" data-clear-preview>選びなおす</button>
         </div>
         <p class="help" data-hold-msg></p>
       </div>`
      : `${photoPickHtml("quest")}
         <p class="help">カメラで撮るか、フォルダーから選べます。</p>`;

  const editingPhoto = Boolean(preview) && !posted;
  app.innerHTML = chrome(
    `
      ${editingPhoto ? "" : statusRow(group, user.id)}
      ${editingPhoto ? "" : riskNote}
      ${
        editingPhoto || todayScreen(user.id)
          ? ""
          : `<a class="notice check-cta" href="#/brain/check">今日の脳の元気予報をしませんか<small>診断ではありません。文字や数字を自分で入れる、やさしい6問です。</small></a>`
      }
      ${editingPhoto ? "" : learnCtaHtml()}
      ${editingPhoto ? "" : `<div class="streak ${streak ? "pulse" : ""}">${escapeHtml(streakLabel(streak))}</div>`}
      <p class="kicker">${formatDateLabel(todayKey())}　今日の一枚</p>
      ${
        posted || editingPhoto
          ? ""
          : `<p class="help">${escapeHtml(holdHelp(quest.date))}</p>`
      }
      ${editor}
      ${stage}
      ${
        editingPhoto
          ? ""
          : `<button type="button" class="ghost" data-enable-push>通知を受け取る</button>
      <p class="help">${escapeHtml(window.__pushMsg || "iPhoneは「ホーム画面に追加」すると、アプリを閉じていても写真の通知が届きます。")}</p>`
      }
    `,
    "today"
  );

  bindTop();

  bindFileInputs(app, (file) => {
    compressPhoto(file, (url) => {
      window.__photoPreview = url;
      window.__mosaicMask = "";
      render();
    });
  });
  const host = app.querySelector("[data-mosaic-host]");
  if (host && window.__photoPreview) mountMosaicEditor(host, window.__photoPreview);
  const readingRow = app.querySelector("[data-reading-row]");
  app.querySelector("[data-secret]")?.addEventListener("input", (e) => {
    window.__secretDraft = e.target.value;
    if (readingRow) readingRow.hidden = !hasKanji(e.target.value);
  });
  app.querySelector("[data-reading]")?.addEventListener("input", (e) => {
    window.__readingDraft = e.target.value;
  });
  app.querySelectorAll("[data-usage-hint]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.__usageHint = btn.dataset.usageHint;
      app.querySelectorAll("[data-usage-hint]").forEach((el) => {
        el.classList.toggle("on", el.dataset.usageHint === window.__usageHint);
      });
    });
  });
  const holdMsg = app.querySelector("[data-hold-msg]");
  host?.addEventListener("mosaicchange", () => {
    if (holdMsg) holdMsg.textContent = "";
  });
  app.querySelector("[data-confirm]")?.addEventListener("click", () => {
    const secret = String(window.__secretDraft || "").trim();
    const reading = hasKanji(secret) ? String(window.__readingDraft || "").trim() : "";
    const missing = [];
    if (!window.__mosaicMask) missing.push("写真を指でなぞってモザイクをかける");
    if (!secret) missing.push("持っているものの名前を書く");
    if (hasKanji(secret) && (!reading || hasKanji(reading))) missing.push("よみがなをひらがなで書く");
    if (!window.__usageHint) missing.push("最初のヒントを選ぶ");
    if (!window.__photoPreview || missing.length) {
      if (holdMsg) holdMsg.textContent = `あと少し：${missing.join("、")}`;
      return;
    }
    postPhoto(quest.id, {
      photoDataUrl: window.__photoPreview,
      mosaicMask: window.__mosaicMask,
      secretAnswer: secret,
      secretReading: reading,
      usageHint: window.__usageHint,
      caption: "",
    });
    window.__photoPreview = "";
    window.__secretDraft = "";
    window.__readingDraft = "";
    window.__usageHint = "";
    window.__mosaicMask = "";
    go("/feed");
  });
  app.querySelector("[data-clear-preview]")?.addEventListener("click", () => {
    window.__photoPreview = "";
    window.__mosaicMask = "";
    render();
  });
  app.querySelector("[data-enable-push]")?.addEventListener("click", () => enablePush());
}

function postCard(quest, viewerId) {
  const who = userById(quest.userId);
  const mine = quest.userId === viewerId;
  const posted = isPosted(quest);
  const comments = commentsFor(quest.id)
    .slice()
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  const likes = likeCount(quest.id);
  const liked = hasLiked(quest.id, viewerId);
  const expanded = commentsOpen(quest.id);
  const hidden = expanded ? 0 : Math.max(0, comments.length - VISIBLE_COMMENTS);
  const shown = comments.slice(hidden);

  const hold = quest.secretAnswer ? holdProgress(quest, viewerId) : null;
  const showClear = mine || !quest.secretAnswer || (hold && hold.over);
  const media = posted
    ? showClear
      ? `<img src="${quest.photoDataUrl}" alt="" />
       ${mine || !quest.secretAnswer ? '<div class="tag">お題：' + escapeHtml(quest.theme) + "</div>" : ""}`
      : `<p class="kicker">${escapeHtml(quest.theme)}</p><canvas class="hold-canvas" data-hold-view="${quest.id}" data-hold-stage="${hold.stage}"></canvas>`
    : `<div class="locked"><div><span>🔒</span><em>waiting</em></div></div>`;

  const waitCopy = !posted
    ? `<p class="text">${escapeHtml(who.name)}さんは、まだ今日の一枚を待っています。</p>`
    : "";

  const captionLine =
    posted && quest.caption ? `<p class="caption-line">一言「${escapeHtml(quest.caption)}」</p>` : "";

  const prompt = talkPromptFor(quest);
  const minePick = myTalkReact(quest.id, viewerId);
  const talkLines = latestTalkReacts(quest.id)
    .map((r) => {
      const who = userById(r.userId);
      if (!who) return "";
      const said = talkButtonLabel(prompt, r.choice);
      const replySet = talkReplyFor(r.choice, quest);
      const answered = r.reply ? talkButtonLabel(replySet, r.reply) : "";
      const followSet = talkFollowFor(r.reply);
      const followed = r.follow ? talkButtonLabel(followSet, r.follow) : "";
      const ownerName = escapeHtml(userById(quest.userId)?.shortName || "");
      const back = answered
        ? '<p class="talk-line back"><b>' +
          ownerName +
          "</b>「" +
          escapeHtml(answered) +
          "」" +
          (r.reply === "more" ? "　今日の画面でもう一枚送れます。" : "") +
          "</p>"
        : mine
          ? `<p class="kicker">${escapeHtml(replySet.q)}</p>
             <div class="talk-btns">
               ${replySet.buttons
                 .map(
                   (b) =>
                     `<button type="button" class="talk-btn" data-talk-reply="${quest.id}" data-talk-to="${escapeHtml(
                       r.userId
                     )}" data-talk-reply-choice="${escapeHtml(b.id)}">${escapeHtml(b.label)}</button>`
                 )
                 .join("")}
             </div>`
          : `<p class="help">返事を待っています。</p>`;
      const tail =
        answered && followed
          ? '<p class="talk-line"><b>' + escapeHtml(who.shortName) + "</b>「" + escapeHtml(followed) + "」</p>"
          : answered && viewerId === r.userId
            ? '<p class="kicker">' +
              escapeHtml(followSet.q) +
              '</p><div class="talk-btns">' +
              followSet.buttons
                .map(
                  (b) =>
                    '<button type="button" class="talk-btn" data-talk-follow="' +
                    quest.id +
                    '" data-talk-follow-choice="' +
                    escapeHtml(b.id) +
                    '">' +
                    escapeHtml(b.label) +
                    "</button>"
                )
                .join("") +
              "</div>"
            : "";
      return `<div class="talk-turn"><p class="talk-line"><b>${escapeHtml(who.shortName)}</b>「${escapeHtml(said)}」</p>${back}${tail}</div>`;
    })
    .join("");
  const talkAsk = posted
    ? `<div class="talk-ask">
         <p class="kicker">${escapeHtml(prompt.q)}</p>
         ${
           mine
             ? ""
             : `<div class="talk-btns">
           ${prompt.buttons
             .map(
               (b) =>
                 `<button type="button" class="talk-btn ${
                   minePick && minePick.choice === b.id ? "on" : ""
                 }" data-talk-react="${quest.id}" data-talk-choice="${escapeHtml(b.id)}">${escapeHtml(b.label)}</button>`
             )
             .join("")}
         </div>`
         }
         ${talkLines || `<p class="help">${mine ? "家族がボタンで声をかけると、ここに返事が出ます。" : "大きいボタンを押すと、相手がボタンで返します。"}</p>`}
       </div>`
    : "";

  const talkUi = posted
    ? `<div class="talk">
         <p class="kicker">おしゃべり</p>
         ${
           hidden || (expanded && comments.length > VISIBLE_COMMENTS)
             ? `<button class="thread-toggle" type="button" data-toggle-comments="${quest.id}">
                  ${expanded ? "前のコメントをしまう" : `前のコメントも見る（${hidden}）`}
                </button>`
             : ""
         }
         ${
           shown.length
             ? `<div class="thread open">
                  ${shown
                    .map((c) => {
                      const cu = userById(c.userId);
                      return `<div class="bubble ${c.userId === viewerId ? "me" : ""}">${avatarMark(
                        cu,
                        "tiny"
                      )}<div><b>${escapeHtml(cu?.shortName || "")}</b>${escapeHtml(c.text)}</div></div>`;
                    })
                    .join("")}
                </div>`
             : `<p class="help">写真を見て、ひとこと書いてください。</p>`
         }
         <form class="composer" data-comment="${quest.id}">
           <div class="actions">
             <input class="pill" name="text" placeholder="おしゃべりを書く" />
             <button class="pill-btn" type="submit">送る</button>
           </div>
         </form>
       </div>`
    : "";

  const holdUi =
    quest.secretAnswer && !mine && posted
      ? hold.over
        ? `<div class="choice-box"><p class="guess-note">${hold.solved ? "当たり" : "ゲームオーバー"}</p><p class="fit-answer">答え：${escapeHtml(quest.secretAnswer)}</p></div>`
        : `<div class="choice-box">
            <p class="help">ヒント：${escapeHtml(quest.usageHint || "")}</p>
            ${hold.stage >= 1 ? `<p class="help">名前のヒント：${escapeHtml(quest.nameHint || "")}</p>` : ""}
            <form class="composer" data-hold-guess="${quest.id}">
              <div class="actions">
                <input class="pill" name="guess" maxlength="30" placeholder="なにを持ってる？" />
                <button class="pill-btn" type="submit">答える</button>
              </div>
            </form>
            <button type="button" class="ghost" data-hold-giveup="${quest.id}">モザイクを外す</button>
            <p class="help">いま ${hold.stage + 1} 回目。あと ${3 - hold.wrong} 回。モザイクを外すとゲームオーバーです。</p>
          </div>`
      : "";

  return `
    <article class="post">
      <div class="post-head">
        ${avatarMark(who)}
        <div><b>${escapeHtml(who.name)}</b><small>${posted ? ago(quest.postedAt) : "まだ"}${
          quest.date && quest.date !== todayKey() ? ` · ${formatDateLabel(quest.date)}` : ""
        }</small></div>
      </div>
      <div class="frame">${media}</div>
      ${waitCopy}
      ${captionLine}
      ${mine && quest.secretAnswer ? `<p class="theme-mine">あなたが書いた答え　${escapeHtml(quest.secretAnswer)}</p>` : ""}
      ${holdUi}
      ${talkAsk}
      ${
        posted
          ? `<div class="react">
               <button type="button" class="like-btn ${liked ? "on" : ""}" data-like="${quest.id}" ${
                 mine ? "disabled" : ""
               }>${liked ? "❤️" : "♡"} いいね ${likes}</button>
             </div>
             ${
               mine
                 ? `<div class="owner-actions">
                      <button type="button" class="like-btn danger" data-delete-post="${quest.id}">この写真を消す</button>
                    </div>`
                 : ""
             }`
          : ""
      }
      ${talkUi}
    </article>
  `;
}

function bindDeletePost(root) {
  root.querySelectorAll("[data-delete-post]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const id = btn.getAttribute("data-delete-post");
      const ok = window.confirm(
        "この写真を消しますか？家族のスマホと共有サーバーからも消えます。その日の連続記録も消えます。"
      );
      if (ok) deletePost(id);
    });
  });
}

function bindFeedActions() {
  app.querySelectorAll("[data-comment]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      addComment(form.dataset.comment, new FormData(form).get("text"));
    });
  });
  app.querySelectorAll("[data-like]").forEach((btn) => {
    btn.addEventListener("click", () => toggleLike(btn.dataset.like));
  });
  app.querySelectorAll("[data-talk-react]").forEach((btn) => {
    btn.addEventListener("click", () => setTalkReact(btn.dataset.talkReact, btn.dataset.talkChoice));
  });
  app.querySelectorAll("[data-talk-reply]").forEach((btn) => {
    btn.addEventListener("click", () => setTalkReply(btn.dataset.talkReply, btn.dataset.talkTo, btn.dataset.talkReplyChoice));
  });
  app.querySelectorAll("[data-talk-follow]").forEach((btn) => {
    btn.addEventListener("click", () => setTalkFollow(btn.dataset.talkFollow, btn.dataset.talkFollowChoice));
  });
  app.querySelectorAll("[data-hold-guess]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const guess = submitHoldGuess(form.dataset.holdGuess, new FormData(form).get("guess"));
      if (!guess) return;
      if (guess.correct) playFanfare();
      else playResultTone(false);
    });
  });
  app.querySelectorAll("[data-hold-giveup]").forEach((btn) => {
    btn.addEventListener("click", () => giveUpHold(btn.dataset.holdGiveup));
  });
  paintHoldCards();
  bindDeletePost(app);
  app.querySelectorAll("[data-toggle-comments]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.__openComments = window.__openComments || {};
      const id = btn.dataset.toggleComments;
      window.__openComments[id] = !window.__openComments[id];
      render();
    });
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
      ${statusRow(group, user.id)}
      ${
        streakAtRisk(user.id)
          ? `<div class="notice risk-note">🔥 連続記録が今日で途切れそうです<small>写真を送ると、家族のいいね競争にも参加できます。</small></div>`
          : ""
      }
      <div class="lockbox">
         <div class="lockico">🔒</div>
         <h2>みんなの写真はまだ鍵</h2>
         <p>自分が今日の一枚を送ると開きます。</p>
         <a class="primary" href="#/today">今日のお題へ</a>
       </div>`,
      "feed"
    );
    bindTop();
    return;
  }

  const today = todayKey();
  const all = questsForGroup(group.id);
  const postedDates = [...new Set(all.filter((q) => isPosted(q)).map((q) => q.date))];
  if (!postedDates.includes(today)) postedDates.unshift(today);
  postedDates.sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));
  if (window.__feedDateIndex == null) window.__feedDateIndex = 0;
  window.__feedDateIndex = Math.max(0, Math.min(window.__feedDateIndex, postedDates.length - 1));
  const viewDate = postedDates[window.__feedDateIndex] || today;
  const isLatest = viewDate === postedDates[0];
  const isOldest = window.__feedDateIndex >= postedDates.length - 1;
  const quests = all.filter((q) => q.date === viewDate && (q.date === today || isPosted(q)));
  const ordered = quests
    .filter((q) => q.userId !== user.id || isPosted(q))
    .slice()
    .sort((a, b) => (b.postedAt || 0) - (a.postedAt || 0));
  const board = viewDate === today ? todayBoard(group.id) : [];
  const top = board[0];
  const fun = board.flatMap((b) => b.comments.map((c) => ({ ...c, owner: b.user }))).sort((a, b) => b.at - a.at)[0];

  app.innerHTML = chrome(
    `
      <div class="time-nav">
        <button type="button" class="time-btn" data-feed-older ${isOldest ? "disabled" : ""}>← 過去へ</button>
        <div class="time-now">
          <b>${formatDateLabel(viewDate)}</b>
          <span>${isLatest ? "いちばん新しい日" : `${window.__feedDateIndex + 1} / ${postedDates.length} 日め`}</span>
        </div>
        <button type="button" class="time-btn" data-feed-newer ${isLatest ? "disabled" : ""}>最新へ →</button>
      </div>
      ${viewDate === today ? statusRow(group, user.id) : ""}
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
      ${
        ordered.length
          ? ordered
              .map((q) => `${q.userId === user.id ? `<p class="kicker">あなたの写真</p>` : ""}${postCard(q, user.id)}`)
              .join("")
          : `<p class="help">この日の写真はまだありません。矢印で日付を変えてください。</p>`
      }
    `,
    "feed"
  );

  bindTop();
  app.querySelector("[data-feed-older]")?.addEventListener("click", () => {
    window.__feedDateIndex = Math.min(postedDates.length - 1, window.__feedDateIndex + 1);
    render();
  });
  app.querySelector("[data-feed-newer]")?.addEventListener("click", () => {
    window.__feedDateIndex = Math.max(0, window.__feedDateIndex - 1);
    render();
  });
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

  app.innerHTML = chrome(
    `
      <div class="hero-me">
        ${avatarMark(user, "xl")}
        ${photoPickHtml("icon")}
        <p class="help">保存してある写真からも、カメラからも設定できます。丸く切り抜かれます。</p>
      </div>
      <div class="me-name">
        <b>${escapeHtml(user.name)}</b>
      </div>
      <div class="streak pulse">${escapeHtml(streakLabel(mineStreak))}</div>
      ${
        streakAtRisk(user.id)
          ? `<div class="notice risk-note">今日まだ送っていません。連続が途切れます。</div>`
          : ""
      }
      <div class="stats">
        <div class="stat"><span class="text" style="margin:0">連続投稿</span><b>🔥 ${mineStreak}日</b></div>
        <div class="stat"><span class="text" style="margin:0">もらったいいね</span><b>❤️ ${likesReceived(
          user.id
        )}</b></div>
      </div>
      <a class="primary" href="#/brain">脳トレで息抜き</a>
      ${learnCtaHtml()}
      <form data-name>
        <p class="kicker">表示名</p>
        <div class="actions">
          <input class="pill" name="name" value="${escapeHtml(user.name)}" maxlength="12" />
          <button class="pill-btn" type="submit">保存</button>
        </div>
      </form>
      <p class="kicker" style="margin-top:18px">アイコン</p>
      <p class="help">絵文字を選ぶか、上のボタンで写真を設定してください。</p>
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
        <p class="help">このコードを伝えて、友だちも同じサイト（nicopoke.vercel.app）の「参加コードで入る」から入れてください。</p>
      </div>
      <form data-add>
        <p class="kicker">この端末にメンバーを追加</p>
        ${personFields("add")}
        ${agreeFieldHtml()}
        <button class="pill-btn" type="submit">追加する</button>
      </form>
      <p class="kicker">家族から見える記録</p>
      <p class="help">連続日数といいねは、同じグループのメンバーにも表示されます。</p>
      ${members
        .map((m) => {
          const you = m.id === user.id ? "（あなた）" : "";
          return `<div class="member">
            ${avatarMark(m)}
            <div><b>${escapeHtml(m.name)}${you}</b></div>
            <div class="nums">🔥 ${streakFor(m.id)}日<br />❤️ ${likesReceived(m.id)}</div>
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
              )} ${escapeHtml(q.theme)}<br /><span class="text">${formatDateLabel(q.date)}</span></p>
              <button type="button" class="cell-del" data-delete-post="${q.id}">消す</button></div>`
            )
            .join("") || "<p class='text'>まだ写真がありません。</p>"
        }
      </div>
      <p class="kicker" style="margin-top:18px">保存されるもの</p>
      ${privacyListHtml()}
      <button class="ghost" type="button" data-logout>ログアウト</button>
      <button class="ghost danger" type="button" data-leave>グループから退出する</button>
      <p class="help">退出すると、あなたの写真はすべて消え、この端末からもログインできなくなります。</p>
    `,
    "me"
  );
  bindTop();
  app.querySelector("[data-logout]")?.addEventListener("click", () => {
    window.__photoPreview = "";
    logout();
    go("/login");
  });
  bindDeletePost(app);
  app.querySelector("[data-leave]")?.addEventListener("click", async (e) => {
    const ok = window.confirm(
      "グループから退出しますか？あなたの写真はすべて消え、元に戻せません。"
    );
    if (!ok) return;
    e.target.disabled = true;
    e.target.textContent = "退出しています…";
    const result = await leaveGroup();
    if (!result.ok) {
      window.alert(result.error);
      render();
      return;
    }
    window.__photoPreview = "";
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
  bindFileInputs(app.querySelector(".hero-me") || app, (f) => {
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
  if (user && path !== "brain" && path !== "learn" && !todayScreen(user.id) && !window.__deferBrainCheck) {
    go("/brain/check");
    return;
  }
  if (path === "login") return renderLogin();
  if (path === "feed") return renderFeed();
  if (path === "brain") return renderBrain();
  if (path === "learn") return renderLearn();
  if (path === "me") return renderMe();
  return renderToday();
}

const TUTORIAL_KEY = "nicopoke-tutorial-v1";

function tutorialSeen() {
  try {
    return localStorage.getItem(namespacedKey(TUTORIAL_KEY)) === "1";
  } catch {
    return false;
  }
}

function markTutorialSeen() {
  try {
    localStorage.setItem(namespacedKey(TUTORIAL_KEY), "1");
  } catch {
    /* ignore */
  }
}

function tutorialSlides() {
  return [
    {
      img: "img/learn-aging.png",
      alt: "にこぽけのやさしい脳のイラスト",
      title: "にこぽけへようこそ",
      text: "病院・老人ホーム・認知症予防の教室をきっかけに、家族で写真と脳トレを続けるアプリです。",
    },
    {
      img: "img/brain-intro-memory.png",
      alt: "家族の写真カードのイラスト",
      title: "今日の一枚を送る",
      text: "下の「今日」から、その曜日のお題で写真を送ります。1つだけ近くで撮って、隠したいところをなぞってください。",
    },
    {
      img: "img/brain-intro-order.png",
      alt: "数字タッチで遊んでいるイラスト",
      title: "息抜きの脳トレ",
      text: "「息抜き」には数字タッチやかたち合わせがあります。難易度は簡単・普通・難しいから選べます。",
    },
    {
      img: "img/learn-train.png",
      alt: "脳トレと会話で頭がつながるイラスト",
      title: "読みものもあります",
      text: "認知症の仕組み・予防・前触れを、イラストつきで読めます。準備ができたら「はじめる」を押してください。",
    },
  ];
}

function closeTutorial() {
  markTutorialSeen();
  document.getElementById("tutorial")?.remove();
}

function paintTutorial() {
  if (tutorialSeen()) {
    document.getElementById("tutorial")?.remove();
    return;
  }
  const slides = tutorialSlides();
  if (window.__tutPage == null) window.__tutPage = 0;
  window.__tutPage = Math.max(0, Math.min(slides.length - 1, window.__tutPage));
  const i = window.__tutPage;
  const s = slides[i];
  const last = i === slides.length - 1;
  let root = document.getElementById("tutorial");
  if (!root) {
    root = document.createElement("div");
    root.id = "tutorial";
    root.className = "tut-overlay";
    document.body.appendChild(root);
  }
  root.innerHTML = `
    <div class="tut-card" role="dialog" aria-modal="true" aria-labelledby="tut-title">
      <p class="tut-kicker">つかいかた ${i + 1} / ${slides.length}</p>
      <img class="tut-img" src="${s.img}" alt="${s.alt}" />
      <h2 id="tut-title">${s.title}</h2>
      <p>${s.text}</p>
      <div class="tut-dots">${slides
        .map((_, n) => `<span class="${n === i ? "on" : ""}"></span>`)
        .join("")}</div>
      <div class="tut-actions">
        ${i > 0 ? `<button type="button" class="ghost" data-tut-prev>まえへ</button>` : ""}
        ${
          last
            ? `<button type="button" class="primary" data-tut-start>はじめる</button>`
            : `<button type="button" class="primary" data-tut-next>つぎへ</button>`
        }
      </div>
    </div>
  `;
  root.querySelector("[data-tut-next]")?.addEventListener("click", () => {
    window.__tutPage += 1;
    paintTutorial();
  });
  root.querySelector("[data-tut-prev]")?.addEventListener("click", () => {
    window.__tutPage -= 1;
    paintTutorial();
  });
  root.querySelector("[data-tut-start]")?.addEventListener("click", () => closeTutorial());
}

function boot() {
  render();
  paintTutorial();
}

window.addEventListener("hashchange", () => {
  render();
  paintTutorial();
});
window.addEventListener("hidamari-change", () => {
  if (window.__photoPreview || window.__mosaicDrawing) {
    window.__pendingSyncRender = true;
    return;
  }
  const el = document.activeElement;
  if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) {
    window.__pendingSyncRender = true;
    return;
  }
  render();
  paintTutorial();
});

let tapAudio = null;
function playTap() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!tapAudio) tapAudio = new AC();
    if (tapAudio.state === "suspended") tapAudio.resume();
    const now = tapAudio.currentTime;
    const o = tapAudio.createOscillator();
    const g = tapAudio.createGain();
    o.type = "square";
    o.frequency.setValueAtTime(620, now);
    o.frequency.exponentialRampToValueAtTime(1240, now + 0.045);
    g.gain.setValueAtTime(0.16, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    o.connect(g);
    g.connect(tapAudio.destination);
    o.start(now);
    o.stop(now + 0.1);
  } catch {
    /* ignore */
  }
}

function playResultTone(ok) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!tapAudio) tapAudio = new AC();
    if (tapAudio.state === "suspended") tapAudio.resume();
    const now = tapAudio.currentTime;
    const beep = (freq, t, len) => {
      const o = tapAudio.createOscillator();
      const g = tapAudio.createGain();
      o.type = "square";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.12, now + t);
      g.gain.exponentialRampToValueAtTime(0.001, now + t + len);
      o.connect(g);
      g.connect(tapAudio.destination);
      o.start(now + t);
      o.stop(now + t + len);
    };
    if (ok) {
      beep(880, 0, 0.12);
      beep(1174, 0.14, 0.16);
    } else {
      beep(196, 0, 0.18);
    }
  } catch {
    /* ignore */
  }
}

function playFanfare() {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!tapAudio) tapAudio = new AC();
    if (tapAudio.state === "suspended") tapAudio.resume();
    const now = tapAudio.currentTime;
    [523, 659, 784, 1046].forEach((freq, i) => {
      const o = tapAudio.createOscillator();
      const g = tapAudio.createGain();
      o.type = "square";
      o.frequency.value = freq;
      const t = now + i * 0.12;
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
      o.connect(g);
      g.connect(tapAudio.destination);
      o.start(t);
      o.stop(t + 0.2);
    });
  } catch {
    /* ignore */
  }
}
document.addEventListener(
  "pointerdown",
  (e) => {
    const el = e.target.closest("button, a, [data-key]");
    if (!el || el.matches(":disabled") || el.getAttribute("aria-disabled") === "true") return;
    playTap();
  },
  true
);

function vapidKeyBytes(base64) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

async function enablePush() {
  const group = currentGroup();
  const user = currentUser();
  if (!group || !user) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const standalone =
    window.navigator.standalone || window.matchMedia("(display-mode: standalone)").matches;
  if (ios && !standalone) {
    window.__pushMsg = "iPhoneでは、共有ボタンから「ホーム画面に追加」して、そのアイコンから開いてから通知をオンにしてください。";
    render();
    return;
  }
  if (!window.Notification || !navigator.serviceWorker || !window.PushManager) {
    window.__pushMsg = "この端末では、閉じてからの通知はできません。";
    render();
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") {
    window.__pushMsg = "通知が許可されませんでした。";
    render();
    return;
  }
  try {
    const reg = await navigator.serviceWorker.register("sw.js");
    const origin = cloudOrigin();
    const keyRes = await fetch(`${origin}/api/group?vapid=1`, { cache: "no-store" });
    const keyData = await keyRes.json();
    if (!keyData.publicKey) throw new Error("no key");
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidKeyBytes(keyData.publicKey),
    });
    const code = normalizeCode(group.code);
    await fetch(`${origin}/api/group?code=${encodeURIComponent(code)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Join-Code": code },
      body: JSON.stringify({ action: "subscribe", userId: user.id, subscription: sub.toJSON() }),
    });
    window.__pushMsg = "通知をオンにしました。";
  } catch {
    window.__pushMsg = "通知の設定ができませんでした。通信を確かめて、もう一度押してください。";
  }
  render();
}

function userIsEditing() {
  if (window.__mosaicDrawing || window.__photoPreview) return true;
  const el = document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA");
}

function renderAfterSync(changed) {
  if (changed) window.__pendingSyncRender = true;
  if (!window.__pendingSyncRender || userIsEditing()) return;
  window.__pendingSyncRender = false;
  render();
}

boot();
refreshFromCloud().then((changed) => {
  renderAfterSync(changed);
  paintTutorial();
});
window.setInterval(() => {
  if (route() === "brain" || userIsEditing()) return;
  refreshFromCloud().then(renderAfterSync);
}, 8000);
window.addEventListener("focus", () => {
  refreshFromCloud().then(renderAfterSync);
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  refreshFromCloud().then(renderAfterSync);
});
