'use strict';
/* ============================================================
 * 深空突袭 DEEP STRIKE — 精灵预渲染管线(v4.0.0 自 entities.js 拆出并重构)
 * 硬科幻机甲分层建模:金属渐变装甲 / 装甲缝线分件 / 径向发光核心 / 边缘灯点。
 * 带 shadowBlur 的静态机体只绘制一次到离屏画布,运行时 drawImage 贴图,
 * 避免逐帧 shadowBlur 的巨大开销;shade() 为十六进制颜色明暗调整工具。
 * ============================================================ */
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const gg = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return 'rgb(' + r + ',' + gg + ',' + b + ')';
}

function makeSprite(half, paint) {
  const c = document.createElement('canvas');
  c.width = c.height = half * 4;   // 2x 超采样
  const g = c.getContext('2d');
  g.scale(2, 2);
  g.translate(half, half);
  paint(g);
  return c;
}

const SPRITES = { enemy: {}, power: {} };

function initSprites() {
  const enemyPaint = (color, fill, path, dotR, dotY) => (g) => {
    g.shadowColor = color; g.shadowBlur = 9;
    g.beginPath(); path(g); g.closePath();
    // 硬科幻分层:金属渐变装甲(顶亮 → 基色 → 底暗)
    const grad = g.createLinearGradient(0, -18, 0, 18);
    grad.addColorStop(0, shade(fill, 1.8));
    grad.addColorStop(0.55, fill);
    grad.addColorStop(1, shade(fill, 0.5));
    g.fillStyle = grad; g.fill();
    g.lineWidth = 2; g.strokeStyle = color; g.stroke();
    g.shadowBlur = 0;
    // 装甲缝线:纵向中线分件
    g.save();
    g.strokeStyle = shade(fill, 2.0); g.lineWidth = 1;
    g.globalAlpha = 0.5;
    g.beginPath(); g.moveTo(0, -15); g.lineTo(0, 15); g.stroke();
    g.restore();
    // 径向发光核心(白心 → 主色 → 消散)
    const core = g.createRadialGradient(0, dotY, 0, 0, dotY, dotR * 2.6);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, color);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = core;
    g.beginPath(); g.arc(0, dotY, dotR * 2.6, 0, TAU); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(0, dotY, dotR * 0.55, 0, TAU); g.fill();
  };
  const enemyDefs = {
    drone:  { color: '#ff4d6d', fill: '#42101d', half: 22, baseR: 11, dotR: 3, dotY: 0,
      path: (g) => { g.moveTo(0, 12); g.lineTo(10, -9); g.lineTo(0, -4); g.lineTo(-10, -9); } },
    waver:  { color: '#ff7ab8', fill: '#40152c', half: 24, baseR: 13, dotR: 3, dotY: 1,
      path: (g) => { g.moveTo(0, 14); g.lineTo(11, 0); g.lineTo(0, -11); g.lineTo(-11, 0); } },
    tank:   { color: '#ff9a3c', fill: '#40230c', half: 32, baseR: 21, dotR: 6, dotY: 1,
      path: (g) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; const px = Math.cos(a) * 21, py = Math.sin(a) * 21; i ? g.lineTo(px, py) : g.moveTo(px, py); } } },
    bomber: { color: '#ff6a3c', fill: '#40180c', half: 18, baseR: 9, dotR: 2.5, dotY: -1,
      path: (g) => { g.moveTo(0, 11); g.lineTo(9, -8); g.lineTo(0, -3); g.lineTo(-9, -8); } },
    shielder: { color: '#5ad0ff', fill: '#0e2c40', half: 26, baseR: 15, dotR: 5, dotY: 0,
      path: (g) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const px = Math.cos(a) * 15, py = Math.sin(a) * 15; i ? g.lineTo(px, py) : g.moveTo(px, py); } } },
    mender: { color: '#7dff9e', fill: '#103a1e', half: 24, baseR: 13, dotR: 4, dotY: 0,
      path: (g) => { for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; const px = Math.cos(a) * 13, py = Math.sin(a) * 13; i ? g.lineTo(px, py) : g.moveTo(px, py); } } },
    sniper: { color: '#c86bff', fill: '#2a1240', half: 24, baseR: 13, dotR: 3, dotY: 1,
      path: (g) => { g.moveTo(0, 13); g.lineTo(10, -10); g.lineTo(0, -3); g.lineTo(-10, -10); } },
    // 母舰:宽扁的六边形战舰,携带机库舱格,周期释放无人机
    carrier: { color: '#8fd0ff', fill: '#0c2438', half: 40, baseR: 26, dotR: 5, dotY: 0,
      path: (g) => { g.moveTo(-24, -8); g.lineTo(24, -8); g.lineTo(28, 4); g.lineTo(14, 12); g.lineTo(-14, 12); g.lineTo(-28, 4); } },
    // 干扰机:碟形天线机体,悬停释放电磁脉冲干扰玩家
    jammer: { color: '#b0ff5a', fill: '#223a10', half: 24, baseR: 13, dotR: 4, dotY: 0,
      path: (g) => { g.moveTo(-11, -4); g.lineTo(0, -12); g.lineTo(11, -4); g.lineTo(11, 6); g.lineTo(0, 13); g.lineTo(-11, 6); } }
  };
  for (const [type, d] of Object.entries(enemyDefs)) {
    SPRITES.enemy[type] = {
      baseR: d.baseR, half: d.half,
      body: makeSprite(d.half, enemyPaint(d.color, d.fill, d.path, d.dotR, d.dotY)),
      flash: makeSprite(d.half, enemyPaint('#ffffff', '#ffffff', d.path, d.dotR, d.dotY))
    };
  }
  // 玩家机体(引擎火焰/护盾/判定点动态绘制)
  SPRITES.player = {
    half: 30,
    body: makeSprite(30, (g) => {
      g.shadowColor = '#37e2ff'; g.shadowBlur = 14;
      g.beginPath();
      g.moveTo(0, -17); g.lineTo(9, 4); g.lineTo(14, 11); g.lineTo(5, 8);
      g.lineTo(0, 12); g.lineTo(-5, 8); g.lineTo(-14, 11); g.lineTo(-9, 4);
      g.closePath();
      const pg = g.createLinearGradient(0, -17, 0, 12);
      pg.addColorStop(0, shade('#0f4b66', 1.9));
      pg.addColorStop(0.5, '#0f4b66');
      pg.addColorStop(1, shade('#0f4b66', 0.55));
      g.fillStyle = pg; g.fill();
      g.lineWidth = 2; g.strokeStyle = '#7ef3ff'; g.stroke();
      g.shadowBlur = 0;
      // 座舱:径向高光玻璃
      const cp = g.createRadialGradient(-0.8, -5, 0, 0, -4, 3.4);
      cp.addColorStop(0, '#ffffff');
      cp.addColorStop(0.4, '#d9fbff');
      cp.addColorStop(1, 'rgba(20,90,120,0.9)');
      g.fillStyle = cp;
      g.beginPath(); g.arc(0, -4, 3, 0, TAU); g.fill();
      // 双引擎喷口
      g.fillStyle = '#37e2ff';
      g.fillRect(-6, 8, 3.4, 4);
      g.fillRect(2.6, 8, 3.4, 4);
    })
  };
  // BOSS 舰体(旋转外环与核心动态绘制,双变体配色)
  SPRITES.boss = {};
  for (const [vname, vcfg] of Object.entries(BOSS_VARIANTS)) {
    SPRITES.boss[vname] = {
      half: 84,
      body: makeSprite(84, (g) => {
        g.shadowColor = vcfg.glow; g.shadowBlur = 22;
        const hexPath = (r) => {
          g.beginPath();
          for (let i = 0; i < 6; i++) {
            const a = i / 6 * TAU + Math.PI / 6;
            const px = Math.cos(a) * r, py = Math.sin(a) * r;
            i ? g.lineTo(px, py) : g.moveTo(px, py);
          }
          g.closePath();
        };
        // 大舰体:金属渐变装甲
        hexPath(44);
        const grad = g.createLinearGradient(0, -44, 0, 44);
        grad.addColorStop(0, shade(vcfg.hull, 1.8));
        grad.addColorStop(0.55, vcfg.hull);
        grad.addColorStop(1, shade(vcfg.hull, 0.5));
        g.fillStyle = grad; g.fill();
        g.lineWidth = 3; g.strokeStyle = vcfg.color; g.stroke();
        g.shadowBlur = 0;
        // 装甲分块:内六边形缝线 + 纵横缝线
        g.save();
        g.strokeStyle = shade(vcfg.hull, 2.1); g.lineWidth = 1.2;
        g.globalAlpha = 0.5;
        hexPath(30); g.stroke();
        g.beginPath(); g.moveTo(0, -44); g.lineTo(0, 44); g.stroke();
        g.beginPath(); g.moveTo(-44, 0); g.lineTo(44, 0); g.stroke();
        g.restore();
        // 两侧炮塔:渐变基座 + 炮口
        for (const sx of [-54, 40]) {
          const tg = g.createLinearGradient(sx, -8, sx + 14, 18);
          tg.addColorStop(0, shade(vcfg.turret, 1.6));
          tg.addColorStop(1, shade(vcfg.turret, 0.6));
          g.fillStyle = tg;
          g.fillRect(sx, -8, 14, 26);
          g.strokeStyle = vcfg.color; g.lineWidth = 1.5;
          g.strokeRect(sx, -8, 14, 26);
          g.fillStyle = vcfg.color;
          g.fillRect(sx + 4, 14, 6, 8);
        }
        // 中央大核心:径向发光
        const core = g.createRadialGradient(0, 0, 0, 0, 0, 20);
        core.addColorStop(0, '#ffffff');
        core.addColorStop(0.3, vcfg.color);
        core.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = core;
        g.beginPath(); g.arc(0, 0, 20, 0, TAU); g.fill();
        // 边缘灯点:六角顶点
        g.fillStyle = shade(vcfg.color, 1.4);
        for (let i = 0; i < 6; i++) {
          const a = i / 6 * TAU + Math.PI / 6;
          g.beginPath(); g.arc(Math.cos(a) * 40, Math.sin(a) * 40, 2.2, 0, TAU); g.fill();
        }
      })
    };
  }
  // 道具盒
  for (const [type, cfg] of Object.entries(PowerUp.CFG)) {
    SPRITES.power[type] = {
      half: 28,
      c: makeSprite(28, (g) => {
        g.shadowColor = cfg.color; g.shadowBlur = 14;
        roundRectPath(g, -11, -11, 22, 22, 5);
        g.fillStyle = '#0b1220'; g.fill();
        g.lineWidth = 2; g.strokeStyle = cfg.color; g.stroke();
        g.shadowBlur = 0;
        g.fillStyle = cfg.color;
        g.font = 'bold 13px "Segoe UI", sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(cfg.label, 0, 1);
      })
    };
  }
}

initSprites();
