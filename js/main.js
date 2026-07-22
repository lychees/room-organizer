// 整理房间大作战 —— 主逻辑
import * as THREE from 'three';
import { buildRoom, makeBox } from './room.js';
import { getCatalog, beep, customFurniture, CUSTOM_KINDS } from './shop.js';
import { getOutfits, makeHat } from './outfits.js';

function init(theme) {
const SAVE_KEY = `roomOrganizerSave_${theme}`;
const savedRaw = (() => { try { return JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { return null; } })();
// 玩家自定义设计的家具（按主题持久化）
const customDesigns = savedRaw?.designs ?? [];
const designToDef = (d) => ({
  id: d.id, icon: CUSTOM_KINDS[d.kind]?.icon ?? '🎨', name: d.name,
  price: d.price, cat: '自定义', desc: `你设计的${CUSTOM_KINDS[d.kind]?.label ?? '家具'} · ${d.w}×${d.d}×${d.h}m`,
  build: customFurniture(d),
});
const CATALOG = [...getCatalog(theme), ...customDesigns.map(designToDef)];
let customConfig = null; // 自定义外观配置
document.getElementById('title').textContent =
  theme === 'victorian' ? '⚓ 大航海 · 维多利亚房间' : '🏠 整理房间大作战';

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
const fill = new THREE.PointLight(theme === 'victorian' ? 0xffc088 : 0xaaccff, 8, 25);
fill.position.set(0, 3.4, 0);
scene.add(fill);

// ---------- 角色 ----------
const player = new THREE.Group();
const parts = {};
{
  const skin = 0xf2c89a;
  const shirt = theme === 'victorian' ? 0x4a2e2e : 0x4f7ad9;
  const pants = theme === 'victorian' ? 0x2e2a26 : 0x3d4a5c;
  const torso = makeBox(0.42, 0.55, 0.24, shirt); torso.position.y = 0.95; player.add(torso);
  parts.torso = torso;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16),
    new THREE.MeshStandardMaterial({ color: skin, roughness: 0.7 }));
  head.position.y = 1.42; head.castShadow = true; player.add(head);
  parts.head = head;
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.185, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2.2),
    new THREE.MeshStandardMaterial({ color: 0x4a3524, roughness: 1 }));
  hair.position.y = 1.45; player.add(hair);
  parts.hair = hair;

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
// ---------- 服装系统 ----------
const outfits = getOutfits(theme);
let hatGroup = null;
let currentOutfit = null;
function applyOutfit(o, silent) {
  parts.torso.material.color.setHex(o.shirt);
  parts.armL.children[0].material.color.setHex(o.shirt);
  parts.armR.children[0].material.color.setHex(o.shirt);
  parts.legL.children[0].material.color.setHex(o.pants);
  parts.legR.children[0].material.color.setHex(o.pants);
  if (o.skin) parts.head.material.color.setHex(o.skin);
  if (o.hair) parts.hair.material.color.setHex(o.hair);
  if (hatGroup) { player.remove(hatGroup); hatGroup = null; }
  hatGroup = makeHat(o.hat);
  if (hatGroup) player.add(hatGroup);
  currentOutfit = o;
  if (o.id === 'custom') customConfig = o;
  for (const el of dressItemsEl.children) el.classList.toggle('active', el.dataset.id === o.id);
  if (!silent) { beep(700, 0.08, 'sine', 0.05); ctx.flashMessage(`${o.icon} 换上了「${o.name}」！`); saveGame(); }
}
player.position.set(0, 0, 2);
scene.add(player);

// 携带物品的挂载点（举在头顶）
const carryMount = new THREE.Group();
carryMount.position.set(0, 1.85, 0);
player.add(carryMount);

