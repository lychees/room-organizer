// 商店模块 —— 100+ 种可购买家具（模拟人生式）
import * as THREE from 'three';
import { makeBox, makeCyl } from './room.js';

// ---------- 音效 ----------
let audioCtx = null;
function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}
export function beep(freq = 440, dur = 0.08, type = 'square', vol = 0.05) {
  try {
    const a = audio();
    const o = a.createOscillator(), g = a.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
    o.connect(g).connect(a.destination);
    o.start(); o.stop(a.currentTime + dur);
  } catch { /* 无音频环境时忽略 */ }
}

// ---------- 基础工具 ----------
function canvasTex(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return { canvas, g: canvas.getContext('2d'), tex: new THREE.CanvasTexture(canvas) };
}
function B(w, h, d, c) { return makeBox(w, h, d, c); }
function C(rt, rb, h, c, seg = 16) { return makeCyl(rt, rb, h, c, seg); }
function S(r, c, seg = 14) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(8, seg - 2)),
    new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  m.castShadow = true; return m;
}
function add(g, m, x, y, z, ry = 0, rx = 0) {
  m.position.set(x, y, z);
  if (ry) m.rotation.y = ry;
  if (rx) m.rotation.x = rx;
  g.add(m); return m;
}
function legs4(g, w, d, h, t, c) {
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
    add(g, B(t, h, t, c), sx * (w / 2 - t / 2 - 0.02), h / 2, sz * (d / 2 - t / 2 - 0.02));
}

// ---------- 交互动作工厂 ----------
function actMsg(ctx, g, meshes, prompt, message, pitch = 520) {
  return {
    pos: g.position, meshes,
    getPrompt: () => `按 <b>E</b> ${prompt}`,
    action: () => { ctx.flashMessage(message); beep(pitch, 0.1, 'sine', 0.05); },
  };
}
function actToggle(g, meshes, onPrompt, offPrompt, fn) {
  let on = false;
  return {
    pos: g.position, meshes,
    getPrompt: () => on ? `按 <b>E</b> ${offPrompt}` : `按 <b>E</b> ${onPrompt}`,
    action: () => { on = !on; fn(on); },
  };
}
function lightAct(g, shadeMesh, light, onPrompt = '开灯', offPrompt = '关灯') {
  return actToggle(g, [shadeMesh], onPrompt, offPrompt, on => {
    light.intensity = on ? 20 : 0;
    shadeMesh.material.emissive.setHex(on ? 0xffdca0 : 0x000000);
    shadeMesh.material.emissiveIntensity = on ? 0.7 : 0;
    beep(on ? 660 : 330, 0.06, 'sine', 0.04);
  });
}
function doorAct(g, pivot, mesh, angle = 1.9, what = '柜门') {
  return actToggle(g, [mesh], `打开${what}`, `关上${what}`, on => {
    pivot.rotation.y = on ? angle : 0;
    beep(on ? 500 : 300, 0.05, 'square', 0.03);
  });
}
function lidAct(g, lid, what = '盖子', openRx = -1.1) {
  return actToggle(g, [lid], `打开${what}`, `盖上${what}`, on => {
    lid.rotation.x = on ? openRx : 0;
    beep(on ? 560 : 320, 0.05, 'square', 0.03);
  });
}
function drawerAct(g, drawer, dist = 0.35) {
  return actToggle(g, [drawer], '拉开抽屉', '推上抽屉', on => {
    drawer.position.z = on ? dist : 0;
    beep(on ? 420 : 260, 0.05, 'square', 0.03);
  });
}
function musicAct(g, meshes, notes, wave = 'triangle', iv = 190, label = '播放音乐 🎵') {
  let timer = null, step = 0;
  return actToggle(g, meshes, label, '停止演奏', on => {
    if (on) timer = setInterval(() => beep(notes[step++ % notes.length], iv / 1000 * 0.85, wave, 0.045), iv);
    else clearInterval(timer);
  });
}
function screenAct(g, mesh, mat, label = '电视', onHex = 0x3a6ea8, onColor = 0x88bbee) {
  return actToggle(g, [mesh], `打开${label}`, `关掉${label}`, on => {
    mat.emissive.setHex(on ? onHex : 0x000000);
    mat.emissiveIntensity = on ? 1.1 : 0;
    mat.color.setHex(on ? onColor : 0x111111);
    beep(on ? 760 : 240, 0.08, 'sine', 0.05);
  });
}
function plantAct(ctx, g, leaves, message = '🌱 植物喝饱了水，更有精神了！') {
  return {
    pos: g.position, meshes: [leaves],
    getPrompt: () => '按 <b>E</b> 浇水',
    action: () => {
      leaves.scale.setScalar(1.22);
      ctx.flashMessage(message);
      beep(700, 0.08, 'sine', 0.04);
      setTimeout(() => leaves.scale.setScalar(1), 600);
    },
  };
}
function bookStorageAct(ctx, g, slotLocals) {
  const slots = slotLocals.map(l => ({ local: l, used: false }));
  return {
    pos: g.position, meshes: [g],
    getPrompt: () => ctx.carrying?.type === 'book' ? '按 <b>E</b> 把书放上去' : null,
    action: () => {
      const slot = slots.find(s => !s.used);
      if (!slot) { ctx.flashMessage('这里已经放满啦'); return; }
      slot.used = true;
      const book = ctx.carrying;
      ctx.dropCarried();
      g.updateMatrixWorld(true);
      book.mesh.position.copy(g.localToWorld(slot.local.clone()));
      book.mesh.position.x += Math.random() * 0.25;
      book.mesh.rotation.set(0, g.rotation.y, 0);
      g.parent.add(book.mesh);
      book.placed = true;
      book.task.done = true;
      ctx.onProgress();
    },
  };
}

// ============================================================
//  特殊家具：电脑桌 / 弹珠台（带动画）
// ============================================================
function buildComputer(ctx) {
  const group = new THREE.Group();
  add(group, B(1.3, 0.06, 0.7, 0x8a5f38), 0, 0.74, 0);
  legs4(group, 1.24, 0.64, 0.74, 0.06, 0x6b4527);
  add(group, B(0.1, 0.14, 0.1, 0x333333), 0, 0.84, -0.18);
  const monitor = add(group, B(0.58, 0.38, 0.05, 0x222222), 0, 1.06, -0.18);
  const { g, tex } = canvasTex(256, 160);
  add(group, new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32),
    new THREE.MeshBasicMaterial({ map: tex })), 0, 1.06, -0.151);
  add(group, B(0.4, 0.02, 0.14, 0xdddddd), 0, 0.78, 0.1);
  add(group, B(0.05, 0.02, 0.08, 0xdddddd), 0.32, 0.78, 0.1);
  add(group, B(0.18, 0.4, 0.4, 0x2b2b3d), 0.5, 0.2, -0.1);

  let on = false, acc = 0;
  const drops = Array.from({ length: 16 }, () => Math.random() * 20);
  function drawOff() {
    g.fillStyle = '#0a0a12'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#333'; g.font = '14px monospace'; g.textAlign = 'center';
    g.fillText('已关机 · 按 E 开机', 128, 84);
    tex.needsUpdate = true;
  }
  function drawOn(dt) {
    g.fillStyle = 'rgba(4,16,8,0.25)'; g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#39ff6a'; g.font = '12px monospace'; g.textAlign = 'left';
    for (let i = 0; i < drops.length; i++) {
      drops[i] += dt * (6 + (i % 5) * 3);
      if (drops[i] * 12 > 176) drops[i] = 0;
      g.fillText(String.fromCharCode(0x30a0 + Math.floor(Math.random() * 90)), i * 16, drops[i] * 12);
    }
    g.fillStyle = '#0a2a14'; g.fillRect(0, 140, 256, 20);
    g.fillStyle = '#39ff6a';
    g.fillText('> 正在整理房间数据' + '.'.repeat(1 + Math.floor(acc * 2) % 3), 8, 154);
    tex.needsUpdate = true;
  }
  drawOff();
  return {
    group, foot: { w: 1.3, d: 0.75 },
    updater(dt) { if (on) { acc += dt; drawOn(dt); } },
    interactables: [{
      pos: group.position, meshes: [monitor],
      getPrompt: () => on ? '按 <b>E</b> 关闭电脑' : '按 <b>E</b> 使用电脑',
      action: () => { on = !on; beep(on ? 880 : 220, 0.12, 'sine', 0.06); if (!on) drawOff(); },
    }],
  };
}

function buildPinball(ctx) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb03a4a, roughness: 0.5 });
  for (const [lx, lz] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]])
    add(group, C(0.03, 0.03, 0.72, 0x888888, 10), lx, 0.36, lz);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 1.4), bodyMat);
  body.position.y = 0.85; body.rotation.x = -0.07; body.castShadow = true; group.add(body);
  const pf = canvasTex(192, 320);
  add(group, new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.25),
    new THREE.MeshBasicMaterial({ map: pf.tex })), 0, 1.008, 0.048, 0, -Math.PI / 2 - 0.07);
  add(group, B(0.75, 0.65, 0.15, 0x8c2f3d), 0, 1.55, -0.72);
  const sc = canvasTex(192, 96);
  add(group, new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32),
    new THREE.MeshBasicMaterial({ map: sc.tex })), 0, 1.58, -0.64);

  function drawPF() {
    const g = pf.g;
    const grad = g.createLinearGradient(0, 0, 0, 320);
    grad.addColorStop(0, '#1a2a6c'); grad.addColorStop(1, '#2a0a3c');
    g.fillStyle = grad; g.fillRect(0, 0, 192, 320);
    for (const [x, y, r, c] of [[50, 90, 16, '#ffd54a'], [140, 80, 13, '#4fc3f7'], [96, 160, 18, '#ef5350'], [40, 220, 11, '#9ccc65'], [150, 230, 11, '#ba68c8']]) {
      g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, r * 0.4, 0, 7); g.fill();
    }
    g.strokeStyle = '#ffd54a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(30, 320); g.lineTo(80, 270); g.stroke();
    g.beginPath(); g.moveTo(162, 320); g.lineTo(112, 270); g.stroke();
  }
  function drawScore(txt, color = '#ffd54a') {
    const g = sc.g;
    g.fillStyle = '#12060a'; g.fillRect(0, 0, 192, 96);
    g.fillStyle = color; g.font = 'bold 30px monospace'; g.textAlign = 'center';
    g.fillText(txt, 96, 56);
    g.font = '12px monospace'; g.fillText('★ PINBALL ★', 96, 82);
    sc.tex.needsUpdate = true;
  }
  drawPF(); pf.tex.needsUpdate = true; drawScore('READY');

  let playing = false, t = 0, score = 0;
  const ball = { x: 96, y: 280, vx: 60, vy: -140 };
  const bumpers = [[50, 90, 16], [140, 80, 13], [96, 160, 18], [40, 220, 11], [150, 230, 11]];
  return {
    group, foot: { w: 0.85, d: 1.5 },
    updater(dt) {
      if (!playing) return;
      t += dt;
      ball.vy += 160 * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < 8 || ball.x > 184) { ball.vx *= -1; ball.x = THREE.MathUtils.clamp(ball.x, 8, 184); }
      if (ball.y < 8) ball.vy *= -1;
      if (ball.y > 312) { ball.y = 312; ball.vy = -Math.abs(ball.vy) * 0.9 - 60; beep(150, 0.06); }
      for (const [bx, by, br] of bumpers) {
        const dx = ball.x - bx, dy = ball.y - by, d = Math.hypot(dx, dy);
        if (d < br + 5) {
          const nx = dx / d, ny = dy / d, dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
          ball.x = bx + nx * (br + 6); ball.y = by + ny * (br + 6);
          score += 120; beep(300 + Math.random() * 700, 0.05, 'square', 0.04);
        }
      }
      score += Math.floor(dt * 60);
      drawPF();
      const g = pf.g;
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(ball.x, ball.y, 5, 0, 7); g.fill();
      g.shadowColor = '#fff'; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0;
      pf.tex.needsUpdate = true;
      drawScore(String(score).padStart(6, '0'), Math.floor(t * 6) % 2 ? '#ffd54a' : '#4fc3f7');
      bodyMat.emissive.setHSL((t * 0.5) % 1, 0.7, 0.15);
      if (t > 8) {
        playing = false;
        bodyMat.emissive.setHex(0x000000);
        drawScore(String(score).padStart(6, '0'), '#39ff6a');
        ctx.flashMessage(`🎰 弹珠台得分：${score}！`);
        beep(660, 0.15, 'sine', 0.07); setTimeout(() => beep(880, 0.25, 'sine', 0.07), 160);
      }
    },
    interactables: [{
      pos: group.position, meshes: [body],
      getPrompt: () => playing ? null : '按 <b>E</b> 玩弹珠台 🎰',
      action: () => {
        playing = true; t = 0; score = 0;
        ball.x = 96; ball.y = 280; ball.vx = 60 * (Math.random() > 0.5 ? 1 : -1); ball.vy = -140;
        beep(440, 0.1, 'sawtooth', 0.06);
      },
    }],
  };
}

// ============================================================
//  参数化家具生成器
// ============================================================

// ---------- 桌类 ----------
function gTable(o) {
  return (ctx) => {
    const g = new THREE.Group();
    if (o.round) {
      const topMat = o.glass
        ? new THREE.MeshStandardMaterial({ color: 0xbfe8ef, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.6 })
        : undefined;
      const top = new THREE.Mesh(new THREE.CylinderGeometry(o.r, o.r, 0.05, 28), topMat ?? undefined);
      if (!topMat) { top.material = new THREE.MeshStandardMaterial({ color: o.top, roughness: 0.7 }); }
      top.castShadow = true; add(g, top, 0, o.h, 0);
      add(g, C(0.06, 0.08, o.h, o.leg), 0, o.h / 2, 0);
      add(g, C(0.3, 0.35, 0.05, o.leg), 0, 0.03, 0);
    } else {
      add(g, B(o.w, 0.06, o.d, o.top), 0, o.h, 0);
      legs4(g, o.w, o.d, o.h, o.legT ?? 0.07, o.leg);
    }
    const w = o.round ? o.r * 2 : o.w, d = o.round ? o.r * 2 : o.d;
    return { group: g, foot: { w, d }, interactables: [actMsg(ctx, g, [g.children[0]], '擦擦桌子', '🧽 桌子被擦得闪闪发亮！', 600)] };
  };
}

// ---------- 椅类 ----------
function gChair(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const seatY = o.seatY ?? 0.46;
    if (o.style === 'stool') {
      add(g, C(0.21, 0.21, 0.06, o.cushion), 0, seatY, 0);
      add(g, C(0.03, 0.03, seatY, o.frame), 0, seatY / 2, 0);
      add(g, C(0.2, 0.24, 0.04, o.frame), 0, 0.02, 0);
    } else if (o.style === 'office' || o.style === 'gaming') {
      add(g, B(0.5, 0.08, 0.48, o.cushion), 0, seatY, 0);
      const back = add(g, B(0.48, o.style === 'gaming' ? 0.8 : 0.55, 0.08, o.cushion), 0, seatY + (o.style === 'gaming' ? 0.45 : 0.32), -0.22);
      if (o.style === 'gaming') back.material.color.setHex(o.accent ?? 0xd94040);
      add(g, C(0.04, 0.04, seatY - 0.1, o.frame), 0, (seatY - 0.1) / 2 + 0.05, 0);
      for (let i = 0; i < 5; i++) add(g, B(0.28, 0.04, 0.05, o.frame), Math.cos(i * 1.256) * 0.14, 0.03, Math.sin(i * 1.256) * 0.14, -i * 1.256);
      add(g, B(0.5, 0.05, 0.1, o.cushion), -0.28, seatY + 0.16, 0);
      add(g, B(0.5, 0.05, 0.1, o.cushion), 0.28, seatY + 0.16, 0);
    } else if (o.style === 'bench') {
      add(g, B(o.len ?? 1.2, 0.07, 0.35, o.cushion), 0, seatY, 0);
      legs4(g, o.len ?? 1.2, 0.35, seatY, 0.06, o.frame);
    } else if (o.style === 'rocking') {
      add(g, B(0.5, 0.06, 0.48, o.cushion), 0, seatY, 0);
      add(g, B(0.5, 0.55, 0.06, o.cushion), 0, seatY + 0.3, -0.24, 0, -0.15);
      for (const sx of [-1, 1]) {
        add(g, B(0.05, 0.3, 0.05, o.frame), sx * 0.22, seatY - 0.15, -0.15);
        add(g, B(0.05, 0.3, 0.05, o.frame), sx * 0.22, seatY - 0.15, 0.15);
        const rail = add(g, B(0.05, 0.05, 0.8, o.frame), sx * 0.22, 0.06, 0);
        rail.rotation.x = 0.1;
      }
    } else { // wood / cushion
      add(g, B(0.44, 0.06, 0.44, o.cushion ?? o.frame), 0, seatY, 0);
      add(g, B(0.44, 0.5, 0.06, o.cushion ?? o.frame), 0, seatY + 0.28, -0.19);
      legs4(g, 0.44, 0.44, seatY, 0.05, o.frame);
    }
    const w = o.style === 'bench' ? (o.len ?? 1.2) : 0.6;
    return { group: g, foot: { w, d: 0.6 }, interactables: [actMsg(ctx, g, [g.children[0]], '坐一会儿', '🪑 坐下来了，真舒服～', 480)] };
  };
}

// ---------- 沙发 ----------
function gSofa(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const W = o.seats * 0.8 + 0.5;
    add(g, B(W, 0.45, 0.95, o.color), 0, 0.25, 0);
    add(g, B(W, 0.6, 0.25, o.color), 0, 0.75, -0.35);
    add(g, B(0.25, 0.35, 0.95, o.color), -W / 2 + 0.12, 0.62, 0);
    add(g, B(0.25, 0.35, 0.95, o.color), W / 2 - 0.12, 0.62, 0);
    for (let i = 0; i < o.seats; i++)
      add(g, B(0.72, 0.12, 0.6, o.cushion), (i - (o.seats - 1) / 2) * 0.78, 0.53, 0.08);
    if (o.chaise) add(g, B(0.7, 0.42, 0.9, o.color), -W / 2 + 0.45, 0.21, 0.9);
    let extra = 0;
    if (o.lshape) { add(g, B(0.8, 0.45, 1.0, o.color), W / 2 - 0.4, 0.25, 0.95); extra = 1; }
    return {
      group: g, foot: { w: W, d: o.lshape ? 2.0 : 1.05 },
      interactables: [actMsg(ctx, g, [g.children[0]], '瘫在沙发上', '🛋️ 陷进沙发里，不想起来了……', 440)],
    };
  };
}
function gBeanbag(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const bag = S(0.45, o.color, 18);
    bag.scale.y = 0.72; add(g, bag, 0, 0.3, 0);
    return { group: g, foot: { w: 0.9, d: 0.9 }, interactables: [actMsg(ctx, g, [bag], '瘫上去', '🫠 整个人都陷进去了……', 400)] };
  };
}

