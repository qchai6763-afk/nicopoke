function learnCtaHtml() {
  return `<a class="learn-cta" href="#/learn">
      <img src="img/learn-aging.png" alt="" />
      <span><b>脳の仕組みと認知症のメカニズム</b>イラストで、やさしく読めます</span>
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
      <h1 class="theme">脳の仕組みと<br />認知症のメカニズム</h1>
      <p class="help">病院の診断ではありません。今日の脳トレが、なぜ心強い味方になるのかを、絵でながめるページです。</p>

      <article class="learn-block">
        <p class="learn-num">1</p>
        <h2>脳がくたびれると、なにが起こる？</h2>
        <img class="learn-art" src="img/learn-aging.png" alt="やさしい脳のイラスト。綿のようなやわらかい粒が、脳のすみにたまっている様子" />
        <p>私たちの頭の中には、たくさんの神経細胞がいて、おしゃべりするように信号をやりとりしています。</p>
        <p>年を重ねると、その細胞が少しずつ疲れたり、アミロイドβというたんぱく質が綿あめのようにたまりやすくなったりします。道が混んでくると、伝言が届きにくくなるイメージです。</p>
        <p>全部がいっぺんに止まるわけではありません。だからこそ、毎日の小さな刺激が大切です。</p>
      </article>

      <article class="learn-block">
        <p class="learn-num">2</p>
        <h2>時間や場所が、ぼやける理由</h2>
        <img class="learn-art" src="img/learn-gps.png" alt="脳のGPSと、思い出の引き出しのイラスト。カレンダーを見る家族" />
        <p>「いま何時？」「ここはどこ？」を覚える働きは、脳のGPSのようなものです。地図アプリが電波の悪い場所で迷うのと似ています。</p>
        <p>思い出は、引き出しにしまってある写真です。引き出しの取っ手がさびつくと、取り出すのに時間がかかります。忘れっぽさは、引き出しが空っぽ、というより「開けにくい」ことが多いのです。</p>
        <p>にこぽけの日付チェックや家族の写真合わせは、このGPSと引き出しを、やさしく動かす練習です。</p>
      </article>

      <article class="learn-block">
        <p class="learn-num">3</p>
        <h2>なぜ脳トレが、予防の味方になるの？</h2>
        <img class="learn-art" src="img/learn-train.png" alt="数字タッチやクイズで、脳がぽかぽかとつながっていくイラスト" />
        <p>クイズや数字の順押しは、おでこの奥の前頭前野を刺激します。考える・切り替える・順番を守る、という働きです。</p>
        <p>頭を使うと、脳の血流がぽかぽかとよくなり、神経どうしのネットワークが「まだつながっているよ」と維持されやすくなります。筋トレの、頭バージョンです。</p>
        <p>勝ち負けやタイムより、「なるほど！」の気持ちよさのほうが、続けやすさにつながります。にこぽけは、その気持ちよさを大切にしています。</p>
      </article>

      <p class="learn-note">これは一般的な説明です。体調が気になるときは、かかりつけ医に相談してください。</p>
      <a class="primary" href="#/brain">脳トレをやってみる</a>
      <a class="ghost" href="#/today">今日の写真にもどる</a>
    `,
    "me"
  );
  bindTop();
}