// ---------- 金钱 / 存档 ----------
const moneyEl = document.getElementById('money');
let money = 3000;
const placedItems = [];   // {id, x, z, ry}
const updaters = new Set();
function setMoney(v) {
  money = Math.round(v);
  moneyEl.textContent = `💰 §${money}`;
  refreshShopAffordability();
}
function saveGame() {
  localStorage.setItem(SAVE_KEY, JSON.stringify({
    money, items: placedItems, outfit: currentOutfit?.id,
    customSkin: customConfig, designs: customDesigns,
  }));
}

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
    const prev = this._done ?? 0;
    if (done > prev) {
      setMoney(money + 100 * (done - prev));
      if (prev > 0 || done > 0) {
        this.flashMessage(`✨ 整理奖励 +§${100 * (done - prev)}`);
        beep(990, 0.1, 'sine', 0.05);
      }
      this._done = done;
      saveGame();
    }
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

const room = buildRoom(scene, ctx, theme);
for (const u of room.updaters ?? []) updaters.add(u);
ctx.onProgress();

// ---------- 坐下 / 躺下系统 ----------
let seat = null; // {type:'sit'|'lie', y, ry, pos, standPos}
ctx.isSeated = () => !!seat;
ctx.sitDown = (info) => {
  if (seat || ctx.carrying) return;
  seat = info;
  seat.standPos = player.position.clone();
  player.position.set(info.pos.x, info.y ?? 0, info.pos.z);
  if (info.ry !== undefined) player.rotation.y = info.ry;
  vy = 0;
  beep(info.type === 'lie' ? 320 : 420, 0.1, 'sine', 0.04);
};
function standUp() {
  if (!seat) return;
  player.position.copy(seat.standPos);
  player.position.y = 0;
  player.rotation.x = 0;
  seat = null;
  beep(520, 0.06, 'sine', 0.03);
}

// ---------- 购买模式（模拟人生式）----------
const shopEl = document.getElementById('shop');
const shopItemsEl = document.getElementById('shop-items');
const placeHintEl = document.getElementById('place-hint');
let buyMode = false;
let ghost = null; // {group, def, ry, valid}
const raycaster = new THREE.Raycaster();
const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.55, depthWrite: false });

// 构建商店列表（带分类筛选）
const chipsEl = document.getElementById('shop-chips');
document.querySelector('#shop h3').textContent = `🛒 家具商店（${CATALOG.length} 件）`;
let shopFilter = '全部';
function buildChips(preferFilter) {
  const cats = ['全部', ...new Set(CATALOG.map(d => d.cat))];
  shopFilter = preferFilter && cats.includes(preferFilter) ? preferFilter
    : cats.includes(shopFilter) ? shopFilter : '全部';
  chipsEl.innerHTML = '';
  for (const cat of cats) {
    const chip = document.createElement('button');
    chip.className = 'chip' + (cat === shopFilter ? ' active' : '');
    chip.textContent = cat;
    chip.addEventListener('click', () => {
      shopFilter = cat;
      for (const c of chipsEl.children) c.classList.toggle('active', c.textContent === cat);
      renderShopItems();
    });
    chipsEl.appendChild(chip);
  }
}
buildChips();
function renderShopItems() {
  shopItemsEl.innerHTML = '';
  for (const def of CATALOG.filter(d => shopFilter === '全部' || d.cat === shopFilter)) {
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.dataset.id = def.id;
    el.innerHTML = `<div class="icon">${def.icon}</div>
      <div class="info"><div class="name">${def.name}</div><div class="desc">${def.desc}</div></div>
      <div class="price">§${def.price}</div>`;
    el.addEventListener('click', () => {
      if (money < def.price) { ctx.flashMessage('💸 钱不够啦，先去整理房间赚钱吧！'); beep(180, 0.15); return; }
      startPlacement(def);
    });
    shopItemsEl.appendChild(el);
  }
  refreshShopAffordability();
}
renderShopItems();