// ---------- 床 ----------
function gBed(o) {
  return (ctx) => {
    const g = new THREE.Group();
    if (o.style === 'round') {
      add(g, C(1.05, 1.1, 0.35, o.frame, 28), 0, 0.18, 0);
      add(g, C(1.0, 1.0, 0.18, 0xf0ead8, 28), 0, 0.44, 0);
      add(g, C(0.95, 0.95, 0.08, o.blanket, 28), 0, 0.55, 0);
      add(g, S(0.22, 0xffffff), -0.4, 0.6, -0.55);
      add(g, S(0.22, 0xffffff), 0.4, 0.6, -0.55);
    } else if (o.style === 'tatami') {
      add(g, B(o.w, 0.12, o.d, 0xd8c890), 0, 0.06, 0);
      add(g, B(o.w - 0.15, 0.1, o.d - 0.15, 0xf0ead8), 0, 0.17, 0);
      add(g, B(o.w - 0.2, 0.07, o.d * 0.55, o.blanket), 0, 0.25, 0.3);
    } else {
      add(g, B(o.w, 0.28, o.d, o.frame), 0, 0.16, 0);
      add(g, B(o.w - 0.1, 0.16, o.d - 0.1, 0xf0ead8), 0, 0.38, 0);
      add(g, B(o.w - 0.06, 0.07, o.d * 0.6, o.blanket), 0, 0.48, 0.35);
      add(g, B(o.w * 0.4, 0.1, 0.3, 0xffffff), -o.w * 0.2, 0.5, -o.d / 2 + 0.35);
      if (o.w > 1.3) add(g, B(o.w * 0.4, 0.1, 0.3, 0xffffff), o.w * 0.2, 0.5, -o.d / 2 + 0.35);
      add(g, B(o.w, 0.85, 0.09, o.frame), 0, 0.62, -o.d / 2);
      if (o.style === 'bunk') {
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]])
          add(g, B(0.08, 1.7, 0.08, o.frame), sx * (o.w / 2 - 0.04), 0.85, sz * (o.d / 2 - 0.04));
        add(g, B(o.w, 0.12, o.d, o.frame), 0, 1.32, 0);
        add(g, B(o.w - 0.1, 0.14, o.d - 0.1, 0xf0ead8), 0, 1.45, 0);
        add(g, B(o.w - 0.06, 0.06, o.d * 0.6, o.blanket), 0, 1.55, 0.35);
        add(g, B(0.3, 1.1, 0.05, o.frame), o.w / 2 + 0.1, 0.75, 0.3, 0, -0.4);
      }
    }
    const w = o.style === 'round' ? 2.2 : o.w, d = o.style === 'round' ? 2.2 : o.d;
    return { group: g, foot: { w, d }, interactables: [actMsg(ctx, g, [g.children[0]], '躺下休息', '😴 好舒服……差点睡着了', 380)] };
  };
}

// ---------- 柜类 ----------
function gCabinet(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(o.w, o.h, o.d, o.color), 0, o.h / 2, 0);
    const doors = [];
    const n = o.doors ?? 2;
    for (let i = 0; i < n; i++) {
      const pivot = new THREE.Group();
      const dw = o.w / n;
      pivot.position.set(-o.w / 2 + i * dw, o.h / 2, o.d / 2 + 0.02);
      const door = B(dw - 0.02, o.h - 0.06, 0.04, o.door ?? o.color);
      door.position.x = dw / 2 - 0.01;
      if (o.glass) door.material = new THREE.MeshStandardMaterial({ color: 0xa8d8e8, roughness: 0.1, metalness: 0.2, transparent: true, opacity: 0.45 });
      pivot.add(door); g.add(pivot);
      doors.push({ pivot, door, sign: i % 2 ? 1 : -1 });
    }
    if (o.glass) for (let i = 0; i < 3; i++) add(g, B(0.18, 0.22, 0.18, [0xd94f4f, 0x4f7ad9, 0xe0a83c][i]), (i - 1) * o.w / 4, o.h * 0.35 + i * 0.18, 0);
    const acts = [doorAct(g, doors[0].pivot, doors[0].door, doors[0].sign * 1.9, o.what ?? '柜门')];
    return { group: g, foot: { w: o.w + 0.05, d: o.d + 0.05 }, interactables: acts };
  };
}
function gDrawers(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(o.w, o.h, o.d, o.color), 0, o.h / 2, 0);
    const drawers = [];
    const n = o.n ?? 3;
    for (let i = 0; i < n; i++) {
      const dr = B(o.w - 0.08, o.h / n - 0.06, o.d - 0.06, o.front ?? 0xa9805a);
      add(g, dr, 0, o.h / n * (i + 0.5), 0.03);
      add(g, B(0.15, 0.03, 0.03, 0x444444), 0, o.h / n * (i + 0.5), o.d / 2);
      drawers.push(dr);
    }
    return { group: g, foot: { w: o.w + 0.05, d: o.d + 0.05 }, interactables: [drawerAct(g, drawers[n - 1], o.d * 0.5)] };
  };
}

// ---------- 书架 ----------
function gBooks(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const { w, h, d } = o;
    add(g, B(0.06, h, d, o.color), -w / 2, h / 2, 0);
    add(g, B(0.06, h, d, o.color), w / 2, h / 2, 0);
    add(g, B(w, 0.06, d, o.color), 0, h, 0);
    add(g, B(w, 0.06, d, o.color), 0, 0.03, 0);
    add(g, B(w, h, 0.04, 0x5d3d26), 0, h / 2, -d / 2);
    const slots = [];
    const levels = o.levels ?? 2;
    for (let i = 1; i < levels; i++) add(g, B(w, 0.05, d - 0.03, o.color), 0, h / levels * i, 0);
    for (let i = 0; i < levels; i++)
      for (let k = 0; k < (o.perLevel ?? 2); k++)
        slots.push(new THREE.Vector3(-w / 2 + 0.25 + k * (w / (o.perLevel ?? 2)), h / levels * i + 0.08, 0.03));
    // 预置几本装饰书
    for (let i = 0; i < Math.min(3, slots.length); i++) {
      if (o.empty) break;
      const bk = B(0.06, 0.26, 0.2, [0xd94f4f, 0x4f7ad9, 0x53b15a][i % 3]);
      add(g, bk, slots[i].x + 0.35, slots[i].y + 0.1, slots[i].z);
    }
    return { group: g, foot: { w: w + 0.1, d: d + 0.05 }, interactables: [bookStorageAct(ctx, g, slots)] };
  };
}
function gLadderShelf(o) {
  return (ctx) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) add(g, B(0.05, 1.6, 0.05, o.color), sx * 0.45, 0.8, -0.05, 0, -0.12 * sx * 0);
    for (let i = 0; i < 4; i++) add(g, B(0.95 - i * 0.15, 0.04, 0.3, o.color), 0, 0.35 + i * 0.38, 0);
    add(g, S(0.1, 0x53b15a), -0.2, 1.6, 0);
    add(g, B(0.15, 0.2, 0.1, 0xd94f4f), 0.15, 1.25, 0);
    return { group: g, foot: { w: 1.0, d: 0.35 }, interactables: [actMsg(ctx, g, [g.children[0]], '整理置物架', '✨ 摆件都擦干净了！', 580)] };
  };
}
function gWallShelf(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.0, 0.05, 0.25, o.color), 0, 1.5, 0);
    add(g, B(1.0, 0.05, 0.25, o.color), 0, 1.85, 0);
    add(g, B(0.06, 0.24, 0.18, 0x4f7ad9), -0.3, 1.65, 0);
    add(g, B(0.06, 0.2, 0.18, 0xd94f4f), -0.22, 1.63, 0);
    add(g, S(0.08, 0xe0a83c), 0.25, 1.93, 0);
    return { group: g, foot: { w: 1.0, d: 0.3 }, soft: true, interactables: [actMsg(ctx, g, [g.children[0]], '看看藏书', '📖 抽出一本书翻了翻', 560)] };
  };
}

// ---------- 灯具 ----------
function gFloorLamp(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const shadeMat = new THREE.MeshStandardMaterial({ color: o.shade, roughness: 0.9 });
    let shade;
    if (o.style === 'arc') {
      add(g, C(0.22, 0.26, 0.05, 0x555555), 0, 0.03, 0);
      const arm = add(g, B(0.04, 1.9, 0.04, 0x555555), 0, 0.95, 0);
      arm.rotation.z = 0.35;
      shade = add(g, new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), shadeMat), 0.62, 1.75, 0);
    } else if (o.style === 'tripod') {
      for (let i = 0; i < 3; i++) {
        const leg = add(g, B(0.04, 1.6, 0.04, o.pole ?? 0x6b5238), Math.cos(i * 2.1) * 0.18, 0.8, Math.sin(i * 2.1) * 0.18);
        leg.rotation.z = Math.cos(i * 2.1) * 0.22; leg.rotation.x = -Math.sin(i * 2.1) * 0.22;
      }
      shade = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.3, 18, 1, true), shadeMat), 0, 1.65, 0);
    } else if (o.style === 'modern') {
      add(g, C(0.2, 0.24, 0.05, 0x333333), 0, 0.03, 0);
      add(g, C(0.025, 0.025, 1.7, 0x333333), 0, 0.9, 0);
      shade = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.5, 18, 1, true), shadeMat), 0, 1.85, 0);
    } else { // classic
      add(g, C(0.25, 0.3, 0.06, 0x555555), 0, 0.03, 0);
      add(g, C(0.03, 0.03, 1.7, 0x555555), 0, 0.9, 0);
      shade = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.45, 20, 1, true), shadeMat), 0, 1.85, 0);
    }
    shade.castShadow = true;
    const light = new THREE.PointLight(0xffdca0, 0, 8);
    add(g, light, 0, 1.65, 0);
    return { group: g, foot: { w: 0.5, d: 0.5 }, interactables: [lightAct(g, shade, light)] };
  };
}
function gTableLamp(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.12, 0.14, 0.05, o.base ?? 0x8a5f38), 0, 0.45, 0);
    add(g, B(0.3, 0.42, 0.3, o.base ?? 0x8a5f38), 0, 0.21, 0);
    add(g, C(0.025, 0.025, 0.3, 0x555555), 0, 0.6, 0);
    const shadeMat = new THREE.MeshStandardMaterial({ color: o.shade, roughness: 0.9 });
    const shade = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.25, 18, 1, true), shadeMat), 0, 0.85, 0);
    const light = new THREE.PointLight(0xffdca0, 0, 6);
    add(g, light, 0, 0.75, 0);
    return { group: g, foot: { w: 0.35, d: 0.35 }, interactables: [lightAct(g, shade, light)] };
  };
}
function gPendant(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.015, 0.015, 1.4, 0x333333), 0, 3.2, 0);
    const shadeMat = new THREE.MeshStandardMaterial({ color: o.shade, roughness: o.style === 'cloud' ? 1 : 0.5, metalness: o.style === 'industrial' ? 0.6 : 0 });
    let shade;
    if (o.style === 'cloud') {
      shade = new THREE.Group();
      for (const [x, y, z, r] of [[0, 0, 0, 0.28], [0.25, -0.03, 0.05, 0.2], [-0.24, -0.02, -0.04, 0.22], [0.05, 0.08, -0.15, 0.18]])
        add(shade, S(r, o.shade), x, y, z);
      shade.position.y = 2.45;
    } else {
      shade = add(g, new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.3, 20, 1, true), shadeMat), 0, 2.45, 0);
    }
    if (o.style === 'cloud') g.add(shade);
    shade.traverse ? shade.traverse(m => { if (m.isMesh) m.material = shadeMat; }) : 0;
    const light = new THREE.PointLight(0xfff0cc, 0, 10);
    add(g, light, 0, 2.3, 0);
    const firstMesh = o.style === 'cloud' ? shade.children[0] : shade;
    return { group: g, foot: { w: 0.5, d: 0.5 }, soft: true, interactables: [lightAct(g, firstMesh, light, '开吊灯', '关吊灯')] };
  };
}
function gNeon(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.0, 0.5, 0.06, 0x1a1a24), 0, 1.5, 0);
    add(g, B(0.04, 1.5, 0.04, 0x333333), 0, 0.75, 0);
    add(g, B(0.4, 0.05, 0.2, 0x333333), 0, 0.03, 0);
    const { g: cg, tex } = canvasTex(256, 128);
    cg.fillStyle = '#0a0a12'; cg.fillRect(0, 0, 256, 128);
    cg.font = 'bold 60px sans-serif'; cg.textAlign = 'center';
    cg.shadowColor = o.glow; cg.shadowBlur = 24;
    cg.fillStyle = o.glow; cg.fillText(o.text, 128, 82);
    tex.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const panel = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.42), mat), 0, 1.5, 0.035);
    const light = new THREE.PointLight(new THREE.Color(o.glow).getHex(), 0, 5);
    add(g, light, 0, 1.5, 0.4);
    return {
      group: g, foot: { w: 1.0, d: 0.25 },
      interactables: [actToggle(g, [panel], '点亮霓虹灯', '关掉霓虹灯', on => {
        mat.opacity = on ? 1 : 0.15; light.intensity = on ? 8 : 0;
        beep(on ? 880 : 220, 0.1, 'sawtooth', 0.04);
      })],
    };
  };
}

// ---------- 植物 ----------
function gPlant(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(o.potR ?? 0.2, (o.potR ?? 0.2) * 0.75, 0.28, o.pot ?? 0xb5654a), 0, 0.14, 0);
    let leaves;
    if (o.kind === 'cactus') {
      leaves = new THREE.Group();
      add(leaves, C(0.09, 0.11, 0.55, 0x3f8a3f), 0, 0.28, 0);
      add(leaves, C(0.05, 0.06, 0.25, 0x3f8a3f), 0.13, 0.3, 0, 0, -0.7);
      add(leaves, C(0.05, 0.06, 0.2, 0x3f8a3f), -0.12, 0.38, 0, 0, 0.7);
      add(leaves, S(0.05, 0xe06c9f), 0, 0.6, 0);
      leaves.position.y = 0.26;
    } else if (o.kind === 'succulent') {
      leaves = new THREE.Group();
      for (let i = 0; i < 6; i++) {
        const s = S(0.06, i % 2 ? 0x6ab86a : 0x8ac8a8);
        s.scale.y = 0.6;
        add(leaves, s, Math.cos(i) * 0.09, 0.03, Math.sin(i) * 0.09);
      }
      leaves.position.y = 0.28;
    } else if (o.kind === 'tall') {
      leaves = new THREE.Group();
      add(leaves, C(0.02, 0.04, 0.9, 0x3f7a3f), 0, 0.45, 0);
      for (let i = 0; i < 5; i++) {
        const leaf = add(leaves, B(0.5, 0.02, 0.12, 0x4a9a4a), 0, 0.7 + i * 0.12, 0, i * 1.3, -0.4);
        leaf.geometry.translate(0.2, 0, 0);
      }
      leaves.position.y = 0.26;
    } else if (o.kind === 'bamboo') {
      leaves = new THREE.Group();
      for (let i = 0; i < 4; i++) {
        add(leaves, C(0.025, 0.03, 0.7 + (i % 3) * 0.25, 0x7ab84a), (i - 1.5) * 0.08, (0.7 + (i % 3) * 0.25) / 2, (i % 2) * 0.06);
        add(leaves, B(0.15, 0.01, 0.05, 0x53b15a), (i - 1.5) * 0.08, 0.65 + (i % 3) * 0.25, 0, i);
      }
      leaves.position.y = 0.26;
    } else if (o.kind === 'tree') {
      leaves = new THREE.Group();
      add(leaves, C(0.05, 0.08, 0.9, 0x6b4527), 0, 0.45, 0);
      add(leaves, S(0.4, o.leaf ?? 0xe8a0b8, 16), 0, 1.15, 0);
      add(leaves, S(0.25, o.leaf ?? 0xe8a0b8), 0.3, 0.95, 0.15);
      add(leaves, S(0.22, o.leaf ?? 0xe8a0b8), -0.28, 1.0, -0.1);
      leaves.position.y = 0.26;
    } else if (o.kind === 'flower') {
      leaves = new THREE.Group();
      add(leaves, C(0.015, 0.02, 0.5, 0x3f7a3f), 0, 0.25, 0);
      for (let i = 0; i < 6; i++) add(leaves, S(0.05, o.leaf ?? 0xd94f6a), Math.cos(i * 1.05) * 0.06, 0.52, Math.sin(i * 1.05) * 0.06);
      add(leaves, S(0.045, 0xffd54a), 0, 0.55, 0);
      leaves.position.y = 0.26;
    } else { // ball 绿萝
      leaves = new THREE.Group();
      add(leaves, C(0.02, 0.03, 0.4, 0x3f7a3f), 0, 0.2, 0);
      add(leaves, new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1),
        new THREE.MeshStandardMaterial({ color: o.leaf ?? 0x53b15a, roughness: 1 })), 0, 0.55, 0);
      leaves.position.y = 0.26;
    }
    leaves.traverse(m => { if (m.isMesh) m.castShadow = true; });
    g.add(leaves);
    const size = o.kind === 'tree' ? 0.8 : 0.45;
    return { group: g, foot: { w: size, d: size }, interactables: [plantAct(ctx, g, leaves)] };
  };
}

