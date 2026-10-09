const HOLD_DAYS = [
  {
    theme: "今の季節がわかるものはなーんだ？",
    label: "季節",
    emoji: "🍂",
    help: "みかん、上着、花など、今の季節がわかるものを1つ撮ってください。",
  },
  {
    theme: "手もとに持ってるのはなーんだ？",
    label: "手元",
    emoji: "✋",
    help: "いま手に持っているものを撮ってください。",
  },
  {
    theme: "いま飲んでるのはなーんだ？",
    label: "飲み物",
    emoji: "☕",
    help: "いま飲んでいるものを、コップごと近くで撮ってください。",
  },
  {
    theme: "いまのおやつ・ごはんはなーんだ？",
    label: "ごはん",
    emoji: "🍙",
    help: "いまのおやつやごはんを、1品だけ近くで撮ってください。",
  },
  {
    theme: "テーブルの上から1つ、なーんだ？",
    label: "テーブル",
    emoji: "🪑",
    help: "テーブルや机の上から、1つだけ持ち上げて撮ってください。",
  },
  {
    theme: "今日つかった道具はなーんだ？",
    label: "道具",
    emoji: "🔧",
    help: "リモコン、箸、ペン、はさみなど、今日つかった道具を1つ撮ってください。",
  },
  {
    theme: "棚か引き出しから1つ、なーんだ？",
    label: "棚",
    emoji: "📦",
    help: "棚や引き出しから1つ出して、近くで撮ってください。中を撮らないでください。",
  },
];

const HOLD_THEME = HOLD_DAYS[1].theme;

const HOLD_HINTS = ["家で使う", "外で使う", "勉強で使う", "食べるもの", "飲むもの", "着るもの", "遊ぶもの", "仕事で使う"];

function holdForKey(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  const date = y && m && d ? new Date(y, m - 1, d) : new Date();
  return HOLD_DAYS[date.getDay()] || HOLD_DAYS[1];
}

function holdFields(iso) {
  const hold = holdForKey(iso);
  return {
    theme: hold.theme,
    themeOptions: [hold.theme],
    category: "hold",
    categoryLabel: hold.label,
    categoryEmoji: hold.emoji,
  };
}

function holdHelp(iso) {
  const hold = holdForKey(iso);
  return `1つだけ、近くで撮って、隠したいところをなぞってください。${hold.help}`;
}

const HOLD_BLUR = [28, 14, 4, 0];

function hasKanji(text) {
  return /[\u3400-\u9fff\uf900-\ufaff々〆]/.test(String(text || ""));
}

function nameHintFrom(answer, reading) {
  const text = String(reading || answer || "").trim();
  if (!text) return "";
  if (text.length < 2) return `短い名前で、「${text}」から始まります。`;
  return `「${text.slice(0, 1)}」から始まって、「${text.slice(-1)}」で終わります。`;
}

function holdGuessMatches(guess, answer) {
  const target = foldGuess(answer);
  if (!guess || !target) return false;
  if (guess === target) return true;
  return guess.length >= 2 && (target.includes(guess) || guess.includes(target));
}

function holdGuessOk(text, answer, reading) {
  const guess = foldGuess(text);
  return holdGuessMatches(guess, answer) || holdGuessMatches(guess, reading);
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function fitSize(img, max) {
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  return {
    width: Math.max(1, Math.round(img.width * scale)),
    height: Math.max(1, Math.round(img.height * scale)),
  };
}

async function paintHoldCanvas(canvas, photoUrl, maskUrl, stage) {
  const photo = await loadImage(photoUrl);
  if (!photo || !canvas) return;
  const size = fitSize(photo, 520);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.drawImage(photo, 0, 0, size.width, size.height);
  const blur = HOLD_BLUR[Math.max(0, Math.min(HOLD_BLUR.length - 1, stage))] || 0;
  if (!blur || !maskUrl) return;
  const mask = await loadImage(maskUrl);
  if (!mask) return;
  const layer = document.createElement("canvas");
  layer.width = size.width;
  layer.height = size.height;
  const lctx = layer.getContext("2d");
  lctx.filter = `blur(${blur}px)`;
  lctx.drawImage(photo, 0, 0, size.width, size.height);
  lctx.filter = "none";
  lctx.globalCompositeOperation = "destination-in";
  lctx.drawImage(mask, 0, 0, size.width, size.height);
  ctx.drawImage(layer, 0, 0);
}

function mountMosaicEditor(host, photoUrl) {
  host.innerHTML = '<canvas class="hold-canvas" data-mosaic-view></canvas>';
  const view = host.querySelector("[data-mosaic-view]");
  Promise.all([loadImage(photoUrl), window.__mosaicMask ? loadImage(window.__mosaicMask) : null]).then(([photo, saved]) => {
    if (!photo) return;
    const size = fitSize(photo, 520);
    view.width = size.width;
    view.height = size.height;
    const vctx = view.getContext("2d");
    const blurred = document.createElement("canvas");
    blurred.width = size.width;
    blurred.height = size.height;
    const bctx = blurred.getContext("2d");
    bctx.filter = `blur(${HOLD_BLUR[0]}px)`;
    bctx.drawImage(photo, 0, 0, size.width, size.height);
    bctx.filter = "none";
    const mask = document.createElement("canvas");
    mask.width = size.width;
    mask.height = size.height;
    const mctx = mask.getContext("2d");
    if (saved) mctx.drawImage(saved, 0, 0, size.width, size.height);
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.strokeStyle = "#fff";
    mctx.lineWidth = 46;
    const layer = document.createElement("canvas");
    layer.width = size.width;
    layer.height = size.height;
    const lctx = layer.getContext("2d");
    let drawing = false;
    let last = null;
    let queued = false;
    const paint = () => {
      queued = false;
      lctx.globalCompositeOperation = "source-over";
      lctx.clearRect(0, 0, size.width, size.height);
      lctx.drawImage(blurred, 0, 0);
      lctx.globalCompositeOperation = "destination-in";
      lctx.drawImage(mask, 0, 0);
      vctx.drawImage(photo, 0, 0, size.width, size.height);
      vctx.drawImage(layer, 0, 0);
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    };
    const point = (event) => {
      const rect = view.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * view.width,
        y: ((event.clientY - rect.top) / rect.height) * view.height,
      };
    };
    const stroke = (event) => {
      const now = point(event);
      mctx.beginPath();
      mctx.moveTo((last || now).x, (last || now).y);
      mctx.lineTo(now.x, now.y);
      mctx.stroke();
      last = now;
      schedule();
    };
    const finish = () => {
      if (!drawing) return;
      drawing = false;
      window.__mosaicDrawing = false;
      window.__mosaicMask = mask.toDataURL("image/png");
      host.dispatchEvent(new CustomEvent("mosaicchange"));
    };
    view.addEventListener("pointerdown", (event) => {
      drawing = true;
      window.__mosaicDrawing = true;
      last = null;
      view.setPointerCapture(event.pointerId);
      stroke(event);
    });
    view.addEventListener("pointermove", (event) => {
      if (drawing) stroke(event);
    });
    view.addEventListener("pointerup", finish);
    view.addEventListener("pointercancel", finish);
    paint();
  });
}

function paintHoldCards() {
  document.querySelectorAll("[data-hold-view]").forEach((canvas) => {
    const quest = getQuest(canvas.getAttribute("data-hold-view"));
    if (!quest) return;
    const stage = Number(canvas.getAttribute("data-hold-stage") || 0);
    paintHoldCanvas(canvas, quest.photoDataUrl, quest.mosaicMask, stage);
  });
}
