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

/* 升级卡片:id / 图标 / 名称 / 最大层数 / 稀有度(0普 1稀 2史) / 说明
 * hidden:true 为隐藏卡,仅在特定条件下进入卡池 */
const UPGRADES = [
  { id: 'dmg',      icon: '⚡', name: '火力强化',   max: 4, rar: 0, desc: '所有子弹伤害 +1' },
  { id: 'rate',     icon: '🔥', name: '急速射击',   max: 4, rar: 0, desc: '射击间隔 -15%' },
  { id: 'speed',    icon: '💨', name: '推进器',     max: 3, rar: 0, desc: '移动速度 +15%' },
  { id: 'magnet',   icon: '🧲', name: '引力场',     max: 3, rar: 0, desc: '道具与经验吸取范围大幅增加' },
  { id: 'xpchip',   icon: '🔷', name: '经验芯片',   max: 3, rar: 0, desc: '经验获取 +25%' },
  { id: 'combo',    icon: '♾️', name: '连击锁链',   max: 2, rar: 0, desc: '连击维持时间 +1.5 秒' },
  { id: 'vitality', icon: '❤️', name: '生命上限',   max: 4, rar: 0, desc: '生命上限 +25,并立即回复同量' },
  { id: 'multi',    icon: '⇈',  name: '并列弹道',   max: 2, rar: 1, desc: '增加 1 路并列主炮' },
  { id: 'side',     icon: '◎',  name: '侧翼弹',     max: 3, rar: 1, desc: '两侧各增加 1 枚斜射弹' },
  { id: 'rear',     icon: '▼',  name: '尾炮',       max: 2, rar: 1, desc: '机尾向后发射 2 枚炮弹' },
  { id: 'pierce',   icon: '➹',  name: '贯穿弹',     max: 3, rar: 1, desc: '子弹可穿透 +1 个目标' },
  { id: 'crit',     icon: '✖',  name: '要害打击',   max: 2, rar: 1, desc: '暴击率 +20%,造成 3 倍伤害' },
  { id: 'bombkill', icon: '💣', name: '歼灭装填',   max: 2, rar: 1, desc: '每击坠一批敌机获得 1 枚炸弹' },
  { id: 'thorn',    icon: '☢',  name: '反击风暴',   max: 1, rar: 1, desc: '受击时清除周围弹幕并放出冲击波' },
  { id: 'regen',    icon: '💠', name: '纳米修复',   max: 3, rar: 1, desc: '每秒回复 0.6 点生命' },
  { id: 'leech',    icon: '🩸', name: '击杀汲取',   max: 3, rar: 1, desc: '击坠敌机回复 0.7 点生命' },
  { id: 'armor',    icon: '🛡️', name: '复合装甲',   max: 3, rar: 1, desc: '受到伤害 -15%' },
  { id: 'split',    icon: '✷',  name: '裂变弹',     max: 2, rar: 2, desc: '子弹命中后分裂出 2 枚小弹' },
  { id: 'homing',   icon: '➤',  name: '追踪导弹',   max: 3, rar: 2, desc: '周期性自动发射追踪导弹' },
  { id: 'shieldgen',icon: '◇',  name: '护盾发生器', max: 1, rar: 2, desc: '每 12 秒自动展开一层护盾' },
  { id: 'undying',  icon: '🕊️', name: '不屈意志',   max: 1, rar: 2, desc: '受到致命伤害时保留 1 点生命并清除全屏弹幕(每局一次)' },
  { id: 'time',     icon: '⏳', name: '时滞力场',   max: 2, rar: 2, desc: '全部敌方弹幕减速 18%' },
  { id: 'wingman',  icon: '🛰', name: '幻影僚机',   max: 2, rar: 2, desc: '召唤僚机环绕,自动索敌射击' },
  { id: 'rift',     icon: '🌀', name: '空间裂隙',   max: 2, rar: 2, desc: '周期生成黑洞,撕碎弹幕并灼烧敌机' },
  { id: 'laser',    icon: '🔦', name: '激光主炮',   max: 2, rar: 2, desc: '质变:主炮替换为贯穿激光束,持续灼烧一列', path: true },
  { id: 'spread',   icon: '🎇', name: '散射炮',     max: 2, rar: 2, desc: '质变:主炮替换为宽扇散射,近程爆发(弹丸会衰减)', path: true },
  { id: 'slotplus', icon: '🧬', name: '基因扩展',   max: 2, rar: 2, desc: '隐藏卡:强化槽位 +1', hidden: true }
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
  { id: 'chrono',   name: '时间领主', req: ['time', 'rate'],        desc: '时滞效果提升至每层 30%' },
  { id: 'focus',    name: '聚能协议', req: ['laser', 'dmg'],        desc: '激光伤害 +60%' },
  { id: 'suppress', name: '压制弹幕', req: ['spread', 'side'],      desc: '散射与侧翼弹丸数 +2' },
  { id: 'symbiosis',name: '生机涌动', req: ['shieldgen', 'regen'],  desc: '护盾破碎时回复 15 点生命' },
  { id: 'ironwill', name: '荆棘装甲', req: ['armor', 'thorn'],      desc: '受击时回复 5 点生命' },
  { id: 'bloodrush',name: '血怒共振', req: ['leech', 'crit'],       desc: '暴击时额外回复 2 点生命' }
];

const UPGRADE_MAP = {};
for (const u of UPGRADES) UPGRADE_MAP[u.id] = u;

/* 加权抽卡:从未满级的卡片中按稀有度权重抽取 3 张(互不重复)
 * 等级越高,史诗权重略微上调;质变武器互斥;槽位满载时隐藏卡「基因扩展」进入卡池 */
function drawUpgradeCards(mods, maxSlots, level, count = 3) {
  const ownedCount = UPGRADES.filter(u => (mods[u.id] || 0) > 0 && !u.hidden).length;
  const slotsFull = ownedCount >= maxSlots;
  const pathId = mods.laser ? 'laser' : (mods.spread ? 'spread' : null);
  const pool = UPGRADES.filter(u =>
    (mods[u.id] || 0) < u.max &&
    !(u.path && pathId && pathId !== u.id) &&
    !(u.hidden && !slotsFull)
  );
  const weights = RARITY.map((r, i) => r.weight + (i === 2 ? level : 0));
  const cardWeight = (u) => weights[u.rar] + (u.hidden ? 45 : 0);
  const picks = [];
  for (let n = 0; n < count && pool.length; n++) {
    let total = 0;
    for (const u of pool) total += cardWeight(u);
    let roll = RNG() * total;
    let chosen = pool[0];
    for (const u of pool) {
      roll -= cardWeight(u);
      if (roll <= 0) { chosen = u; break; }
    }
    picks.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return picks;
}
