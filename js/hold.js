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

/** Block size for mosaic. Larger = harder to see. 0 = clear. */
const HOLD_PIXEL = [22, 12, 6, 0];

function holdForKey(iso) {
  const [y, m, d] = String(iso || "")
    .split("-")
    .map(Number);
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
    if (!url) {
      resolve(null);
      return;
    }
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

function makePixelLayer(photo, width, height, block) {
  const layer = document.createElement("canvas");
  layer.width = width;
  layer.height = height;
  if (!block) return layer;
  const tw = Math.max(1, Math.floor(width / block));
  const th = Math.max(1, Math.floor(height / block));
  const tiny = document.createElement("canvas");
  tiny.width = tw;
  tiny.height = th;
  const tctx = tiny.getContext("2d");
  tctx.imageSmoothingEnabled = true;
  tctx.drawImage(photo, 0, 0, tw, th);
  const lctx = layer.getContext("2d");
  lctx.imageSmoothingEnabled = false;
  lctx.drawImage(tiny, 0, 0, width, height);
  return layer;
}

function composeMosaic(viewCtx, photo, pixelLayer, maskCanvas, width, height) {
  viewCtx.clearRect(0, 0, width, height);
  viewCtx.drawImage(photo, 0, 0, width, height);
  if (!maskCanvas || !pixelLayer) return;
  const cut = document.createElement("canvas");
  cut.width = width;
  cut.height = height;
  const cctx = cut.getContext("2d");
  cctx.drawImage(pixelLayer, 0, 0);
  cctx.globalCompositeOperation = "destination-in";
  cctx.drawImage(maskCanvas, 0, 0, width, height);
  viewCtx.drawImage(cut, 0, 0);
}

async function paintHoldCanvas(canvas, photoUrl, maskUrl, stage) {
  const photo = await loadImage(photoUrl);
  if (!photo || !canvas) return;
  const size = fitSize(photo, 420);
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  const block = HOLD_PIXEL[Math.max(0, Math.min(HOLD_PIXEL.length - 1, stage))] || 0;
  if (!block || !maskUrl) {
    ctx.drawImage(photo, 0, 0, size.width, size.height);
    return;
  }
  const mask = await loadImage(maskUrl);
  if (!mask) {
    ctx.drawImage(photo, 0, 0, size.width, size.height);
    return;
  }
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = size.width;
  maskCanvas.height = size.height;
  maskCanvas.getContext("2d").drawImage(mask, 0, 0, size.width, size.height);
  const pixel = makePixelLayer(photo, size.width, size.height, block);
  composeMosaic(ctx, photo, pixel, maskCanvas, size.width, size.height);
}

function mountMosaicEditor(host, photoUrl) {
  if (!host) return;
  host.innerHTML = '<canvas class="hold-canvas" data-mosaic-view></canvas><p class="help" data-mosaic-tip>白い線をなぞったところがモザイクになります。</p>';
  const view = host.querySelector("[data-mosaic-view]");
  Promise.all([loadImage(photoUrl), window.__mosaicMask ? loadImage(window.__mosaicMask) : null]).then(([photo, saved]) => {
    if (!photo || !view.isConnected) return;
    const size = fitSize(photo, 420);
    view.width = size.width;
    view.height = size.height;
    const vctx = view.getContext("2d");
    const pixel = makePixelLayer(photo, size.width, size.height, HOLD_PIXEL[0]);
    const mask = document.createElement("canvas");
    mask.width = size.width;
    mask.height = size.height;
    const mctx = mask.getContext("2d");
    if (saved) mctx.drawImage(saved, 0, 0, size.width, size.height);
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.strokeStyle = "#ffffff";
    mctx.lineWidth = Math.max(36, Math.round(Math.min(size.width, size.height) / 10));
    let drawing = false;
    let last = null;
    let queued = false;
    const paint = () => {
      queued = false;
      composeMosaic(vctx, photo, pixel, mask, size.width, size.height);
    };
    const schedule = () => {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(paint);
    };
    const point = (event) => {
      const rect = view.getBoundingClientRect();
      const x = event.clientX ?? (event.touches && event.touches[0] && event.touches[0].clientX);
      const y = event.clientY ?? (event.touches && event.touches[0] && event.touches[0].clientY);
      return {
        x: ((x - rect.left) / Math.max(1, rect.width)) * view.width,
        y: ((y - rect.top) / Math.max(1, rect.height)) * view.height,
      };
    };
    const stroke = (event) => {
      const now = point(event);
      if (!Number.isFinite(now.x) || !Number.isFinite(now.y)) return;
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
    const start = (event) => {
      event.preventDefault();
      drawing = true;
      window.__mosaicDrawing = true;
      last = null;
      try {
        view.setPointerCapture(event.pointerId);
      } catch {
        /* ignore */
      }
      stroke(event);
    };
    view.addEventListener("pointerdown", start);
    view.addEventListener("pointermove", (event) => {
      if (drawing) {
        event.preventDefault();
        stroke(event);
      }
    });
    view.addEventListener("pointerup", finish);
    view.addEventListener("pointercancel", finish);
    paint();
    if (saved) {
      window.__mosaicMask = mask.toDataURL("image/png");
    }
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
