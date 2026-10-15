/* 奶娃入学记 · 逻辑
   无框架、无依赖、零外部请求。文案全在 data/script.js。 */

(() => {
  'use strict';

  const D = window.ENROLL_DATA;
  if (!D) return;

  const PHOTO_DIR = '/enroll/assets/photos/';
  const KEY = 'enroll:v1';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------ DOM */

  const photoEl    = document.getElementById('photo');
  const naiwaEl    = document.getElementById('naiwa');
  const panel      = document.getElementById('panel');
  const kickerEl   = document.getElementById('kicker');
  const titleEl    = document.getElementById('title');
  const linesEl    = document.getElementById('lines');
  const promptEl   = document.getElementById('prompt');
  const controlsEl = document.getElementById('controls');
  const toastEl    = document.getElementById('toast');
  const backBtn    = document.getElementById('back');
  const resetBtn   = document.getElementById('reset');
  const progressEl = document.getElementById('progress');
  const progressBox = progressEl.parentElement;
  const disclaimerEl = document.getElementById('disclaimer');

  disclaimerEl.textContent = D.meta.disclaimer;

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

  function choice(label, note, onClick) {
    const b = button('choice', null, null);
    b.appendChild(el('b', null, label));
    if (note) b.appendChild(el('small', null, note));
    if (onClick) b.addEventListener('click', onClick);
    else b.disabled = true;
    return b;
  }

  function actions(...nodes) {
    const row = el('div', 'actions');
    nodes.filter(Boolean).forEach(n => row.appendChild(n));
    return row;
  }

  /* ------------------------------------------------------------ 状态 */

  function blank() {
    return {
      act: 'start', name: '', arrive: '', dorm: '', gate: '', pay: '',
      room: '', made: false, vow: '', stamps: [], packed: [], kept: []
    };
  }

  let state = blank();
  let storeOK = true;
  let renderToken = 0;

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

  function wipe() {
    try { localStorage.removeItem(KEY); } catch (err) { /* 忽略 */ }
  }

  let saved = load();

  /* ------------------------------------------------------------ 画面 */

  let curPhoto = null;

  /* 只在该幕要用时才加载那张照片，首屏不会把十来张图全拉下来 */
  function setPhoto(key) {
    if (key === curPhoto) return;
    curPhoto = key;
    photoEl.classList.remove('is-in');
    if (!key) { photoEl.style.backgroundImage = ''; return; }
    const url = PHOTO_DIR + key + '.webp';
    const img = new Image();
    img.onload = () => {
      if (curPhoto !== key) return;
      photoEl.style.backgroundImage = 'url("' + url + '")';
      requestAnimationFrame(() => photoEl.classList.add('is-in'));
    };
    img.src = url;
  }

  function setNaiwa(mood) { naiwaEl.dataset.mood = mood; }

  let toastTimer = 0;
  function toast(text, warn) {
    clearTimeout(toastTimer);
    toastEl.textContent = text || '';
    toastEl.classList.toggle('on', !!text);
    toastEl.style.color = warn ? '#e2a2a2' : '';
    if (text) toastTimer = setTimeout(() => toastEl.classList.remove('on'), 4200);
  }

  function shake() {
    if (reduce) return;
    panel.classList.remove('shake');
    void panel.offsetWidth;
    panel.classList.add('shake');
  }

  let skipTyping = false;
  addEventListener('pointerdown', () => { skipTyping = true; }, true);

  function renderLines(list, typing) {
    linesEl.innerHTML = '';
    const items = list.slice();
    if (!typing || reduce) {
      items.forEach(t => linesEl.appendChild(el('p', null, t)));
      return Promise.resolve();
    }
    skipTyping = false;
    return new Promise(resolve => {
      let i = 0;
      (function nextLine() {
        if (i >= items.length || skipTyping) {
          if (skipTyping) { linesEl.innerHTML = ''; items.forEach(t => linesEl.appendChild(el('p', null, t))); }
          resolve();
          return;
        }
        const text = items[i++];
        const p = el('p');
        linesEl.appendChild(p);
        let j = 0;
        (function tick() {
          if (skipTyping) { p.textContent = text; nextLine(); return; }
          if (j >= text.length) { nextLine(); return; }
          p.textContent = text.slice(0, ++j);
          setTimeout(tick, 26);
        })();
      })();
    });
  }

  function setProgress(id) {
    const i = Math.max(0, D.order.indexOf(id));
    progressEl.style.width = (i / (D.order.length - 1) * 100) + '%';
    progressBox.setAttribute('aria-valuenow', String(i));
    progressBox.setAttribute('aria-valuemax', String(D.order.length - 1));
  }

  function head(act) {
    kickerEl.textContent = act.kicker || '';
    titleEl.textContent = act.title || '';
  }

  /* ------------------------------------------------------------ 路由 */

  function render(id) {
    const token = ++renderToken;
    const act = D[id] || {};
    document.body.dataset.act = id;
    backBtn.hidden = id === 'start';
    setProgress(id);
    setPhoto(D.photo[id] || null);
    controlsEl.innerHTML = '';
    promptEl.textContent = '';
    toast('');
    panel.classList.remove('shake');
    panel.style.animation = 'none';
    void panel.offsetWidth;              // 重新触发进入动画
    panel.style.animation = '';
    panel.scrollTop = 0;
    setNaiwa('idle');
    (R[id] || R.start)(act, token);
  }

  function go(id, opts) {
    opts = opts || {};
    if (!D.order.includes(id)) id = 'start';
    state.act = id;
    if (opts.save !== false) save();
    if (opts.push !== false) history.pushState({ act: id }, '', '#/' + id);
    render(id);
  }

  addEventListener('popstate', e => {
    const id = (e.state && e.state.act) || 'start';
    state.act = D.order.includes(id) ? id : 'start';
    save();
    render(state.act);
  });

  backBtn.addEventListener('click', () => history.back());
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.act !== 'start') history.back();
  });

  function restart() {
    wipe();
    saved = null;                     // 免得「继续上次的报到」又把刚清掉的进度捞回来
    state = blank();
    history.replaceState({ act: 'start' }, '', '#/start');
    render('start');
  }

  resetBtn.addEventListener('click', () => {
    if (state.act === 'start' || confirm('重新开始？这次报到的记录会清空。')) restart();
  });

  /* ------------------------------------------------------------ 各幕 */

  const R = {};

  /* 第〇幕 · 启程 */
  R.start = act => {
    head({ kicker: '第〇幕', title: '启程' });
    renderLines([
      '天还没亮。我坐在行李箱上，等第一班车。',
      '箱子里装了四样东西，剩下的位置全给了我自己。'
    ]);
    promptEl.textContent = '先给我起个名字吧——会印在学生证上。';

    const input = el('input');
    input.type = 'text';
    input.maxLength = 12;
    input.placeholder = '奶娃';
    input.value = state.name || '';
    input.setAttribute('aria-label', '名字');
    input.autocomplete = 'off';

    const field = el('div', 'field');
    const goBtn = button('primary', '出发', submit);
    field.append(input, goBtn);
    controlsEl.appendChild(field);

    function submit() {
      state.name = (input.value || '').trim().slice(0, 12) || '奶娃';
      go('arrive');
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });

    if (saved && saved.act && saved.act !== 'start' && D.order.includes(saved.act)) {
      const label = '继续上次的报到 · ' + (D[saved.act].title || saved.act);
      controlsEl.appendChild(actions(button('ghost', label, () => {
        state = Object.assign(blank(), saved);
        go(saved.act);
      })));
      controlsEl.appendChild(el('p', 'hintline', '第一次来，直接在上面输入名字点「出发」。'));
    }
  };

  /* 第一幕 · 到站 */
  R.arrive = act => {
    head(act);
    renderLines(act.lines);
    promptEl.textContent = act.prompt;
    act.choices.forEach(c => {
      const b = choice(c.label, c.note, () => { state.arrive = c.id; go('gate'); });
      if (state.arrive === c.id) b.classList.add('picked');
      controlsEl.appendChild(b);
    });
  };

  /* 第二幕 · 进校门（先选宿舍区，再按真实管制规则选校门） */
  R.gate = act => {
    head(act);
    const dorm = state.dorm ? act.dorms.find(d => d.id === state.dorm) : null;

    if (dorm && state.gate) {
      const gate = act.gates.find(g => g.id === state.gate);
      setNaiwa('happy');
      renderLines([act.right]);
      promptEl.textContent = '住在' + dorm.name + '，走' + gate.name + '进校。' + dorm.note;
      controlsEl.appendChild(actions(button('primary', '去北京路报到', () => go('report'))));
      return;
    }

    renderLines(act.lines);

    if (!dorm) {
      promptEl.textContent = act.askDorm;
      controlsEl.appendChild(el('p', 'counter', act.dormIntro));
      act.dorms.forEach(d => {
        controlsEl.appendChild(choice(d.name, d.note, () => {
          state.dorm = d.id;
          save();
          render('gate');
        }));
      });
      return;
    }

    promptEl.textContent = act.askGate + '（你住' + dorm.name + '）';
    controlsEl.appendChild(el('p', 'counter', act.gateIntro));
    act.gates.forEach(g => {
      controlsEl.appendChild(choice(g.name, g.note, () => {
        if (g.id === dorm.gate) {
          state.gate = g.id;
          save();
          render('gate');
          toast(act.right);
        } else {
          setNaiwa('worried');
          shake();
          toast(act.wrong, true);
          setTimeout(() => setNaiwa('idle'), 1600);
        }
      }));
    });
    controlsEl.appendChild(actions(button('ghost', '换一个宿舍区', () => {
      state.dorm = ''; state.gate = ''; save(); render('gate');
    })));
  };

  /* 第三幕 · 北京路报到（行李打包） */
  R.report = act => {
    head(act);
    renderLines(act.lines);
    promptEl.textContent = act.prompt;

    state.packed = state.packed || [];
    state.kept = state.kept || [];

    const counter = el('p', 'counter');
    controlsEl.appendChild(counter);
    controlsEl.appendChild(el('p', 'hintline', act.hint));

    const grid = el('div', 'items');
    const pool = act.need.concat(act.decoy);
    pool.forEach(item => {
      const need = act.need.indexOf(item) >= 0;
      const b = button('item', null, () => {
        if (need) {
          state.packed.push(item.id);
          save();
          b.classList.add('gone');
          setNaiwa('happy');
          toast(item.ok);
        } else {
          state.kept.push(item.id);
          save();
          b.classList.add('kept');
          setNaiwa('worried');
          shake();
          toast(item.no, true);
          setTimeout(() => setNaiwa('idle'), 1500);
        }
        update();
      });
      const icon = el('i', null, item.icon);
      icon.setAttribute('aria-hidden', 'true');
      b.appendChild(icon);
      b.appendChild(document.createTextNode(item.name));
      if (state.packed.includes(item.id)) b.classList.add('gone');
      if (state.kept.includes(item.id)) b.classList.add('kept');
      grid.appendChild(b);
    });
    controlsEl.appendChild(grid);

    const tail = el('div');
    controlsEl.appendChild(tail);

    update();

    function update() {
      const n = state.packed.length;
      counter.textContent = '必需材料 ' + n + ' / ' + act.need.length;
      tail.innerHTML = '';
      if (n >= act.need.length) {
        setNaiwa('happy');
        tail.appendChild(el('p', 'counter', act.done));
        tail.appendChild(actions(button('primary', '去缴费', () => go('pay'))));
      }
    }
  };

  /* 第四幕 · 缴费 */
  R.pay = act => {
    head(act);
    const picked = act.choices.find(c => c.id === state.pay);
    if (picked) {
      renderLines(act.lines.concat([picked.after]));
      promptEl.textContent = '办好了。';
      controlsEl.appendChild(actions(
        button('primary', '搬行李去宿舍', () => go('dorm')),
        button('ghost', '换一种方式', () => { state.pay = ''; save(); render('pay'); })
      ));
      return;
    }
    renderLines(act.lines);
    promptEl.textContent = act.prompt;
    act.choices.forEach(c => {
      controlsEl.appendChild(choice(c.label, c.note, () => {
        state.pay = c.id;
        save();
        render('pay');
      }));
    });
  };

  /* 第五幕 · 入住 */
  R.dorm = act => {
    head(act);
    const said = act.choices.find(c => c.id === state.room);

    if (said && state.made) {
      setNaiwa('happy');
      renderLines([said.tone, act.made, act.after]);
      promptEl.textContent = '灯熄了。';
      controlsEl.appendChild(actions(button('primary', '第二天 · 开学第一课', () => go('class'))));
      return;
    }

    if (said) {
      renderLines([said.tone]);
      promptEl.textContent = act.make;
      controlsEl.appendChild(actions(button('primary', act.make, () => {
        state.made = true;
        save();
        render('dorm');
      })));
      return;
    }

    renderLines(act.lines);
    promptEl.textContent = act.prompt;
    act.choices.forEach(c => {
      controlsEl.appendChild(choice(c.label, null, () => {
        state.room = c.id;
        save();
        render('dorm');
      }));
    });
  };

  /* 第六幕 · 开学第一课（打字机独白） */
  R.class = (act, token) => {
    head(act);
    const chosen = act.choices.find(c => c.id === state.vow);

    if (chosen) {
      setNaiwa('happy');
      renderLines(act.lines.concat([chosen.label + ' ' + chosen.note]));
      promptEl.textContent = '说完了。灯亮起来。';
      controlsEl.appendChild(actions(button('primary', '下午没课，去逛逛', () => go('tour'))));
      return;
    }

    renderLines(act.lines, true).then(() => {
      if (token !== renderToken) return;      // 期间换幕了就不要写回去
      promptEl.textContent = act.prompt;
      act.choices.forEach(c => {
        controlsEl.appendChild(choice(c.label, c.note, () => {
          state.vow = c.id;
          save();
          render('class');
        }));
      });
    });
  };

  /* 第七幕 · 逛校园集章 */
  R.tour = act => {
    head(act);
    state.stamps = state.stamps || [];
    renderLines(act.lines);

    const total = act.stamps.length;
    const counter = el('p', 'counter');
    const done = el('div');

    function update() {
      counter.textContent = act.progress(state.stamps.length, total);
      done.innerHTML = '';
      if (state.stamps.length >= total) {
        setNaiwa('happy');
        done.appendChild(el('p', 'counter', act.done));
        done.appendChild(actions(button('primary', '回宿舍', () => go('finish'))));
      }
    }

    if (state.stamps.length >= total) {
      promptEl.textContent = act.done;
    } else {
      promptEl.textContent = act.prompt;
      controlsEl.appendChild(counter);
    }

    const grid = el('div', 'stamps');
    act.stamps.forEach(s => {
      const b = button('stamp', null, () => {
        if (state.stamps.includes(s.id)) return;
        state.stamps.push(s.id);
        save();
        b.classList.add('got');
        toast(s.fact);
        update();
      });
      const thumb = el('span', 'thumb');
      /* 缩略图也是按需加载：只有进到这一幕才开始拉这 6 张 */
      thumb.style.backgroundImage = 'url("' + PHOTO_DIR + s.photo + '.webp")';
      const cap = el('span', 'cap');
      cap.appendChild(el('b', null, s.name));
      cap.appendChild(el('small', null, s.fact));
      const mark = el('span', 'mark', '✓');
      mark.setAttribute('aria-hidden', 'true');
      b.append(thumb, cap, mark);
      if (state.stamps.includes(s.id)) b.classList.add('got');
      grid.appendChild(b);
    });
    controlsEl.appendChild(grid);
    controlsEl.appendChild(done);
    update();
  };

  /* 尾声 · 结业（学生证） */
  R.finish = act => {
    head(act);
    renderLines(act.lines);
    promptEl.textContent = '';

    const canvas = drawCard(act.card, state.name);
    const wrap = el('div', 'idcard-wrap');
    const img = el('img');
    img.alt = '奶娃学生证';
    img.src = canvas.toDataURL('image/png');
    wrap.appendChild(img);
    wrap.appendChild(actions(
      button('primary', act.save, () => download(canvas)),
      button('ghost', act.again, () => restart()),
      (() => {
        const a = el('a', 'ghost', act.officialLead);
        a.href = D.meta.official;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        return a;
      })()
    ));
    wrap.appendChild(el('p', 'hintline', '手机上长按图片也能存下来。'));
    controlsEl.appendChild(wrap);

    setTimeout(() => { if (state.act === 'finish') setNaiwa('happy'); }, 400);
  };

  /* ------------------------------------------------------------ 学生证 */

  const CFONT = '"Microsoft YaHei", "PingFang SC", "Hiragino Sans GB", sans-serif';

  function studentId(name) {
    let h = 0;
    for (let i = 0; i < name.length; i++) h = (h * 131 + name.charCodeAt(i)) >>> 0;
    return D.meta.year + String(100000 + (h % 900000));
  }

  function drawCard(card, name) {
    const W = 900, H = 560;
    const c = el('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d');
    const who = name || '奶娃';

    /* 底色 */
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#fff8f5');
    grad.addColorStop(1, '#ffeef4');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);

    /* 右上角三拱门水印 */
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

    /* 「学生证」小胶囊 */
    g.fillStyle = '#f6b3c6';
    g.beginPath();
    g.roundRect ? g.roundRect(W - 208, 56, 152, 52, 26) : g.rect(W - 208, 56, 152, 52);
    g.fill();
    g.fillStyle = '#4a3038';
    g.font = 'bold 26px ' + CFONT;
    g.fillText(card.title, W - 178, 91);

    /* 照片框 */
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#f6b3c6';
    g.lineWidth = 4;
    if (g.roundRect) {
      g.beginPath(); g.roundRect(56, 168, 232, 272, 18); g.fill(); g.stroke();
    } else {
      g.fillRect(56, 168, 232, 272); g.strokeRect(56, 168, 232, 272);
    }
    drawAvatar(g, 172, 266);

    /* 信息栏 */
    const rows = [
      ['姓　名', who],
      ['学　号', studentId(who)],
      ['院　系', card.college],
      ['专　业', card.major],
      ['有效期', card.valid]
    ];
    rows.forEach((row, i) => {
      const y = 214 + i * 56;
      g.fillStyle = '#9c8189';
      g.font = '19px ' + CFONT;
      g.fillText(row[0], 330, y);
      g.fillStyle = '#4a3038';
      g.font = 'bold 27px ' + CFONT;
      g.fillText(row[1], 436, y);
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
    g.fillText('本证为虚构道具，与湘潭大学无任何官方关联。', 56, 500);
    g.textAlign = 'right';
    g.fillText(card.base + ' 签发', 844, 500);
    g.textAlign = 'left';

    return c;
  }

  /* 黄白格子布：横竖两条半透明色带叠出深浅两档格子，和 index.html 里的 SVG pattern 一致 */
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

  /* 程序化画一只奶娃（黄衣小奶娃，形象参考 resource/core.png）
     (cx, cy) 是头的中心，r 是头半径，其余部件按和 SVG 一致的比例摆 */
  function drawAvatar(g, cx, cy) {
    const r = 72;
    const gingham = ginghamPattern(g);
    const line = 0.0667 * r;               // 蕾丝线宽，和 SVG 的 2.8/42 一致

    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';

    /* 鞋 */
    [-0.5, 0.5].forEach(k => {
      const x = cx + k * r;
      const y = cy + 2.0 * r;
      g.fillStyle = '#f0b400';
      g.beginPath(); g.ellipse(x, y + 0.05 * r, 0.357 * r, 0.238 * r, 0, 0, Math.PI * 2); g.fill();
      const sg = g.createRadialGradient(x - 0.14 * r, y - 0.11 * r, 2, x, y, 0.4 * r);
      sg.addColorStop(0, '#ffee9e');
      sg.addColorStop(1, '#f5c000');
      g.fillStyle = sg;
      g.beginPath(); g.ellipse(x, y, 0.357 * r, 0.238 * r, 0, 0, Math.PI * 2); g.fill();
      /* 鞋头的小白蝴蝶结 */
      const by = y - 0.071 * r;
      g.fillStyle = '#fffdf5';
      g.beginPath();
      g.moveTo(x, by); g.lineTo(x - 0.167 * r, by - 0.119 * r); g.lineTo(x - 0.167 * r, by + 0.119 * r);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(x, by); g.lineTo(x + 0.167 * r, by - 0.119 * r); g.lineTo(x + 0.167 * r, by + 0.119 * r);
      g.closePath(); g.fill();
      g.beginPath(); g.arc(x, by, 0.057 * r, 0, Math.PI * 2); g.fill();
    });

    /* 连衣裙 */
    const dressTop = cy + 0.81 * r;
    const dressBot = cy + 1.619 * r;
    const dressHalfTop = 0.714 * r;
    const dressHalfBot = 1.19 * r;
    g.fillStyle = gingham;
    g.beginPath();
    g.moveTo(cx - dressHalfTop, dressTop);
    g.lineTo(cx + dressHalfTop, dressTop);
    g.lineTo(cx + dressHalfBot, dressBot - 0.143 * r);
    g.quadraticCurveTo(cx + dressHalfBot + 0.024 * r, dressBot, cx + dressHalfBot - 0.119 * r, dressBot);
    g.lineTo(cx - dressHalfBot + 0.119 * r, dressBot);
    g.quadraticCurveTo(cx - dressHalfBot - 0.024 * r, dressBot, cx - dressHalfBot, dressBot - 0.143 * r);
    g.closePath();
    g.fill();

    /* 裙摆蕾丝 */
    g.strokeStyle = '#fffdf5';
    g.lineWidth = line;
    const hemY = cy + 1.571 * r;
    const hemStep = 2 * dressHalfBot / 6;
    for (let i = 0; i < 6; i++) {
      const x = cx - dressHalfBot + i * hemStep;
      g.beginPath();
      g.arc(x + hemStep / 2, hemY, hemStep / 2 - line, 0, Math.PI);
      g.stroke();
    }

    /* 泡泡袖与小手 */
    [-1, 1].forEach(s => {
      g.fillStyle = gingham;
      g.beginPath();
      g.arc(cx + s * 1.048 * r, cy + 0.952 * r, 0.357 * r, 0, Math.PI * 2);
      g.fill();
      const hx = cx + s * 1.238 * r;
      const hy = cy + 1.31 * r;
      const hg = g.createRadialGradient(hx - 0.1 * r, hy - 0.12 * r, 2, hx, hy, 0.38 * r);
      hg.addColorStop(0, '#ffeb96');
      hg.addColorStop(1, '#f2b808');
      g.fillStyle = hg;
      g.beginPath(); g.ellipse(hx, hy, 0.19 * r, 0.238 * r, 0, 0, Math.PI * 2); g.fill();
    });

    /* 白围裙 + 建校年份 */
    const ax0 = cx - 0.667 * r, ax1 = cx + 0.667 * r;
    const ay0 = cy + 0.952 * r, ay1 = cy + 1.476 * r;
    g.fillStyle = '#fffdf5';
    if (g.roundRect) {
      g.beginPath(); g.roundRect(ax0, ay0, ax1 - ax0, ay1 - ay0, 0.095 * r); g.fill();
    } else {
      g.fillRect(ax0, ay0, ax1 - ax0, ay1 - ay0);
    }
    g.fillStyle = '#e8a000';
    g.font = 'bold ' + Math.round(0.517 * r) + 'px ' + CFONT;
    g.textAlign = 'center';
    g.fillText('1958', cx, cy + 1.31 * r);
    g.textAlign = 'left';

    /* 领口蕾丝 */
    g.strokeStyle = '#fffdf5';
    g.lineWidth = line;
    const colStep = 1.4 * r / 3;
    for (let i = 0; i < 3; i++) {
      const x = cx - 0.7 * r + i * colStep;
      g.beginPath();
      g.arc(x + colStep / 2, cy + 0.857 * r, colStep / 2 - line, 0, Math.PI);
      g.stroke();
    }

    /* 头 */
    const headGrad = g.createRadialGradient(cx - 0.34 * r, cy - 0.46 * r, 0.1 * r, cx, cy, 1.12 * r);
    headGrad.addColorStop(0, '#fff6bb');
    headGrad.addColorStop(.5, '#ffd94a');
    headGrad.addColorStop(1, '#eeb000');
    g.fillStyle = headGrad;
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();

    /* 眼睛 */
    [-1, 1].forEach(s => {
      const ex = cx + s * 0.298 * r, ey = cy + 0.298 * r;
      g.fillStyle = '#241c14';
      g.beginPath(); g.arc(ex, ey, 0.281 * r, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff';
      g.beginPath(); g.arc(ex - s * 0.1 * r, ey - 0.107 * r, 0.098 * r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = .7;
      g.beginPath(); g.arc(ex + s * 0.102 * r, ey + 0.107 * r, 0.045 * r, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    });

    /* 嘴 */
    g.strokeStyle = '#3b2c10';
    g.lineWidth = 0.062 * r;
    g.beginPath();
    g.moveTo(cx - 0.19 * r, cy + 0.548 * r);
    g.quadraticCurveTo(cx, cy + 0.69 * r, cx + 0.19 * r, cy + 0.548 * r);
    g.stroke();

    /* 格子布兜帽 */
    const bonnetY = cy - 0.095 * r;
    const bonnetR = 1.143 * r;
    g.fillStyle = gingham;
    g.beginPath();
    g.arc(cx, bonnetY, bonnetR, Math.PI, 0);
    g.closePath();
    g.fill();

    /* 兜帽蕾丝边 */
    g.strokeStyle = '#fffdf5';
    g.lineWidth = line;
    const laceStep = 2 * bonnetR / 6;
    for (let i = 0; i < 6; i++) {
      const x = cx - bonnetR + i * laceStep;
      g.beginPath();
      g.arc(x + laceStep / 2, cy - 0.238 * r, laceStep / 2 - line, 0, Math.PI);
      g.stroke();
    }

    /* 兜帽上的黄蝴蝶结 */
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

    g.restore();
  }

  function download(canvas) {
    canvas.toBlob(blob => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = el('a');
      a.href = url;
      a.download = '奶娃学生证.png';
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

  if (first !== 'start' && D[first] && D[first].title && saved) {
    state = Object.assign(blank(), saved, { act: first });
  } else if (first !== 'start') {
    state.act = first;
  }

  history.replaceState({ act: first }, '', '#/' + first);
  render(first);
})();
