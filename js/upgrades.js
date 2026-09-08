'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 肉鸽升级系统
 * 升级卡片池 / 羁绊定义 / 抽卡逻辑
 * ============================================================ */

const RARITY = [
  { name: '普通', color: '#9fb8d0', weight: 60 },
  { name: '稀有', color: '#4db8ff', weight: 32 },
  { name: '史诗', color: '#c86bff', weight: 8 },
  { name: '传说', color: '#ffd166', weight: 0 }
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
  { id: 'railgun',  icon: '🌩', name: '轨道炮',     max: 2, rar: 2, desc: '质变:蓄力发射高速贯穿磁轨弹,单发高伤(与暴击/贯穿强联动)', path: true },
  { id: 'tesla',    icon: '⚡', name: '电弧发生器', max: 2, rar: 2, desc: '质变:主炮替换为链式闪电,自动在敌群间跳跃(与并列/裂变强联动)', path: true },
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
  { id: 'bloodrush',name: '血怒共振', req: ['leech', 'crit'],       desc: '暴击时额外回复 2 点生命' },
  // 质变武器专属羁绊(item 2:更多套路)
  { id: 'railcrit', name: '穿甲协议', req: ['railgun', 'crit'],     desc: '轨道炮蓄力更快,必定暴击' },
  { id: 'railpierce',name:'无阻贯通', req: ['railgun', 'pierce'],   desc: '轨道炮弹体贯穿无限,伤害随贯穿层叠加' },
  { id: 'teslachain',name:'雷网',     req: ['tesla', 'multi'],      desc: '闪电额外多一条独立链' },
  { id: 'teslafork', name: '分叉雷电', req: ['tesla', 'split'],      desc: '闪电每次跳跃分叉命中两个目标' },
  { id: 'laserlens', name: '聚焦透镜', req: ['laser', 'pierce'],     desc: '激光宽度翻倍,灼烧穿透护盾' },
  { id: 'scatterstorm',name:'散射风暴',req: ['spread', 'rate'],      desc: '散射额外并发一轮,射速越高越密' }
];

const UPGRADE_MAP = {};
for (const u of UPGRADES) UPGRADE_MAP[u.id] = u;

/* ============================================================
 * 进化卡(传说):对应卡片满级后出现在升级三选一中,
 * 选中后该卡片"质变"——不占用槽位,提供质变级战力
 * ============================================================ */
const EVOLUTIONS = [
  { id: 'e_fusion',    base: 'dmg',      icon: '☄', name: '聚变弹头', desc: '伤害额外 +2,命中溅射周围敌人(50% 伤害)' },
  { id: 'e_overclock', base: 'rate',     icon: '⚙', name: '超频引擎', desc: '射击间隔额外 -25%' },
  { id: 'e_titan',     base: 'vitality', icon: '🧱', name: '泰坦血统', desc: '生命上限 +50,每波清版额外回复 15 点' },
  { id: 'e_quantum',   base: 'pierce',   icon: '⚛', name: '量子穿甲', desc: '贯穿 +2,子弹伤害 +1' },
  { id: 'e_executioner', base: 'crit',   icon: '☠', name: '处决者',   desc: '暴击率 +30%,暴击对精英与旗舰 +50% 伤害' },
  { id: 'e_rapture',   base: 'homing',   icon: '🌠', name: '天罚矩阵', desc: '追踪导弹数量 +3,伤害 +2' },
  { id: 'e_chain',     base: 'split',    icon: '❋', name: '链式裂变', desc: '裂变小弹再次分裂一次' },
  { id: 'e_aegis',     base: 'shieldgen',icon: '⚜', name: '圣盾爆发', desc: '护盾破碎时清除全屏弹幕并重创周围敌机' },
  { id: 'e_annihil',   base: 'laser',    icon: '🔆', name: '湮灭主炮', desc: '激光宽度 +60%,伤害 +40%' },
  { id: 'e_maelstrom', base: 'spread',   icon: '💫', name: '万弹齐发', desc: '散射弹丸 +6,且射程不再衰减' },
  { id: 'e_freeze',    base: 'time',     icon: '⏱', name: '时间冻结', desc: '每波开始时,敌方弹幕静止 2.5 秒' },
  { id: 'e_railstorm', base: 'railgun',  icon: '🌠', name: '磁暴风', desc: '轨道炮蓄力更快、弹体贯穿无限,命中引发链式爆轰' },
  { id: 'e_thunderlord',base: 'tesla',   icon: '🌩', name: '雷霆领主', desc: '闪电跳跃目标 +3,每跳附加麻痹减速' }
];

/* 加权抽卡:从未满级的卡片中按稀有度权重抽取 3 张(互不重复)
 * 等级越高,史诗权重略微上调;质变武器互斥;槽位满载时隐藏卡「基因扩展」进入卡池 */
function drawUpgradeCards(mods, maxSlots, level, evo, count = 3) {
  const ownedCount = UPGRADES.filter(u => (mods[u.id] || 0) > 0 && !u.hidden).length;
  const slotsFull = ownedCount >= maxSlots;
  const pathId = UPGRADES.find(u => u.path && (mods[u.id] || 0) > 0);
  const pathKey = pathId ? pathId.id : null;
  const pool = UPGRADES.filter(u =>
    (mods[u.id] || 0) < u.max &&
    !(u.path && pathKey && pathKey !== u.id) &&
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
  // 进化注入:已满级且未进化的卡片,其传说进化卡替换一张候选(必定露面);
  // 若常规卡池已耗尽但进化可拿,仍单独提供进化选项
  const evoReady = EVOLUTIONS.filter(e => (mods[e.base] || 0) >= UPGRADE_MAP[e.base].max && !(evo && evo[e.base]));
  if (evoReady.length) {
    const evo = evoReady[Math.floor(RNG() * evoReady.length)];
    if (picks.length) picks[Math.floor(RNG() * picks.length)] = Object.assign({ isEvo: true, rar: 3 }, evo);
    else picks.push(Object.assign({ isEvo: true, rar: 3 }, evo));
  }
  return picks;
}
