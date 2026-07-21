// 商店模块 —— 可购买的家具目录（模拟人生式）
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

function canvasTex(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  return { canvas, g: canvas.getContext('2d'), tex: new THREE.CanvasTexture(canvas) };
}

// ---------- 电脑桌 ----------
function buildComputer(ctx) {
  const group = new THREE.Group();
  const deskTop = makeBox(1.3, 0.06, 0.7, 0x8a5f38); deskTop.position.y = 0.74; group.add(deskTop);
  for (const [lx, lz] of [[-0.58, -0.28], [0.58, -0.28], [-0.58, 0.28], [0.58, 0.28]]) {
    const leg = makeBox(0.06, 0.74, 0.06, 0x6b4527);
    leg.position.set(lx, 0.37, lz); group.add(leg);
  }
  // 显示器
  const stand = makeBox(0.1, 0.14, 0.1, 0x333333); stand.position.set(0, 0.84, -0.18); group.add(stand);
  const monitor = makeBox(0.58, 0.38, 0.05, 0x222222, { roughness: 0.4 }); monitor.position.set(0, 1.06, -0.18); group.add(monitor);
  const { canvas, g, tex } = canvasTex(256, 160);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.32),
    new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.set(0, 1.06, -0.151); group.add(screen);
  // 键盘鼠标
  const kb = makeBox(0.4, 0.02, 0.14, 0xdddddd); kb.position.set(0, 0.78, 0.1); group.add(kb);
  const ms = makeBox(0.05, 0.02, 0.08, 0xdddddd); ms.position.set(0.32, 0.78, 0.1); group.add(ms);
  // 主机
  const pc = makeBox(0.18, 0.4, 0.4, 0x2b2b3d, { roughness: 0.5 }); pc.position.set(0.5, 0.2, -0.1); group.add(pc);

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
    group,
    collider: { w: 1.3, d: 0.75 },
    updater(dt) { if (on) { acc += dt; drawOn(dt); } },
    interactables: [{
      pos: group.position,
      meshes: [monitor],
      getPrompt: () => on ? '按 <b>E</b> 关闭电脑' : '按 <b>E</b> 使用电脑',
      action: () => {
        on = !on;
        beep(on ? 880 : 220, 0.12, 'sine', 0.06);
        if (!on) drawOff();
      },
    }],
  };
}

// ---------- 弹珠台 ----------
function buildPinball(ctx) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb03a4a, roughness: 0.5 });
  // 四条腿
  for (const [lx, lz] of [[-0.3, -0.55], [0.3, -0.55], [-0.3, 0.55], [0.3, 0.55]]) {
    const leg = makeCyl(0.03, 0.03, 0.72, 0x888888, 10);
    leg.position.set(lx, 0.36, lz); group.add(leg);
  }
  // 机身（微倾斜）
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.3, 1.4), bodyMat);
  body.position.y = 0.85; body.rotation.x = -0.07; body.castShadow = true; group.add(body);
  // 台面（画布纹理）
  const pf = canvasTex(192, 320);
  const playfield = new THREE.Mesh(new THREE.PlaneGeometry(0.65, 1.25),
    new THREE.MeshBasicMaterial({ map: pf.tex }));
  playfield.rotation.x = -Math.PI / 2 - 0.07;
  playfield.position.set(0, 1.008, 0.048);
  group.add(playfield);
  // 后箱 + 分数屏
  const backbox = makeBox(0.75, 0.65, 0.15, 0x8c2f3d); backbox.position.set(0, 1.55, -0.72); group.add(backbox);
  const sc = canvasTex(192, 96);
  const scoreScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.32),
    new THREE.MeshBasicMaterial({ map: sc.tex }));
  scoreScreen.position.set(0, 1.58, -0.64); group.add(scoreScreen);

  // 静态台面背景
  function drawPlayfieldBase() {
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
    g.font = '12px monospace';
    g.fillText('★ PINBALL ★', 96, 82);
    sc.tex.needsUpdate = true;
  }
  drawPlayfieldBase(); pf.tex.needsUpdate = true;
  drawScore('READY');

  let playing = false, t = 0, score = 0;
  const ball = { x: 96, y: 280, vx: 60, vy: -140 };
  const bumpers = [[50, 90, 16], [140, 80, 13], [96, 160, 18], [40, 220, 11], [150, 230, 11]];

  return {
    group,
    collider: { w: 0.85, d: 1.5 },
    updater(dt) {
      if (!playing) return;
      t += dt;
      // 小球物理
      ball.vy += 160 * dt;
      ball.x += ball.vx * dt; ball.y += ball.vy * dt;
      if (ball.x < 8 || ball.x > 184) { ball.vx *= -1; ball.x = THREE.MathUtils.clamp(ball.x, 8, 184); }
      if (ball.y < 8) ball.vy *= -1;
      if (ball.y > 312) { ball.y = 312; ball.vy = -Math.abs(ball.vy) * 0.9 - 60; beep(150, 0.06); }
      for (const [bx, by, br] of bumpers) {
        const dx = ball.x - bx, dy = ball.y - by, d = Math.hypot(dx, dy);
        if (d < br + 5) {
          const nx = dx / d, ny = dy / d;
          const dot = ball.vx * nx + ball.vy * ny;
          ball.vx -= 2 * dot * nx; ball.vy -= 2 * dot * ny;
          ball.x = bx + nx * (br + 6); ball.y = by + ny * (br + 6);
          score += 120;
          beep(300 + Math.random() * 700, 0.05, 'square', 0.04);
        }
      }
      score += Math.floor(dt * 60);
      // 重绘
      drawPlayfieldBase();
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
      pos: group.position,
      meshes: [body, backbox],
      getPrompt: () => playing ? null : '按 <b>E</b> 玩弹珠台 🎰',
      action: () => {
        playing = true; t = 0; score = 0;
        ball.x = 96; ball.y = 280; ball.vx = 60 * (Math.random() > 0.5 ? 1 : -1); ball.vy = -140;
        beep(440, 0.1, 'sawtooth', 0.06);
      },
    }],
  };
}

