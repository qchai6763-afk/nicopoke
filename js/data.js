const SLOT_CATS = [
  {
    id: "face",
    label: "顔",
    emoji: "😊",
    items: [
      "下からの顔",
      "上からの顔",
      "すっぱいものを食べた時の顔",
      "まずいのを食べた時の顔",
      "真剣な顔",
    ],
  },
  {
    id: "food",
    label: "食べもの",
    emoji: "🍪",
    items: ["今日のおやつ・ごはん", "今一番食べたいもの"],
  },
  {
    id: "today",
    label: "きょう",
    emoji: "📷",
    items: ["今日の服装", "今はまってるもの", "昔の写真"],
  },
];

const THEMES = SLOT_CATS.flatMap((c) => c.items);

const ICONS = ["🌸", "🌞", "🍀", "☕", "📷", "🌙", "🐶", "🐱", "🍙", "🏠", "🌻", "📚", "🎹", "🚲", "🌊"];

const USER_COLORS = ["#ff8a7a", "#7ec8a3", "#ffb347", "#8ecae6", "#c9a0dc", "#ff8fab"];

const MAX_REROLLS = 3;