// ---------- 衣帽间（换装面板）----------
const dressEl = document.getElementById('dress');
const dressItemsEl = document.getElementById('dress-items');
let dressOpen = false;
for (const o of outfits) {
  const el = document.createElement('div');
  el.className = 'dress-item';
  el.dataset.id = o.id;
  const hex = n => '#' + n.toString(16).padStart(6, '0');
  el.innerHTML = `<div class="icon">${o.icon}</div>
    <div class="info"><div class="name">${o.name}</div>
    <div class="swatches"><i style="background:${hex(o.shirt)}"></i><i style="background:${hex(o.pants)}"></i></div></div>`;
  el.addEventListener('click', () => applyOutfit(o));
  dressItemsEl.appendChild(el);
}
function toggleDress(force) {
  if (seat) standUp();
  dressOpen = force ?? !dressOpen;
  dressEl.style.display = dressOpen ? 'block' : 'none';
  if (dressOpen) document.exitPointerLock();
  updateLockTip();
}
ctx.openDress = () => toggleDress(true);

// ---------- 自定义外观 ----------
const HAT_TYPES = [['none', '🚫 无帽子'], ['top', '🎩 礼帽'], ['tall', '🎩 高礼帽'], ['cap', '🧢 棒球帽'],
  ['bucket', '👒 雨帽/渔夫帽'], ['helmet', '🪖 安全帽'], ['bandana', '🧣 头巾'], ['sailor', '⚓ 水手帽'],
  ['safari', '🤠 探险帽'], ['wig', '👨‍🦳 假发'], ['nightcap', '😴 睡帽']];
const csHatType = document.getElementById('cs-hat-type');
for (const [v, label] of HAT_TYPES) {
  const op = document.createElement('option');
  op.value = v; op.textContent = label;
  csHatType.appendChild(op);
}
document.getElementById('cs-apply').addEventListener('click', () => {
  const val = id => parseInt(document.getElementById(id).value.slice(1), 16);
  const ht = csHatType.value;
  applyOutfit({
    id: 'custom', icon: '🎨', name: '自定义装扮',
    shirt: val('cs-shirt'), pants: val('cs-pants'),
    skin: val('cs-skin'), hair: val('cs-hair'),
    hat: ht === 'none' ? null : { type: ht, color: val('cs-hat-color') },
  });
});

// ---------- 家具设计器 ----------
const designEl = document.getElementById('design');
let designOpen = false;
const dsKind = document.getElementById('ds-kind');
for (const [k, m] of Object.entries(CUSTOM_KINDS)) {
  const op = document.createElement('option');
  op.value = k; op.textContent = `${m.icon} ${m.label}`;
  dsKind.appendChild(op);
}
const dsVal = id => document.getElementById(id);
function calcDesignPrice() {
  const base = CUSTOM_KINDS[dsKind.value]?.base ?? 100;
  const v = parseFloat(dsVal('ds-w').value) * parseFloat(dsVal('ds-d').value) * parseFloat(dsVal('ds-h').value);
  return Math.round((base + v * 220) / 10) * 10;
}
function refreshDesign() {
  for (const k of ['w', 'd', 'h'])
    dsVal(`ds-${k}-v`).textContent = parseFloat(dsVal(`ds-${k}`).value).toFixed(2) + 'm';
  dsVal('ds-price').textContent = `预估价格：§${calcDesignPrice()}`;
}
for (const id of ['ds-kind', 'ds-w', 'ds-d', 'ds-h']) dsVal(id).addEventListener('input', refreshDesign);
refreshDesign();
function toggleDesign(force) {
  if (seat) standUp();
  designOpen = force ?? !designOpen;
  designEl.style.display = designOpen ? 'block' : 'none';
  if (designOpen) document.exitPointerLock();
  updateLockTip();
}
function saveDesign() {
  const kind = dsKind.value;
  const meta = CUSTOM_KINDS[kind];
  const d = {
    id: `custom_${Date.now()}`, kind,
    name: dsVal('ds-name').value.trim() || `我的${meta.label}`,
    w: parseFloat(dsVal('ds-w').value),
    d: parseFloat(dsVal('ds-d').value),
    h: parseFloat(dsVal('ds-h').value),
    c1: parseInt(dsVal('ds-c1').value.slice(1), 16),
    c2: parseInt(dsVal('ds-c2').value.slice(1), 16),
    price: calcDesignPrice(),
  };
  customDesigns.push(d);
  const def = designToDef(d);
  CATALOG.push(def);
  buildChips('自定义');
  renderShopItems();
  document.querySelector('#shop h3').textContent = `🛒 家具商店（${CATALOG.length} 件）`;
  saveGame();
  return def;
}
dsVal('ds-save').addEventListener('click', () => {
  const def = saveDesign();
  ctx.flashMessage(`🎨 设计「${def.name}」已保存到商店「自定义」分类！`);
  beep(880, 0.1, 'sine', 0.05);
});
dsVal('ds-place').addEventListener('click', () => {
  const def = saveDesign();
  toggleDesign(false);
  startPlacement(def);
});
document.getElementById('open-design').addEventListener('click', () => toggleDesign(true));
function refreshShopAffordability() {
  for (const el of shopItemsEl.children) {
    const def = CATALOG.find(d => d.id === el.dataset.id);
    el.classList.toggle('cant-afford', money < def.price);
  }
}
document.getElementById('reset-save').addEventListener('click', () => {
  if (confirm('确定清空存档（金钱和已购家具）并重开吗？')) {
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  }
});