// ---------- 电器 ----------
function gFridge(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.35, metalness: 0.4 });
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.75, 1.8, 0.7), bodyMat), 0, 0.9, 0).castShadow = true;
    const pivot = new THREE.Group();
    pivot.position.set(-0.36, 0.9, 0.36);
    const door = B(0.72, 1.76, 0.05, o.color);
    door.material = bodyMat.clone(); door.position.x = 0.36; pivot.add(door); g.add(pivot);
    add(g, B(0.04, 0.5, 0.04, 0x888888), 0.28, 0.9, 0.4);
    const light = new THREE.PointLight(0xcceeff, 0, 2);
    add(g, light, 0, 1.2, 0.5);
    return {
      group: g, foot: { w: 0.8, d: 0.75 },
      interactables: [actToggle(g, [door], '打开冰箱', '关上冰箱', on => {
        pivot.rotation.y = on ? -1.6 : 0; light.intensity = on ? 4 : 0;
        beep(on ? 520 : 300, 0.06, 'sine', 0.04);
        if (on) ctx.flashMessage('🧊 冰箱里凉飕飕的，拿了瓶汽水！');
      })],
    };
  };
}
function gWasher(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.65, 0.85, 0.65, o.color ?? 0xe8e8ec), 0, 0.425, 0);
    const drum = add(g, C(0.24, 0.24, 0.06, 0x333344, 24), 0, 0.45, 0.33, 0, Math.PI / 2);
    drum.rotation.x = Math.PI / 2;
    add(g, C(0.17, 0.17, 0.08, 0x88bbdd, 24), 0, 0.45, 0.34).rotation.x = Math.PI / 2;
    add(g, B(0.5, 0.08, 0.05, 0x333333), 0, 0.78, 0.31);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.7, d: 0.7 },
      updater(dt) { if (st.on) drum.rotation.y += dt * 12; },
      interactables: [actToggle(g, [drum], '开始洗衣', '停止洗衣', on => {
        st.on = on; beep(on ? 400 : 250, 0.15, 'sine', 0.05);
        if (on) ctx.flashMessage('🌀 滚筒转起来了，哗啦啦——');
      })],
    };
  };
}
function gMicrowave(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.3, 0.35, o.color ?? 0x444450), 0, 0.55, 0);
    add(g, B(0.55, 0.04, 0.4, 0x8a5f38), 0, 0.38, 0);
    legs4(g, 0.55, 0.4, 0.38, 0.05, 0x6b4527);
    const doorPivot = new THREE.Group();
    doorPivot.position.set(-0.23, 0.55, 0.18);
    const door = B(0.32, 0.24, 0.03, 0x222228);
    door.position.x = 0.17; doorPivot.add(door); g.add(doorPivot);
    add(g, B(0.08, 0.24, 0.03, 0x333340), 0.2, 0.55, 0.18);
    const light = new THREE.PointLight(0xffcc88, 0, 1.5);
    add(g, light, 0, 0.55, 0.25);
    return {
      group: g, foot: { w: 0.6, d: 0.45 },
      interactables: [actToggle(g, [door], '打开微波炉', '关上并加热', on => {
        doorPivot.rotation.y = on ? -1.8 : 0;
        light.intensity = on ? 0 : 3;
        beep(on ? 500 : 880, 0.1, 'sine', 0.05);
        if (!on) { ctx.flashMessage('♨️ 叮——热好了！'); setTimeout(() => beep(990, 0.15, 'sine', 0.06), 800); }
      })],
    };
  };
}
function gSimpleAppliance(o) {
  // 烤箱/咖啡机/烤面包机/电饭煲/饮水机/空气净化器/加湿器 等
  return (ctx) => {
    const g = new THREE.Group();
    const body = add(g, B(o.w, o.h, o.d, o.color), 0, o.base + o.h / 2, 0);
    if (o.base > 0.01) { add(g, B(o.w + 0.05, 0.04, o.d + 0.05, 0x8a5f38), 0, o.base - 0.02, 0); legs4(g, o.w, o.d, o.base - 0.04, 0.05, 0x6b4527); }
    if (o.detail === 'coffee') { add(g, C(0.08, 0.1, 0.15, 0x222222), 0, o.base + o.h + 0.08, 0); add(g, C(0.06, 0.05, 0.08, 0xffffff), 0.1, o.base + 0.05, 0.1); }
    if (o.detail === 'toast') add(g, B(o.w * 0.6, 0.03, 0.08, 0xd8a860), 0, o.base + o.h + 0.02, 0);
    if (o.detail === 'water') { add(g, C(0.12, 0.12, 0.3, 0x88ccee), 0, o.base + o.h + 0.15, 0); }
    const acts = {
      oven: ['打开烤箱', '关上烤箱', '🔥 烤箱暖烘烘的，闻到了面包香！'],
      coffee: ['煮咖啡', '停止', '☕ 煮好了一杯香浓咖啡！'],
      toast: ['烤吐司', '取消', '🍞 啪！吐司弹出来了，金黄酥脆！'],
      rice: ['开盖盛饭', '合盖', '🍚 盛了一碗香喷喷的米饭！'],
      water: ['接杯水', '停下', '🥤 咕嘟咕嘟，接满一杯水！'],
      purify: ['开启净化', '关闭', '🍃 空气变得清新了！'],
      humidify: ['开始加湿', '关闭', '💧 喷出细细的水雾～'],
    }[o.detail] ?? ['使用', '关闭', '✨ 用完了！'];
    return {
      group: g, foot: { w: o.w + 0.1, d: o.d + 0.1 },
      interactables: [actToggle(g, [body], acts[0], acts[1], on => {
        beep(on ? 700 : 350, 0.08, 'sine', 0.04);
        if (on) ctx.flashMessage(acts[2]);
      })],
    };
  };
}
function gAC(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 1.7, 0.35, 0xe8e8ec), 0, 0.85, 0);
    const flap = add(g, B(0.4, 0.15, 0.02, 0xcccccc), 0, 1.35, 0.19);
    add(g, B(0.3, 0.06, 0.02, 0x333333), 0, 1.55, 0.19);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.55, d: 0.4 },
      updater(dt, t) { if (st.on) flap.rotation.x = Math.sin(t * 2) * 0.4 - 0.2; },
      interactables: [actToggle(g, [flap], '开空调', '关空调', on => {
        st.on = on; if (!on) flap.rotation.x = 0;
        beep(on ? 600 : 300, 0.1, 'sine', 0.05);
        ctx.flashMessage(on ? '❄️ 凉风吹出来了，好舒服！' : '空调关掉了');
      })],
    };
  };
}
function gFan(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.22, 0.26, 0.05, 0x666666), 0, 0.03, 0);
    add(g, C(0.03, 0.03, 1.0, 0x666666), 0, 0.55, 0);
    const head = new THREE.Group(); head.position.y = 1.1; g.add(head);
    const blades = new THREE.Group(); head.add(blades);
    for (let i = 0; i < 3; i++) add(blades, B(0.3, 0.1, 0.01, 0x99ccdd), Math.cos(i * 2.1) * 0.12, Math.sin(i * 2.1) * 0.12, 0, 0).rotation.z = i * 2.1;
    add(head, C(0.3, 0.3, 0.02, 0x888888, 24), 0, 0, 0.02).rotation.x = Math.PI / 2;
    add(head, S(0.05, 0x555555), 0, 0, 0.05);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.5, d: 0.5 },
      updater(dt, t) { if (st.on) { blades.rotation.z += dt * 15; head.rotation.y = Math.sin(t * 0.8) * 0.7; } },
      interactables: [actToggle(g, [head.children[1]], '开风扇', '关风扇', on => {
        st.on = on; beep(on ? 500 : 260, 0.1, 'sine', 0.05);
        if (on) ctx.flashMessage('🌬️ 风扇摇头吹起来了！');
      })],
    };
  };
}

// ---------- 厨卫 ----------
function gStove(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.2, 0.85, 0.6, o.color ?? 0xd8d8dc), 0, 0.425, 0);
    add(g, B(1.24, 0.04, 0.64, 0x444444), 0, 0.87, 0);
    for (const [x, z] of [[-0.3, -0.12], [0.3, -0.12], [-0.3, 0.15], [0.3, 0.15]])
      add(g, C(0.11, 0.11, 0.02, 0x222222, 20), x, 0.9, z);
    add(g, C(0.14, 0.12, 0.1, 0x888888, 18), -0.3, 0.96, -0.12);
    add(g, B(0.6, 0.5, 0.4, 0xbbbbbb), 0, 1.75, -0.1); // 油烟机
    const fire = add(g, C(0.08, 0.1, 0.03, 0xff6600, 16), -0.3, 0.91, -0.12);
    fire.material.emissive = new THREE.Color(0xff4400); fire.material.emissiveIntensity = 0;
    return {
      group: g, foot: { w: 1.25, d: 0.65 },
      interactables: [actToggle(g, [fire], '开火做饭', '关火', on => {
        fire.material.emissiveIntensity = on ? 1.5 : 0;
        beep(on ? 300 : 200, 0.1, 'sawtooth', 0.04);
        if (on) ctx.flashMessage('🍳 滋啦——开始炒菜了！');
      })],
    };
  };
}
function gSink(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.0, 0.8, 0.6, o.color ?? 0x9a8a6a), 0, 0.4, 0);
    add(g, B(1.04, 0.05, 0.64, 0xd8d8dc), 0, 0.82, 0);
    add(g, B(0.5, 0.12, 0.35, 0xaaaaaa), -0.15, 0.8, 0);
    add(g, C(0.02, 0.02, 0.3, 0x888888), -0.15, 1.0, -0.18);
    add(g, B(0.15, 0.03, 0.03, 0x888888), -0.15, 1.12, -0.1);
    return { group: g, foot: { w: 1.05, d: 0.65 }, interactables: [actMsg(ctx, g, [g.children[0]], '洗洗手', '🚰 哗啦啦，手洗干净了！', 620)] };
  };
}
function gToilet(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.45, 0.5, 0.2, 0xf0f0f0), 0, 0.55, -0.2);
    add(g, C(0.22, 0.16, 0.35, 0xf0f0f0, 20), 0, 0.18, 0.05);
    add(g, C(0.24, 0.24, 0.06, 0xf8f8f8, 20), 0, 0.38, 0.05);
    const lid = add(g, C(0.23, 0.23, 0.03, 0xffffff, 20), 0, 0.42, 0.05);
    lid.geometry.translate(0, 0, -0.2);
    return { group: g, foot: { w: 0.5, d: 0.7 }, interactables: [lidAct(g, lid, '马桶盖', -1.4)] };
  };
}
function gTub(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.7, 0.55, 0.75, o.color ?? 0xf0f0f0), 0, 0.275, 0);
    add(g, B(1.5, 0.45, 0.55, 0x88ccee), 0, 0.32, 0);
    add(g, C(0.02, 0.02, 0.5, 0x888888), -0.7, 0.8, 0);
    return { group: g, foot: { w: 1.75, d: 0.8 }, interactables: [actMsg(ctx, g, [g.children[1]], '放水泡澡', '🛁 热水放满了，泡个澡真解乏！', 400)] };
  };
}
function gVanity(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.7, 0.6, 0.45, o.color ?? 0x8a6a4a), 0, 0.3, 0);
    add(g, C(0.22, 0.18, 0.1, 0xf0f0f0, 20), 0, 0.65, 0);
    add(g, C(0.015, 0.015, 0.25, 0x888888), 0, 0.8, -0.15);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xd0e8f0, roughness: 0.05, metalness: 0.9 });
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.7, 0.03), mirrorMat), 0, 1.35, -0.2);
    return { group: g, foot: { w: 0.75, d: 0.5 }, interactables: [actMsg(ctx, g, [g.children[3]], '照照镜子', '🪞 嗯，今天也很精神！', 640)] };
  };
}
function gShower(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.9, 0.06, 0.9, 0xd8d8dc), 0, 0.03, 0);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d8e8, roughness: 0.1, transparent: true, opacity: 0.3 });
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.03), glassMat), 0, 1.0, 0.45);
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.03, 1.9, 0.9), glassMat), 0.45, 1.0, 0);
    add(g, C(0.02, 0.02, 1.9, 0x888888), -0.35, 0.98, -0.35);
    add(g, C(0.1, 0.12, 0.03, 0x888888, 16), -0.35, 1.9, -0.35);
    const water = add(g, C(0.09, 0.14, 0.9, 0x88ccee, 12), -0.35, 1.4, -0.35);
    water.material.transparent = true; water.material.opacity = 0; water.castShadow = false;
    return {
      group: g, foot: { w: 0.95, d: 0.95 },
      interactables: [actToggle(g, [water], '打开淋浴', '关掉淋浴', on => {
        water.material.opacity = on ? 0.5 : 0;
        beep(on ? 450 : 250, 0.12, 'sine', 0.05);
        if (on) ctx.flashMessage('🚿 热水哗哗地冲下来！');
      })],
    };
  };
}

