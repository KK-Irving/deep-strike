'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 肉鸽升级系统
 * 升级卡片池 / 羁绊定义 / 抽卡逻辑
 * ============================================================ */

const RARITY = [
  { name: '普通', color: '#9fb8d0', weight: 60 },
  { name: '稀有', color: '#4db8ff', weight: 32 },
  { name: '史诗', color: '#c86bff', weight: 8 }
];

/* 升级卡片:id / 图标 / 名称 / 最大层数 / 稀有度(0普 1稀 2史) / 说明 */
const UPGRADES = [
  { id: 'dmg',      icon: '⚡', name: '火力强化',   max: 4, rar: 0, desc: '所有子弹伤害 +1' },
  { id: 'rate',     icon: '🔥', name: '急速射击',   max: 4, rar: 0, desc: '射击间隔 -15%' },
  { id: 'speed',    icon: '💨', name: '推进器',     max: 3, rar: 0, desc: '移动速度 +15%' },
  { id: 'magnet',   icon: '🧲', name: '引力场',     max: 3, rar: 0, desc: '道具与经验吸取范围大幅增加' },
  { id: 'xpchip',   icon: '🔷', name: '经验芯片',   max: 3, rar: 0, desc: '经验获取 +25%' },
  { id: 'combo',    icon: '♾️', name: '连击锁链',   max: 2, rar: 0, desc: '连击维持时间 +1.5 秒' },
  { id: 'multi',    icon: '⇈',  name: '并列弹道',   max: 2, rar: 1, desc: '增加 1 路并列主炮' },
  { id: 'side',     icon: '◎',  name: '侧翼弹',     max: 3, rar: 1, desc: '两侧各增加 1 枚斜射弹' },
  { id: 'rear',     icon: '▼',  name: '尾炮',       max: 2, rar: 1, desc: '机尾向后发射 2 枚炮弹' },
  { id: 'pierce',   icon: '➹',  name: '贯穿弹',     max: 3, rar: 1, desc: '子弹可穿透 +1 个目标' },
  { id: 'crit',     icon: '✖',  name: '要害打击',   max: 2, rar: 1, desc: '暴击率 +20%,造成 3 倍伤害' },
  { id: 'bombkill', icon: '💣', name: '歼灭装填',   max: 2, rar: 1, desc: '每击坠一批敌机获得 1 枚炸弹' },
  { id: 'thorn',    icon: '☢',  name: '反击风暴',   max: 1, rar: 1, desc: '受击时清除周围弹幕并放出冲击波' },
  { id: 'split',    icon: '✷',  name: '裂变弹',     max: 2, rar: 2, desc: '子弹命中后分裂出 2 枚小弹' },
  { id: 'homing',   icon: '➤',  name: '追踪导弹',   max: 3, rar: 2, desc: '周期性自动发射追踪导弹' },
  { id: 'shieldgen',icon: '◇',  name: '护盾发生器', max: 1, rar: 2, desc: '每 12 秒自动展开一层护盾' },
  { id: 'time',     icon: '⏳', name: '时滞力场',   max: 2, rar: 2, desc: '全部敌方弹幕减速 18%' },
  { id: 'wingman',  icon: '🛰', name: '幻影僚机',   max: 2, rar: 2, desc: '召唤僚机环绕,自动索敌射击' },
  { id: 'rift',     icon: '🌀', name: '空间裂隙',   max: 2, rar: 2, desc: '周期生成黑洞,撕碎弹幕并灼烧敌机' }
];

/* 羁绊:同时拥有指定技能后觉醒,提供额外特效 */
const BONDS = [
  { id: 'storm',    name: '弹幕风暴', req: ['split', 'pierce'],     desc: '裂变小弹获得贯穿能力' },
  { id: 'web',      name: '天罗地网', req: ['side', 'rear'],        desc: '周期性释放全向环形弹' },
  { id: 'hunt',     name: '猎杀时刻', req: ['homing', 'crit'],      desc: '追踪导弹必定暴击' },
  { id: 'fortress', name: '移动堡垒', req: ['shieldgen', 'thorn'],  desc: '护盾充能时间减半' },
  { id: 'overdrive',name: '超载核心', req: ['rate', 'dmg'],         desc: '射击间隔额外 -15%' },
  { id: 'execute',  name: '歼灭协议', req: ['crit', 'dmg'],         desc: '暴击倍率提升至 4.5 倍' },
  { id: 'ghostNet', name: '维度撕裂', req: ['time', 'rift'],        desc: '裂隙范围 +60%,撕碎弹幕更快' },
  { id: 'squad',    name: '僚机协议', req: ['wingman', 'homing'],   desc: '僚机改射追踪导弹' },
  { id: 'chrono',   name: '时间领主', req: ['time', 'rate'],        desc: '时滞效果提升至每层 30%' }
];

const UPGRADE_MAP = {};
for (const u of UPGRADES) UPGRADE_MAP[u.id] = u;

/* 加权抽卡:从未满级的卡片中按稀有度权重抽取 3 张(互不重复)
 * 等级越高,史诗权重略微上调(后期更容易抽到质变卡) */
function drawUpgradeCards(mods, level, count = 3) {
  const pool = UPGRADES.filter(u => (mods[u.id] || 0) < u.max);
  const weights = RARITY.map((r, i) => r.weight + (i === 2 ? level : 0));
  const picks = [];
  const w = weights.slice();
  for (let n = 0; n < count && pool.length; n++) {
    let total = 0;
    for (const u of pool) total += w[u.rar];
    let roll = Math.random() * total;
    let chosen = pool[0];
    for (const u of pool) {
      roll -= w[u.rar];
      if (roll <= 0) { chosen = u; break; }
    }
    picks.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return picks;
}

/* 检查 newly 达成的羁绊(之前未激活 + 现在条件满足) */
function checkNewBonds(mods, activeBonds) {
  return BONDS.filter(b =>
    !activeBonds.includes(b.id) &&
    b.req.every(id => (mods[id] || 0) > 0)
  );
}
