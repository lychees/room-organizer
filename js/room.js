// 房间与家具构建模块
import * as THREE from 'three';

// ---------- 工具函数 ----------
export function makeBox(w, h, d, color, opts = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.8, metalness: opts.metalness ?? 0.05 });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.castShadow = opts.castShadow ?? true;
  mesh.receiveShadow = true;
  return mesh;
}

export function makeCyl(rt, rb, h, color, seg = 20) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(rt, rb, h, seg),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8 })
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function woodTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#b58a5a';
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? '#ad8152' : '#bd9160';
    g.fillRect(0, i * 32, 256, 32);
    g.strokeStyle = 'rgba(90,60,30,.5)';
    g.strokeRect(0, i * 32 + .5, 256, 31);
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(120,85,45,${Math.random() * .15})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 40 + 5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

// ---------- 主构建函数 ----------
// 返回 { colliders, interactables, tasks, books, papers, shelfSlots }
export function buildRoom(scene, ctx) {
  const colliders = [];       // {minX,maxX,minZ,maxZ}
  const interactables = [];   // {pos, radius, meshes, getPrompt, action, enabled}
  const tasks = [];           // {name, done}  整理任务
  const books = [];
  const papers = [];
  const shelfSlots = [];

  const addCollider = (cx, cz, w, d) =>
    colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });

  const addInteractable = (cfg) => { interactables.push({ radius: 2.4, enabled: true, ...cfg }); };

  const addTask = (name) => { const t = { name, done: false }; tasks.push(t); return t; };

  const W = 20, D = 14, H = 4; // 房间尺寸

  // ---------- 地板 / 墙 / 天花 ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W, D),
    new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.7 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.95 });
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
    scene.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2, 0);            // 北
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);       // 南
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);  // 西
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);  // 东

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: 0xf5f0e6 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
  scene.add(ceil);

  // 窗户（南墙）
  const winFrame = makeBox(3, 2, 0.1, 0x8b6f47);
  winFrame.position.set(2, 2.2, D / 2 - 0.06); scene.add(winFrame);
  const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7),
    new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6688aa, emissiveIntensity: 0.4 }));
  winGlass.position.set(2, 2.2, D / 2 - 0.12); winGlass.rotation.y = Math.PI;
  scene.add(winGlass);

  // 地毯
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32),
    new THREE.MeshStandardMaterial({ color: 0xc2554f, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(4.5, 0.01, 3);
  rug.receiveShadow = true; scene.add(rug);

  // ---------- 书柜（核心交互）----------
  const shelfG = new THREE.Group();
  const shelfColor = 0x7a5230;
  const sw = 3.2, sh = 2.6, sd = 0.45;
  const side1 = makeBox(0.08, sh, sd, shelfColor); side1.position.set(-sw / 2, sh / 2, 0);
  const side2 = makeBox(0.08, sh, sd, shelfColor); side2.position.set(sw / 2, sh / 2, 0);
  const top = makeBox(sw + 0.08, 0.08, sd, shelfColor); top.position.set(0, sh, 0);
  const bottom = makeBox(sw + 0.08, 0.08, sd, shelfColor); bottom.position.set(0, 0.04, 0);
  const back = makeBox(sw, sh, 0.05, 0x6b4527); back.position.set(0, sh / 2, -sd / 2 + 0.03);
  shelfG.add(side1, side2, top, bottom, back);
  const shelfYs = [0.75, 1.4, 2.05];
  for (const y of shelfYs) {
    const b = makeBox(sw, 0.06, sd - 0.05, shelfColor);
    b.position.set(0, y, 0); shelfG.add(b);
  }
  shelfG.position.set(-7.5, 0, -6.6);
  scene.add(shelfG);
  addCollider(-7.5, -6.6, sw + 0.2, sd + 0.1);

  // 书架槽位：4 层 × 2
  const slotLevels = [0.11, 0.78, 1.43, 2.08];
  for (const y of slotLevels)
    for (const x of [-0.9, 0.5])
      shelfSlots.push({ pos: new THREE.Vector3(-7.5 + x, y, -6.55), used: false });

  addInteractable({
    pos: new THREE.Vector3(-7.5, 1, -6.4),
    meshes: [shelfG],
    getPrompt: () => ctx.carrying?.type === 'book' ? '按 <b>E</b> 把书放上书架' : null,
    action: () => {
      const slot = shelfSlots.find(s => !s.used);
      if (!slot) return;
      slot.used = true;
      const book = ctx.carrying;
      ctx.dropCarried();
      book.mesh.position.copy(slot.pos);
      book.mesh.position.x += Math.random() * 0.6;
      book.mesh.rotation.set(0, 0, 0);
      scene.add(book.mesh);
      book.placed = true;
      book.task.done = true;
      ctx.onProgress();
    },
  });

  // ---------- 散落的书 ----------
  const bookColors = [0xd94f4f, 0x4f7ad9, 0x53b15a, 0xe0a83c, 0x9b59b6, 0x3cb8b0, 0xe06c9f, 0x7f8c8d];
  const bookSpots = [
    [-4, -2, 0.4], [1.5, 1, 1.2], [5, -0.5, -0.7], [-2, 4.5, 2.1],
    [6.5, 1.5, 0.2], [-6.5, 2, 1.8], [0.5, -3.5, -1.1], [3.5, 5, 0.9],
  ];
  bookSpots.forEach(([x, z, ry], i) => {
    const mesh = makeBox(0.22, 0.05, 0.3, bookColors[i]);
    mesh.position.set(x, 0.03, z);
    mesh.rotation.y = ry;
    scene.add(mesh);
    const task = addTask(`书 #${i + 1}`);
    const book = { type: 'book', mesh, placed: false, task };
    books.push(book);
    addInteractable({
      pos: mesh.position,
      meshes: [mesh],
      getPrompt: () => (!book.placed && !ctx.carrying) ? '按 <b>E</b> 捡起书' : null,
      action: () => {
        scene.remove(mesh);
        ctx.pickUp(book);
      },
      enabled: true,
      isItem: book,
    });
  });

  // ---------- 书桌 + 抽屉 ----------
  const deskG = new THREE.Group();
  const deskTop = makeBox(2, 0.08, 0.9, 0x9a6b3f); deskTop.position.y = 0.78;
  deskG.add(deskTop);
  for (const [lx, lz] of [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]]) {
    const leg = makeBox(0.08, 0.78, 0.08, 0x7a5230);
    leg.position.set(lx, 0.39, lz); deskG.add(leg);
  }
  const drawerBox = makeBox(0.7, 0.5, 0.8, 0x8a5f38);
  drawerBox.position.set(0.6, 0.5, 0); deskG.add(drawerBox);
  const drawer = makeBox(0.62, 0.16, 0.7, 0xa9805a);
  drawer.position.set(0.6, 0.55, 0); deskG.add(drawer);
  // 桌上物品：台灯 + 笔筒
  const deskLampBase = makeCyl(0.12, 0.14, 0.05, 0x444444); deskLampBase.position.set(-0.6, 0.85, -0.2); deskG.add(deskLampBase);
  const deskLampPole = makeCyl(0.02, 0.02, 0.35, 0x444444); deskLampPole.position.set(-0.6, 1.02, -0.2); deskG.add(deskLampPole);
  const deskLampHead = makeCyl(0.09, 0.13, 0.14, 0x2e8b8b); deskLampHead.position.set(-0.6, 1.22, -0.2); deskG.add(deskLampHead);
  const penCup = makeCyl(0.07, 0.06, 0.14, 0xc2554f); penCup.position.set(-0.2, 0.89, 0.25); deskG.add(penCup);
  deskG.position.set(-0.5, 0, -6.4);
  scene.add(deskG);
  addCollider(-0.5, -6.4, 2, 0.9);

  let drawerOpen = false;
  addInteractable({
    pos: new THREE.Vector3(0.1, 0.6, -6.4),
    meshes: [drawer],
    getPrompt: () => drawerOpen ? '按 <b>E</b> 关上抽屉' : '按 <b>E</b> 打开抽屉',
    action: () => {
      drawerOpen = !drawerOpen;
      drawer.position.z = drawerOpen ? 0.5 : 0;
    },
  });

  // ---------- 椅子（整理任务：归位）----------
  const chairG = new THREE.Group();
  const seat = makeBox(0.5, 0.06, 0.5, 0x5b7fa6); seat.position.y = 0.48; chairG.add(seat);
  const backrest = makeBox(0.5, 0.55, 0.06, 0x5b7fa6); backrest.position.set(0, 0.78, -0.22); chairG.add(backrest);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const leg = makeBox(0.05, 0.48, 0.05, 0x3d3d3d);
    leg.position.set(lx, 0.24, lz); chairG.add(leg);
  }
  const chairHome = { x: -0.5, z: -5.55, ry: Math.PI };
  chairG.position.set(-2.2, 0, -4.2);
  chairG.rotation.y = 2.2;
  scene.add(chairG);
  addCollider(-2.2, -4.2, 0.6, 0.6);
  const chairTask = addTask('椅子归位');
  const chairCollider = colliders[colliders.length - 1];
  addInteractable({
    pos: chairG.position,
    meshes: [chairG],
    getPrompt: () => !chairTask.done ? '按 <b>E</b> 把椅子放回书桌' : null,
    action: () => {
      chairG.position.set(chairHome.x, 0, chairHome.z);
      chairG.rotation.y = chairHome.ry;
      Object.assign(chairCollider, { minX: chairHome.x - 0.3, maxX: chairHome.x + 0.3, minZ: chairHome.z - 0.3, maxZ: chairHome.z + 0.3 });
      chairTask.done = true;
      ctx.onProgress();
    },
  });

  // ---------- 床（整理任务：铺床）----------
  const bedG = new THREE.Group();
  const bedFrame = makeBox(1.8, 0.3, 2.4, 0x8a5f38); bedFrame.position.y = 0.2; bedG.add(bedFrame);
  const mattress = makeBox(1.7, 0.2, 2.3, 0xf0ead8); mattress.position.y = 0.45; bedG.add(mattress);
  const headboard = makeBox(1.8, 0.9, 0.1, 0x7a5230); headboard.position.set(0, 0.7, -1.2); bedG.add(headboard);
  const blanket = makeBox(1.75, 0.08, 1.6, 0x6a8fbf); blanket.position.set(0.35, 0.56, 0.5); blanket.rotation.y = 0.35; bedG.add(blanket);
  const pillow = makeBox(0.6, 0.12, 0.4, 0xffffff); pillow.position.set(-0.4, 0.58, -0.8); pillow.rotation.y = 0.5; bedG.add(pillow);
  bedG.position.set(8.2, 0, -3);
  scene.add(bedG);
  addCollider(8.2, -3, 1.8, 2.4);
  const bedTask = addTask('整理床铺');
  addInteractable({
    pos: new THREE.Vector3(8.2, 0.5, -3),
    meshes: [blanket, pillow],
    getPrompt: () => !bedTask.done ? '按 <b>E</b> 整理床铺' : null,
    action: () => {
      blanket.position.set(0, 0.56, 0.3); blanket.rotation.y = 0;
      pillow.position.set(0, 0.58, -0.85); pillow.rotation.y = 0;
      bedTask.done = true;
      ctx.onProgress();
    },
  });

  // ---------- 沙发 + 抱枕（整理任务）----------
  const sofaG = new THREE.Group();
  const sofaColor = 0x4e7a5a;
  const sofaBase = makeBox(2.4, 0.45, 1, sofaColor); sofaBase.position.y = 0.25; sofaG.add(sofaBase);
  const sofaBack = makeBox(2.4, 0.6, 0.25, sofaColor); sofaBack.position.set(0, 0.75, -0.38); sofaG.add(sofaBack);
  const arm1 = makeBox(0.25, 0.35, 1, sofaColor); arm1.position.set(-1.08, 0.65, 0); sofaG.add(arm1);
  const arm2 = makeBox(0.25, 0.35, 1, sofaColor); arm2.position.set(1.08, 0.65, 0); sofaG.add(arm2);
  sofaG.position.set(3, 0, 2.2);
  sofaG.rotation.y = Math.PI / 2; // 面向 +x（电视方向）
  scene.add(sofaG);
  addCollider(3, 2.2, 1.1, 2.5);

  const cushion = makeBox(0.4, 0.4, 0.15, 0xe0a83c);
  cushion.position.set(2, 0.2, 4.2); // 掉在地上
  cushion.rotation.set(0.9, 0.5, 0.3);
  scene.add(cushion);
  const cushionTask = addTask('抱枕放回沙发');
  addInteractable({
    pos: cushion.position,
    meshes: [cushion],
    getPrompt: () => !cushionTask.done ? '按 <b>E</b> 把抱枕放回沙发' : null,
    action: () => {
      cushion.position.set(3, 0.62, 2.8);
      cushion.rotation.set(0, Math.PI / 2, 0.2);
      cushionTask.done = true;
      ctx.onProgress();
    },
  });

  // ---------- 茶几 ----------
  const tableG = new THREE.Group();
  const tableTop = makeBox(1.2, 0.06, 0.7, 0x9a6b3f); tableTop.position.y = 0.42; tableG.add(tableTop);
  for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) {
    const leg = makeBox(0.06, 0.42, 0.06, 0x7a5230);
    leg.position.set(lx, 0.21, lz); tableG.add(leg);
  }
  const mug = makeCyl(0.05, 0.04, 0.09, 0xd94f4f); mug.position.set(0.3, 0.5, 0.1); tableG.add(mug);
  tableG.position.set(5.5, 0, 3);
  scene.add(tableG);
  addCollider(5.5, 3, 1.2, 0.7);

  // ---------- 电视柜 + 电视（可开关）----------
  const tvStandG = new THREE.Group();
  const stand = makeBox(0.5, 0.45, 1.8, 0x6b4a2f); stand.position.y = 0.225; tvStandG.add(stand);
  tvStandG.position.set(8.6, 0, 3);
  scene.add(tvStandG);
  addCollider(8.6, 3, 0.5, 1.8);

  const tvG = new THREE.Group();
  const tvBody = makeBox(0.08, 0.9, 1.6, 0x222222, { roughness: 0.4 }); tvBody.position.y = 1.0; tvG.add(tvBody);
  const tvScreenMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x000000, roughness: 0.2 });
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 0.75), tvScreenMat);
  tvScreen.position.set(-0.05, 1.0, 0); tvScreen.rotation.y = -Math.PI / 2; tvG.add(tvScreen);
  tvG.position.set(8.6, 0, 3);
  scene.add(tvG);

  let tvOn = false;
  addInteractable({
    pos: new THREE.Vector3(8.4, 1, 3),
    meshes: [tvBody],
    getPrompt: () => tvOn ? '按 <b>E</b> 关掉电视' : '按 <b>E</b> 打开电视',
    action: () => {
      tvOn = !tvOn;
      tvScreenMat.emissive.setHex(tvOn ? 0x3a6ea8 : 0x000000);
      tvScreenMat.emissiveIntensity = tvOn ? 1.2 : 0;
      tvScreenMat.color.setHex(tvOn ? 0x88bbee : 0x111111);
    },
  });

  // ---------- 落地灯（可开关）----------
  const lampG = new THREE.Group();
  const lampBase = makeCyl(0.25, 0.3, 0.06, 0x555555); lampBase.position.y = 0.03; lampG.add(lampBase);
  const lampPole = makeCyl(0.03, 0.03, 1.7, 0x555555); lampPole.position.y = 0.9; lampG.add(lampPole);
  const lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xf2d9a0, roughness: 0.9, emissive: 0x000000 });
  const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.45, 20, 1, true), lampShadeMat);
  lampShade.position.y = 1.85; lampG.add(lampShade);
  const lampLight = new THREE.PointLight(0xffdca0, 0, 8);
  lampLight.position.y = 1.7; lampG.add(lampLight);
  lampG.position.set(-8.5, 0, 5.5);
  scene.add(lampG);
  addCollider(-8.5, 5.5, 0.5, 0.5);

  let lampOn = false;
  addInteractable({
    pos: new THREE.Vector3(-8.5, 1, 5.5),
    meshes: [lampShade],
    getPrompt: () => lampOn ? '按 <b>E</b> 关掉落地灯' : '按 <b>E</b> 打开落地灯',
    action: () => {
      lampOn = !lampOn;
      lampLight.intensity = lampOn ? 25 : 0;
      lampShadeMat.emissive.setHex(lampOn ? 0xffdca0 : 0x000000);
      lampShadeMat.emissiveIntensity = lampOn ? 0.7 : 0;
    },
  });

  // ---------- 储物柜（柜门可开关）----------
  const cabG = new THREE.Group();
  const cabBody = makeBox(1.6, 1.8, 0.55, 0x8a5f38); cabBody.position.y = 0.9; cabG.add(cabBody);
  const cabDoorMat = new THREE.MeshStandardMaterial({ color: 0xa9805a, roughness: 0.7 });
  const cabDoor = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1.7, 0.05), cabDoorMat);
  cabDoor.castShadow = true;
  const cabDoorPivot = new THREE.Group();
  cabDoorPivot.position.set(-0.38, 0.9, 0.28);
  cabDoor.position.x = 0.38;
  cabDoorPivot.add(cabDoor);
  cabG.add(cabDoorPivot);
  const cabDoor2Pivot = cabDoorPivot.clone();
  cabDoor2Pivot.position.x = 0.38;
  cabDoor2Pivot.children[0].position.x = -0.38;
  cabG.add(cabDoor2Pivot);
  cabG.position.set(7.5, 0, -6.5);
  scene.add(cabG);
  addCollider(7.5, -6.5, 1.6, 0.6);

  let cabOpen = false;
  addInteractable({
    pos: new THREE.Vector3(7.5, 1, -6.3),
    meshes: [cabDoor, cabDoor2Pivot.children[0]],
    getPrompt: () => cabOpen ? '按 <b>E</b> 关上柜门' : '按 <b>E</b> 打开柜门',
    action: () => {
      cabOpen = !cabOpen;
      cabDoorPivot.rotation.y = cabOpen ? -1.9 : 0;
      cabDoor2Pivot.rotation.y = cabOpen ? 1.9 : 0;
    },
  });

  // ---------- 盆栽 ----------
  const plantG = new THREE.Group();
  const pot = makeCyl(0.22, 0.16, 0.3, 0xb5654a); pot.position.y = 0.15; plantG.add(pot);
  const stem = makeCyl(0.02, 0.03, 0.5, 0x3f7a3f); stem.position.y = 0.5; plantG.add(stem);
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1),
    new THREE.MeshStandardMaterial({ color: 0x53b15a, roughness: 1 }));
  leaves.position.y = 0.9; leaves.castShadow = true; plantG.add(leaves);
  plantG.position.set(8.8, 0, 5.8);
  scene.add(plantG);
  addCollider(8.8, 5.8, 0.5, 0.5);
  addInteractable({
    pos: new THREE.Vector3(8.8, 0.8, 5.8),
    meshes: [leaves],
    getPrompt: () => '按 <b>E</b> 给植物浇水',
    action: () => {
      leaves.scale.setScalar(1.25);
      ctx.flashMessage('🌱 植物喝饱了水，看起来更有精神了！');
      setTimeout(() => leaves.scale.setScalar(1), 600);
    },
  });

  // ---------- 衣帽架 ----------
  const rackG = new THREE.Group();
  const rackBase = makeCyl(0.3, 0.35, 0.05, 0x5a4632); rackBase.position.y = 0.03; rackG.add(rackBase);
  const rackPole = makeCyl(0.04, 0.04, 1.8, 0x6b5238); rackPole.position.y = 0.9; rackG.add(rackPole);
  for (let i = 0; i < 4; i++) {
    const hook = makeBox(0.25, 0.04, 0.04, 0x6b5238);
    hook.position.y = 1.7 - i * 0.15;
    hook.rotation.y = i * Math.PI / 2;
    hook.position.x = Math.cos(i * Math.PI / 2) * 0.1;
    hook.position.z = Math.sin(i * Math.PI / 2) * 0.1;
    rackG.add(hook);
  }
  const hat = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.2, 16),
    new THREE.MeshStandardMaterial({ color: 0xc2554f }));
  hat.position.y = 1.9; hat.castShadow = true; rackG.add(hat);
  rackG.position.set(-9.2, 0, 0);
  scene.add(rackG);
  addCollider(-9.2, 0, 0.6, 0.6);

  // ---------- 垃圾桶 + 纸团（整理任务）----------
  const bin = makeCyl(0.25, 0.2, 0.45, 0x7f8c8d);
  bin.position.set(1.5, 0.225, -6.3);
  scene.add(bin);
  addCollider(1.5, -6.3, 0.5, 0.5);
  addInteractable({
    pos: new THREE.Vector3(1.5, 0.3, -6.3),
    meshes: [bin],
    getPrompt: () => ctx.carrying?.type === 'paper' ? '按 <b>E</b> 把纸团扔进垃圾桶' : null,
    action: () => {
      const paper = ctx.carrying;
      ctx.dropCarried();
      paper.mesh.position.set(1.5, 0.45, -6.3);
      paper.mesh.scale.setScalar(0.7);
      scene.add(paper.mesh);
      paper.task.done = true;
      ctx.onProgress();
    },
  });

  const paperSpots = [[-3, 1.5], [2.5, -1.5], [6, 4.5], [-5.5, 4]];
  paperSpots.forEach(([x, z], i) => {
    const mesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f0, roughness: 1, flatShading: true }));
    mesh.position.set(x, 0.09, z);
    mesh.castShadow = true;
    scene.add(mesh);
    const task = addTask(`纸团 #${i + 1}`);
    const paper = { type: 'paper', mesh, task };
    papers.push(paper);
    addInteractable({
      pos: mesh.position,
      meshes: [mesh],
      getPrompt: () => !task.done && !ctx.carrying ? '按 <b>E</b> 捡起纸团' : null,
      action: () => {
        scene.remove(mesh);
        ctx.pickUp(paper);
      },
    });
  });

  return { colliders, interactables, tasks, bounds: { W, D } };
}