function startPlacement(def) {
  cancelGhost();
  const item = def.build(ctx);
  item.group.traverse(o => { if (o.isMesh) { o.material = ghostMat; o.castShadow = false; } });
  scene.add(item.group);
  ghost = { group: item.group, def, foot: item.foot, soft: !!item.soft, ry: 0, valid: false };
  placeHintEl.style.display = 'block';
  beep(700, 0.05, 'sine', 0.03);
}
function cancelGhost() {
  if (ghost) { scene.remove(ghost.group); ghost = null; }
  placeHintEl.style.display = 'none';
}
function ghostFootSize(ry, foot) {
  const rotated = Math.round(ry / (Math.PI / 2)) % 2 !== 0;
  return rotated ? { w: foot.d, d: foot.w } : { w: foot.w, d: foot.d };
}
function placementValid(x, z, ry, foot, soft) {
  const { W, D } = room.bounds;
  const { w, d } = ghostFootSize(ry, foot);
  if (x - w / 2 < -W / 2 + 0.15 || x + w / 2 > W / 2 - 0.15) return false;
  if (z - d / 2 < -D / 2 + 0.15 || z + d / 2 > D / 2 - 0.15) return false;
  if (soft) return true; // 地毯/吊灯/搁板等可与家具重叠
  for (const c of room.colliders)
    if (x - w / 2 < c.maxX && x + w / 2 > c.minX && z - d / 2 < c.maxZ && z + d / 2 > c.minZ) return false;
  return true;
}
function placeItem() {
  if (!ghost || !ghost.valid) { beep(180, 0.12); return; }
  const def = ghost.def;
  if (money < def.price) { ctx.flashMessage('💸 钱不够啦！'); cancelGhost(); return; }
  const x = ghost.group.position.x, z = ghost.group.position.z, ry = ghost.ry;
  setMoney(money - def.price);
  const item = def.build(ctx);
  registerItem(item, x, z, ry);
  placedItems.push({ id: def.id, x, z, ry });
  saveGame();
  ctx.flashMessage(`${def.icon} 购买了${def.name}！-§${def.price}`);
  beep(880, 0.08, 'sine', 0.06); setTimeout(() => beep(1320, 0.12, 'sine', 0.05), 90);
}
function registerItem(item, x, z, ry) {
  item.group.position.set(x, 0, z);
  item.group.rotation.y = ry;
  scene.add(item.group);
  if (!item.soft) {
    const { w, d } = ghostFootSize(ry, item.foot);
    room.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
  }
  for (const it of item.interactables) room.interactables.push({ radius: 2.4, ...it });
  if (item.updater) updaters.add(item.updater);
}
function updateLockTip() {
  lockTip.style.display = (!pointerLocked && !buyMode && !dressOpen && !designOpen) ? 'block' : 'none';
}
function toggleBuy() {
  if (seat) standUp();
  buyMode = !buyMode;
  shopEl.style.display = buyMode ? 'block' : 'none';
  if (buyMode) {
    document.exitPointerLock();
  } else {
    cancelGhost();
  }
  updateLockTip();
}
function loadGame() {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!s) return;
    setMoney(typeof s.money === 'number' ? s.money : 3000);
    for (const rec of s.items ?? []) {
      const def = CATALOG.find(d => d.id === rec.id);
      if (!def) continue;
      registerItem(def.build(ctx), rec.x, rec.z, rec.ry);
      placedItems.push(rec);
    }
    if (s.customSkin) customConfig = s.customSkin;
    const savedOutfit = s.outfit === 'custom' && customConfig
      ? customConfig
      : outfits.find(o => o.id === s.outfit);
    applyOutfit(savedOutfit ?? outfits[0], true);
  } catch { /* 存档损坏则忽略 */ }
}
loadGame();
if (!currentOutfit) applyOutfit(outfits[0], true);
setMoney(money);