// ---------- 娱乐 ----------
function gTV(o) {
  return (ctx) => {
    const g = new THREE.Group();
    if (o.crt) {
      add(g, B(0.65, 0.55, 0.55, o.color ?? 0x8a6a4a), 0, 0.85, 0);
      add(g, B(0.5, 0.02, 0.02, 0x888888), -0.1, 1.35, 0, 0, -0.5);
      add(g, B(0.5, 0.02, 0.02, 0x888888), 0.1, 1.35, 0, 0, 0.5);
      add(g, B(0.6, 0.55, 0.5, 0x6b5238), 0, 0.28, 0);
    } else {
      add(g, B(o.w ?? 1.2, 0.06, 0.4, 0x555555), 0, 0.42, 0);
      legs4(g, o.w ?? 1.2, 0.4, 0.42, 0.05, 0x333333);
      add(g, B((o.w ?? 1.2) * 0.9, (o.w ?? 1.2) * 0.55, 0.06, 0x1a1a1a), 0, 1.0, 0);
    }
    const smat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const sw = o.crt ? 0.45 : (o.w ?? 1.2) * 0.82, sh = o.crt ? 0.4 : (o.w ?? 1.2) * 0.48;
    const sy = o.crt ? 0.87 : 1.0, sz = o.crt ? 0.28 : 0.04;
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), smat), 0, sy, sz);
    const screen = g.children[g.children.length - 1];
    return { group: g, foot: { w: (o.w ?? 1.2) + 0.1, d: 0.6 }, interactables: [screenAct(g, screen, smat, '电视')] };
  };
}
function gArcade(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.7, 1.7, 0.8, o.color ?? 0x3a3a8c), 0, 0.85, 0);
    add(g, B(0.74, 0.3, 0.84, 0x2a2a6c), 0, 1.75, 0);
    const { g: cg, tex } = canvasTex(128, 128);
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.45), new THREE.MeshBasicMaterial({ map: tex })), 0, 1.25, 0.41, 0, -0.12);
    add(g, B(0.6, 0.05, 0.25, 0x2a2a6c), 0, 0.95, 0.45, 0, -0.15);
    add(g, S(0.03, 0xd94f4f), -0.1, 1.0, 0.5);
    add(g, S(0.025, 0xffd54a), 0.05, 0.99, 0.51);
    add(g, S(0.025, 0x53b15a), 0.15, 0.99, 0.51);
    let t = 0;
    const px = [];
    return {
      group: g, foot: { w: 0.75, d: 0.85 },
      updater(dt) {
        t += dt; if (t < 0.1) return; t = 0;
        cg.fillStyle = '#000018'; cg.fillRect(0, 0, 128, 128);
        for (let i = 0; i < 30; i++) {
          if (!px[i]) px[i] = { x: Math.random() * 128, y: Math.random() * 128, c: ['#ff5252', '#ffd54a', '#4fc3f7', '#9ccc65'][i % 4] };
          px[i].y += 3 + (i % 3); if (px[i].y > 128) px[i].y = 0;
          cg.fillStyle = px[i].c; cg.fillRect(px[i].x, px[i].y, 4, 4);
        }
        cg.fillStyle = '#fff'; cg.font = 'bold 16px monospace'; cg.textAlign = 'center';
        cg.fillText('INSERT COIN', 64, 70);
        tex.needsUpdate = true;
      },
      interactables: [actMsg(ctx, g, [g.children[2]], '投币玩一局', '🕹️ 投币成功！像素大战开始！', 880)],
    };
  };
}
function gGameTable(o) {
  // 桌上足球/台球/乒乓球/象棋/麻将
  return (ctx) => {
    const g = new THREE.Group();
    const msgs = {
      foosball: ['来一局桌上足球', '⚽ 球进了！1:0 领先！'],
      pool: ['打一局台球', '🎱 黑八入袋，漂亮的一杆！'],
      pingpong: ['打乒乓球', '🏓 好球！一个漂亮的扣杀！'],
      chess: ['下盘棋', '♟️ 将军！这步棋走得妙啊！'],
      mahjong: ['搓麻将', '🀄 杠上开花，胡了！'],
    };
    const [prompt, message] = msgs[o.kind];
    if (o.kind === 'foosball') {
      add(g, B(1.3, 0.35, 0.7, 0x2e7a3e), 0, 0.75, 0);
      legs4(g, 1.3, 0.7, 0.6, 0.08, 0x5a4632);
      for (let i = 0; i < 4; i++) add(g, C(0.015, 0.015, 1.6, 0xaaaaaa, 8), 0, 0.95, -0.24 + i * 0.16).rotation.z = Math.PI / 2;
      for (let i = 0; i < 8; i++) add(g, B(0.05, 0.08, 0.03, i < 4 ? 0xd94f4f : 0x4f7ad9), -0.45 + (i % 4) * 0.3, 0.9, -0.24 + Math.floor(i / 4) * 0.48);
    } else if (o.kind === 'pool') {
      add(g, B(1.8, 0.2, 1.0, 0x2e7a3e), 0, 0.78, 0);
      add(g, B(1.9, 0.1, 1.1, 0x6b4527), 0, 0.86, 0);
      legs4(g, 1.8, 1.0, 0.72, 0.1, 0x5a4632);
      for (const [x, z, c] of [[-0.4, 0.1, 0xd94f4f], [-0.3, -0.1, 0xffd54a], [-0.35, 0.25, 0x4f7ad9], [0.5, 0, 0xffffff], [-0.28, 0.05, 0x222222]])
        add(g, S(0.035, c, 10), x, 0.92, z);
      add(g, C(0.015, 0.02, 1.2, 0x8a5f38, 8), 0.3, 0.93, 0.3, 0, Math.PI / 2).rotation.y = 0.5;
    } else if (o.kind === 'pingpong') {
      add(g, B(1.8, 0.05, 1.0, 0x2a4a8c), 0, 0.76, 0);
      add(g, B(1.8, 0.01, 0.05, 0xffffff), 0, 0.79, 0);
      add(g, B(0.02, 0.15, 1.0, 0xdddddd), 0, 0.86, 0);
      legs4(g, 1.8, 1.0, 0.74, 0.06, 0x333333);
      add(g, C(0.12, 0.12, 0.02, 0xd94f4f, 16), 0.5, 0.8, 0.2).rotation.x = Math.PI / 2;
      add(g, S(0.02, 0xffa500, 8), -0.3, 0.8, -0.1);
    } else if (o.kind === 'chess') {
      add(g, B(0.9, 0.08, 0.9, 0x8a5f38), 0, 0.72, 0);
      legs4(g, 0.9, 0.9, 0.7, 0.06, 0x6b4527);
      const { g: cg, tex } = canvasTex(128, 128);
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { cg.fillStyle = (i + j) % 2 ? '#7a5230' : '#e8d8b8'; cg.fillRect(i * 16, j * 16, 16, 16); }
      tex.needsUpdate = true;
      add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshBasicMaterial({ map: tex })), 0, 0.765, 0, 0, -Math.PI / 2);
      for (let i = 0; i < 8; i++) add(g, C(0.025, 0.03, 0.07, i < 4 ? 0x222222 : 0xf0f0f0, 8), -0.21 + (i % 4) * 0.14, 0.8, -0.08 + Math.floor(i / 4) * 0.16);
    } else { // mahjong
      add(g, B(1.0, 0.08, 1.0, 0x2e6a4e), 0, 0.72, 0);
      add(g, B(1.06, 0.05, 1.06, 0x8a5f38), 0, 0.68, 0);
      legs4(g, 1.0, 1.0, 0.66, 0.06, 0x6b4527);
      for (let i = 0; i < 12; i++) add(g, B(0.05, 0.03, 0.035, 0xf0ead8), -0.3 + (i % 6) * 0.12, 0.78, -0.2 + Math.floor(i / 6) * 0.4, (Math.random() - 0.5) * 0.3);
    }
    const sizes = { foosball: [1.4, 0.8], pool: [1.95, 1.15], pingpong: [1.85, 1.05], chess: [0.95, 0.95], mahjong: [1.1, 1.1] };
    const [w, d] = sizes[o.kind];
    return { group: g, foot: { w, d }, interactables: [actMsg(ctx, g, [g.children[0]], prompt, message, 700)] };
  };
}
function gDart(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.15, 0.2, 0.05, 0x555555), 0, 0.03, 0);
    add(g, C(0.03, 0.03, 1.6, 0x555555), 0, 0.8, 0);
    const { g: cg, tex } = canvasTex(128, 128);
    for (let i = 5; i > 0; i--) { cg.fillStyle = i % 2 ? '#d94f4f' : '#f0f0f0'; cg.beginPath(); cg.arc(64, 64, i * 12, 0, 7); cg.fill(); }
    cg.fillStyle = '#ffd54a'; cg.beginPath(); cg.arc(64, 64, 8, 0, 7); cg.fill();
    tex.needsUpdate = true;
    const board = add(g, new THREE.Mesh(new THREE.CircleGeometry(0.3, 24), new THREE.MeshBasicMaterial({ map: tex })), 0, 1.6, 0.05);
    return {
      group: g, foot: { w: 0.4, d: 0.4 },
      interactables: [actMsg(ctx, g, [board], '扔飞镖', `🎯 ${['正中靶心！满分！', '9 环！不错！', '脱靶了……再来！'][Math.floor(Math.random() * 3)]}`, 760)],
    };
  };
}
function gConsole(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.0, 0.05, 0.35, 0x555555), 0, 0.4, 0);
    legs4(g, 1.0, 0.35, 0.4, 0.04, 0x333333);
    add(g, B(0.9, 0.5, 0.05, 0x1a1a1a), 0, 0.75, 0);
    const smat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const screen = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.82, 0.42), smat), 0, 0.75, 0.03);
    add(g, B(0.3, 0.06, 0.2, 0x222222), -0.2, 0.46, 0.08);
    add(g, B(0.12, 0.04, 0.08, 0x333333), 0.25, 0.45, 0.1);
    return { group: g, foot: { w: 1.05, d: 0.4 }, interactables: [screenAct(g, screen, smat, '游戏机', 0x6a3aa8, 0xbb88ee)] };
  };
}
function gTheater(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(2.2, 0.08, 0.5, 0x333333), 0, 0.3, 0);
    add(g, B(2.0, 1.2, 0.08, 0x1a1a1a), 0, 1.2, 0);
    const smat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 });
    const screen = add(g, new THREE.Mesh(new THREE.PlaneGeometry(1.85, 1.05), smat), 0, 1.2, 0.05);
    for (const sx of [-1.25, 1.25]) {
      add(g, B(0.25, 0.9, 0.25, 0x2b2b3d), sx, 0.45, 0.1);
      add(g, C(0.07, 0.07, 0.02, 0x111111, 16), sx, 0.6, 0.23).rotation.x = Math.PI / 2;
      add(g, C(0.05, 0.05, 0.02, 0x111111, 16), sx, 0.3, 0.23).rotation.x = Math.PI / 2;
    }
    return { group: g, foot: { w: 2.6, d: 0.55 }, interactables: [screenAct(g, screen, smat, '家庭影院', 0x8a6a1a, 0xffdd88)] };
  };
}
function gVR(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.2, 0.24, 0.04, 0x333333), 0, 0.02, 0);
    add(g, C(0.025, 0.025, 1.3, 0x333333), 0, 0.65, 0);
    add(g, B(0.22, 0.12, 0.12, 0xeeeeee), 0, 1.35, 0.04);
    add(g, B(0.16, 0.08, 0.02, 0x222222), 0, 1.35, 0.11);
    add(g, B(0.05, 0.12, 0.05, 0xeeeeee), -0.1, 1.15, 0);
    add(g, B(0.05, 0.12, 0.05, 0xeeeeee), 0.1, 1.15, 0);
    return { group: g, foot: { w: 0.45, d: 0.45 }, interactables: [actMsg(ctx, g, [g.children[2]], '戴上VR玩一会', '🥽 进入了虚拟世界，太震撼了！', 900)] };
  };
}
function gKaraoke(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.18, 0.22, 0.04, 0x333333), 0, 0.02, 0);
    add(g, C(0.02, 0.02, 1.4, 0x666666), 0, 0.7, 0);
    add(g, S(0.07, 0x999999), 0, 1.45, 0);
    add(g, B(0.3, 0.45, 0.25, 0x2b2b3d), 0.4, 0.225, 0);
    add(g, C(0.08, 0.08, 0.02, 0x111111, 16), 0.4, 0.3, 0.13).rotation.x = Math.PI / 2;
    return {
      group: g, foot: { w: 0.7, d: 0.4 },
      interactables: [musicAct(g, [g.children[2]], [392, 440, 523, 587, 523, 440, 392, 330], 'sine', 260, '点歌开唱 🎤')],
    };
  };
}
function gSpeaker(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const box = add(g, B(0.35, 0.6, 0.3, 0x2b2b3d), 0, 0.3, 0);
    for (const [y, r] of [[0.42, 0.1], [0.18, 0.07]]) {
      add(g, C(r, r, 0.03, 0x111111, 18), 0, y, 0.16).rotation.x = Math.PI / 2;
      add(g, C(r * 0.4, r * 0.4, 0.04, 0x4fc3f7, 14), 0, y, 0.16).rotation.x = Math.PI / 2;
    }
    return {
      group: g, foot: { w: 0.4, d: 0.35 },
      interactables: [musicAct(g, [box], [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 880, 784, 659, 587])],
    };
  };
}

// ---------- 乐器 ----------
function gPiano(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const body = o.grand
      ? add(g, B(1.5, 0.25, 1.0, o.color ?? 0x1a1a1a), 0, 0.75, 0)
      : add(g, B(1.3, 1.2, 0.55, o.color ?? 0x1a1a1a), 0, 0.6, 0);
    if (o.grand) {
      legs4(g, 1.4, 0.9, 0.62, 0.07, o.color ?? 0x1a1a1a);
      add(g, B(1.5, 0.03, 0.9, o.color ?? 0x1a1a1a), 0, 1.05, -0.15, 0, -0.35);
    }
    const keyY = o.grand ? 0.78 : 0.75, keyZ = o.grand ? 0.48 : 0.26;
    add(g, B(1.1, 0.04, 0.16, 0xf0f0f0), 0, keyY, keyZ);
    for (let i = 0; i < 10; i++) add(g, B(0.05, 0.03, 0.09, 0x1a1a1a), -0.5 + i * 0.11 + 0.03, keyY + 0.02, keyZ - 0.03);
    add(g, B(0.5, 0.06, 0.3, o.color ?? 0x1a1a1a), 0, 0.45, 0.75);
    legs4(g, 0.5, 0.3, 0.42, 0.04, o.color ?? 0x1a1a1a);
    return {
      group: g, foot: { w: o.grand ? 1.6 : 1.35, d: o.grand ? 1.1 : 0.9 },
      interactables: [musicAct(g, [body], [261, 293, 329, 349, 392, 440, 493, 523, 493, 440, 392, 349, 329, 293], 'sine', 220, '弹奏钢琴 🎹')],
    };
  };
}
function gGuitar(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.06, 0.9, 0.06, 0x555555), 0, 0.45, 0);
    add(g, B(0.3, 0.05, 0.3, 0x555555), 0, 0.03, 0);
    const bodyMat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.4 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20), bodyMat);
    body.rotation.x = Math.PI / 2; body.castShadow = true;
    add(g, body, 0.12, 0.75, 0.08);
    add(g, B(0.05, 0.6, 0.03, 0x6b4527), 0.12, 1.2, 0.08);
    add(g, B(0.08, 0.1, 0.04, 0x4a3524), 0.12, 1.52, 0.08);
    return {
      group: g, foot: { w: 0.5, d: 0.4 },
      interactables: [musicAct(g, [body], [196, 246, 293, 392, 293, 246], o.electric ? 'sawtooth' : 'triangle', 200, o.electric ? '弹电吉他 🎸' : '弹吉他 🎸')],
    };
  };
}
function gDrums(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.3, 0.3, 0.4, 0xd94f4f, 20), 0, 0.35, 0);
    add(g, C(0.16, 0.16, 0.25, 0xd94f4f, 16), -0.35, 0.55, -0.1);
    add(g, C(0.14, 0.14, 0.25, 0xd94f4f, 16), 0.35, 0.55, -0.1);
    add(g, C(0.2, 0.2, 0.12, 0xe8e8ec, 16), -0.5, 0.5, 0.3);
    add(g, C(0.22, 0.22, 0.02, 0xd8c860, 20), 0.45, 0.85, 0.2);
    add(g, C(0.02, 0.02, 0.5, 0x888888), 0.45, 0.55, 0.2);
    add(g, C(0.18, 0.18, 0.02, 0xd8c860, 20), -0.45, 0.9, 0.15);
    add(g, C(0.02, 0.02, 0.55, 0x888888), -0.45, 0.6, 0.15);
    return {
      group: g, foot: { w: 1.2, d: 1.0 },
      interactables: [musicAct(g, [g.children[0]], [120, 120, 180, 120, 240, 120, 180, 300], 'sawtooth', 160, '打鼓 🥁')],
    };
  };
}
function gViolin(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.3, 0.05, 0.3, 0x555555), 0, 0.03, 0);
    add(g, C(0.02, 0.02, 1.0, 0x555555), 0, 0.5, 0);
    const body = add(g, B(0.16, 0.3, 0.06, 0x8a5f38), 0.08, 1.0, 0.05, 0, 0.3);
    add(g, B(0.03, 0.35, 0.02, 0x4a3524), 0.02, 1.25, 0.1, 0, 0.3);
    return {
      group: g, foot: { w: 0.35, d: 0.35 },
      interactables: [musicAct(g, [body], [440, 493, 554, 659, 554, 493], 'sine', 320, '拉小提琴 🎻')],
    };
  };
}

// ---------- 装饰 ----------
function gMirror(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.6, 1.6, 0.06, o.frame ?? 0x8a6a4a), 0, 0.85, 0);
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xd0e8f0, roughness: 0.05, metalness: 0.95 });
    const m = add(g, new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.45, 0.02), mirrorMat), 0, 0.85, 0.035);
    add(g, B(0.5, 0.05, 0.25, o.frame ?? 0x8a6a4a), 0, 0.03, 0.08);
    return { group: g, foot: { w: 0.65, d: 0.3 }, interactables: [actMsg(ctx, g, [m], '照镜子', '🪞 整理了一下发型，帅呆了！', 660)] };
  };
}
function gEasel(o) {
  return (ctx) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) { const l = add(g, B(0.04, 1.6, 0.04, 0x8a5f38), sx * 0.25, 0.8, 0); l.rotation.z = -sx * 0.12; }
    add(g, B(0.04, 1.5, 0.04, 0x8a5f38), 0, 0.75, -0.25, 0).rotation.x = 0.35;
    add(g, B(0.6, 0.05, 0.05, 0x8a5f38), 0, 0.55, 0.03);
    const { g: cg, tex } = canvasTex(128, 160);
    cg.fillStyle = '#f8f4e8'; cg.fillRect(0, 0, 128, 160);
    cg.strokeStyle = '#888'; cg.strokeRect(4, 4, 120, 152);
    tex.needsUpdate = true;
    const cv = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), new THREE.MeshBasicMaterial({ map: tex })), 0, 1.0, 0.06);
    const colors = ['#d94f4f', '#4f7ad9', '#53b15a', '#e0a83c', '#9b59b6', '#3cb8b0'];
    let strokes = 0;
    return {
      group: g, foot: { w: 0.6, d: 0.5 },
      interactables: [{
        pos: g.position, meshes: [cv],
        getPrompt: () => '按 <b>E</b> 画一笔 🎨',
        action: () => {
          cg.fillStyle = colors[strokes % colors.length];
          cg.beginPath(); cg.arc(20 + Math.random() * 88, 20 + Math.random() * 120, 6 + Math.random() * 14, 0, 7); cg.fill();
          tex.needsUpdate = true; strokes++;
          ctx.flashMessage(strokes >= 8 ? '🖼️ 杰作完成了！挂在卢浮宫也不过分！' : '🎨 画了一笔，灵感涌现！');
          beep(600 + strokes * 40, 0.08, 'sine', 0.04);
        },
      }],
    };
  };
}
function gArtStand(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.08, 1.2, 0.08, 0x555555), 0, 0.6, 0);
    add(g, B(0.4, 0.05, 0.3, 0x555555), 0, 0.03, 0);
    const { g: cg, tex } = canvasTex(128, 96);
    cg.fillStyle = o.bg ?? '#1a2a4c'; cg.fillRect(0, 0, 128, 96);
    for (let i = 0; i < 8; i++) {
      cg.fillStyle = ['#ffd54a', '#ef5350', '#4fc3f7', '#9ccc65', '#fff'][i % 5];
      cg.beginPath(); cg.arc(Math.random() * 128, Math.random() * 96, 6 + Math.random() * 16, 0, 7); cg.fill();
    }
    tex.needsUpdate = true;
    add(g, B(0.74, 0.54, 0.04, 0x8a6a4a), 0, 1.45, 0);
    const art = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.46), new THREE.MeshBasicMaterial({ map: tex })), 0, 1.45, 0.025);
    return { group: g, foot: { w: 0.75, d: 0.35 }, interactables: [actMsg(ctx, g, [art], '欣赏画作', '🖼️ 嗯……深奥的构图，艺术的张力！', 580)] };
  };
}
function gGrandClock(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 2.0, 0.35, 0x6b4527), 0, 1.0, 0);
    const { g: cg, tex } = canvasTex(96, 96);
    add(g, new THREE.Mesh(new THREE.CircleGeometry(0.18, 24), new THREE.MeshBasicMaterial({ map: tex })), 0, 1.75, 0.18);
    const pend = add(g, B(0.03, 0.5, 0.02, 0xd8c860), 0, 1.15, 0.1);
    pend.geometry.translate(0, -0.25, 0); pend.position.y = 1.4;
    add(g, S(0.05, 0xd8c860), 0, 1.12, 0.1);
    function drawFace() {
      cg.fillStyle = '#f8f4e8'; cg.beginPath(); cg.arc(48, 48, 46, 0, 7); cg.fill();
      cg.strokeStyle = '#333'; cg.lineWidth = 3; cg.stroke();
      const now = new Date();
      const ha = (now.getHours() % 12) / 12 * Math.PI * 2 - Math.PI / 2;
      const ma = now.getMinutes() / 60 * Math.PI * 2 - Math.PI / 2;
      cg.strokeStyle = '#222'; cg.lineWidth = 4;
      cg.beginPath(); cg.moveTo(48, 48); cg.lineTo(48 + Math.cos(ha) * 22, 48 + Math.sin(ha) * 22); cg.stroke();
      cg.lineWidth = 2;
      cg.beginPath(); cg.moveTo(48, 48); cg.lineTo(48 + Math.cos(ma) * 34, 48 + Math.sin(ma) * 34); cg.stroke();
      tex.needsUpdate = true;
    }
    drawFace();
    return {
      group: g, foot: { w: 0.55, d: 0.4 },
      updater(dt, t) { pend.rotation.z = Math.sin(t * 2.5) * 0.25; if (Math.floor(t) % 30 === 0) drawFace(); },
      interactables: [actMsg(ctx, g, [g.children[1]], '看看时间', `🕰️ 现在是 ${new Date().toLocaleTimeString('zh-CN')}，时间过得好快！`, 520)],
    };
  };
}
function gVase(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(o.r ?? 0.16, 0.1, 0.35, o.color, 20), 0, 0.35 + 0.175, 0);
    add(g, C(0.06, 0.1, 0.12, o.color, 16), 0, 0.35 + 0.4, 0);
    add(g, B(0.35, 0.7, 0.35, 0x8a5f38), 0, 0.175, 0);
    if (o.flowers) for (let i = 0; i < 3; i++) {
      add(g, C(0.008, 0.008, 0.3, 0x3f7a3f), (i - 1) * 0.04, 0.95, 0);
      add(g, S(0.035, [0xd94f6a, 0xffd54a, 0xe06c9f][i]), (i - 1) * 0.05, 1.12, 0);
    }
    return { group: g, foot: { w: 0.4, d: 0.4 }, interactables: [actMsg(ctx, g, [g.children[0]], '欣赏花瓶', '🏺 釉色温润，是件好东西！', 600)] };
  };
}
function gSculpture(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.4, 0.8, 0.4, 0xe8e4dc), 0, 0.4, 0);
    const art = new THREE.Mesh(new THREE.TorusKnotGeometry(0.14, 0.045, 64, 8),
      new THREE.MeshStandardMaterial({ color: o.color ?? 0xc8a860, roughness: 0.3, metalness: 0.7 }));
    art.castShadow = true; add(g, art, 0, 1.0, 0);
    return {
      group: g, foot: { w: 0.45, d: 0.45 },
      updater(dt) { art.rotation.y += dt * 0.4; },
      interactables: [actMsg(ctx, g, [art], '欣赏雕塑', '🗿 流动的线条……这就是现代艺术！', 560)],
    };
  };
}
function gGlobe(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.15, 0.2, 0.05, 0x6b4527), 0, 0.45, 0);
    add(g, B(0.3, 0.42, 0.3, 0x8a5f38), 0, 0.21, 0);
    add(g, C(0.015, 0.015, 0.3, 0x888888), 0, 0.62, 0);
    const { g: cg, tex } = canvasTex(128, 64);
    cg.fillStyle = '#2a6a9c'; cg.fillRect(0, 0, 128, 64);
    cg.fillStyle = '#5a9c4a';
    for (const [x, y, w, h] of [[15, 15, 25, 18], [50, 10, 30, 22], [55, 35, 15, 20], [90, 20, 20, 15], [20, 40, 18, 12]]) cg.fillRect(x, y, w, h);
    tex.needsUpdate = true;
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 14), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
    globe.castShadow = true; add(g, globe, 0, 0.85, 0);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.35, d: 0.35 },
      updater(dt) { if (st.on) globe.rotation.y += dt * 2; },
      interactables: [actToggle(g, [globe], '转转地球仪', '停下', on => { st.on = on; beep(640, 0.06); if (on) ctx.flashMessage('🌍 世界那么大，想去看看！'); })],
    };
  };
}
function gTelescope(o) {
  return (ctx) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const leg = add(g, B(0.04, 1.0, 0.04, 0x6b4527), Math.cos(i * 2.1) * 0.2, 0.5, Math.sin(i * 2.1) * 0.2);
      leg.rotation.z = Math.cos(i * 2.1) * 0.35; leg.rotation.x = -Math.sin(i * 2.1) * 0.35;
    }
    const tube = add(g, C(0.06, 0.08, 0.7, 0x8a8a92, 16), 0, 1.15, 0);
    tube.rotation.x = -0.7;
    add(g, C(0.02, 0.02, 0.15, 0x333333), 0, 1.0, 0.18).rotation.x = -0.7;
    return { group: g, foot: { w: 0.5, d: 0.5 }, interactables: [actMsg(ctx, g, [tube], '看星星', '🔭 哇……看到土星环了！', 720)] };
  };
}
function gFishTank(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(o.w + 0.06, 0.06, o.d + 0.06, 0x444444), 0, 0.45, 0);
    add(g, B(o.w + 0.06, 0.42, o.d + 0.06, 0x8a5f38), 0, 0.21, 0);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x88ccee, roughness: 0.05, transparent: true, opacity: 0.35 });
    add(g, new THREE.Mesh(new THREE.BoxGeometry(o.w, 0.4, o.d), glassMat), 0, 0.68, 0);
    const water = add(g, B(o.w - 0.04, 0.3, o.d - 0.04, 0x3a8ac8), 0, 0.62, 0);
    water.material.transparent = true; water.material.opacity = 0.6; water.castShadow = false;
    const fish = [];
    const n = o.round ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 8),
        new THREE.MeshStandardMaterial({ color: [0xff8800, 0xffd54a, 0xff5544][i % 3] }));
      f.rotation.z = -Math.PI / 2;
      g.add(f); fish.push({ m: f, a: Math.random() * 6.28, r: 0.12 + i * 0.05, sp: 0.8 + i * 0.3, y: 0.58 + i * 0.06 });
    }
    return {
      group: g, foot: { w: o.w + 0.15, d: o.d + 0.15 },
      updater(dt) {
        for (const f of fish) {
          f.a += dt * f.sp;
          f.m.position.set(Math.cos(f.a) * f.r, f.y, Math.sin(f.a) * f.r * 0.6);
          f.m.rotation.y = -f.a;
        }
      },
      interactables: [actMsg(ctx, g, [water], '喂鱼', '🐠 小鱼们欢快地游过来抢食！', 680)],
    };
  };
}
function gBirdCage(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.2, 0.22, 0.03, 0x8a6a4a), 0, 0.45, 0);
    add(g, B(0.35, 0.42, 0.35, 0x8a5f38), 0, 0.21, 0);
    const cageMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, roughness: 0.4, wireframe: true });
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.2, 0.45, 12, 3, true), cageMat), 0, 0.7, 0);
    add(g, new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.15, 12), cageMat), 0, 1.0, 0);
    const bird = add(g, S(0.05, o.color ?? 0x4fc3f7), 0, 0.68, 0);
    add(g, S(0.03, o.color ?? 0x4fc3f7), 0.05, 0.73, 0);
    add(g, new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.03, 6), new THREE.MeshStandardMaterial({ color: 0xffa500 })), 0.08, 0.73, 0).rotation.z = -Math.PI / 2;
    return {
      group: g, foot: { w: 0.45, d: 0.45 },
      updater(dt, t) { bird.position.y = 0.68 + Math.abs(Math.sin(t * 3)) * 0.05; },
      interactables: [actMsg(ctx, g, [bird], '逗逗小鸟', '🐦 叽叽喳喳！小鸟唱起了歌！', 1200)],
    };
  };
}
function gRug(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const { g: cg, tex } = canvasTex(128, 128);
    cg.fillStyle = o.c1; cg.fillRect(0, 0, 128, 128);
    if (o.pattern === 'stripes') for (let i = 0; i < 6; i++) { cg.fillStyle = i % 2 ? o.c2 : o.c1; cg.fillRect(0, i * 21, 128, 21); }
    else if (o.pattern === 'persian') {
      cg.strokeStyle = o.c2; cg.lineWidth = 6; cg.strokeRect(8, 8, 112, 112);
      cg.lineWidth = 2; cg.strokeRect(20, 20, 88, 88);
      cg.fillStyle = o.c2; cg.beginPath(); cg.arc(64, 64, 20, 0, 7); cg.fill();
    } else { cg.fillStyle = o.c2; cg.beginPath(); cg.arc(64, 64, 40, 0, 7); cg.fill(); cg.fillStyle = o.c1; cg.beginPath(); cg.arc(64, 64, 25, 0, 7); cg.fill(); }
    tex.needsUpdate = true;
    let mesh;
    if (o.shape === 'circle') mesh = new THREE.Mesh(new THREE.CircleGeometry(o.r, 28), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    else mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.y = 0.015; mesh.receiveShadow = true;
    g.add(mesh);
    const w = o.shape === 'circle' ? o.r * 2 : o.w, d = o.shape === 'circle' ? o.r * 2 : o.d;
    return { group: g, foot: { w, d }, soft: true, interactables: [actMsg(ctx, g, [mesh], '踩踩地毯', '🧶 软乎乎的，脚感真好！', 500)] };
  };
}

