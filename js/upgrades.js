'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 肉鸽升级系统
 * 升级卡片池 / 羁绊定义 / 抽卡逻辑
 * v1.6.0 统一 5 级制:所有可升级卡片上限 5 级,
 *        5 级后再次抽到同卡即为「进化」(传说质变,每卡一条)
 * ============================================================ */

const RARITY = [
  { name: '普通', color: '#9fb8d0', weight: 60 },
  { name: '稀有', color: '#4db8ff', weight: 32 },
  { name: '史诗', color: '#c86bff', weight: 8 },
  { name: '传说', color: '#ffd166', weight: 0 }
];

/* 升级卡片:id / 图标 / 名称 / 最大层数(统一 5) / 稀有度(0普 1稀 2史) / 说明(按级数值)
 * hidden:true 为隐藏卡,仅在特定条件下进入卡池;path:true 为质变武器(互斥)
 * curse:true 为诅咒风险卡(逐级增益、逐级加重代价,进化可净化代价) */
const UPGRADES = [
  { id: 'dmg',      icon: '⚡', name: '火力强化',   max: 5, rar: 0, desc: '所有子弹伤害 +1' },
  { id: 'rate',     icon: '🔥', name: '急速射击',   max: 5, rar: 0, desc: '射击间隔 -12%' },
  { id: 'speed',    icon: '💨', name: '推进器',     max: 5, rar: 0, desc: '移动速度 +10%' },
  { id: 'magnet',   icon: '🧲', name: '引力场',     max: 5, rar: 0, desc: '道具与经验吸取范围 +45' },
  { id: 'xpchip',   icon: '🔷', name: '经验芯片',   max: 5, rar: 0, desc: '经验获取 +15%' },
  { id: 'combo',    icon: '♾️', name: '连击锁链',   max: 5, rar: 0, desc: '连击维持时间 +0.7 秒' },
  { id: 'vitality', icon: '❤️', name: '生命上限',   max: 5, rar: 0, desc: '生命上限 +20,并立即回复同量' },
  { id: 'multi',    icon: '⇈',  name: '并列弹道',   max: 5, rar: 1, desc: '增加 1 路并列主炮' },
  { id: 'side',     icon: '◎',  name: '侧翼弹',     max: 5, rar: 1, desc: '两侧各增加 1 对斜射弹' },
  { id: 'rear',     icon: '▼',  name: '尾炮',       max: 5, rar: 1, desc: '机尾向后追加 1 对炮弹' },
  { id: 'pierce',   icon: '➹',  name: '贯穿弹',     max: 5, rar: 1, desc: '子弹可穿透 +1 个目标' },
  { id: 'crit',     icon: '✖',  name: '要害打击',   max: 5, rar: 1, desc: '暴击率 +10%,造成 3 倍伤害' },
  { id: 'bombkill', icon: '💣', name: '歼灭装填',   max: 5, rar: 1, desc: '每击坠一批敌机获得 1 枚炸弹(升级缩短所需击坠)' },
  { id: 'thorn',    icon: '☢',  name: '反击风暴',   max: 5, rar: 1, desc: '受击清除周围弹幕并冲击波,升级增强范围与伤害' },
  { id: 'regen',    icon: '💠', name: '纳米修复',   max: 5, rar: 1, desc: '每秒回复 0.4 点生命' },
  { id: 'leech',    icon: '🩸', name: '击杀汲取',   max: 5, rar: 1, desc: '击坠敌机回复 0.45 点生命' },
  { id: 'armor',    icon: '🛡️', name: '复合装甲',   max: 5, rar: 1, desc: '受到伤害 -8%' },
  { id: 'split',    icon: '✷',  name: '裂变弹',     max: 5, rar: 2, desc: '子弹命中后分裂出 1 枚小弹' },
  { id: 'homing',   icon: '➤',  name: '追踪导弹',   max: 5, rar: 2, desc: '周期发射追踪导弹,升级增加数量与射速' },
  { id: 'shieldgen',icon: '◇',  name: '护盾发生器', max: 5, rar: 2, desc: '每 12 秒自动展开护盾,每级充能 -1 秒' },
  { id: 'undying',  icon: '🕊️', name: '不屈意志',   max: 5, rar: 2, desc: '受致命伤保留 2%×等级 生命并清除全屏弹幕(每局一次)' },
  { id: 'time',     icon: '⏳', name: '时滞力场',   max: 5, rar: 2, desc: '全部敌方弹幕减速 10%' },
  { id: 'wingman',  icon: '🛰', name: '幻影僚机',   max: 5, rar: 2, desc: '召唤僚机环绕,自动索敌射击' },
  { id: 'rift',     icon: '🌀', name: '空间裂隙',   max: 5, rar: 2, desc: '周期生成黑洞,升级增强半径与频率' },
  { id: 'laser',    icon: '🔦', name: '激光主炮',   max: 5, rar: 2, desc: '质变:贯穿激光束持续灼烧,升级增伤加宽', path: true },
  { id: 'spread',   icon: '🎇', name: '散射炮',     max: 5, rar: 2, desc: '质变:宽扇散射近程爆发,升级增加弹丸', path: true },
  { id: 'railgun',  icon: '🌩', name: '轨道炮',     max: 5, rar: 2, desc: '质变:蓄力磁轨弹单发高伤,升级增伤缩蓄力', path: true },
  { id: 'tesla',    icon: '⚡', name: '电弧发生器', max: 5, rar: 2, desc: '质变:链式闪电敌群跳跃,升级增加链数', path: true },
  { id: 'boomer',   icon: '↻',  name: '回旋刃',     max: 5, rar: 2, desc: '质变:双程回旋刃双重切割,升级增伤提速', path: true },
  { id: 'glass',    icon: '💥', name: '玻璃大炮',   max: 5, rar: 2, curse: true, desc: '诅咒:所有伤害 +20%/级,生命上限 -8%/级' },
  { id: 'brittle',  icon: '🗡️', name: '脆刃',       max: 5, rar: 2, curse: true, desc: '诅咒:暴击率 +6%/级,受伤 ×(1+10%×等级)' },
  { id: 'pact',     icon: '📜', name: '贪婪契约',   max: 5, rar: 2, curse: true, desc: '诅咒:得分与星晶 +10%/级,敌弹速度 +3%/级' },
  { id: 'slotplus', icon: '🧬', name: '基因扩展',   max: 5, rar: 2, desc: '隐藏卡:强化槽位 +1', hidden: true }
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
  { id: 'chrono',   name: '时间领主', req: ['time', 'rate'],        desc: '时滞效果提升至每层 16%(上限 62%)' },
  { id: 'focus',    name: '聚能协议', req: ['laser', 'dmg'],        desc: '激光伤害 +60%' },
  { id: 'suppress', name: '压制弹幕', req: ['spread', 'side'],      desc: '散射与侧翼弹丸数 +2' },
  { id: 'symbiosis',name: '生机涌动', req: ['shieldgen', 'regen'],  desc: '护盾破碎时回复 15 点生命' },
  { id: 'ironwill', name: '荆棘装甲', req: ['armor', 'thorn'],      desc: '受击时回复 5 点生命' },
  { id: 'bloodrush',name: '血怒共振', req: ['leech', 'crit'],       desc: '暴击时额外回复 2 点生命' },
  // 质变武器专属羁绊
  { id: 'railcrit', name: '穿甲协议', req: ['railgun', 'crit'],     desc: '轨道炮蓄力更快,必定暴击' },
  { id: 'railpierce',name:'无阻贯通', req: ['railgun', 'pierce'],   desc: '轨道炮弹体贯穿无限,伤害随贯穿层叠加' },
  { id: 'teslachain',name:'雷网',     req: ['tesla', 'multi'],      desc: '闪电额外多一条独立链' },
  { id: 'teslafork', name: '分叉雷电', req: ['tesla', 'split'],      desc: '闪电每次跳跃分叉命中两个目标' },
  { id: 'laserlens', name: '聚焦透镜', req: ['laser', 'pierce'],     desc: '激光宽度翻倍,灼烧穿透护盾' },
  { id: 'scatterstorm',name:'散射风暴',req: ['spread', 'rate'],      desc: '散射额外并发一轮,射速越高越密' },
  // 回旋刃专属羁绊
  { id: 'boomerch',  name: '疾风投掷', req: ['boomer', 'rate'],      desc: '回旋刃投掷间隔额外 -25%' },
  { id: 'voidedge',  name: '虚空之刃', req: ['boomer', 'crit'],      desc: '回旋刃暴击率 ×1.5' }
];

