function learnCtaHtml() {
  return `<a class="learn-cta" href="#/learn">
      <img src="img/learn-aging.png" alt="" />
      <span><b>認知症について知る</b>仕組み・予防・前触れを、カードで読めます</span>
    </a>`;
}

function renderLearn() {
  const group = currentGroup();
  if (!group) {
    go("/login");
    return;
  }
  app.innerHTML = chrome(
    `
      <a class="back-link" href="#/brain">← 脳トレ一覧</a>
      <p class="kicker">やさしい読みもの</p>
      <h1 class="theme">認知症について知る</h1>
      <p class="help">病院の診断ではありません。知っておくと、毎日のくらしのヒントになります。</p>

      <article class="learn-card">
        <div class="learn-ico" aria-hidden="true">🧠</div>
        <h2>認知症のメカニズム</h2>
        <img class="learn-art" src="img/learn-aging.png" alt="脳の神経が信号をやりとりしているイラスト" />
        <p>脳の神経細胞が、何らかの原因でダメージを受けることがあります。たとえばアミロイドβというたんぱく質がたまることや、脳の血管の障害です。</p>
        <p>ダメージを受けると、細胞どうしの情報のやりとりがスムーズにいかなくなります。</p>
        <p>その結果、記憶や判断力を司る働きが、徐々に低下していくことがあります。これが認知症の仕組みのひとつです。</p>
      </article>

      <article class="learn-card">
        <div class="learn-ico" aria-hidden="true">🌱</div>
        <h2>予防につながるといわれる習慣</h2>
        <img class="learn-art" src="img/learn-train.png" alt="散歩や会話、脳トレで頭と体を動かしているイラスト" />
        <ul class="learn-list">
          <li><b>知的活動</b>音読、計算、脳トレゲームなどで、脳を刺激します。</li>
          <li><b>運動習慣</b>ウォーキングなどの適度な有酸素運動で、脳の血流をよくします。</li>
          <li><b>コミュニケーション</b>家族や友人と会話したり、笑い合ったりして、社会的な刺激を受けます。</li>
          <li><b>食生活・睡眠</b>栄養バランスのよい食事と、質の高い睡眠で、脳の疲れを回復させます。</li>
        </ul>
      </article>

      <article class="learn-card">
        <div class="learn-ico" aria-hidden="true">🔔</div>
        <h2>認知症の前触れ（初期症状）</h2>
        <img class="learn-art" src="img/learn-gps.png" alt="約束や家事でつまずきやすい日常のイラスト" />
        <ul class="learn-list">
          <li><b>物忘れの増加</b>さっき聞いたことや、約束を忘れてしまう。</li>
          <li><b>意欲・関心の低下</b>趣味やテレビ、外出への興味が薄れる。</li>
          <li><b>段取りや計算のミス</b>料理の味付けが変わったり、家事や作業に時間がかかる。</li>
          <li><b>同じ話を繰り返す</b>短い時間のあいだに、同じ質問や話を何度もしてしまう。</li>
        </ul>
      </article>

      <p class="learn-note">これは一般的な説明です。体調が気になるときは、かかりつけ医に相談してください。</p>
      <a class="primary" href="#/brain">脳トレをやってみる</a>
      <a class="ghost" href="#/today">今日の写真にもどる</a>
    `,
    "me"
  );
  bindTop();
}
