const HOLD_THEME = "手もとに持ってるのはなーんだ？";

const HOLD_HINTS = ["家で使う", "外で使う", "勉強で使う", "食べるもの", "飲むもの", "着るもの", "遊ぶもの", "仕事で使う"];

const HOLD_BLUR = [28, 14, 4, 0];

function nameHintFrom(answer) {
  const text = String(answer || "").trim();
  if (!text) return "";
  if (text.length < 2) return `短い名前で、「${text}」から始まります。`;
  return `「${text.slice(0, 1)}」から始まって、「${text.slice(-1)}」で終わります。`;
}

function holdGuessOk(text, answer) {
  const guess = foldGuess(text);
  const target = foldGuess(answer);
  if (!guess || !target) return false;
  if (guess === target) return true;
  return guess.length >= 2 && (target.includes(guess) || guess.includes(target));
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
  loadImage(photoUrl).then((photo) => {
    if (!photo) return;
    const size = fitSize(photo, 520);
    view.width = size.width;
    view.height = size.height;
    const mask = document.createElement("canvas");
    mask.width = size.width;
    mask.height = size.height;
    const mctx = mask.getContext("2d");
    mctx.lineCap = "round";
    mctx.lineJoin = "round";
    mctx.strokeStyle = "#fff";
    mctx.lineWidth = 46;
    let drawing = false;
    let last = null;
    const refresh = () => {
      paintHoldCanvas(view, photoUrl, mask.toDataURL("image/png"), 0);
      window.__mosaicMask = mask.toDataURL("image/png");
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
      if (last) mctx.moveTo(last.x, last.y);
      else mctx.moveTo(now.x, now.y);
      mctx.lineTo(now.x, now.y);
      mctx.stroke();
      last = now;
      refresh();
    };
    view.addEventListener("pointerdown", (event) => {
      drawing = true;
      last = null;
      view.setPointerCapture(event.pointerId);
      stroke(event);
    });
    view.addEventListener("pointermove", (event) => {
      if (drawing) stroke(event);
    });
    view.addEventListener("pointerup", () => {
      drawing = false;
    });
    refresh();
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