const UPGRADE_MAP = {};
for (const u of UPGRADES) UPGRADE_MAP[u.id] = u;

/* ============================================================
 * 进化卡(传说):每张卡片各有一条进化线。
 * 卡片升至 5 级后再次抽到同卡,即弹出对应进化——
 * 选中后质变(不占槽位),诅咒卡的进化会净化其代价。
 * ============================================================ */
const EVOLUTIONS = [
  { id: 'e_fusion',    base: 'dmg',      icon: '☄', name: '聚变弹头', desc: '伤害额外 +2,命中溅射周围敌人(50% 伤害)' },
  { id: 'e_overclock', base: 'rate',     icon: '⚙', name: '超频引擎', desc: '射击间隔额外 -25%' },
  { id: 'e_comet',     base: 'speed',    icon: '☄', name: '彗星引擎', desc: '移动速度额外 +25%' },
  { id: 'e_singularity', base: 'magnet', icon: '🌀', name: '奇点磁场', desc: '磁吸范围额外 +80%' },
  { id: 'e_neuro',     base: 'xpchip',   icon: '🧠', name: '神经同步', desc: '经验获取额外 +40%' },
  { id: 'e_eternity',  base: 'combo',    icon: '♾️', name: '永恒连锁', desc: '连击维持时间额外 +2 秒' },
  { id: 'e_titan',     base: 'vitality', icon: '🧱', name: '泰坦血统', desc: '生命上限 +50,过波额外回复 15 点' },
  { id: 'e_volley',    base: 'multi',    icon: '⇈',  name: '万炮齐发', desc: '并列弹道额外 +1 路,所有伤害 +1' },
  { id: 'e_twinwing',  base: 'side',     icon: '🪽', name: '双子侧翼', desc: '侧翼弹额外 +2 对,且获得 1 次贯穿' },
  { id: 'e_dragontail', base: 'rear',    icon: '🐲', name: '龙鳞尾炮', desc: '尾炮弹丸翻倍,且获得 2 次贯穿' },
  { id: 'e_quantum',   base: 'pierce',   icon: '⚛', name: '量子穿甲', desc: '贯穿 +2,子弹伤害 +1' },
  { id: 'e_executioner', base: 'crit',   icon: '☠', name: '处决者',   desc: '暴击率 +30%,暴击对精英与旗舰 +50% 伤害' },
  { id: 'e_arsenal',   base: 'bombkill', icon: '📦', name: '随军军械库', desc: '炸弹上限 +1,装填所需击坠 -5' },
  { id: 'e_bramble',   base: 'thorn',    icon: '🌵', name: '荆棘领域', desc: '冲击波范围 +60 且伤害翻倍' },
  { id: 'e_tide',      base: 'regen',    icon: '🌊', name: '纳米潮汐', desc: '回复量翻倍,过波额外回复 10 点' },
  { id: 'e_feast',     base: 'leech',    icon: '🍷', name: '血之盛宴', desc: '击坠汲取量翻倍' },
  { id: 'e_bulwark',   base: 'armor',    icon: '🗿', name: '泰坦装甲', desc: '减伤额外 +12%,减伤上限提升至 62%' },
  { id: 'e_chain',     base: 'split',    icon: '❋', name: '链式裂变', desc: '裂变小弹再次分裂一次' },
  { id: 'e_rapture',   base: 'homing',   icon: '🌠', name: '天罚矩阵', desc: '追踪导弹数量 +3,伤害 +2' },
  { id: 'e_aegis',     base: 'shieldgen',icon: '⚜', name: '圣盾爆发', desc: '护盾破碎时清除全屏弹幕并重创周围敌机' },
  { id: 'e_guardian',  base: 'undying',  icon: '👼', name: '守护天使', desc: '不屈意志可发动 2 次,发动时额外无敌 1 秒' },
  { id: 'e_freeze',    base: 'time',     icon: '⏱', name: '时间冻结', desc: '每波开始时,敌方弹幕静止 2.5 秒' },
  { id: 'e_squadron',  base: 'wingman',  icon: '🛸', name: '幽灵中队', desc: '+2 架僚机,僚机伤害 +1' },
  { id: 'e_collapse',  base: 'rift',     icon: '🕳', name: '引力坍缩', desc: '裂隙半径 +40,生成间隔 -2 秒' },
  { id: 'e_annihil',   base: 'laser',    icon: '🔆', name: '湮灭主炮', desc: '激光宽度 +60%,伤害 +40%' },
  { id: 'e_maelstrom', base: 'spread',   icon: '💫', name: '万弹齐发', desc: '散射弹丸 +6,且射程不再衰减' },
  { id: 'e_railstorm', base: 'railgun',  icon: '🌠', name: '磁暴风', desc: '轨道炮蓄力更快、弹体贯穿无限,命中引发链式爆轰' },
  { id: 'e_thunderlord',base: 'tesla',   icon: '🌩', name: '雷霆领主', desc: '闪电跳跃目标 +3,每跳附加麻痹减速' },
  { id: 'e_vortex',    base: 'boomer',   icon: '🌪', name: '龙卷之核', desc: '回旋刃伤害 +30%,体积增大,投掷与折返更快' },
  { id: 'e_tempered',  base: 'glass',    icon: '🔮', name: '淬炼结晶', desc: '诅咒进化:伤害加成保留,生命惩罚减半' },
  { id: 'e_perfected', base: 'brittle',  icon: '💠', name: '完璧之刃', desc: '诅咒进化:暴击加成保留,受伤惩罚减半' },
  { id: 'e_gilded',    base: 'pact',     icon: '🥇', name: '黄金契约', desc: '诅咒进化:增益保留,敌弹加速惩罚减半' },
  { id: 'e_genesis',   base: 'slotplus', icon: '🧬', name: '无限基因', desc: '强化槽位额外 +1' }
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
  const cardWeight = (u) => u.curse ? 12 : (weights[u.rar] + (u.hidden ? 45 : 0)); // 诅咒卡固定低权重
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
  // 进化注入:已满级(5 级)且未进化的卡片,其传说进化卡替换一张候选(必定露面);
  // 若常规卡池已耗尽但进化可拿,仍单独提供进化选项
  const evoReady = EVOLUTIONS.filter(e => (mods[e.base] || 0) >= UPGRADE_MAP[e.base].max && !(evo && evo[e.base]));
  if (evoReady.length) {
    const evoPick = evoReady[Math.floor(RNG() * evoReady.length)];
    if (picks.length) picks[Math.floor(RNG() * picks.length)] = Object.assign({ isEvo: true, rar: 3 }, evoPick);
    else picks.push(Object.assign({ isEvo: true, rar: 3 }, evoPick));
  }
  return picks;
}
