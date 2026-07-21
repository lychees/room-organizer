// 整理房间大作战 —— 主逻辑
import * as THREE from 'three';
import { buildRoom, makeBox } from './room.js';

// ---------- 渲染基础 ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2b3a55);
scene.fog = new THREE.Fog(0x2b3a55, 20, 40);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 100);

// 灯光
scene.add(new THREE.AmbientLight(0xffffff, 0.45));
const sun = new THREE.DirectionalLight(0xfff2dd, 1.6);
sun.position.set(6, 9, 8);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -12; sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12; sun.shadow.camera.bottom = -12;
scene.add(sun);
const fill = new THREE.PointLight(0xaaccff, 8, 25);
fill.position.set(0, 3.4, 0);
scene.add(fill);

// ---------- 角色 ----------
const player = new THREE.Group();
const parts = {};
{
  const skin = 0xf2c89a, shirt = 0x4f7ad9, pants = 0x3d4a5c;
  const torso = makeBox(0.42, 0.55, 0.24, shirt); torso.position.y = 0.95; player.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
  head.position.y = 1.42; head.castShadow = true; player.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.185, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }));
  hair.position.y = 1.45; player.add(hair);

  const mkLimb = (w, h, d, color, x, y) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0);
    const m = makeBox(w, h, d, color);
    m.position.y = -h / 2;
    pivot.add(m);
    player.add(pivot);
    return pivot;
  };
  parts.armL = mkLimb(0.1, 0.5, 0.1, shirt, -0.28, 1.18);
  parts.armR = mkLimb(0.1, 0.5, 0.1, shirt, 0.28, 1.18);
  parts.legL = mkLimb(0.13, 0.62, 0.13, pants, -0.12, 0.68);
  parts.legR = mkLimb(0.13, 0.62, 0.13, pants, 0.12, 0.68);
}
player.position.set(0, 0, 2);
scene.add(player);

// 携带物品的挂载点（举在头顶）
const carryMount = new THREE.Group();
carryMount.position.set(0, 1.85, 0);
player.add(carryMount);

// ---------- 游戏状态 / 上下文 ----------
const progressEl = document.getElementById('progress');
const promptEl = document.getElementById('prompt');
const carryEl = document.getElementById('carry');
const winEl = document.getElementById('win');
const lockTip = document.getElementById('lock-tip');

const ctx = {
  carrying: null,
  pickUp(item) {
    this.carrying = item;
    item.mesh.rotation.set(0, 0, 0);
    carryMount.add(item.mesh);
    item.mesh.position.set(0, 0, 0);
    carryEl.textContent = `手上拿着：${item.type === 'book' ? '📕 一本书' : '🧻 一个纸团'}（放到该放的地方）`;
    carryEl.style.display = 'block';
  },
  dropCarried() {
    const item = this.carrying;
    carryMount.remove(item.mesh);
    this.carrying = null;
    carryEl.style.display = 'none';
    return item;
  },
  onProgress() {
    const done = room.tasks.filter(t => t.done).length;
    progressEl.textContent = `整理进度：${done} / ${room.tasks.length}`;
    if (done === room.tasks.length) winEl.style.display = 'block';
  },
  flashMessage(msg) {
    carryEl.textContent = msg;
    carryEl.style.display = 'block';
    clearTimeout(this._msgT);
    this._msgT = setTimeout(() => {
      if (!this.carrying) carryEl.style.display = 'none';
    }, 1500);
  },
};

const room = buildRoom(scene, ctx);
ctx.onProgress();

// ---------- 输入 ----------
const keys = {};
let camTheta = Math.PI;   // 相机水平角（初始在角色身后）
let camPhi = 0.35;        // 相机俯仰角
let pointerLocked = false;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyE') tryInteract();
});
addEventListener('keyup', e => keys[e.code] = false);