// ---------- 运动 ----------
function gTreadmill(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.65, 0.15, 1.5, 0x333340), 0, 0.15, 0);
    const { g: cg, tex } = canvasTex(64, 128);
    cg.fillStyle = '#222'; cg.fillRect(0, 0, 64, 128);
    cg.fillStyle = '#555'; for (let i = 0; i < 8; i++) cg.fillRect(4, i * 16, 56, 3);
    tex.needsUpdate = true; tex.wrapT = THREE.RepeatWrapping;
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.55, 1.4), new THREE.MeshBasicMaterial({ map: tex })), 0, 0.23, 0, 0, -Math.PI / 2);
    for (const sx of [-1, 1]) add(g, B(0.05, 0.9, 0.05, 0x666666), sx * 0.3, 0.6, -0.65);
    add(g, B(0.65, 0.25, 0.1, 0x333340), 0, 1.1, -0.65);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.7, d: 1.55 },
      updater(dt) { if (st.on) { tex.offset.y -= dt * 2; tex.needsUpdate = false; } },
      interactables: [actToggle(g, [g.children[4]], '开始跑步', '停下', on => {
        st.on = on; beep(on ? 500 : 260, 0.12, 'sine', 0.05);
        ctx.flashMessage(on ? '🏃 跑带转起来了，加油！' : '💦 出了一身汗，爽！');
      })],
    };
  };
}
function gDumbbell(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.7, 0.05, 0.3, 0x444444), 0, 0.5, 0);
    add(g, B(0.7, 0.05, 0.3, 0x444444), 0, 0.25, 0);
    for (const sx of [-1, 1]) add(g, B(0.05, 0.55, 0.3, 0x444444), sx * 0.33, 0.28, 0);
    for (let i = 0; i < 4; i++) {
      const x = -0.22 + i * 0.15, y = i < 2 ? 0.55 : 0.3;
      add(g, C(0.015, 0.015, 0.16, 0x888888, 8), x, y, 0).rotation.x = Math.PI / 2;
      add(g, C(0.05, 0.05, 0.03, 0x222222, 12), x, y, -0.08).rotation.x = Math.PI / 2;
      add(g, C(0.05, 0.05, 0.03, 0x222222, 12), x, y, 0.08).rotation.x = Math.PI / 2;
    }
    return { group: g, foot: { w: 0.75, d: 0.35 }, interactables: [actMsg(ctx, g, [g.children[0]], '举铁 💪', '💪 一二！肌肉在燃烧！', 340)] };
  };
}
function gYogaMat(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const m = add(g, B(0.6, 0.015, 1.7, o.color ?? 0x9b59b6), 0, 0.01, 0);
    m.castShadow = false;
    add(g, C(0.08, 0.08, 0.6, o.color ?? 0x9b59b6, 12), 0, 0.09, -0.95).rotation.z = Math.PI / 2;
    return { group: g, foot: { w: 0.65, d: 1.75 }, soft: true, interactables: [actMsg(ctx, g, [m], '做瑜伽', '🧘 深呼吸……身心都放松了！', 460)] };
  };
}
function gPunchBag(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.3, 0.35, 0.06, 0x555555), 0, 0.03, 0);
    add(g, C(0.04, 0.04, 1.9, 0x555555), 0, 0.95, 0);
    add(g, B(0.5, 0.05, 0.05, 0x555555), 0.22, 1.9, 0);
    add(g, C(0.02, 0.02, 0.25, 0x888888), 0.42, 1.75, 0);
    const bag = add(g, C(0.16, 0.18, 0.7, 0xd94f4f, 16), 0.42, 1.25, 0);
    bag.geometry.translate(0, 0.35, 0);
    const st = { v: 0 };
    return {
      group: g, foot: { w: 0.9, d: 0.6 },
      updater(dt) {
        bag.rotation.x += st.v * dt;
        st.v += (-bag.rotation.x * 12 - st.v * 1.5) * dt;
      },
      interactables: [{
        pos: g.position, meshes: [bag],
        getPrompt: () => '按 <b>E</b> 打拳 🥊',
        action: () => { st.v = 3 + Math.random() * 2; beep(120, 0.1, 'sawtooth', 0.08); ctx.flashMessage('🥊 砰！漂亮的一击！'); },
      }],
    };
  };
}
function gBike(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.08, 1.0, 0x444444), 0, 0.04, 0);
    add(g, C(0.3, 0.3, 0.06, 0x666666, 20), 0, 0.4, -0.3).rotation.x = Math.PI / 2;
    add(g, B(0.05, 0.7, 0.05, 0x666666), 0, 0.4, 0.25, 0, -0.3);
    add(g, B(0.05, 0.5, 0.05, 0x666666), 0, 0.6, -0.25, 0, 0.3);
    add(g, B(0.3, 0.06, 0.2, 0x222222), 0, 0.78, 0.3);
    add(g, B(0.4, 0.04, 0.04, 0x888888), 0, 0.85, -0.35);
    return { group: g, foot: { w: 0.55, d: 1.05 }, interactables: [actMsg(ctx, g, [g.children[1]], '骑动感单车', '🚴 蹬起来了，心率飙升！', 420)] };
  };
}
function gPullup(o) {
  return (ctx) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      add(g, B(0.06, 2.1, 0.06, 0x444444), sx * 0.55, 1.05, 0);
      add(g, B(0.06, 0.06, 0.6, 0x444444), sx * 0.55, 0.03, 0);
    }
    add(g, B(1.2, 0.05, 0.05, 0x888888), 0, 2.1, 0);
    return { group: g, foot: { w: 1.2, d: 0.65 }, interactables: [actMsg(ctx, g, [g.children[2]], '做引体向上', '💪 1…2…3！做了三个引体向上！', 360)] };
  };
}

// ---------- 收纳 ----------
function gStorageBox(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(o.w, 0.4, o.d, o.color), 0, 0.2, 0);
    const lid = add(g, B(o.w + 0.04, 0.08, o.d + 0.04, o.lid ?? 0x888888), 0, 0.44, 0);
    lid.geometry.translate(0, 0, -o.d / 2); lid.position.z = o.d / 2;
    return { group: g, foot: { w: o.w + 0.1, d: o.d + 0.1 }, interactables: [lidAct(g, lid, o.what ?? '箱子')] };
  };
}
function gBasket(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const b = add(g, C(0.28, 0.2, 0.35, 0xb5895a, 18), 0, 0.175, 0);
    b.material.roughness = 1;
    add(g, C(0.29, 0.29, 0.03, 0x9a7040, 18), 0, 0.35, 0);
    return { group: g, foot: { w: 0.55, d: 0.55 }, interactables: [actMsg(ctx, g, [b], '翻翻篮子', '🧺 找到了失踪已久的遥控器！', 540)] };
  };
}
function gSuitcase(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.6, 0.75, 0.25, o.color ?? 0x8a4a3a), 0, 0.4, 0);
    add(g, B(0.62, 0.06, 0.27, 0x6b3527), 0, 0.4, 0);
    add(g, B(0.2, 0.15, 0.03, 0x666666), 0, 0.85, 0);
    for (const sx of [-1, 1]) add(g, C(0.04, 0.04, 0.04, 0x333333, 10), sx * 0.2, 0.02, 0.08).rotation.x = Math.PI / 2;
    return { group: g, foot: { w: 0.65, d: 0.3 }, interactables: [actMsg(ctx, g, [g.children[0]], '打开行李箱', '🧳 收拾好了，随时可以出发旅行！', 560)] };
  };
}
function gToyBox(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.8, 0.45, 0.5, o.color ?? 0x4f7ad9), 0, 0.225, 0);
    const lid = add(g, B(0.84, 0.08, 0.54, 0xd94f4f), 0, 0.49, 0);
    lid.geometry.translate(0, 0, -0.25); lid.position.z = 0.25;
    add(g, S(0.09, 0xffd54a), -0.2, 0.5, 0);
    add(g, B(0.12, 0.12, 0.12, 0x53b15a), 0.15, 0.48, -0.05, 0.4);
    return { group: g, foot: { w: 0.85, d: 0.55 }, interactables: [lidAct(g, lid, '玩具箱')] };
  };
}
function gUmbrella(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.18, 0.14, 0.4, 0x666666, 14), 0, 0.2, 0);
    for (let i = 0; i < 3; i++) {
      add(g, C(0.015, 0.015, 0.6, [0xd94f4f, 0x4f7ad9, 0xffd54a][i], 8), (i - 1) * 0.06, 0.45, (i % 2) * 0.05);
      add(g, new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), new THREE.MeshStandardMaterial({ color: [0xd94f4f, 0x4f7ad9, 0xffd54a][i] })), (i - 1) * 0.06, 0.78, (i % 2) * 0.05);
    }
    return { group: g, foot: { w: 0.4, d: 0.4 }, interactables: [actMsg(ctx, g, [g.children[0]], '拿把伞', '☂️ 拿了把伞，出门不怕下雨！', 600)] };
  };
}
function gShoeRack(o) {
  return (ctx) => {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) add(g, B(0.7, 0.04, 0.3, o.color ?? 0x8a5f38), 0, 0.15 + i * 0.25, 0);
    for (const sx of [-1, 1]) add(g, B(0.04, 0.75, 0.3, o.color ?? 0x8a5f38), sx * 0.35, 0.375, 0);
    for (let i = 0; i < 4; i++) add(g, B(0.12, 0.07, 0.26, [0xd94f4f, 0x333333, 0xffffff, 0x4f7ad9][i]), -0.22 + (i % 2) * 0.3, 0.2 + Math.floor(i / 2) * 0.25, 0);
    return { group: g, foot: { w: 0.75, d: 0.35 }, interactables: [actMsg(ctx, g, [g.children[0]], '整理鞋子', '👟 鞋子都摆整齐了！', 580)] };
  };
}

// ---------- 宠物 ----------
function gCatTree(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.05, 0.5, 0xb5895a), 0, 0.03, 0);
    add(g, C(0.05, 0.05, 0.8, 0xd8c8a8), -0.15, 0.43, -0.15);
    add(g, C(0.05, 0.05, 1.3, 0xd8c8a8), 0.15, 0.68, 0.15);
    add(g, B(0.4, 0.05, 0.4, 0xb5895a), -0.15, 0.85, -0.15);
    add(g, B(0.35, 0.05, 0.35, 0xb5895a), 0.15, 1.35, 0.15);
    add(g, S(0.06, 0xd94f4f), 0.15, 1.2, 0.32);
    const cat = add(g, S(0.09, 0x888888), -0.15, 0.93, -0.15);
    return { group: g, foot: { w: 0.55, d: 0.55 }, updater(dt, t) { cat.position.y = 0.93 + Math.sin(t * 1.5) * 0.01; }, interactables: [actMsg(ctx, g, [cat], '逗猫', '🐱 喵～猫咪蹭了蹭你的手！', 800)] };
  };
}
function gDogHouse(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.7, 0.5, 0.7, o.color ?? 0xb5654a), 0, 0.25, 0);
    const roofL = add(g, B(0.85, 0.05, 0.45, 0x8a4a3a), 0, 0.6, -0.18);
    roofL.rotation.x = 0.5;
    const roofR = add(g, B(0.85, 0.05, 0.45, 0x8a4a3a), 0, 0.6, 0.18);
    roofR.rotation.x = -0.5;
    add(g, B(0.3, 0.35, 0.05, 0x4a3524), 0, 0.18, 0.33);
    const dog = add(g, S(0.1, 0xc89858), 0, 0.15, 0.45);
    return { group: g, foot: { w: 0.85, d: 0.9 }, updater(dt, t) { dog.position.x = Math.sin(t * 2) * 0.05; }, interactables: [actMsg(ctx, g, [dog], '摸摸狗', '🐶 汪汪！狗狗开心地摇尾巴！', 500)] };
  };
}
function gHamster(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.05, 0.35, 0x88ccee), 0, 0.45, 0);
    add(g, B(0.5, 0.42, 0.35, 0x8a5f38), 0, 0.21, 0);
    const cageMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, wireframe: true });
    add(g, new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.35), cageMat), 0, 0.62, 0);
    const wheel = add(g, new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.015, 8, 18), new THREE.MeshStandardMaterial({ color: 0x999999 })), 0.1, 0.62, -0.1);
    const ham = add(g, S(0.04, 0xd8b078), 0.1, 0.55, -0.1);
    return {
      group: g, foot: { w: 0.55, d: 0.4 },
      updater(dt) { wheel.rotation.z += dt * 3; ham.position.y = 0.55 + Math.sin(Date.now() * 0.01) * 0.01; },
      interactables: [actMsg(ctx, g, [wheel], '看仓鼠跑轮', '🐹 仓鼠跑得飞快，太可爱了！', 900)],
    };
  };
}