// ---------- 小书柜（可放书，计入整理任务）----------
function buildMiniShelf(ctx) {
  const group = new THREE.Group();
  const color = 0x6e4a2f;
  const w = 1.2, h = 1.5, d = 0.35;
  const s1 = makeBox(0.06, h, d, color); s1.position.set(-w / 2, h / 2, 0); group.add(s1);
  const s2 = makeBox(0.06, h, d, color); s2.position.set(w / 2, h / 2, 0); group.add(s2);
  const top = makeBox(w, 0.06, d, color); top.position.y = h; group.add(top);
  const bot = makeBox(w, 0.06, d, color); bot.position.y = 0.03; group.add(bot);
  const mid = makeBox(w, 0.05, d - 0.03, color); mid.position.y = 0.75; group.add(mid);
  const back = makeBox(w, h, 0.04, 0x5d3d26); back.position.set(0, h / 2, -d / 2); group.add(back);

  const slots = [];
  for (const y of [0.09, 0.81])
    for (const x of [-0.32, 0.18])
      slots.push({ local: new THREE.Vector3(x, y, 0.04), used: false });

  return {
    group,
    collider: { w: w + 0.1, d: d + 0.05 },
    interactables: [{
      pos: group.position,
      meshes: [group],
      getPrompt: () => ctx.carrying?.type === 'book' ? '按 <b>E</b> 把书放上小书柜' : null,
      action: () => {
        const slot = slots.find(s => !s.used);
        if (!slot) { ctx.flashMessage('这个小书柜已经放满啦'); return; }
        slot.used = true;
        const book = ctx.carrying;
        ctx.dropCarried();
        group.updateMatrixWorld(true);
        book.mesh.position.copy(group.localToWorld(slot.local.clone()));
        book.mesh.position.x += Math.random() * 0.3;
        book.mesh.rotation.set(0, group.rotation.y, 0);
        // 重新挂回场景
        group.parent.add(book.mesh);
        book.placed = true;
        book.task.done = true;
        ctx.onProgress();
      },
    }],
  };
}