// ---------- 输入 ----------
const keys = {};
let camTheta = Math.PI;   // 相机水平角（初始在角色身后）
let camPhi = 0.35;        // 相机俯仰角
let pointerLocked = false;

addEventListener('keydown', e => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyE' && !buyMode) tryInteract();
  if (e.code === 'KeyB') toggleBuy();
  if (e.code === 'KeyG') toggleDress();
  if (e.code === 'KeyC') toggleDesign();
  if (e.code === 'KeyR' && ghost) ghost.ry = (ghost.ry + Math.PI / 2) % (Math.PI * 2);
  if (e.code === 'Escape' && ghost) cancelGhost();
});
addEventListener('keyup', e => keys[e.code] = false);

renderer.domElement.addEventListener('click', () => {
  if (ghost) { placeItem(); return; }
  if (buyMode) return;
  renderer.domElement.requestPointerLock();
});
renderer.domElement.addEventListener('contextmenu', e => {
  e.preventDefault();
  if (ghost) cancelGhost();
});
lockTip.addEventListener('click', () => renderer.domElement.requestPointerLock());
document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === renderer.domElement;
  updateLockTip();
});
addEventListener('mousemove', e => {
  if (pointerLocked) {
    camTheta -= e.movementX * 0.0025;
    camPhi = THREE.MathUtils.clamp(camPhi + e.movementY * 0.002, -0.15, 1.25);
  }
  // 购买模式：幽灵家具跟随鼠标（0.25m 网格吸附）
  if (ghost) {
    const ndc = new THREE.Vector2(
      (e.clientX / innerWidth) * 2 - 1,
      -(e.clientY / innerHeight) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(floorPlane, hit)) {
      const x = Math.round(hit.x / 0.25) * 0.25;
      const z = Math.round(hit.z / 0.25) * 0.25;
      ghost.group.position.set(x, 0, z);
      ghost.group.rotation.y = ghost.ry;
      ghost.valid = placementValid(x, z, ghost.ry, ghost.foot, ghost.soft);
      ghostMat.color.setHex(ghost.valid ? 0x33ff66 : 0xff4444);
    }
  }
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
  if (seat) {
    if (focused) { setHighlight(focused, false); focused = null; }
    promptEl.innerHTML = seat.type === 'lie' ? '按 <b>E</b> 起床 🛏️' : '按 <b>E</b> 站起来 🧍';
    promptEl.style.display = 'block';
    return;
  }
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
  if (seat) { standUp(); return; }
  if (focused) focused.action();
}

// ---------- 主循环 ----------
const clock = new THREE.Clock();
let vy = 0, grounded = true, walkT = 0;
const CAM_DIST = 4.2;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  // 移动（相对角色朝向：W 前进 / S 后退 / A D 转向，与相机无关）
  const run = keys['ShiftLeft'] || keys['ShiftRight'];
  const speed = run ? 7 : 3.5;
  let fwd = 0;
  if (!buyMode && !seat) {
    if (keys['KeyW']) fwd += 1;
    if (keys['KeyS']) fwd -= 1;
    if (keys['KeyA']) player.rotation.y += 3.2 * dt;  // 左转
    if (keys['KeyD']) player.rotation.y -= 3.2 * dt;  // 右转
  }
  const moving = fwd !== 0;
  if (moving) {
    const sp = speed * (fwd < 0 ? 0.6 : 1) * fwd; // 后退减速
    player.position.x += Math.sin(player.rotation.y) * sp * dt;
    player.position.z += Math.cos(player.rotation.y) * sp * dt;
  }
  collide(player.position);

  // 跳跃 / 重力（坐下/躺下时悬空固定）
  if (keys['Space'] && grounded && !buyMode && !seat) { vy = 6.5; grounded = false; }
  if (!seat) {
    vy -= 18 * dt;
    player.position.y += vy * dt;
    if (player.position.y <= 0) { player.position.y = 0; vy = 0; grounded = true; }
  }

  // 姿势动画：坐下 / 躺下 / 走路
  if (seat?.type === 'lie') {
    // 躺下：身体放平 + 呼吸起伏 + 双臂微张
    player.rotation.x += (-Math.PI / 2 - player.rotation.x) * Math.min(1, dt * 5);
    parts.legL.rotation.x *= 0.85; parts.legR.rotation.x *= 0.85;
    parts.armL.rotation.x *= 0.85; parts.armR.rotation.x *= 0.85;
    parts.armL.rotation.z += (0.4 - parts.armL.rotation.z) * Math.min(1, dt * 5);
    parts.armR.rotation.z += (-0.4 - parts.armR.rotation.z) * Math.min(1, dt * 5);
    parts.torso.scale.y = 1 + Math.sin(clock.elapsedTime * 1.8) * 0.025; // 呼吸
    parts.head && (parts.head.position.y = 1.42 + Math.sin(clock.elapsedTime * 1.8) * 0.008);
  } else if (seat) {
    // 坐下：大腿前伸 + 小腿晃悠 + 手搭在腿上
    player.rotation.x *= 0.8;
    const swing = Math.sin(clock.elapsedTime * 2.2) * 0.12;
    parts.legL.rotation.x = -1.45 + swing;
    parts.legR.rotation.x = -1.45 - swing;
    parts.armL.rotation.x += (-0.55 - parts.armL.rotation.x) * Math.min(1, dt * 6);
    parts.armR.rotation.x += (-0.55 - parts.armR.rotation.x) * Math.min(1, dt * 6);
    parts.armL.rotation.z *= 0.8; parts.armR.rotation.z *= 0.8;
  } else {
    player.rotation.x *= 0.8;
    parts.torso.scale.y = 1;
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
  }

  // 携带物轻微浮动
  if (ctx.carrying) ctx.carrying.mesh.position.y = Math.sin(clock.elapsedTime * 3) * 0.03;

  // 已购家具的动画（电脑代码雨 / 弹珠台游戏等）
  for (const u of updaters) u(dt, clock.elapsedTime);

  // 第三人称相机
  const target = new THREE.Vector3(
    player.position.x, player.position.y + (seat?.type === 'lie' ? 0.7 : 1.5), player.position.z);
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

// 调试/测试钩子
window.__game = { player, room, catalog: CATALOG, camera, parts, get outfit() { return currentOutfit?.id; }, get seat() { return seat; } };
} // end init()

// ---------- 开局模式选择 ----------
for (const [id, theme] of [['mode-modern', 'modern'], ['mode-victorian', 'victorian']]) {
  document.getElementById(id).addEventListener('click', () => {
    document.getElementById('mode-select').style.display = 'none';
    init(theme);
  });
}