// ---------- 原有特殊家具（保留 ID 兼容存档）----------
function buildMiniShelf(ctx) { return gBooks({ w: 1.2, h: 1.5, d: 0.35, color: 0x6e4a2f, levels: 2, perLevel: 2, empty: true })(ctx); }
function buildLamp(ctx) { return gFloorLamp({ style: 'classic', shade: 0xf2d9a0 })(ctx); }
function buildSpeaker(ctx) { return gSpeaker({})(ctx); }
function buildPlant(ctx) { return gPlant({ kind: 'ball', leaf: 0x53b15a })(ctx); }

// ============================================================
//  家具目录（131 件，14 个分类）
// ============================================================
function F(id, icon, name, price, cat, desc, build) { return { id, icon, name, price, cat, desc, build }; }

export const CATALOG = [
  // ===== 桌椅 =====
  F('table_dining', '🪑', '实木餐桌', 320, '桌椅', '可以擦得闪闪发亮的大家庭餐桌', gTable({ w: 2.0, d: 1.1, h: 0.76, top: 0x9a6b3f, leg: 0x7a5230 })),
  F('table_round', '⭕', '玻璃圆桌', 360, '桌椅', '通透的钢化玻璃圆桌', gTable({ round: true, r: 0.55, h: 0.74, glass: true, leg: 0x666666 })),
  F('table_desk', '📐', '简约书桌', 280, '桌椅', '白色北欧风书桌', gTable({ w: 1.3, d: 0.7, h: 0.75, top: 0xf0f0f0, leg: 0xcccccc })),
  F('table_standing', '⬆️', '升降书桌', 450, '桌椅', '站立办公，保护腰椎', gTable({ w: 1.4, d: 0.7, h: 1.0, top: 0x8a8a92, leg: 0x444444, legT: 0.05 })),
  F('table_coffee', '☕', '咖啡矮桌', 200, '桌椅', '客厅百搭小茶几', gTable({ w: 1.1, d: 0.6, h: 0.42, top: 0x6b4527, leg: 0x4a3524 })),
  F('table_side', '🛋️', '沙发边几', 120, '桌椅', '放杯咖啡刚刚好', gTable({ w: 0.5, d: 0.5, h: 0.55, top: 0xb5895a, leg: 0x8a6a4a })),
  F('table_bar', '🍸', '吧台桌', 380, '桌椅', '高脚设计，小酌一杯', gTable({ w: 1.4, d: 0.5, h: 1.05, top: 0x4a3524, leg: 0x333333, legT: 0.05 })),
  F('table_folding', '📦', '折叠桌', 150, '桌椅', '轻便好用，随收随放', gTable({ w: 1.2, d: 0.6, h: 0.72, top: 0xd8d8dc, leg: 0x888888, legT: 0.04 })),
  F('chair_wood', '🪑', '原木椅', 80, '桌椅', '朴素结实的木椅子', gChair({ style: 'wood', frame: 0x9a6b3f })),
  F('chair_cushion', '🪑', '软垫餐椅', 120, '桌椅', '坐着吃饭更香', gChair({ style: 'cushion', frame: 0x6b4527, cushion: 0xc2554f })),
  F('chair_office', '💺', '办公转椅', 260, '桌椅', '五星脚轮，久坐不累', gChair({ style: 'office', frame: 0x333333, cushion: 0x4a4a55 })),
  F('chair_gaming', '🎮', '电竞椅', 420, '桌椅', '红黑配色，战斗力加成', gChair({ style: 'gaming', frame: 0x222222, cushion: 0xd94040, accent: 0xd94040 })),
  F('chair_stool', '🍹', '吧台凳', 110, '桌椅', '配吧台桌刚刚好', gChair({ style: 'stool', seatY: 0.75, frame: 0x666666, cushion: 0x8a5f38 })),
  F('chair_rocking', '🎠', '摇椅', 300, '桌椅', '摇啊摇，摇到外婆桥', gChair({ style: 'rocking', frame: 0x8a5f38, cushion: 0x6a8fbf })),
  F('chair_bench', '🛤️', '长凳', 180, '桌椅', '能坐三个人', gChair({ style: 'bench', frame: 0x7a5230, cushion: 0xb5895a, len: 1.4 })),

  // ===== 沙发 =====
  F('sofa_beanbag', '🫘', '懒人沙发', 350, '沙发', '陷进去就不想起来', gBeanbag({ color: 0xe0a83c })),
  F('sofa_single', '🛋️', '单人沙发', 400, '沙发', '独享的柔软角落', gSofa({ seats: 1, color: 0x4e7a5a, cushion: 0x6a9a76 })),
  F('sofa_double', '🛋️', '双人沙发', 650, '沙发', '两人世界的温馨', gSofa({ seats: 2, color: 0x5b7fa6, cushion: 0x7a9ac0 })),
  F('sofa_triple', '🛋️', '三人沙发', 850, '沙发', '全家一起看电视', gSofa({ seats: 3, color: 0x8a5a6a, cushion: 0xaa7a8a })),
  F('sofa_l', '📐', 'L型沙发', 1200, '沙发', '转角大沙发，躺卧自由', gSofa({ seats: 2, color: 0x5a6a7a, cushion: 0x7a8a9a, lshape: true })),
  F('sofa_chaise', '👑', '贵妃椅', 700, '沙发', '优雅地躺平', gSofa({ seats: 1, color: 0x9b59b6, cushion: 0xbb79d6, chaise: true })),
  F('sofa_velvet', '✨', '天鹅绒沙发', 950, '沙发', '高级绒面质感', gSofa({ seats: 2, color: 0x2e5a4e, cushion: 0x3e7a6e })),

  // ===== 床 =====
  F('bed_single', '🛏️', '单人床', 500, '床', '一个人的好梦', gBed({ w: 1.0, d: 2.0, frame: 0x8a5f38, blanket: 0x6a8fbf })),
  F('bed_double', '🛏️', '双人床', 800, '床', '滚来滚去也不怕掉下去', gBed({ w: 1.7, d: 2.1, frame: 0x7a5230, blanket: 0xc2554f })),
  F('bed_bunk', '🛝', '上下铺', 950, '床', '睡上铺是童年梦想', gBed({ w: 1.0, d: 2.0, frame: 0x9a6b3f, blanket: 0x53b15a, style: 'bunk' })),
  F('bed_tatami', '🎑', '榻榻米', 420, '床', '日式极简，贴近大地', gBed({ w: 1.6, d: 2.0, blanket: 0xe0a83c, style: 'tatami' })),
  F('bed_round', '🔵', '圆形床', 1100, '床', '360° 翻滚自由', gBed({ frame: 0x6a5a7a, blanket: 0x9b59b6, style: 'round' })),

  // ===== 柜架 =====
  F('wardrobe_2', '🚪', '双门衣柜', 600, '柜架', '双开门，收纳四季衣物', gCabinet({ w: 1.4, h: 2.0, d: 0.6, color: 0x8a5f38, doors: 2, what: '衣柜门' })),
  F('wardrobe_3', '🚪', '三门衣柜', 800, '柜架', '超大容量，买买买也不怕', gCabinet({ w: 1.9, h: 2.0, d: 0.6, color: 0xa9805a, doors: 3, what: '衣柜门' })),
  F('drawer_chest', '🗄️', '三斗柜', 350, '柜架', '顶层抽屉可以拉开', gDrawers({ w: 0.9, h: 0.95, d: 0.5, color: 0x8a5f38, n: 3 })),
  F('nightstand', '🛏️', '床头柜', 150, '柜架', '放手机和台灯', gDrawers({ w: 0.45, h: 0.5, d: 0.4, color: 0x9a6b3f, n: 2 })),
  F('cabinet_dining', '🍽️', '餐具柜', 550, '柜架', '玻璃门展示心爱的餐具', gCabinet({ w: 1.2, h: 1.7, d: 0.45, color: 0x7a5230, doors: 2, glass: true, what: '玻璃门' })),
  F('cabinet_display', '🏆', '展示柜', 700, '柜架', '把手办和奖杯亮出来', gCabinet({ w: 0.9, h: 1.8, d: 0.4, color: 0x5a4632, doors: 2, glass: true, what: '展示柜门' })),
  F('cabinet_shoe', '👟', '鞋柜', 250, '柜架', '门口的收纳担当', gCabinet({ w: 0.9, h: 1.0, d: 0.35, color: 0x9a6b3f, doors: 2, what: '鞋柜门' })),
  F('tv_stand', '📺', '电视柜', 300, '柜架', '稳重大气的客厅配角', gCabinet({ w: 1.6, h: 0.5, d: 0.45, color: 0x6b4a2f, doors: 2, what: '柜门' })),
  F('locker', '🔐', '金属储物柜', 400, '柜架', '工业风，结实耐用', gCabinet({ w: 0.8, h: 1.8, d: 0.45, color: 0x7a8a92, door: 0x9aaab2, doors: 2, what: '铁柜门' })),
  F('cabinet_bath', '🛁', '浴室柜', 280, '柜架', '防潮收纳洗漱用品', gCabinet({ w: 0.7, h: 0.85, d: 0.45, color: 0xe8e8ec, door: 0xffffff, doors: 2, what: '浴室柜门' })),
  F('file_cabinet', '📁', '文件柜', 320, '柜架', '重要文件归档', gDrawers({ w: 0.55, h: 1.3, d: 0.55, color: 0x8a929a, front: 0xaab2ba, n: 4 })),
  F('sideboard', '🍷', '餐边柜', 480, '柜架', '餐厅里的优雅收纳', gCabinet({ w: 1.5, h: 0.9, d: 0.45, color: 0x6e4a2f, doors: 3, what: '柜门' })),
  F('minishelf', '📚', '小书柜', 350, '柜架', '散落的书可以放上去，计入整理进度', buildMiniShelf),
  F('bookshelf_big', '📚', '大书架', 600, '柜架', '4 层储书空间，放书计入整理进度', gBooks({ w: 1.8, h: 2.0, d: 0.35, color: 0x6e4a2f, levels: 4, perLevel: 2, empty: true })),
  F('shelf_ladder', '🪜', '梯形置物架', 260, '柜架', 'ins 风摆拍神器', gLadderShelf({ color: 0x9a6b3f })),
  F('shelf_wall', '📏', '壁挂搁板', 90, '柜架', '悬浮在空中的收纳（不挡路）', gWallShelf({ color: 0xb5895a })),
  F('rack_vinyl', '💿', '黑胶唱片架', 180, '柜架', '收藏你的心头好', gBooks({ w: 0.8, h: 0.9, d: 0.35, color: 0x4a3a5a, levels: 2, perLevel: 2 })),

  // ===== 灯具 =====
  F('lamp_classic', '💡', '经典落地灯', 200, '灯具', '温暖的锥形灯罩', buildLamp),
  F('lamp_modern', '🏮', '现代落地灯', 260, '灯具', '极简圆柱灯罩', gFloorLamp({ style: 'modern', shade: 0xf0f0e8 })),
  F('lamp_arc', '🎣', '弧形落地灯', 340, '灯具', '优雅抛物线，照亮沙发', gFloorLamp({ style: 'arc', shade: 0xf2d9a0 })),
  F('lamp_tripod', '🔺', '三脚落地灯', 230, '灯具', '原木三脚架，稳稳的幸福', gFloorLamp({ style: 'tripod', shade: 0xf5e0c0 })),
  F('lamp_table', '🕯️', '原木台灯', 120, '灯具', '床头的一抹暖光', gTableLamp({ shade: 0xf2d9a0 })),
  F('pendant_cloud', '☁️', '云朵吊灯', 280, '灯具', '软绵绵的云，飘在屋里（悬吊不挡路）', gPendant({ style: 'cloud', shade: 0xf8f8f8 })),
  F('pendant_industrial', '🏭', '工业风吊灯', 240, '灯具', '黑色金属罩，酷感十足（悬吊不挡路）', gPendant({ style: 'industrial', shade: 0x2a2a30 })),
  F('neon', '🌈', '霓虹灯牌', 380, '灯具', '点亮房间的仪式感', gNeon({ text: 'HOME', glow: '#ff4a9c' })),

  // ===== 植物 =====
  F('plant_pothos', '🪴', '绿萝', 120, '植物', '好养活的空气净化器', buildPlant),
  F('plant_cactus', '🌵', '仙人掌', 90, '植物', '带刺但可爱，还开了朵小花', gPlant({ kind: 'cactus' })),
  F('plant_succulent', '🌱', '多肉拼盘', 70, '植物', '肉嘟嘟的一盆小可爱', gPlant({ kind: 'succulent', potR: 0.16 })),
  F('plant_bird', '🌿', '天堂鸟', 180, '植物', '大叶片，热带风情', gPlant({ kind: 'tall', potR: 0.24 })),
  F('plant_bamboo', '🎋', '竹盆栽', 140, '植物', '节节高升好彩头', gPlant({ kind: 'bamboo' })),
  F('plant_sakura', '🌸', '樱花树', 260, '植物', '把春天留在房间里', gPlant({ kind: 'tree', leaf: 0xe8a0b8, potR: 0.26 })),
  F('plant_fig', '🌳', '琴叶榕', 200, '植物', '网红绿植，ins 风标配', gPlant({ kind: 'tree', leaf: 0x3f7a3f, potR: 0.26 })),
  F('plant_rose', '🌹', '玫瑰花瓶', 160, '植物', '每天都有好心情', gPlant({ kind: 'flower', leaf: 0xd94f6a, potR: 0.14, pot: 0x88ccee })),

  // ===== 电器 =====
  F('fridge', '🧊', '双门冰箱', 900, '电器', '开门亮灯，里面有汽水', gFridge({ color: 0xd8dde2 })),
  F('washer', '🌀', '滚筒洗衣机', 750, '电器', '滚筒真的会转', gWasher({})),
  F('microwave', '♨️', '微波炉', 320, '电器', '叮——热好了', gMicrowave({})),
  F('oven', '🔥', '嵌入式烤箱', 480, '电器', '烤出满屋面包香', gSimpleAppliance({ w: 0.6, h: 0.6, d: 0.55, base: 0.35, color: 0x3a3a42, detail: 'oven' })),
  F('coffee', '☕', '咖啡机', 380, '电器', '现磨咖啡，提神醒脑', gSimpleAppliance({ w: 0.35, h: 0.4, d: 0.35, base: 0.74, color: 0x2b2b33, detail: 'coffee' })),
  F('toaster', '🍞', '烤面包机', 150, '电器', '啪！吐司弹出来', gSimpleAppliance({ w: 0.3, h: 0.22, d: 0.2, base: 0.74, color: 0xd8b060, detail: 'toast' })),
  F('rice_cooker', '🍚', '电饭煲', 220, '电器', '柴火饭的味道', gSimpleAppliance({ w: 0.32, h: 0.28, d: 0.32, base: 0.74, color: 0xf0f0f0, detail: 'rice' })),
  F('water_dispenser', '🥤', '饮水机', 260, '电器', '咕嘟咕嘟接杯水', gSimpleAppliance({ w: 0.35, h: 1.0, d: 0.35, base: 0, color: 0xe8ecf0, detail: 'water' })),
  F('ac', '❄️', '立式空调', 1100, '电器', '导风板会摆动送风', gAC({})),
  F('fan', '🌬️', '电风扇', 180, '电器', '摇头吹风，叶片真转', gFan({})),
  F('air_purifier', '🍃', '空气净化器', 420, '电器', '呼吸更安心', gSimpleAppliance({ w: 0.4, h: 0.65, d: 0.4, base: 0, color: 0xf0f2f5, detail: 'purify' })),
  F('humidifier', '💧', '加湿器', 200, '电器', '喷出细细的水雾', gSimpleAppliance({ w: 0.28, h: 0.35, d: 0.28, base: 0.74, color: 0xd0e8f0, detail: 'humidify' })),

  // ===== 厨卫 =====
  F('stove', '🍳', '整体灶台', 680, '厨卫', '开火炒菜，带抽油烟机', gStove({})),
  F('sink_kitchen', '🚰', '厨房水槽台', 450, '厨卫', '洗菜洗碗都靠它', gSink({})),
  F('toilet', '🚽', '智能马桶', 620, '厨卫', '马桶盖可以开合', gToilet({})),
  F('bathtub', '🛁', '独立浴缸', 880, '厨卫', '泡个热水澡', gTub({})),
  F('vanity', '🪞', '洗手台镜柜', 380, '厨卫', '照镜子，元气满满', gVanity({})),
  F('shower', '🚿', '玻璃淋浴房', 720, '厨卫', '水流真的会出现', gShower({})),

  // ===== 娱乐 =====
  F('computer', '💻', '电脑桌', 800, '娱乐', '开机后屏幕跑代码雨', buildComputer),
  F('pinball', '🎰', '弹珠台', 1500, '娱乐', '真的可以玩：物理弹跳+音效+计分', buildPinball),
  F('arcade', '🕹️', '街机', 1300, '娱乐', '投币开玩，像素 attract 动画', gArcade({})),
  F('foosball', '⚽', '桌上足球', 900, '娱乐', '来一局桌上足球', gGameTable({ kind: 'foosball' })),
  F('pool', '🎱', '台球桌', 1600, '娱乐', '黑八入袋', gGameTable({ kind: 'pool' })),
  F('pingpong', '🏓', '乒乓球桌', 1100, '娱乐', '漂亮的扣杀', gGameTable({ kind: 'pingpong' })),
  F('dart', '🎯', '飞镖套装', 240, '娱乐', '试试手气，能不能中靶心', gDart({})),
  F('chess', '♟️', '象棋桌', 360, '娱乐', '将军！', gGameTable({ kind: 'chess' })),
  F('mahjong', '🀄', '麻将桌', 680, '娱乐', '杠上开花', gGameTable({ kind: 'mahjong' })),
  F('console', '🎮', '游戏机套装', 950, '娱乐', '主机+显示器，开机有画面', gConsole({})),
  F('tv_crt', '📺', '复古电视机', 300, '娱乐', '带天线的老式电视', gTV({ crt: true })),
  F('tv_flat', '📺', '平板电视', 600, '娱乐', '55 寸大屏', gTV({ w: 1.4 })),
  F('theater', '🎬', '家庭影院', 1400, '娱乐', '巨幕+双音箱，影院级享受', gTheater({})),
  F('vr', '🥽', 'VR 套装', 1200, '娱乐', '进入虚拟世界', gVR({})),
  F('karaoke', '🎤', '卡拉OK机', 560, '娱乐', '在家开演唱会', gKaraoke({})),
  F('speaker', '🎵', '蓝牙音箱', 300, '娱乐', '播放 8-bit 小旋律', buildSpeaker),

  // ===== 乐器 =====
  F('piano_grand', '🎹', '三角钢琴', 2200, '乐器', '黑色烤漆，音色醇厚', gPiano({ grand: true })),
  F('piano_upright', '🎹', '立式钢琴', 1500, '乐器', '家用经典款', gPiano({ grand: false })),
  F('guitar', '🎸', '木吉他', 480, '乐器', '民谣弹唱必备', gGuitar({ color: 0xb5895a })),
  F('guitar_electric', '🎸', '电吉他', 720, '乐器', '摇滚之魂觉醒', gGuitar({ color: 0xd94040, electric: true })),
  F('drums', '🥁', '架子鼓', 980, '乐器', '动次打次动次打次', gDrums({})),
  F('violin', '🎻', '小提琴', 560, '乐器', '悠扬的琴声', gViolin({})),

  // ===== 装饰 =====
  F('mirror', '🪞', '落地镜', 240, '装饰', '出门前照一照', gMirror({})),
  F('easel', '🎨', '画架', 280, '装饰', '每次互动真的会在画布上添一笔', gEasel({})),
  F('art_stand', '🖼️', '立式抽象画', 180, '装饰', '看不懂但很好看', gArtStand({})),
  F('art_stand2', '🌇', '立式风景画', 200, '装饰', '金色的黄昏', gArtStand({ bg: '#d88a3a' })),
  F('grand_clock', '🕰️', '落地钟', 520, '装饰', '钟摆摇动，还能报时（真实时间）', gGrandClock({})),
  F('vase', '🏺', '陶瓷花瓶', 130, '装饰', '青花釉面，温润如玉', gVase({ color: 0x6a8abf })),
  F('vase_flower', '💐', '插花花瓶', 170, '装饰', '鲜花与瓷器相得益彰', gVase({ color: 0xd8d0c8, flowers: true })),
  F('sculpture', '🗿', '现代雕塑', 460, '装饰', '金属扭结，缓缓旋转', gSculpture({})),
  F('globe', '🌍', '地球仪', 320, '装饰', '转一转，环游世界', gGlobe({})),
  F('telescope', '🔭', '天文望远镜', 540, '装饰', '能看到土星环', gTelescope({})),
  F('fishtank', '🐠', '生态鱼缸', 680, '装饰', '三条小鱼真的在游动', gFishTank({ w: 0.8, d: 0.4 })),
  F('birdcage', '🐦', '鸟笼', 220, '装饰', '小鸟蹦蹦跳跳', gBirdCage({})),
  F('rug_circle', '⭕', '圆形地毯', 160, '装饰', '软乎乎的脚感（可铺在家具下）', gRug({ shape: 'circle', r: 1.0, c1: '#c2554f', c2: '#e8a09a', pattern: 'circle' })),
  F('rug_persian', '🧶', '波斯地毯', 320, '装饰', '手工纹样，富丽典雅（可铺在家具下）', gRug({ shape: 'rect', w: 2.4, d: 1.6, c1: '#7a2e3e', c2: '#d8b060', pattern: 'persian' })),
  F('rug_stripe', '🌈', '条纹地垫', 90, '装饰', '清新的彩色条纹（可铺在家具下）', gRug({ shape: 'rect', w: 1.6, d: 1.0, c1: '#4f7ad9', c2: '#f0f0f0', pattern: 'stripes' })),

  // ===== 运动 =====
  F('treadmill', '🏃', '跑步机', 1250, '运动', '跑带真的会滚动', gTreadmill({})),
  F('dumbbell', '🏋️', '哑铃架', 380, '运动', '肌肉在燃烧', gDumbbell({})),
  F('yoga_mat', '🧘', '瑜伽垫', 90, '运动', '深呼吸，放松身心（可铺在家具下）', gYogaMat({})),
  F('punchbag', '🥊', '拳击沙袋', 420, '运动', '打它真的会晃', gPunchBag({})),
  F('bike', '🚴', '动感单车', 760, '运动', '心率飙升', gBike({})),
  F('pullup', '💪', '引体向上架', 340, '运动', '能做三个就是强者', gPullup({})),

  // ===== 收纳 =====
  F('storage_box', '📦', '布艺收纳箱', 80, '收纳', '盖子可以打开', gStorageBox({ w: 0.5, d: 0.4, color: 0x9aa5b1, lid: 0x7a8591 })),
  F('basket', '🧺', '藤编收纳篮', 60, '收纳', '里面有失踪的遥控器', gBasket({})),
  F('suitcase', '🧳', '复古行李箱', 190, '收纳', '随时可以出发旅行', gSuitcase({})),
  F('toybox', '🧸', '玩具箱', 210, '收纳', '装满童年回忆', gToyBox({})),
  F('umbrella_stand', '☂️', '伞桶', 70, '收纳', '雨天好帮手', gUmbrella({})),
  F('shoe_rack', '👞', '多层鞋架', 130, '收纳', '鞋子排排站', gShoeRack({})),

  // ===== 宠物 =====
  F('cattree', '🐱', '猫爬架', 380, '宠物', '猫咪在线打盹', gCatTree({})),
  F('doghouse', '🐶', '狗窝', 240, '宠物', '狗狗开心地摇尾巴', gDogHouse({})),
  F('hamster', '🐹', '仓鼠笼', 190, '宠物', '跑轮转个不停', gHamster({})),
  F('roundtank', '🐟', '圆形金鱼缸', 300, '宠物', '两条金鱼游啊游', gFishTank({ w: 0.5, d: 0.5, round: true })),
];