renderer.domElement.addEventListener('click', () => {
  renderer.domElement.requestPointerLock();
});
lockTip.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  lockTip.style.display = pointerLocked ? 'none' : 'block';
});
addEventListener('mousemove', e => {
  if (!pointerLocked) return;
  camTheta -= e.movementX * 0.0025;
  camPhi = THREE.MathUtils.clamp(camPhi + e.movementY * 0.002, -0.15, 1.25);
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ---------- 碰撞 ----------
const PLAYER_R = 0.35;
function collide(pos) {
  const { W, D } = room.bounds;
  pos.x = THREE.MathUtils.clamp(pos.x, -W / 2 + PLAYER_R, W / 2 - PLAYER_R);
  pos.z = THREE.MathUtils.clamp(pos.z, -D / 2 + PLAYER_R, D / 2 - PLAYER_R);
  for (const c of room.colliders) {
    const nx = THREE.MathUtils.clamp(pos.x, c.minX, c.maxX);
    const nz = THREE.MathUtils.clamp(pos.z, c.minZ, c.maxZ);
    const dx = pos.x - nx, dz = pos.z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 < PLAYER_R * PLAYER_R) {
      if (d2 > 1e-8) {
        const d = Math.sqrt(d2);
        pos.x = nx + dx / d * PLAYER_R;
        pos.z = nz + dz / d * PLAYER_R;
      } else {
        // 在盒子内部：沿最近边推出
        const pushes = [
          [c.maxX + PLAYER_R - pos.x, 1, 0], [pos.x - c.minX + PLAYER_R, -1, 0],
          [c.maxZ + PLAYER_R - pos.z, 0, 1], [pos.z - c.minZ + PLAYER_R, 0, -1],
        ].sort((a, b) => a[0] - b[0])[0];
        pos.x += pushes[1] * pushes[0];
        pos.z += pushes[2] * pushes[0];
      }
    }
  }
}

// ---------- 交互 ----------
let focused = null;
function updateFocus() {
  let best = null, bestD = Infinity;
  for (const it of room.interactables) {
    const p = it.getPrompt();
    if (!p) continue;
    const d = Math.hypot(player.position.x - it.pos.x, player.position.z - it.pos.z);
    if (d < it.radius && d < bestD) { best = it; bestD = d; }
  }
  if (best !== focused) {
    if (focused) setHighlight(focused, false);
    focused = best;
    if (focused) setHighlight(focused, true);
  }
  if (focused) {
    promptEl.innerHTML = focused.getPrompt();
    promptEl.style.display = 'block';
  } else {
    promptEl.style.display = 'none';
  }
}

function setHighlight(it, on) {
  for (const root of it.meshes) {
    root.traverse(o => {
      if (o.isMesh && o.material && 'emissive' in o.material) {
        if (on) {
          o.userData._em = o.material.emissive.getHex();
          o.userData._emi = o.material.emissiveIntensity;
          o.material.emissive.setHex(0x554411);
          o.material.emissiveIntensity = 1;
        } else if (o.userData._em !== undefined) {
          o.material.emissive.setHex(o.userData._em);
          o.material.emissiveIntensity = o.userData._emi;
        }
      }
    });
  }
}

function tryInteract() {
  if (focused) focused.action();
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let vy = 0, grounded = true, walkT = 0;
const CAM_DIST = 4.2;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 移动（相对相机朝向）
  const run = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = run ? 7 : 3.5;
  let mx = 0, mz = 0;
  if (keys['KeyW']) mz -= 1;
  if (keys['KeyS']) mz += 1;
  if (keys['KeyA']) mx -= 1;
  if (keys['KeyD']) mx += 1;
  const moving = mx !== 0 || mz !== 0;
  if (moving) {
    const len = Math.hypot(mx, mz);
    mx /= len; mz /= len;
    const sin = Math.sin(camTheta), cos = Math.cos(camTheta);
    const wx = mx * cos - mz * sin;
    const wz = mx * sin + mz * cos;
    player.position.x += wx * speed * dt;
    player.position.z += wz * speed * dt;
    // 角色朝向移动方向
    const targetRy = Math.atan2(wx, wz);
    let dr = targetRy - player.rotation.y;
    while (dr > Math.PI) dr -= Math.PI * 2;
    while (dr < -Math.PI) dr += Math.PI * 2;
    player.rotation.y += dr * Math.min(1, dt * 12);
  }
  collide(player.position);

  // 跳跃 / 重力
  if (keys['Space'] && grounded) { vy = 6.5; grounded = false; }
  vy -= 18 * dt;
  player.position.y += vy * dt;
  if (player.position.y <= 0) { player.position.y = 0; vy = 0; grounded = true; }

  // 走路动画
  if (moving && grounded) {
    walkT += dt * (run ? 13 : 8);
    const s = Math.sin(walkT) * (run ? 0.75 : 0.5);
    parts.armL.rotation.x = s; parts.armR.rotation.x = -s;
    parts.legL.rotation.x = -s; parts.legR.rotation.x = s;
  } else {
    for (const k of ['armL', 'armR', 'legL', 'legR'])
      parts[k].rotation.x *= 0.85;
  }
  // 拿东西时举手
  if (ctx.carrying) {
    parts.armL.rotation.x = parts.armR.rotation.x = -2.6;
  }

  // 携带物轻微浮动
  if (ctx.carrying) ctx.carrying.mesh.position.y = Math.sin(clock.elapsedTime * 3) * 0.03;

  // 第三人称相机
  const target = new THREE.Vector3(
    player.position.x, player.position.y + 1.5, player.position.z);
  const cx = target.x + CAM_DIST * Math.sin(camTheta) * Math.cos(camPhi);
  const cy = target.y + CAM_DIST * Math.sin(camPhi);
  const cz = target.z + CAM_DIST * Math.cos(camTheta) * Math.cos(camPhi);
  camera.position.set(
    THREE.MathUtils.clamp(cx, -9.5, 9.5),
    THREE.MathUtils.clamp(cy, 0.3, 3.8),
    THREE.MathUtils.clamp(cz, -6.7, 6.7));
  camera.lookAt(target);

  updateFocus();
  renderer.render(scene, camera);
}
animate();