// ---------- 落地灯 ----------
function buildLamp(ctx) {
  const group = new THREE.Group();
  const base = makeCyl(0.25, 0.3, 0.06, 0x555555); base.position.y = 0.03; group.add(base);
  const pole = makeCyl(0.03, 0.03, 1.7, 0x555555); pole.position.y = 0.9; group.add(pole);
  const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf2d9a0, roughness: 0.9 });
  const shade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.45, 20, 1, true), shadeMat);
  shade.position.y = 1.85; shade.castShadow = true; group.add(shade);
  const light = new THREE.PointLight(0xffdca0, 0, 8);
  light.position.y = 1.7; group.add(light);

  let on = false;
  return {
    group,
    collider: { w: 0.5, d: 0.5 },
    interactables: [{
      pos: group.position,
      meshes: [shade],
      getPrompt: () => on ? '按 <b>E</b> 关灯' : '按 <b>E</b> 开灯',
      action: () => {
        on = !on;
        light.intensity = on ? 25 : 0;
        shadeMat.emissive.setHex(on ? 0xffdca0 : 0x000000);
        shadeMat.emissiveIntensity = on ? 0.7 : 0;
        beep(on ? 660 : 330, 0.06, 'sine', 0.04);
      },
    }],
  };
}

// ---------- 盆栽 ----------
function buildPlant(ctx) {
  const group = new THREE.Group();
  const pot = makeCyl(0.22, 0.16, 0.3, 0xb5654a); pot.position.y = 0.15; group.add(pot);
  const stem = makeCyl(0.02, 0.03, 0.5, 0x3f7a3f); stem.position.y = 0.5; group.add(stem);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1),
    new THREE.MeshStandardMaterial({ color: 0x53b15a, roughness: 1 }));
  leaves.position.y = 0.9; leaves.castShadow = true; group.add(leaves);

  return {
    group,
    collider: { w: 0.45, d: 0.45 },
    interactables: [{
      pos: group.position,
      meshes: [leaves],
      getPrompt: () => '按 <b>E</b> 给植物浇水',
      action: () => {
        leaves.scale.setScalar(1.25);
        ctx.flashMessage('🌱 植物喝饱了水！');
        setTimeout(() => leaves.scale.setScalar(1), 600);
      },
    }],
  };
}

// ---------- 音箱（播放音乐）----------
function buildSpeaker(ctx) {
  const group = new THREE.Group();
  const box = makeBox(0.35, 0.6, 0.3, 0x2b2b3d, { roughness: 0.5 }); box.position.y = 0.3; group.add(box);
  for (const [y, r] of [[0.42, 0.1], [0.18, 0.07]]) {
    const ring = makeCyl(r, r, 0.03, 0x111111, 18);
    ring.rotation.x = Math.PI / 2; ring.position.set(0, y, 0.16); group.add(ring);
    const cone = makeCyl(r * 0.4, r * 0.4, 0.04, 0x4fc3f7, 14);
    cone.rotation.x = Math.PI / 2; cone.position.set(0, y, 0.16); group.add(cone);
  }
  const noteMat = new THREE.MeshBasicMaterial({ color: 0xffd54a, transparent: true, opacity: 0 });

  let on = false, timer = null, step = 0;
  const melody = [523, 659, 784, 659, 587, 698, 880, 698, 523, 659, 784, 1046, 880, 784, 659, 587];
  return {
    group,
    collider: { w: 0.4, d: 0.35 },
    interactables: [{
      pos: group.position,
      meshes: [box],
      getPrompt: () => on ? '按 <b>E</b> 关掉音乐' : '按 <b>E</b> 播放音乐 🎵',
      action: () => {
        on = !on;
        if (on) {
          timer = setInterval(() => beep(melody[step++ % melody.length], 0.16, 'triangle', 0.045), 190);
        } else {
          clearInterval(timer);
        }
      },
    }],
  };
}

// ---------- 目录 ----------
export const CATALOG = [
  { id: 'computer', icon: '💻', name: '电脑桌', price: 800, desc: '可以开机使用的电脑，屏幕会跑代码雨', build: buildComputer },
  { id: 'pinball', icon: '🎰', name: '弹珠台', price: 1500, desc: '真的可以玩！小球弹跳 + 灯光音效 + 计分', build: buildPinball },
  { id: 'minishelf', icon: '📚', name: '小书柜', price: 350, desc: '额外的储书空间，书放上去也算整理完成', build: buildMiniShelf },
  { id: 'lamp', icon: '💡', name: '落地灯', price: 200, desc: '开关控制，温暖的光', build: buildLamp },
  { id: 'speaker', icon: '🎵', name: '音箱', price: 300, desc: '播放一段 8-bit 小旋律', build: buildSpeaker },
  { id: 'plant', icon: '🪴', name: '盆栽', price: 120, desc: '可以浇水，心情愉悦', build: buildPlant },
];