// ============================================================
//  大航海 · 维多利亚主题家具
// ============================================================
const BRASS = 0x9a7a2a, DARKWOOD = 0x4a3524, MIDWOOD = 0x6a4a2c;

function gShipWheel(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.06, 0.4, DARKWOOD), 0, 0.03, 0);
    add(g, C(0.05, 0.06, 1.1, DARKWOOD), 0, 0.58, 0);
    const wheel = new THREE.Group(); wheel.position.y = 1.2; g.add(wheel);
    add(wheel, new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.035, 10, 24),
      new THREE.MeshStandardMaterial({ color: 0x8a5f38, roughness: 0.6 })), 0, 0, 0);
    for (let i = 0; i < 6; i++) {
      const sp = add(wheel, C(0.02, 0.02, 0.95, 0x8a5f38, 8), 0, 0, 0);
      sp.rotation.z = i * Math.PI / 3;
    }
    add(wheel, S(0.06, BRASS), 0, 0, 0.02);
    wheel.traverse(m => { if (m.isMesh) m.castShadow = true; });
    const st = { on: false };
    return {
      group: g, foot: { w: 0.8, d: 0.5 },
      updater(dt) { if (st.on) wheel.rotation.z += dt * 1.5; },
      interactables: [actToggle(g, [wheel.children[0]], '转动船舵', '停下船舵', on => {
        st.on = on; beep(300, 0.15, 'sine', 0.05);
        if (on) ctx.flashMessage('☸️ 左满舵！目标——新大陆！');
      })],
    };
  };
}
function gAnchor(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color: 0x3a3a42, roughness: 0.5, metalness: 0.7 });
    add(g, C(0.3, 0.35, 0.05, 0x5a4632), 0, 0.03, 0);
    const shank = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.1, 10), iron);
    shank.position.y = 0.6; shank.castShadow = true; g.add(shank);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.02, 8, 16), iron);
    ring.position.y = 1.2; g.add(ring);
    const cross = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.5, 8), iron);
    cross.rotation.z = Math.PI / 2; cross.position.y = 1.0; g.add(cross);
    for (const sx of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.06), iron);
      arm.position.set(sx * 0.18, 0.3, 0); arm.rotation.z = sx * 0.8; arm.castShadow = true; g.add(arm);
      const fluke = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.15, 8), iron);
      fluke.position.set(sx * 0.36, 0.42, 0); fluke.rotation.z = -sx * 0.6; g.add(fluke);
    }
    return { group: g, foot: { w: 0.8, d: 0.5 }, interactables: [actMsg(ctx, g, [shank], '摸摸铁锚', '⚓ 起锚！准备扬帆远航！', 280)] };
  };
}
function gBarrel(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const body = add(g, C(0.26, 0.22, 0.65, o.color ?? 0x8a5f38, 18), 0, 0.325, 0);
    for (const y of [0.12, 0.53]) add(g, new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.015, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0x3a3a42, metalness: 0.6, roughness: 0.5 })), 0, y, 0).rotation.x = Math.PI / 2;
    add(g, C(0.22, 0.22, 0.03, 0x6b4527, 18), 0, 0.66, 0);
    return { group: g, foot: { w: 0.55, d: 0.55 }, interactables: [actMsg(ctx, g, [body], o.prompt, o.msg, o.pitch ?? 300)] };
  };
}
function gTreasure(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.8, 0.4, 0.5, 0x5a3d24), 0, 0.2, 0);
    add(g, B(0.84, 0.06, 0.54, BRASS), 0, 0.06, 0);
    // 金币
    const gold = new THREE.Group();
    for (let i = 0; i < 10; i++)
      add(gold, C(0.05, 0.05, 0.015, 0xffd54a, 12), (Math.random() - 0.5) * 0.5, 0.4 + (i % 3) * 0.02, (Math.random() - 0.5) * 0.3);
    add(gold, S(0.05, 0xd94f6a), -0.15, 0.44, 0.1);
    add(gold, S(0.05, 0x4fc3f7), 0.18, 0.44, -0.05);
    gold.traverse(m => { if (m.isMesh) m.material.emissive = new THREE.Color(0x332200); });
    g.add(gold);
    // 盖子
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 0.4, -0.25);
    const lid = B(0.82, 0.2, 0.52, 0x5a3d24);
    lid.position.set(0, 0.1, 0.25);
    const strap = B(0.84, 0.06, 0.54, BRASS); strap.position.set(0, 0.16, 0.25);
    lidPivot.add(lid, strap);
    g.add(lidPivot);
    const lock = add(g, B(0.1, 0.12, 0.04, BRASS), 0, 0.32, 0.26);
    return {
      group: g, foot: { w: 0.85, d: 0.55 },
      interactables: [actToggle(g, [lid], '打开宝箱', '合上宝箱', on => {
        lidPivot.rotation.x = on ? -1.8 : 0;
        beep(on ? 523 : 262, 0.12, 'sine', 0.06);
        if (on) { ctx.flashMessage('💰 哇——金灿灿的财宝！'); setTimeout(() => beep(784, 0.15, 'sine', 0.05), 120); }
      })],
    };
  };
}
function gCaptainDesk(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.5, 0.07, 0.85, MIDWOOD), 0, 0.76, 0);
    legs4(g, 1.5, 0.85, 0.76, 0.08, DARKWOOD);
    // 桌面航海图
    const { g: cg, tex } = canvasTex(256, 160);
    cg.fillStyle = '#d8c090'; cg.fillRect(0, 0, 256, 160);
    cg.strokeStyle = '#8a6a3a'; cg.lineWidth = 3; cg.strokeRect(6, 6, 244, 148);
    cg.fillStyle = '#a8825a';
    for (const [x, y, w, h] of [[30, 40, 50, 35], [120, 25, 60, 45], [90, 100, 45, 30], [190, 90, 35, 40]]) {
      cg.beginPath(); cg.ellipse(x, y, w / 2, h / 2, 0.3, 0, 7); cg.fill();
    }
    cg.strokeStyle = '#b03a2e'; cg.lineWidth = 2; cg.setLineDash([6, 5]);
    cg.beginPath(); cg.moveTo(40, 130); cg.quadraticCurveTo(120, 60, 205, 100); cg.stroke();
    cg.setLineDash([]);
    cg.strokeStyle = '#b03a2e'; cg.lineWidth = 4;
    cg.beginPath(); cg.moveTo(198, 93); cg.lineTo(212, 107); cg.moveTo(212, 93); cg.lineTo(198, 107); cg.stroke();
    tex.needsUpdate = true;
    add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55), new THREE.MeshBasicMaterial({ map: tex })), -0.15, 0.8, 0, 0, -Math.PI / 2);
    // 罗盘与羽毛笔
    add(g, C(0.06, 0.07, 0.03, BRASS, 14), 0.55, 0.82, -0.2);
    add(g, B(0.02, 0.25, 0.05, 0xf0ead8), 0.45, 0.9, 0.25, 0, 0.5).rotation.z = 0.4;
    return { group: g, foot: { w: 1.55, d: 0.9 }, interactables: [actMsg(ctx, g, [g.children[5]], '研究航海图', '🗺️ 沿着虚线航线……X 就是宝藏！', 500)] };
  };
}
function gSextant(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.35, 0.7, 0.35, DARKWOOD), 0, 0.35, 0);
    add(g, B(0.4, 0.04, 0.4, MIDWOOD), 0, 0.72, 0);
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.015, 8, 20, Math.PI / 2.2),
      new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.3 }));
    arc.position.y = 0.92; arc.rotation.z = -0.3; g.add(arc);
    add(g, B(0.02, 0.3, 0.02, BRASS), 0, 0.92, 0).rotation.z = 0.6;
    add(g, S(0.03, BRASS), 0, 0.78, 0);
    return { group: g, foot: { w: 0.4, d: 0.4 }, interactables: [actMsg(ctx, g, [arc], '观测星象', '📐 测定了纬度：北纬 31°14′！', 640)] };
  };
}
function gCompass(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.14, 0.18, 0.05, DARKWOOD), 0, 0.45, 0);
    add(g, B(0.3, 0.42, 0.3, MIDWOOD), 0, 0.21, 0);
    add(g, C(0.13, 0.13, 0.06, BRASS, 20), 0, 0.52, 0);
    const needle = add(g, B(0.2, 0.01, 0.025, 0xd94f4f), 0, 0.55, 0);
    add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 20),
      new THREE.MeshStandardMaterial({ color: 0xa8d8e8, transparent: true, opacity: 0.4, roughness: 0.1 })), 0, 0.56, 0);
    return {
      group: g, foot: { w: 0.35, d: 0.35 },
      updater(dt, t) { needle.rotation.y = Math.sin(t * 1.5) * 0.15 + Math.sin(t * 4) * 0.03; },
      interactables: [actMsg(ctx, g, [needle], '查看罗盘', '🧭 指针稳稳指向北方，航线正确！', 560)],
    };
  };
}
function gLantern(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.16, 0.2, 0.05, DARKWOOD), 0, 0.03, 0);
    add(g, C(0.025, 0.025, 1.6, DARKWOOD), 0, 0.82, 0);
    add(g, B(0.35, 0.04, 0.04, DARKWOOD), 0.15, 1.62, 0);
    // 悬挂油灯
    const lampG = new THREE.Group(); lampG.position.set(0.3, 1.45, 0); g.add(lampG);
    add(lampG, C(0.07, 0.09, 0.04, BRASS, 12), 0, 0.12, 0);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.55, emissive: 0x000000 });
    const glass = add(lampG, new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.075, 0.16, 12, 1, true), glassMat), 0, 0, 0);
    add(lampG, C(0.08, 0.06, 0.04, BRASS, 12), 0, -0.1, 0);
    const light = new THREE.PointLight(0xffb060, 0, 7);
    add(lampG, light, 0, 0, 0);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.5, d: 0.4 },
      updater(dt, t) { if (st.on) light.intensity = 10 + Math.sin(t * 12) * 2; },
      interactables: [actToggle(g, [glass], '点燃油灯', '熄灭油灯', on => {
        st.on = on;
        light.intensity = on ? 10 : 0;
        glassMat.emissive.setHex(on ? 0xffb060 : 0x000000);
        glassMat.emissiveIntensity = on ? 0.8 : 0;
        beep(on ? 620 : 310, 0.08, 'sine', 0.04);
      })],
    };
  };
}
function gShipBottle(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.4, 0.3, MIDWOOD), 0, 0.2, 0);
    add(g, B(0.55, 0.04, 0.35, DARKWOOD), 0, 0.42, 0);
    const glassMat = new THREE.MeshStandardMaterial({ color: 0xa8d8c8, transparent: true, opacity: 0.35, roughness: 0.1 });
    const bottle = add(g, new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.35, 14), glassMat), 0, 0.55, 0);
    bottle.rotation.z = Math.PI / 2;
    add(g, C(0.035, 0.05, 0.08, glassMat.color.getHex(), 10), 0.2, 0.55, 0).rotation.z = Math.PI / 2;
    // 瓶中船
    add(g, B(0.14, 0.03, 0.04, 0x6b4527), 0, 0.53, 0);
    add(g, B(0.01, 0.12, 0.01, 0x8a5f38), -0.03, 0.6, 0);
    add(g, B(0.01, 0.1, 0.01, 0x8a5f38), 0.04, 0.59, 0);
    add(g, B(0.06, 0.07, 0.005, 0xf0ead8), -0.03, 0.62, 0);
    add(g, B(0.05, 0.06, 0.005, 0xf0ead8), 0.04, 0.61, 0);
    return { group: g, foot: { w: 0.55, d: 0.35 }, interactables: [actMsg(ctx, g, [bottle], '欣赏瓶中船', '⛵ 好精巧的工艺！这艘船是怎么放进去的？', 620)] };
  };
}
function gPorthole(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.7, 1.5, 0.08, DARKWOOD), 0, 0.75, -0.04);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.045, 10, 22),
      new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.75, roughness: 0.3 }));
    ring.position.set(0, 0.9, 0.01); ring.castShadow = true; g.add(ring);
    const { g: cg, tex } = canvasTex(96, 96);
    cg.fillStyle = '#7ab8d8'; cg.fillRect(0, 0, 96, 96);
    cg.fillStyle = '#4a8ab8'; cg.fillRect(0, 55, 96, 41);
    cg.fillStyle = '#fff';
    cg.beginPath(); cg.ellipse(30, 25, 12, 6, 0, 0, 7); cg.fill();
    cg.beginPath(); cg.ellipse(65, 18, 9, 5, 0, 0, 7); cg.fill();
    tex.needsUpdate = true;
    add(g, new THREE.Mesh(new THREE.CircleGeometry(0.27, 22), new THREE.MeshBasicMaterial({ map: tex })), 0, 0.9, 0.005);
    add(g, B(0.5, 0.05, 0.25, DARKWOOD), 0, 0.03, 0.05);
    return { group: g, foot: { w: 0.75, d: 0.3 }, interactables: [actMsg(ctx, g, [ring], '眺望舷窗', '🌊 碧海蓝天……远处好像有一座岛！', 540)] };
  };
}
function gMapFrame(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.08, 1.2, 0.08, DARKWOOD), 0, 0.6, 0);
    add(g, B(0.45, 0.05, 0.3, DARKWOOD), 0, 0.03, 0);
    const { g: cg, tex } = canvasTex(192, 128);
    cg.fillStyle = '#d8c090'; cg.fillRect(0, 0, 192, 128);
    cg.strokeStyle = '#8a6a3a'; cg.lineWidth = 4; cg.strokeRect(4, 4, 184, 120);
    cg.fillStyle = '#a8825a';
    for (const [x, y, rx, ry] of [[50, 50, 22, 16], [130, 40, 28, 20], [110, 90, 20, 14], [160, 95, 14, 18]]) {
      cg.beginPath(); cg.ellipse(x, y, rx, ry, 0.4, 0, 7); cg.fill();
    }
    cg.strokeStyle = '#b03a2e'; cg.lineWidth = 2; cg.setLineDash([5, 4]);
    cg.beginPath(); cg.moveTo(35, 100); cg.quadraticCurveTo(90, 40, 155, 88); cg.stroke();
    cg.setLineDash([]); cg.lineWidth = 4;
    cg.beginPath(); cg.moveTo(149, 82); cg.lineTo(161, 94); cg.moveTo(161, 82); cg.lineTo(149, 94); cg.stroke();
    tex.needsUpdate = true;
    add(g, B(1.0, 0.7, 0.04, 0x8a6a4a), 0, 1.5, 0);
    const art = add(g, new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.62), new THREE.MeshBasicMaterial({ map: tex })), 0, 1.5, 0.025);
    return { group: g, foot: { w: 1.0, d: 0.3 }, interactables: [actMsg(ctx, g, [art], '研究藏宝图', '🗺️ X 标记的地方……一定有宝藏！', 500)] };
  };
}
function gCandelabra(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.16, 0.22, 0.05, BRASS), 0, 0.03, 0);
    add(g, C(0.025, 0.035, 1.4, BRASS), 0, 0.75, 0);
    const flames = [];
    for (const [x, z] of [[0, 0], [0.16, 0], [-0.16, 0]]) {
      if (x) add(g, B(Math.abs(x), 0.03, 0.03, BRASS), x / 2, 1.35, z);
      add(g, C(0.022, 0.022, 0.16, 0xf0ead8), x, 1.46, z);
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 8),
        new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff8800, emissiveIntensity: 2 }));
      f.position.set(x, 1.59, z); f.visible = false; g.add(f); flames.push(f);
    }
    const light = new THREE.PointLight(0xffb060, 0, 7);
    add(g, light, 0, 1.55, 0);
    const st = { on: false };
    return {
      group: g, foot: { w: 0.45, d: 0.45 },
      updater(dt, t) {
        if (!st.on) return;
        light.intensity = 11 + Math.sin(t * 13) * 2;
        flames.forEach((f, i) => f.scale.y = 1 + Math.sin(t * 10 + i * 2.1) * 0.3);
      },
      interactables: [actToggle(g, [g.children[1]], '点燃蜡烛', '吹灭蜡烛', on => {
        st.on = on; light.intensity = on ? 11 : 0;
        for (const f of flames) f.visible = on;
        beep(on ? 620 : 310, 0.08, 'sine', 0.04);
      })],
    };
  };
}
function gFireplace(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const stone = 0x6a6560, stoneD = 0x55504c;
    add(g, B(1.7, 1.35, 0.3, stone), 0, 0.675, -0.15);
    add(g, B(0.3, 1.2, 0.4, stoneD), 0.68, 0.6, 0.05);
    add(g, B(0.3, 1.2, 0.4, stoneD), -0.68, 0.6, 0.05);
    add(g, B(1.75, 0.14, 0.5, DARKWOOD), 0, 1.28, 0.02);
    add(g, B(1.05, 1.0, 0.3, 0x14100c), 0, 0.5, 0);
    add(g, C(0.06, 0.06, 0.7, 0x4a3020, 10), 0, 0.12, 0.08).rotation.x = Math.PI / 2;
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xff7716, emissive: 0xff5500, emissiveIntensity: 1.6, transparent: true, opacity: 0.95 });
    const flames = [];
    for (const [x, s] of [[-0.15, 0.8], [0, 1.1], [0.15, 0.9]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.4 * s, 8), flameMat);
      f.position.set(x, 0.35, 0.08); f.visible = false; g.add(f); flames.push(f);
    }
    const light = new THREE.PointLight(0xff7733, 0, 7);
    add(g, light, 0, 0.6, 0.4);
    const st = { on: false };
    return {
      group: g, foot: { w: 1.8, d: 0.6 },
      updater(dt, t) {
        if (!st.on) return;
        light.intensity = 12 + Math.sin(t * 11) * 3 + Math.sin(t * 23) * 2;
        flames.forEach((f, i) => f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.25);
      },
      interactables: [actToggle(g, [g.children[0]], '生起炉火', '熄灭火炉', on => {
        st.on = on; light.intensity = on ? 12 : 0;
        for (const f of flames) f.visible = on;
        beep(on ? 200 : 150, 0.15, 'sawtooth', 0.05);
        if (on) ctx.flashMessage('🔥 炉火噼啪作响，房间暖起来了！');
      })],
    };
  };
}
function gGramophone(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(0.5, 0.5, 0.45, DARKWOOD), 0, 0.25, 0);
    add(g, C(0.16, 0.16, 0.03, 0x1a1a1a, 20), 0, 0.52, 0);
    add(g, C(0.03, 0.03, 0.06, BRASS, 8), 0, 0.55, 0);
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 18, 1, true),
      new THREE.MeshStandardMaterial({ color: BRASS, metalness: 0.7, roughness: 0.3, side: THREE.DoubleSide }));
    horn.position.set(0.15, 0.85, -0.1); horn.rotation.z = -0.9; horn.rotation.x = -0.4; horn.castShadow = true;
    g.add(horn);
    const disc = g.children[1];
    return {
      group: g, foot: { w: 0.6, d: 0.5 },
      updater(dt) { disc.rotation.y += dt * 2; },
      interactables: [musicAct(g, [horn], [523, 659, 784, 523, 587, 698, 880, 587, 523, 659, 784, 1046], 'sine', 300, '放上唱片 📀')],
    };
  };
}
function gHammock(o) {
  return (ctx) => {
    const g = new THREE.Group();
    for (const sx of [-1, 1]) {
      add(g, C(0.04, 0.05, 1.2, DARKWOOD), sx * 1.0, 0.6, 0);
      add(g, B(0.3, 0.05, 0.3, DARKWOOD), sx * 1.0, 0.03, 0);
    }
    const clothMat = new THREE.MeshStandardMaterial({ color: o.color ?? 0xd8c8a0, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const seg = add(g, B(0.42, 0.02, 0.65, 0), 0, 0, 0);
      seg.material = clothMat;
      const t = i / 4, x = -0.8 + t * 1.6;
      seg.position.set(x, 0.55 + Math.pow(Math.abs(t - 0.5) * 2, 2) * 0.35, 0);
      seg.rotation.z = (t - 0.5) * -1.2;
      seg.castShadow = true;
    }
    return { group: g, foot: { w: 2.1, d: 0.7 }, interactables: [actMsg(ctx, g, [g.children[4]], '躺进吊床', '⛵ 晃啊晃……想起在海上的日子', 420)] };
  };
}
function gFourPoster(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.6, 0.3, 2.1, DARKWOOD), 0, 0.18, 0);
    add(g, B(1.5, 0.16, 2.0, 0xf0ead8), 0, 0.4, 0);
    add(g, B(1.46, 0.07, 1.3, o.blanket ?? 0x6a2e3a), 0, 0.5, 0.3);
    add(g, B(0.5, 0.1, 0.3, 0xfff8ee), -0.35, 0.52, -0.75);
    add(g, B(0.5, 0.1, 0.3, 0xfff8ee), 0.35, 0.52, -0.75);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      add(g, C(0.05, 0.06, 1.9, DARKWOOD), sx * 0.75, 0.95, sz * 1.0);
      add(g, S(0.06, BRASS), sx * 0.75, 1.93, sz * 1.0);
    }
    add(g, B(1.6, 0.06, 2.1, o.canopy ?? 0x8a2e3a), 0, 1.9, 0);
    for (const sx of [-1, 1]) {
      const curtain = add(g, B(0.06, 1.5, 0.5, o.canopy ?? 0x8a2e3a), sx * 0.75, 1.1, -0.8);
      curtain.material.transparent = true; curtain.material.opacity = 0.85;
    }
    return { group: g, foot: { w: 1.7, d: 2.2 }, interactables: [actMsg(ctx, g, [g.children[1]], '躺下休息', '👑 像贵族一样入眠……', 380)] };
  };
}
function gWingback(o) {
  return (ctx) => {
    const g = new THREE.Group();
    const c = o.color ?? 0x6a2e3a;
    add(g, B(0.6, 0.35, 0.6, c), 0, 0.3, 0);
    add(g, B(0.6, 0.75, 0.15, c), 0, 0.85, -0.24);
    for (const sx of [-1, 1]) {
      const wing = add(g, B(0.12, 0.6, 0.3, c), sx * 0.26, 0.8, -0.12);
      wing.rotation.y = -sx * 0.25;
      add(g, B(0.12, 0.25, 0.55, c), sx * 0.26, 0.55, 0.02);
      add(g, C(0.03, 0.04, 0.15, DARKWOOD), sx * 0.24, 0.075, 0.24);
      add(g, C(0.03, 0.04, 0.15, DARKWOOD), sx * 0.24, 0.075, -0.2);
    }
    add(g, B(0.5, 0.1, 0.45, o.cushion ?? 0x8a4a5a), 0, 0.5, 0.03);
    return { group: g, foot: { w: 0.7, d: 0.7 }, interactables: [actMsg(ctx, g, [g.children[0]], '坐进扶手椅', '🛋️ 包裹感十足的贵族座椅！', 460)] };
  };
}
function gTeaSet(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, C(0.45, 0.45, 0.04, MIDWOOD, 24), 0, 0.72, 0);
    add(g, C(0.05, 0.07, 0.7, DARKWOOD), 0, 0.36, 0);
    add(g, C(0.25, 0.3, 0.04, DARKWOOD, 20), 0, 0.02, 0);
    // 茶壶
    const pot = add(g, S(0.1, 0xe8e0d0, 16), -0.12, 0.82, 0);
    add(g, C(0.02, 0.035, 0.09, 0xe8e0d0, 8), -0.22, 0.85, 0).rotation.z = 0.8;
    add(g, S(0.025, 0xd8a0a8, 8), -0.12, 0.93, 0);
    for (const [x, z] of [[0.12, 0.12], [0.15, -0.1], [-0.02, 0.2]]) {
      add(g, C(0.035, 0.028, 0.05, 0xffffff, 10), x, 0.765, z);
      add(g, C(0.055, 0.055, 0.012, 0xe8e0d0, 12), x, 0.745, z);
    }
    return { group: g, foot: { w: 0.7, d: 0.7 }, interactables: [actMsg(ctx, g, [pot], '享用下午茶', '🫖 倒了一杯伯爵红茶，配上司康饼～', 580)] };
  };
}
function gTypewriter(o) {
  return (ctx) => {
    const g = new THREE.Group();
    add(g, B(1.0, 0.06, 0.6, MIDWOOD), 0, 0.74, 0);
    legs4(g, 1.0, 0.6, 0.74, 0.06, DARKWOOD);
    const body = add(g, B(0.4, 0.15, 0.3, 0x2a2a30), 0, 0.85, -0.05);
    add(g, C(0.035, 0.035, 0.38, 0x1a1a1a, 10), 0, 0.95, -0.15).rotation.z = Math.PI / 2;
    add(g, B(0.3, 0.12, 0.01, 0xf8f4e8), 0, 1.0, -0.16, 0, -0.3);
    for (let r = 0; r < 3; r++)
      for (let k = 0; k < 8; k++)
        add(g, C(0.015, 0.015, 0.015, 0xe8e8e8, 6), -0.14 + k * 0.04, 0.87 + r * 0.025, 0.03 + r * 0.035);
    return {
      group: g, foot: { w: 1.05, d: 0.65 },
      interactables: [{
        pos: g.position, meshes: [body],
        getPrompt: () => '按 <b>E</b> 写航海日志',
        action: () => {
          ctx.flashMessage('⌨️ 嗒嗒嗒……"今日，发现了新大陆。"');
          beep(800, 0.03, 'square', 0.04); setTimeout(() => beep(750, 0.03, 'square', 0.04), 90);
          setTimeout(() => beep(820, 0.03, 'square', 0.04), 180); setTimeout(() => beep(700, 0.06, 'square', 0.04), 300);
        },
      }],
    };
  };
}

