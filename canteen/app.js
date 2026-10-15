/* 奶娃打饭记 · 逻辑
   无框架、无依赖、零外部请求。文案、菜品与数值全在 data/script.js。 */

(() => {
  'use strict';

  const D = window.CANTEEN_DATA;
  if (!D) return;

  const R0 = D.rules;
  const KEY = 'canteen:v1';
  const ENROLL_KEY = 'enroll:v1';        // 入学记那边的存档，只为借一个名字
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ DOM */

  const backBtn    = document.getElementById('back');
  const whereEl    = document.getElementById('where');
  const timebarEl  = document.getElementById('timebar');
  const progressEl = document.getElementById('progress');
  const heartsEl   = document.getElementById('hearts');
  const pauseBtn   = document.getElementById('pause');
  const hudEl      = document.getElementById('hud');
  const scoreEl    = document.getElementById('score');
  const comboEl    = document.getElementById('combo');
  const sayEl      = document.getElementById('say');
  const stageEl    = document.getElementById('stage');
  const fieldEl    = document.getElementById('field');
  const dropsEl    = document.getElementById('drops');
  const trayEl     = document.getElementById('tray');
  const naiwaEl    = document.getElementById('naiwa');
  const pauseBox   = document.getElementById('pausebox');
  const pauseText  = document.getElementById('pausetext');
  const resumeBtn  = document.getElementById('resume');
  const panel      = document.getElementById('panel');
  const kickerEl   = document.getElementById('kicker');
  const titleEl    = document.getElementById('title');
  const linesEl    = document.getElementById('lines');
  const promptEl   = document.getElementById('prompt');
  const controlsEl = document.getElementById('controls');
  const toastEl    = document.getElementById('toast');
  const disclaimerEl = document.getElementById('disclaimer');

  disclaimerEl.textContent = D.meta.disclaimer;
  whereEl.textContent = D.meta.base;

  /* ------------------------------------------------------------ 小工具 */

  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function button(cls, label, onClick) {
    const b = el('button', cls, label);
    b.type = 'button';
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function actions(...nodes) {
    const row = el('div', 'actions');
    nodes.filter(Boolean).forEach(n => row.appendChild(n));
    return row;
  }

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ------------------------------------------------------------ 存档 */

  function blank() {
    return { act: 'start', name: '', best: 0, plays: 0, last: null };
  }

  let state = blank();
  let storeOK = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data && typeof data === 'object' ? Object.assign(blank(), data) : null;
    } catch (err) {
      storeOK = false;                    // 无痕模式 / 禁用存储：降级为「本次有效」
      return null;
    }
  }

  function save() {
    if (!storeOK) return;
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (err) { storeOK = false; }
  }

  state = load() || blank();

  /* 入学记里留过名字的话，直接借过来用 */
  function nameFromEnroll() {
    try {
      const raw = localStorage.getItem(ENROLL_KEY);
      if (!raw) return '';
      const data = JSON.parse(raw);
      return data && typeof data.name === 'string' ? data.name.slice(0, 12) : '';
    } catch (err) { return ''; }
  }

  /* ------------------------------------------------------------ 画面 */

  function head(act) {
    kickerEl.textContent = act.kicker || '';
    titleEl.textContent = act.title || '';
  }

  function renderLines(list) {
    linesEl.textContent = '';
    (list || []).forEach(t => linesEl.appendChild(el('p', null, t)));
  }

  let toastTimer = 0;
  function toast(text, warn) {
    clearTimeout(toastTimer);
    toastEl.textContent = text || '';
    toastEl.classList.toggle('on', !!text);
    toastEl.style.color = warn ? 'var(--bad)' : '';
    if (text) toastTimer = setTimeout(() => toastEl.classList.remove('on'), 4200);
  }

  let sayTimer = 0;
  function say(text) {
    clearTimeout(sayTimer);
    sayEl.textContent = text || '';
    sayEl.classList.toggle('on', !!text);
    if (text) sayTimer = setTimeout(() => sayEl.classList.remove('on'), 2400);
  }

  function setMood(mood) {
    naiwaEl.dataset.mood = mood;
    if (mood === 'happy' || mood === 'worried') {
      clearTimeout(setMood.timer);
      setMood.timer = setTimeout(() => { naiwaEl.dataset.mood = 'idle'; }, mood === 'happy' ? 700 : 900);
    }
  }

  function bump() {
    if (reduce) return;
    trayEl.classList.remove('hurt');
    void trayEl.offsetWidth;
    trayEl.classList.add('hurt');
  }

  function pop(x, y, text, bad) {
    const n = el('span', 'pop' + (bad ? ' bad' : ''), text);
    n.style.left = (x * 100) + '%';
    n.style.top = (y * 100) + '%';
    dropsEl.appendChild(n);
    setTimeout(() => n.remove(), 800);
  }

  /* ------------------------------------------------------------ 一局 */

  let G = null;

  function measure() {
    G.fw = fieldEl.clientWidth || 1;
    G.fh = fieldEl.clientHeight || 1;
    G.halfW = (R0.catchWidth / 2) / G.fw;
  }

  function buildHearts() {
    heartsEl.textContent = '';
    for (let i = 0; i < R0.lives; i++) {
      const i2 = el('i', null, '❤');
      i2.setAttribute('aria-hidden', 'true');
      heartsEl.appendChild(i2);
    }
    paintHearts();
  }

  function paintHearts() {
    if (!G) return;
    [...heartsEl.children].forEach((n, i) => n.classList.toggle('gone', i >= G.lives));
    heartsEl.setAttribute('aria-label', D.play.lives(Math.max(0, G.lives)));
  }

  function multiplier() {
    if (!G) return 1;
    return G.combo >= R0.combo3 ? 3 : G.combo >= R0.combo2 ? 2 : 1;
  }

  function paintHud() {
    if (!G) return;
    scoreEl.textContent = String(G.score);
    const m = multiplier();
    if (G.combo >= 2) {
      comboEl.textContent = D.play.combo(G.combo) + (m > 1 ? ' · ×' + m : '');
      comboEl.classList.add('on');
      comboEl.classList.toggle('hot', m > 1);
    } else {
      comboEl.textContent = '';
      comboEl.classList.remove('on', 'hot');
    }
  }

  function startRound() {
    G = {
      on: true, paused: false,
      t: 0, score: 0, lives: R0.lives, caught: 0, combo: 0, bestCombo: 0,
      x: 0.5, target: 0.5, dragging: false,
      items: [], spawnIn: 1, missAt: -99,
      last: performance.now(), raf: 0, second: -1
    };
    dropsEl.textContent = '';
    trayEl.style.left = '50%';
    pauseBox.hidden = true;
    pauseBtn.textContent = D.play.pause;
    timebarEl.classList.remove('low', 'crit');
    progressEl.style.width = '100%';
    timebarEl.setAttribute('aria-valuenow', String(R0.time));
    measure();
    buildHearts();
    paintHud();
    setMood('idle');
    say(D.play.start);
    G.raf = requestAnimationFrame(tick);
  }

  function stopGame() {
    if (!G) return;
    G.on = false;
    cancelAnimationFrame(G.raf);
    G.items = [];
    dropsEl.textContent = '';           // 掉落物和浮字一起清掉，奶娃在另一层不受影响
    trayEl.style.left = '';
    G = null;
    pauseBox.hidden = true;
  }

  function spawn(goodRate, speed) {
    const wantGood = Math.random() < goodRate;
    const pool = D.items.filter(it => !!it.good === wantGood);
    const def = pool[Math.floor(Math.random() * pool.length)];
    const x = R0.spawnX[0] + Math.random() * (R0.spawnX[1] - R0.spawnX[0]);
    const y = -0.07;
    const node = el('span', 'drop' + (def.good ? '' : ' bad'), def.icon);
    node.style.left = (x * 100) + '%';
    node.style.top = (y * 100) + '%';
    dropsEl.appendChild(node);
    G.items.push({
      def, x, y, node, judged: false,
      vy: speed * (0.86 + Math.random() * 0.28)
    });
  }

  function drop(i) {
    G.items[i].node.remove();
    G.items.splice(i, 1);
  }

  function collect(it) {
    const def = it.def;
    if (def.good) {
      G.combo++;
      if (G.combo > G.bestCombo) G.bestCombo = G.combo;
      const gain = def.score * multiplier();
      G.score += gain;
      G.caught++;
      pop(it.x, it.y, '+' + gain, false);
      setMood('happy');
      if (def.heal) {
        if (G.lives < R0.lives) { G.lives += def.heal; paintHearts(); say(def.say + '（' + D.play.lives(G.lives) + '）'); }
        else say(D.play.healFull);
      } else {
        say(def.say);
      }
    } else {
      G.combo = 0;
      if (def.hurt) {
        G.lives -= def.hurt;
        paintHearts();
        setMood('worried');
        bump();
      }
      if (def.score) G.score = Math.max(0, G.score + def.score);
      pop(it.x, it.y, def.score ? String(def.score) : '✕', true);
      say(def.say);
    }
    paintHud();
  }

  function step(dt) {
    G.t += dt;
    const p = clamp(G.t / R0.time, 0, 1);

    /* 键盘推目标点，指针则直接写目标点 */
    const dir = (keys.has('r') ? 1 : 0) - (keys.has('l') ? 1 : 0);
    if (dir) G.target = clamp(G.target + dir * dt * 1.75, 0.05, 0.95);
    G.x += (G.target - G.x) * Math.min(1, dt * 16);

    /* 越到后面出得越快、落得越快，坏东西也越多 */
    G.spawnIn -= dt;
    if (G.spawnIn <= 0 && G.items.length < R0.maxAlive) {
      G.spawnIn = lerp(R0.spawnFrom, R0.spawnTo, p);
      spawn(lerp(R0.goodFrom, R0.goodTo, p), lerp(R0.speedFrom, R0.speedTo, p));
    }

    for (let i = G.items.length - 1; i >= 0; i--) {
      const it = G.items[i];
      it.y += it.vy * dt;

      if (!it.judged && it.y >= R0.catchY) {
        it.judged = true;
        if (Math.abs(it.x - G.x) <= G.halfW) { collect(it); drop(i); continue; }
        /* 没接住只是没得分，不罚连击；给个淡淡的提示就够 */
        if (it.def.good && G.t - G.missAt > 0.5) { G.missAt = G.t; pop(it.x, R0.catchY, D.play.miss, true); }
      }
      if (it.y > 1.14) drop(i);
    }

    if (G.lives <= 0) { finish('lifeOut'); return; }
    if (G.t >= R0.time) { finish('timeUp'); }
  }

  function paint() {
    trayEl.style.left = (G.x * 100) + '%';
    for (let i = 0; i < G.items.length; i++) {
      G.items[i].node.style.top = (G.items[i].y * 100) + '%';
    }
    const left = Math.max(0, R0.time - G.t);
    progressEl.style.width = (left / R0.time * 100) + '%';
    const sec = Math.ceil(left);
    if (sec !== G.second) {
      G.second = sec;
      timebarEl.setAttribute('aria-valuenow', String(sec));
    }
    timebarEl.classList.toggle('low', left <= 20);
    timebarEl.classList.toggle('crit', left <= 10);
  }

  function tick(now) {
    if (!G || !G.on) return;
    G.raf = requestAnimationFrame(tick);
    const dt = Math.min(0.05, Math.max(0, (now - G.last) / 1000));  // 切标签页回来别一次跳一大截
    G.last = now;
    if (G.paused) return;
    step(dt);
    if (G && G.on) paint();
  }

  function togglePause(force) {
    if (!G || !G.on) return;
    const want = typeof force === 'boolean' ? force : !G.paused;
    if (want === G.paused) return;
    G.paused = want;
    G.dragging = false;
    G.last = performance.now();
    pauseBtn.textContent = G.paused ? D.play.resume : D.play.pause;
    pauseText.textContent = D.play.paused;
    pauseBox.hidden = !G.paused;
    if (!G.paused) resumeBtn.focus();
  }

  function rankOf(score) {
    return D.ranks.find(r => score >= r.min) || D.ranks[D.ranks.length - 1];
  }

  function finish(reason) {
    if (!G || !G.on) return;
    const result = {
      reason,
      score: G.score,
      caught: G.caught,
      bestCombo: G.bestCombo,
      lives: Math.max(0, G.lives),
      seconds: Math.round(Math.min(G.t, R0.time))
    };
    stopGame();
    say('');
    if (result.score > (state.best || 0)) { state.best = result.score; result.newBest = true; }
    state.plays = (state.plays || 0) + 1;
    state.last = result;
    go('over', { replace: true });
  }

  /* ------------------------------------------------------------ 输入 */

  const keys = new Set();

  function fieldX(e) {
    const r = fieldEl.getBoundingClientRect();
    return clamp((e.clientX - r.left) / Math.max(1, r.width), 0.05, 0.95);
  }

  stageEl.addEventListener('pointerdown', e => {
    if (!G || !G.on || G.paused) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    G.dragging = true;
    G.target = fieldX(e);
    if (stageEl.setPointerCapture) { try { stageEl.setPointerCapture(e.pointerId); } catch (err) { /* 忽略 */ } }
  });

  stageEl.addEventListener('pointermove', e => {
    if (!G || !G.on || G.paused || !G.dragging) return;
    G.target = fieldX(e);
  });

  ['pointerup', 'pointercancel'].forEach(t =>
    addEventListener(t, () => { if (G) G.dragging = false; }));

  addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (G && G.on) { e.preventDefault(); history.back(); }
      return;
    }
    if (!G || !G.on) return;
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') { keys.add('l'); e.preventDefault(); }
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') { keys.add('r'); e.preventDefault(); }
    else if (k === ' ' || k === 'p' || k === 'P') { e.preventDefault(); togglePause(); }
  });

  addEventListener('keyup', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') keys.delete('l');
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') keys.delete('r');
  });

  addEventListener('blur', () => keys.clear());

  /* 切到别的标签页就自动暂停，回来自己点继续 */
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) togglePause(true);
  });

  addEventListener('resize', () => { if (G && G.on) measure(); });

  pauseBtn.addEventListener('click', () => togglePause());
  resumeBtn.addEventListener('click', () => togglePause(false));
  backBtn.addEventListener('click', () => history.back());

  /* ------------------------------------------------------------ 路由 */

  function render(id) {
    const act = D[id] || D.start;
    document.body.dataset.act = id;
    stopGame();                          // 任何一次换幕都先把上一局停干净

    const playing = id === 'play';
    backBtn.hidden = !playing;
    whereEl.hidden = playing;
    timebarEl.hidden = !playing;
    heartsEl.hidden = !playing;
    pauseBtn.hidden = !playing;
    hudEl.hidden = !playing;
    panel.hidden = playing;

    controlsEl.textContent = '';
    promptEl.textContent = '';
    linesEl.textContent = '';
    toast('');
    say('');
    setMood('idle');
    panel.scrollTop = 0;
    (R[id] || R.start)(act);
  }

  function go(id, opts) {
    opts = opts || {};
    if (!D.order.includes(id)) id = 'start';
    state.act = id;
    if (opts.save !== false) save();
    if (opts.replace) history.replaceState({ act: id }, '', '#/' + id);
    else history.pushState({ act: id }, '', '#/' + id);
    render(id);
  }

  addEventListener('popstate', e => {
    const id = (e.state && e.state.act) || 'start';
    state.act = D.order.includes(id) ? id : 'start';
    save();
    render(state.act);
  });

  /* ------------------------------------------------------------ 各幕 */

  const R = {};

  /* 开场 */
  R.start = act => {
    head(act);
    renderLines(act.lines);
    promptEl.textContent = act.prompt;

    const ul = el('ul', 'rules');
    act.rulesText(R0).forEach(t => ul.appendChild(el('li', null, t)));
    controlsEl.appendChild(ul);
    controlsEl.appendChild(el('p', 'hintline', act.controls));

    const borrowed = nameFromEnroll();
    const input = el('input');
    input.type = 'text';
    input.maxLength = 12;
    input.placeholder = '奶娃';
    input.value = state.name || borrowed;
    input.setAttribute('aria-label', '名字');
    input.autocomplete = 'off';

    const field = el('div', 'field');
    field.append(input, button('primary', act.go, submit));
    controlsEl.appendChild(el('p', 'counter', act.name));
    controlsEl.appendChild(field);
    controlsEl.appendChild(el('p', 'hintline', !state.name && borrowed ? act.fromEnroll : act.nameHint));
    controlsEl.appendChild(el('p', 'counter', state.best ? act.best(state.best) : act.noBest));

    function submit() {
      state.name = (input.value || '').trim().slice(0, 12) || '奶娃';
      go('play');
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  };

  /* 打饭 */
  R.play = () => { startRound(); };

  /* 结算 */
  R.over = act => {
    head(act);
    const last = state.last;
    if (!last) {
      renderLines([act.empty]);
      controlsEl.appendChild(actions(button('primary', D.start.go, () => go('play'))));
      return;
    }

    const ending = act.endings[last.reason] || act.endings.timeUp;
    const rank = rankOf(last.score);
    renderLines([ending.line]);
    promptEl.textContent = act.prompt;

    const stats = el('div', 'stats');
    [[last.score, '分'], [last.caught, '份'], [last.bestCombo, '连击']].forEach(pair => {
      const s = el('span');
      s.appendChild(el('b', null, String(pair[0])));
      s.appendChild(document.createTextNode(pair[1]));
      stats.appendChild(s);
    });
    controlsEl.appendChild(stats);
    controlsEl.appendChild(el('p', 'counter', '段位：' + rank.name + '——' + rank.note));

    const canvas = drawCard(act.card, state.name || '奶娃', last, rank, ending);
    const wrap = el('div', 'grade-wrap');
    const img = el('img');
    img.alt = '奶娃干饭成绩单';
    img.src = canvas.toDataURL('image/png');
    wrap.appendChild(img);
    wrap.appendChild(actions(
      button('primary', act.save, () => download(canvas)),
      button('ghost', act.again, () => go('play')),
      button('ghost', act.back, () => go('start', { replace: true })),
      (() => {
        const a = el('a', 'ghost', D.meta.homeName);
        a.href = D.meta.home;
        return a;
      })()
    ));
    wrap.appendChild(el('p', 'hintline', act.hint));
    controlsEl.appendChild(wrap);

    const best = state.best || 0;
    controlsEl.appendChild(el('p', 'counter', act.best(best) + (last.newBest ? ' ' + act.newBest : '')));
    setMood(last.reason === 'timeUp' ? 'happy' : 'sad');
  };

  /* ------------------------------------------------------------ 成绩单 */

  const CFONT = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';

  function drawCard(card, name, last, rank, ending) {
    const W = 900, H = 560;
    const c = el('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');

    /* 底色 */
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#fff8f5');
    grad.addColorStop(1, '#ffeef4');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    /* 右上角三拱门水印，和主站、入学记是同一套 */
    g.save();
    g.globalAlpha = .16;
    g.strokeStyle = '#f6b3c6';
    g.lineWidth = 13;
    g.lineCap = 'round';
    [W - 200, W - 120, W - 40].forEach(x => {
      g.beginPath();
      g.moveTo(x, H - 24);
      g.lineTo(x, H - 132);
      g.quadraticCurveTo(x + 40, H - 196, x + 80, H - 132);
      g.lineTo(x + 80, H - 24);
      g.stroke();
    });
    g.restore();

    /* 顶部三色带 */
    g.fillStyle = '#f6b3c6'; g.fillRect(0, 0, W, 11);
    g.fillStyle = '#f6e3a1'; g.fillRect(0, 11, W, 5);
    g.fillStyle = '#bcd9ea'; g.fillRect(0, 16, W, 5);

    /* 抬头 */
    g.fillStyle = '#4a3038';
    g.font = 'bold 44px ' + CFONT;
    g.fillText(card.school, 56, 96);
    g.fillStyle = '#9c8189';
    g.font = '17px ' + CFONT;
    g.fillText(card.schoolEn + ' · ' + card.base, 58, 126);

    /* 「干饭成绩单」小胶囊 */
    g.fillStyle = '#f6b3c6';
    g.beginPath();
    if (g.roundRect) g.roundRect(W - 258, 56, 202, 52, 26); else g.rect(W - 258, 56, 202, 52);
    g.fill();
    g.fillStyle = '#4a3038';
    g.font = 'bold 26px ' + CFONT;
    g.fillText(card.title, W - 234, 91);

    /* 头像徽章 */
    g.save();
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#f6b3c6';
    g.lineWidth = 5;
    g.beginPath(); g.arc(170, 292, 106, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.arc(170, 292, 106, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#fff3f7';
    g.fillRect(60, 182, 220, 220);
    drawHead(g, 170, 292, 62);
    g.restore();

    /* 段位小牌 */
    const rw = 224, rh = 46;
    g.fillStyle = '#f6e3a1';
    g.beginPath();
    if (g.roundRect) g.roundRect(170 - rw / 2, 412, rw, rh, 23); else g.rect(170 - rw / 2, 412, rw, rh);
    g.fill();
    g.fillStyle = '#4a3038';
    g.font = 'bold 22px ' + CFONT;
    g.textAlign = 'center';
    g.fillText(rank.name, 170, 444);
    g.textAlign = 'left';

    /* 信息栏 */
    const rows = [
      ['姓　名', name],
      ['得　分', last.score + ' 分'],
      ['接住菜品', last.caught + ' 份'],
      ['最高连击', last.bestCombo + ' 个'],
      ['收场原因', ending.why]
    ];
    rows.forEach((row, i) => {
      const y = 196 + i * 58;
      g.fillStyle = '#9c8189';
      g.font = '19px ' + CFONT;
      g.fillText(row[0], 330, y);
      g.fillStyle = '#4a3038';
      g.font = 'bold 27px ' + CFONT;
      g.fillText(row[1], 452, y);
      g.strokeStyle = 'rgba(246, 179, 198, .55)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(330, y + 14);
      g.lineTo(844, y + 14);
      g.stroke();
    });

    /* 页脚 */
    g.fillStyle = '#9c8189';
    g.font = '15px ' + CFONT;
    g.fillText('本页是虚构的小游戏，与湘潭大学无任何官方关联。', 56, 512);
    g.textAlign = 'right';
    g.fillText(card.issuer + ' 签发', 844, 512);
    g.textAlign = 'left';

    return c;
  }

  /* 黄白格子布，和 index.html 里那个 SVG pattern 一致 */
  let ginghamTile = null;
  function ginghamPattern(g) {
    if (!ginghamTile) {
      const t = el('canvas');
      t.width = t.height = 14;
      const tg = t.getContext('2d');
      tg.fillStyle = '#fffdf5';
      tg.fillRect(0, 0, 14, 14);
      tg.fillStyle = 'rgba(255, 193, 7, .55)';
      tg.fillRect(0, 0, 7, 14);
      tg.fillRect(0, 0, 14, 7);
      ginghamTile = t;
    }
    return g.createPattern(ginghamTile, 'repeat');
  }

  /* 成绩单上的小头像：只画头和兜帽，比例和 SVG 里那只一致 */
  function drawHead(g, cx, cy, r) {
    const line = 0.0667 * r;

    /* 脸 */
    const grad = g.createRadialGradient(cx - 0.34 * r, cy - 0.46 * r, 0.1 * r, cx, cy, 1.12 * r);
    grad.addColorStop(0, '#fff6bb');
    grad.addColorStop(.5, '#ffd94a');
    grad.addColorStop(1, '#eeb000');
    g.fillStyle = grad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();

    /* 眼睛 */
    [-1, 1].forEach(s => {
      const ex = cx + s * 0.298 * r, ey = cy + 0.298 * r;
      g.fillStyle = '#241c14';
      g.beginPath(); g.arc(ex, ey, 0.281 * r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(ex - s * 0.1 * r, ey - 0.107 * r, 0.098 * r, 0, Math.PI * 2); g.fill();
    });

    /* 嘴：笑 */
    g.strokeStyle = '#3b2c10';
    g.lineWidth = 0.068 * r;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(cx - 0.22 * r, cy + 0.52 * r);
    g.quadraticCurveTo(cx, cy + 0.78 * r, cx + 0.22 * r, cy + 0.52 * r);
    g.stroke();

    /* 格子布兜帽 */
    const bonnetY = cy - 0.095 * r;
    const bonnetR = 1.143 * r;
    g.fillStyle = ginghamPattern(g);
    g.beginPath(); g.arc(cx, bonnetY, bonnetR, Math.PI, 0); g.closePath(); g.fill();

    /* 兜帽蕾丝边 */
    g.strokeStyle = '#fffdf5';
    g.lineWidth = line;
    const step = 2 * bonnetR / 6;
    for (let i = 0; i < 6; i++) {
      const x = cx - bonnetR + i * step;
      g.beginPath();
      g.arc(x + step / 2, cy - 0.238 * r, step / 2 - line, 0, Math.PI);
      g.stroke();
    }

    /* 黄蝴蝶结 */
    g.save();
    g.translate(cx + 0.738 * r, cy - 0.548 * r);
    g.rotate(-20 * Math.PI / 180);
    g.fillStyle = '#ffc800';
    g.beginPath();
    g.ellipse(-0.238 * r, -0.071 * r, 0.238 * r, 0.179 * r, -16 * Math.PI / 180, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffd94a';
    g.beginPath();
    g.ellipse(0.238 * r, -0.071 * r, 0.238 * r, 0.179 * r, 16 * Math.PI / 180, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#ffa800';
    g.beginPath(); g.arc(0, 0, 0.095 * r, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function download(canvas) {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = el('a');
      a.href = url;
      a.download = '奶娃干饭成绩单.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, 'image/png');
  }

  /* ------------------------------------------------------------ 启动 */

  const params = new URLSearchParams(location.search);
  const jump = params.get('act');
  const hashAct = (location.hash.match(/^#\/([a-z]+)$/) || [])[1];

  let first = 'start';
  if (jump && D.order.includes(jump)) first = jump;
  else if (jump && /^\d+$/.test(jump) && D.order[+jump]) first = D.order[+jump];
  else if (hashAct && D.order.includes(hashAct)) first = hashAct;
  /* 结算幕要有上一局的成绩，直接跳进来就退回开场 */
  if (first === 'over' && !state.last) first = 'start';

  state.act = first;
  /* 判定线交给 CSS：开场时奶娃站在上面，打饭时落到 --catch 那条线上 */
  document.documentElement.style.setProperty('--catch', (R0.catchY * 100) + '%');
  history.replaceState({ act: 'start' }, '', '#/start');
  /* 直接带 ?act= 进来时也垫一层开场，免得游戏里按返回键直接离开本站 */
  if (first !== 'start') history.pushState({ act: first }, '', '#/' + first);
  render(first);
})();
