/* 奶娃打饭记 · 全部文案、菜品与数值都在这里，改手感不用动 app.js */
window.CANTEEN_DATA = {

  meta: {
    school: '湖南奶娃大学',
    base: '奶娃食堂',
    subtitle: '干饭时刻',
    official: 'https://www.xtu.edu.cn/',
    officialName: '真的湘潭大学',
    home: '/',
    homeName: '回奶娃大学首页',
    disclaimer: '本页是一个虚构的小游戏，与湘潭大学无任何官方关联；' +
                '食堂窗口、菜品与打饭阿姨都是演的，以现实为准。'
  },

  /* 幕次：开场 → 打饭 → 结算。app.js 按这个推历史与显隐 */
  order: ['start', 'play', 'over'],

  /* 一局的手感参数。难度按局内时间在 from → to 之间线性过渡 */
  rules: {
    time: 60,             // 一局多少秒
    lives: 3,             // 接住几次坏东西就收摊
    spawnFrom: 0.94,      // 出菜间隔（秒）
    spawnTo: 0.40,
    speedFrom: 0.30,      // 下落速度（每秒走过场地高度的比例）
    speedTo: 1.02,
    goodFrom: 0.88,       // 好东西的占比，越到后面越低
    goodTo: 0.62,
    catchY: 0.86,         // 判定线：菜落到这里结算，正好落在盘面上
    catchWidth: 104,      // 接住的横向判定宽度（像素，按场地实际宽度换算）
    maxAlive: 7,          // 场上同时最多几个
    combo2: 3,            // 连住几个开始 ×2
    combo3: 6,            // 连住几个开始 ×3
    spawnX: [0.09, 0.91]  // 出菜的横向范围
  },

  /* 掉落物。good:false 的是不能接的：hurt 扣命，score 为负就是纯扣分 */
  items: [
    { id: 'rice',   icon: '🍚', name: '白米饭',   good: true,  score: 1,
      say: '一勺米饭，先垫一垫。' },
    { id: 'green',  icon: '🥬', name: '青菜',     good: true,  score: 2,
      say: '阿姨说，多吃点绿的。' },
    { id: 'egg',    icon: '🍅', name: '番茄炒蛋', good: true,  score: 2,
      say: '番茄炒蛋，汤汁别洒了。' },
    { id: 'meat',   icon: '🍗', name: '鸡腿',     good: true,  score: 3,
      say: '今天运气真好，还有鸡腿。' },
    { id: 'soup',   icon: '🍜', name: '汤面',     good: true,  score: 3,
      say: '汤面很烫，端稳一点。' },
    { id: 'milk',   icon: '🍼', name: '奶瓶',     good: true,  score: 1, heal: 1,
      say: '喝一口，又活过来了。' },

    { id: 'chili',  icon: '🌶️', name: '辣椒',     good: false, hurt: 1,
      say: '辣得我半天说不出话。' },
    { id: 'rag',    icon: '🧽', name: '抹布',     good: false, hurt: 1,
      say: '阿姨：那是擦桌子的！' },
    { id: 'plate',  icon: '🍽️', name: '空盘子',   good: false, score: -3,
      say: '接了个空盘子。菜呢？' },
    { id: 'tissue', icon: '🧻', name: '纸巾',     good: false,
      say: '食堂的纸巾，一卷能用一学期。' }
  ],

  /* 结算段位，按分数从高到低取第一个够得着的 */
  ranks: [
    { min: 200, name: '奶娃の传说', note: '据说你从来没错过任何一个鸡腿。' },
    { min: 130, name: '食堂之神',   note: '你端盘子的时候，队伍会自己让开。' },
    { min: 80,  name: '抢饭好手',   note: '几个窗口的阿姨都认识你了。' },
    { min: 45,  name: '光盘标兵',   note: '盘子干净得能照出人影。' },
    { min: 20,  name: '干饭学徒',   note: '知道要早点来，就是每次都慢半步。' },
    { min: 0,   name: '打饭萌新',   note: '刚来，还没摸清哪个窗口的队伍最短。' }
  ],

  /* ---------------------------------------------------------------- 开场 */

  start: {
    kicker: '开场',
    title: '打饭',
    lines: [
      '下课铃一响，我抱着空盘子往食堂跑。',
      '窗口前面已经排起了长队，阿姨在里头喊：「下一个！」'
    ],
    prompt: '端稳盘子：能吃的接住，不能吃的躲开。',
    rulesText: r => [
      '🍚 米饭 +1 · 🍅 番茄炒蛋 +2 · 🍗 鸡腿 +3 · 🍼 奶瓶 +1 条命',
      '🌶️ 辣椒和 🧽 抹布各扣一条命，🍽️ 空盘子倒扣 3 分',
      `连住 ${r.combo2} 个开始翻倍，连住 ${r.combo3} 个三倍；接住坏东西断连击`,
      `一局 ${r.time} 秒、${r.lives} 条命；命掉光就提前收摊`
    ],
    controls: '电脑：← → 或 A D。手机：按住屏幕左右拖动。Esc 退出这一局。',
    name: '名字会印在成绩单上。',
    nameHint: '留空就叫「奶娃」。',
    go: '开始打饭',
    fromEnroll: '还是你报到时那个名字，想改就改。',
    best: n => `目前最高分 ${n} 分，看看这次能不能破。`,
    noBest: '还没有成绩，先盛一碗再说。'
  },

  /* ---------------------------------------------------------------- 打饭 */

  play: {
    kicker: '干饭中',
    title: '打饭',
    combo: n => `连住 ${n} 个`,
    lives: n => `还剩 ${n} 条命`,
    pause: '暂停',
    resume: '继续',
    paused: '阿姨回后厨添菜了，等你回来。',
    miss: '漏',
    healFull: '命是满的，奶瓶先揣兜里。',
    start: '开饭！'
  },

  /* ---------------------------------------------------------------- 结算 */

  over: {
    kicker: '结算',
    title: '收摊',
    endings: {
      timeUp: {
        why: '吃满全场',
        line: '铃响了。我端着满满一盘，在角落找了个位置坐下。'
      },
      lifeOut: {
        why: '中途洒了',
        line: '盘子一歪，菜全洒了。阿姨叹了口气，把牌子翻到「暂停供应」。'
      }
    },
    prompt: '成绩单给你，拿好。',
    card: {
      title: '干饭成绩单',
      school: '湖南奶娃大学',
      schoolEn: 'HUNAN NAIWA UNIVERSITY',
      base: '奶娃食堂',
      issuer: '奶娃食堂 · 打饭窗口'
    },
    save: '保存成绩单',
    again: '再打一份',
    back: '回开场',
    hint: '手机上长按图片也能存下来。',
    best: n => `最高分 ${n} 分。`,
    newBest: '新高。',
    empty: '上一局没留下记录，回去再打一份吧。'
  }
};