// ============================================================
//  主题目录
// ============================================================
const V_REUSE = [
  'chair_wood', 'chair_rocking', 'table_dining', 'table_side', 'bed_single',
  'wardrobe_2', 'wardrobe_3', 'drawer_chest', 'nightstand', 'cabinet_dining', 'cabinet_display',
  'sideboard', 'minishelf', 'bookshelf_big', 'shelf_ladder',
  'plant_pothos', 'plant_sakura', 'plant_rose',
  'bathtub', 'vanity',
  'piano_grand', 'piano_upright', 'guitar', 'violin',
  'mirror', 'easel', 'art_stand2', 'grand_clock', 'vase', 'vase_flower', 'sculpture',
  'globe', 'telescope', 'birdcage',
  'rug_circle', 'rug_persian', 'umbrella_stand', 'suitcase', 'toybox', 'basket',
];

export const VICTORIAN_CATALOG = [
  // ===== 航海 =====
  F('ship_wheel', '☸️', '船舵装饰', 420, '航海', '转动船舵，目标新大陆', gShipWheel({})),
  F('anchor', '⚓', '大铁锚', 380, '航海', '起锚！准备远航', gAnchor({})),
  F('barrel_rum', '🛢️', '朗姆酒桶', 160, '航海', '海盗的最爱', gBarrel({ color: 0x8a5f38, prompt: '闻一闻酒桶', msg: '🍺 嗯——是上等朗姆酒的香气！' })),
  F('barrel_powder', '🧨', '火药桶', 180, '航海', '小心轻放！', gBarrel({ color: 0x3a3a42, prompt: '检查火药桶', msg: '🧨 干燥密封，完好无损……千万别靠近火源！', pitch: 200 })),
  F('barrel_water', '🛢️', '淡水桶', 120, '航海', '远航必备补给', gBarrel({ color: 0x6a7a8a, prompt: '喝点淡水', msg: '💧 咕咚咕咚，清甜的淡水！', pitch: 500 })),
  F('treasure', '💰', '海盗宝箱', 880, '航海', '打开看看里面的财宝', gTreasure({})),
  F('captain_desk', '🗺️', '船长航海桌', 720, '航海', '桌面铺着真正的航海图', gCaptainDesk({})),
  F('sextant', '📐', '六分仪', 340, '航海', '观测星象测定纬度', gSextant({})),
  F('compass', '🧭', '航海罗盘', 260, '航海', '指针永远指向北方', gCompass({})),
  F('lantern', '🏮', '船用油灯', 180, '航海', '火光摇曳，照亮夜航', gLantern({})),
  F('ship_bottle', '⛵', '瓶中船', 460, '航海', '精巧的手工瓶中船', gShipBottle({})),
  F('porthole', '🪟', '舷窗装饰', 300, '航海', '透过舷窗看海', gPorthole({})),
  F('map_frame', '🗺️', '航海藏宝图', 280, '航海', 'X 标记着宝藏的位置', gMapFrame({})),
  // ===== 维多利亚 =====
  F('candelabra', '🕯️', '银烛台', 240, '维多利亚', '三支蜡烛，火光摇曳', gCandelabra({})),
  F('fireplace', '🔥', '石砌壁炉', 980, '维多利亚', '生起炉火，温暖整个房间', gFireplace({})),
  F('gramophone', '📻', '留声机', 620, '维多利亚', '黄铜喇叭播放华尔兹', gGramophone({})),
  F('hammock', '⛵', '水手吊床', 340, '维多利亚', '晃啊晃，梦回大海', gHammock({})),
  F('four_poster', '🛏️', '四柱床', 1200, '维多利亚', '带帷幔的贵族床', gFourPoster({})),
  F('wingback', '🪑', '翼背扶手椅', 560, '维多利亚', '包裹感十足的绅士座椅', gWingback({})),
  F('chesterfield', '🛋️', '切斯特菲尔德沙发', 1100, '维多利亚', '经典英式皮沙发', gSofa({ seats: 2, color: 0x5a3a28, cushion: 0x6b4530 })),
  F('tea_set', '🫖', '下午茶桌', 380, '维多利亚', '伯爵红茶配司康饼', gTeaSet({})),
  F('typewriter', '⌨️', '打字机桌', 440, '维多利亚', '嗒嗒嗒，写下航海日志', gTypewriter({})),
  // ===== 经典沿用 =====
  ...V_REUSE.map(id => CATALOG.find(d => d.id === id)),
];

export function getCatalog(theme) {
  return theme === 'victorian' ? VICTORIAN_CATALOG : CATALOG;
}
