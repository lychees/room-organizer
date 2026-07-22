// 房间与家具构建模块（支持 现代 / 大航海·维多利亚 双主题）
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

function woodTexture(palette = ['#b58a5a', '#ad8152', '#bd9160']) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = palette[0];
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 8; i++) {
    g.fillStyle = i % 2 ? palette[1] : palette[2];
    g.fillRect(0, i * 32, 256, 32);
    g.strokeStyle = 'rgba(60,40,20,.5)';
    g.strokeRect(0, i * 32 + .5, 256, 31);
  }
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(60,40,20,${Math.random() * .18})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, Math.random() * 40 + 5, 1.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 4);
  return tex;
}

// ---------- 主构建函数 ----------
// 返回 { colliders, interactables, tasks, bounds, updaters }
export function buildRoom(scene, ctx, theme = 'modern') {
  const V = theme === 'victorian';
  const updaters = [];
  // 主题配色
  const WOOD = V ? 0x4a3524 : 0x7a5230;     // 深木
  const WOOD_L = V ? 0x6a4a2c : 0x9a6b3f;   // 浅木
  const WOOD_D = V ? 0x3a2818 : 0x6b4527;   // 背板
  const WOOD_M = V ? 0x5a3d24 : 0x8a5f38;   // 中间木
  const WOOD_XL = V ? 0x6a4a2c : 0xa9805a;  // 面板
  const FABRIC = V ? 0x6a2e3a : 0x5b7fa6;   // 布艺

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
    new THREE.MeshStandardMaterial({ map: woodTexture(V ? ['#6a4a2c', '#634427', '#715031'] : undefined), roughness: 0.7 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const wallMat = new THREE.MeshStandardMaterial({ color: V ? 0x584a3e : 0xe8dcc8, roughness: 0.95 });
  const mkWall = (w, h, x, y, z, ry) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), wallMat);
    m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = true;
    scene.add(m);
  };
  mkWall(W, H, 0, H / 2, -D / 2, 0);            // 北
  mkWall(W, H, 0, H / 2, D / 2, Math.PI);       // 南
  mkWall(D, H, -W / 2, H / 2, 0, Math.PI / 2);  // 西
  mkWall(D, H, W / 2, H / 2, 0, -Math.PI / 2);  // 东

  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ color: V ? 0x4a3f38 : 0xf5f0e6 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H;
  scene.add(ceil);

  // ---------- 窗户（南墙）：现代方窗 / 维多利亚黄铜舷窗 ----------
  if (V) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.1, 12, 28),
      new THREE.MeshStandardMaterial({ color: 0x9a7a2a, roughness: 0.35, metalness: 0.75 }));
    ring.position.set(2, 2.2, D / 2 - 0.08);
    scene.add(ring);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.85, 28),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x557799, emissiveIntensity: 0.4 }));
    glass.position.set(2, 2.2, D / 2 - 0.12); glass.rotation.y = Math.PI;
    scene.add(glass);
    for (let i = 0; i < 4; i++) {
      const bolt = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xc8a83a, metalness: 0.8, roughness: 0.3 }));
      bolt.position.set(2 + Math.cos(i * Math.PI / 2 + 0.78) * 0.85, 2.2 + Math.sin(i * Math.PI / 2 + 0.78) * 0.85, D / 2 - 0.06);
      scene.add(bolt);
    }
  } else {
    const winFrame = makeBox(3, 2, 0.1, 0x8b6f47);
    winFrame.position.set(2, 2.2, D / 2 - 0.06); scene.add(winFrame);
    const winGlass = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.7),
      new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x6688aa, emissiveIntensity: 0.4 }));
    winGlass.position.set(2, 2.2, D / 2 - 0.12); winGlass.rotation.y = Math.PI;
    scene.add(winGlass);
  }

  // 地毯
  const rug = new THREE.Mesh(new THREE.CircleGeometry(2.2, 32),
    new THREE.MeshStandardMaterial({ color: V ? 0x6a2e3a : 0xc2554f, roughness: 1 }));
  rug.rotation.x = -Math.PI / 2; rug.position.set(4.5, 0.01, 3);
  rug.receiveShadow = true; scene.add(rug);

  // ---------- 书柜（核心交互）----------
  const shelfG = new THREE.Group();
  const shelfColor = WOOD;
  const sw = 3.2, sh = 2.6, sd = 0.45;
  const side1 = makeBox(0.08, sh, sd, shelfColor); side1.position.set(-sw / 2, sh / 2, 0);
  const side2 = makeBox(0.08, sh, sd, shelfColor); side2.position.set(sw / 2, sh / 2, 0);
  const top = makeBox(sw + 0.08, 0.08, sd, shelfColor); top.position.set(0, sh, 0);
  const bottom = makeBox(sw + 0.08, 0.08, sd, shelfColor); bottom.position.set(0, 0.04, 0);
  const back = makeBox(sw, sh, 0.05, WOOD_D); back.position.set(0, sh / 2, -sd / 2 + 0.03);
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
  const bookColors = V
    ? [0x8a3a2e, 0x3a5a4a, 0x6a5a2a, 0x4a3a5a, 0x7a4a2a, 0x2e4a5a, 0x8a6a3a, 0x5a4a3a]
    : [0xd94f4f, 0x4f7ad9, 0x53b15a, 0xe0a83c, 0x9b59b6, 0x3cb8b0, 0xe06c9f, 0x7f8c8d];
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
  const deskTop = makeBox(2, 0.08, 0.9, WOOD_L); deskTop.position.y = 0.78;
  deskG.add(deskTop);
  for (const [lx, lz] of [[-0.9, -0.35], [0.9, -0.35], [-0.9, 0.35], [0.9, 0.35]]) {
    const leg = makeBox(0.08, 0.78, 0.08, WOOD);
    leg.position.set(lx, 0.39, lz); deskG.add(leg);
  }
  const drawerBox = makeBox(0.7, 0.5, 0.8, WOOD_M);
  drawerBox.position.set(0.6, 0.5, 0); deskG.add(drawerBox);
  const drawer = makeBox(0.62, 0.16, 0.7, WOOD_XL);
  drawer.position.set(0.6, 0.55, 0); deskG.add(drawer);
  if (V) {
    // 维多利亚：桌上放羽毛笔和墨水瓶
    const ink = makeCyl(0.05, 0.06, 0.08, 0x1a1a2a); ink.position.set(-0.5, 0.85, -0.2); deskG.add(ink);
    const quill = makeBox(0.02, 0.3, 0.06, 0xf0ead8); quill.position.set(-0.5, 1.0, -0.2); quill.rotation.z = 0.4; deskG.add(quill);
    const scroll = makeCyl(0.04, 0.04, 0.4, 0xe8d8b0); scroll.rotation.z = Math.PI / 2; scroll.position.set(0.1, 0.84, 0.15); deskG.add(scroll);
  } else {
    // 现代：台灯 + 笔筒
    const deskLampBase = makeCyl(0.12, 0.14, 0.05, 0x444444); deskLampBase.position.set(-0.6, 0.85, -0.2); deskG.add(deskLampBase);
    const deskLampPole = makeCyl(0.02, 0.02, 0.35, 0x444444); deskLampPole.position.set(-0.6, 1.02, -0.2); deskG.add(deskLampPole);
    const deskLampHead = makeCyl(0.09, 0.13, 0.14, 0x2e8b8b); deskLampHead.position.set(-0.6, 1.22, -0.2); deskG.add(deskLampHead);
    const penCup = makeCyl(0.07, 0.06, 0.14, 0xc2554f); penCup.position.set(-0.2, 0.89, 0.25); deskG.add(penCup);
  }
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
  const seat = makeBox(0.5, 0.06, 0.5, FABRIC); seat.position.y = 0.48; chairG.add(seat);
  const backrest = makeBox(0.5, 0.55, 0.06, FABRIC); backrest.position.set(0, 0.78, -0.22); chairG.add(backrest);
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
    getPrompt: () => {
      if (!chairTask.done) return '按 <b>E</b> 把椅子放回书桌';
      if (ctx.carrying || ctx.isSeated?.()) return null;
      return '按 <b>E</b> 坐下 🪑';
    },
    action: () => {
      if (!chairTask.done) {
        chairG.position.set(chairHome.x, 0, chairHome.z);
        chairG.rotation.y = chairHome.ry;
        Object.assign(chairCollider, { minX: chairHome.x - 0.3, maxX: chairHome.x + 0.3, minZ: chairHome.z - 0.3, maxZ: chairHome.z + 0.3 });
        chairTask.done = true;
        ctx.onProgress();
      } else {
        ctx.sitDown({ type: 'sit', y: -0.17, ry: chairHome.ry, pos: new THREE.Vector3(chairHome.x, 0, chairHome.z) });
      }
    },
  });

  // ---------- 床（整理任务：铺床）----------
  const bedG = new THREE.Group();
  const bedFrame = makeBox(1.8, 0.3, 2.4, WOOD_M); bedFrame.position.y = 0.2; bedG.add(bedFrame);
  const mattress = makeBox(1.7, 0.2, 2.3, 0xf0ead8); mattress.position.y = 0.45; bedG.add(mattress);
  const headboard = makeBox(1.8, 0.9, 0.1, WOOD); headboard.position.set(0, 0.7, -1.2); bedG.add(headboard);
  const blanket = makeBox(1.75, 0.08, 1.6, V ? 0x6a2e3a : 0x6a8fbf); blanket.position.set(0.35, 0.56, 0.5); blanket.rotation.y = 0.35; bedG.add(blanket);
  const pillow = makeBox(0.6, 0.12, 0.4, 0xffffff); pillow.position.set(-0.4, 0.58, -0.8); pillow.rotation.y = 0.5; bedG.add(pillow);
  bedG.position.set(8.2, 0, -3);
  scene.add(bedG);
  addCollider(8.2, -3, 1.8, 2.4);
  const bedTask = addTask('整理床铺');
  addInteractable({
    pos: new THREE.Vector3(8.2, 0.5, -3),
    meshes: [blanket, pillow],
    getPrompt: () => {
      if (!bedTask.done) return '按 <b>E</b> 整理床铺';
      if (ctx.carrying || ctx.isSeated?.()) return null;
      return '按 <b>E</b> 躺下休息 🛏️';
    },
    action: () => {
      if (!bedTask.done) {
        blanket.position.set(0, 0.56, 0.3); blanket.rotation.y = 0;
        pillow.position.set(0, 0.58, -0.85); pillow.rotation.y = 0;
        bedTask.done = true;
        ctx.onProgress();
      } else {
        ctx.sitDown({ type: 'lie', y: 0.55, ry: 0, pos: new THREE.Vector3(8.2, 0, -3) });
      }
    },
  });

  // ---------- 沙发 + 抱枕（整理任务）----------
  const sofaG = new THREE.Group();
  const sofaColor = V ? 0x5a3a28 : 0x4e7a5a;
  const sofaBase = makeBox(2.4, 0.45, 1, sofaColor); sofaBase.position.y = 0.25; sofaG.add(sofaBase);
  const sofaBack = makeBox(2.4, 0.6, 0.25, sofaColor); sofaBack.position.set(0, 0.75, -0.38); sofaG.add(sofaBack);
  const arm1 = makeBox(0.25, 0.35, 1, sofaColor); arm1.position.set(-1.08, 0.65, 0); sofaG.add(arm1);
  const arm2 = makeBox(0.25, 0.35, 1, sofaColor); arm2.position.set(1.08, 0.65, 0); sofaG.add(arm2);
  sofaG.position.set(3, 0, 2.2);
  sofaG.rotation.y = Math.PI / 2; // 面向 +x
  scene.add(sofaG);
  addCollider(3, 2.2, 1.1, 2.5);
  addInteractable({
    pos: new THREE.Vector3(3, 0.5, 2.9),
    meshes: [sofaBase],
    getPrompt: () => (ctx.carrying || ctx.isSeated?.()) ? null : '按 <b>E</b> 坐上沙发 🛋️',
    action: () => ctx.sitDown({ type: 'sit', y: -0.2, ry: Math.PI / 2, pos: new THREE.Vector3(3, 0, 2.2) }),
  });

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
  const tableTop = makeBox(1.2, 0.06, 0.7, WOOD_L); tableTop.position.y = 0.42; tableG.add(tableTop);
  for (const [lx, lz] of [[-0.5, -0.25], [0.5, -0.25], [-0.5, 0.25], [0.5, 0.25]]) {
    const leg = makeBox(0.06, 0.42, 0.06, WOOD);
    leg.position.set(lx, 0.21, lz); tableG.add(leg);
  }
  const mug = makeCyl(0.05, 0.04, 0.09, V ? 0x8a6a2a : 0xd94f4f); mug.position.set(0.3, 0.5, 0.1); tableG.add(mug);
  tableG.position.set(5.5, 0, 3);
  scene.add(tableG);
  addCollider(5.5, 3, 1.2, 0.7);

  // ---------- 东墙：现代电视柜+电视 / 维多利亚石砌壁炉 ----------
  if (V) {
    const fpG = new THREE.Group();
    const stone = 0x6a6560, stoneD = 0x55504c;
    const fpBack = makeBox(0.25, 1.35, 1.7, stone); fpBack.position.set(0.15, 0.675, 0); fpG.add(fpBack);
    const col1 = makeBox(0.35, 1.2, 0.3, stoneD); col1.position.set(-0.05, 0.6, 0.68); fpG.add(col1);
    const col2 = makeBox(0.35, 1.2, 0.3, stoneD); col2.position.set(-0.05, 0.6, -0.68); fpG.add(col2);
    const mantel = makeBox(0.5, 0.14, 1.75, WOOD); mantel.position.set(-0.02, 1.28, 0); fpG.add(mantel);
    const inner = makeBox(0.3, 1.0, 1.05, 0x14100c); inner.position.set(-0.02, 0.5, 0); fpG.add(inner);
    const log1 = makeCyl(0.06, 0.06, 0.7, 0x4a3020, 10); log1.rotation.x = Math.PI / 2; log1.position.set(-0.05, 0.12, 0); fpG.add(log1);
    const log2 = makeCyl(0.05, 0.05, 0.6, 0x5a3a26, 10); log2.rotation.x = Math.PI / 2; log2.rotation.z = 0.3; log2.position.set(-0.05, 0.22, 0.05); fpG.add(log2);
    // 火焰
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xff7716, emissive: 0xff5500, emissiveIntensity: 1.6, transparent: true, opacity: 0.95 });
    const flames = [];
    for (const [z, s] of [[-0.15, 0.8], [0, 1.1], [0.15, 0.9]]) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.09 * s, 0.4 * s, 8), flameMat);
      f.position.set(-0.05, 0.35, z); f.visible = false;
      fpG.add(f); flames.push(f);
    }
    const fireLight = new THREE.PointLight(0xff7733, 0, 7);
    fireLight.position.set(-0.3, 0.6, 0); fpG.add(fireLight);
    // 烛台摆件（壁炉台上）
    const candle = makeCyl(0.02, 0.025, 0.15, 0xf0ead8); candle.position.set(0, 1.43, 0.5); fpG.add(candle);
    fpG.position.set(8.6, 0, 3);
    scene.add(fpG);
    addCollider(8.6, 3, 0.6, 1.8);

    let fireOn = false;
    updaters.push((dt, t) => {
      if (!fireOn) return;
      fireLight.intensity = 12 + Math.sin(t * 11) * 3 + Math.sin(t * 23) * 2;
      flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 9 + i * 2) * 0.25; });
    });
    addInteractable({
      pos: new THREE.Vector3(8.4, 0.8, 3),
      meshes: [fpBack],
      getPrompt: () => fireOn ? '按 <b>E</b> 熄灭火炉' : '按 <b>E</b> 生起炉火',
      action: () => {
        fireOn = !fireOn;
        for (const f of flames) f.visible = fireOn;
        fireLight.intensity = fireOn ? 12 : 0;
      },
    });
  } else {
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
  }

  // ---------- 角落：现代落地灯 / 维多利亚银烛台 ----------
  const lampG = new THREE.Group();
  let lampOn = false;
  let lampToggle;
  if (V) {
    const brass = 0x9a7a2a;
    const base = makeCyl(0.22, 0.28, 0.06, brass); base.position.y = 0.03; lampG.add(base);
    const pole = makeCyl(0.025, 0.035, 1.5, brass); pole.position.y = 0.8; lampG.add(pole);
    const flames = [];
    for (const [x, z, h] of [[0, 0, 0], [0.18, 0, -0.12], [-0.18, 0, -0.12]]) {
      if (x !== 0) {
        const arm = makeBox(Math.abs(x), 0.03, 0.03, brass);
        arm.position.set(x / 2, 1.42, z); lampG.add(arm);
      }
      const candle = makeCyl(0.022, 0.022, 0.18, 0xf0ead8); candle.position.set(x, 1.52, z); lampG.add(candle);
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.07, 8),
        new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0xff8800, emissiveIntensity: 2 }));
      flame.position.set(x, 1.66, z); flame.visible = false;
      lampG.add(flame); flames.push(flame);
    }
    const lampLight = new THREE.PointLight(0xffb060, 0, 8);
    lampLight.position.y = 1.6; lampG.add(lampLight);
    updaters.push((dt, t) => {
      if (!lampOn) return;
      lampLight.intensity = 14 + Math.sin(t * 13) * 2.5;
      flames.forEach((f, i) => { f.scale.y = 1 + Math.sin(t * 10 + i * 2.4) * 0.3; });
    });
    lampToggle = (on) => {
      lampLight.intensity = on ? 14 : 0;
      for (const f of flames) f.visible = on;
    };
    var lampPrompts = ['点燃蜡烛', '吹灭蜡烛'];
    var lampMeshes = [lampG.children[1]];
  } else {
    const lampBase = makeCyl(0.25, 0.3, 0.06, 0x555555); lampBase.position.y = 0.03; lampG.add(lampBase);
    const lampPole = makeCyl(0.03, 0.03, 1.7, 0x555555); lampPole.position.y = 0.9; lampG.add(lampPole);
    const lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xf2d9a0, roughness: 0.9, emissive: 0x000000 });
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.45, 20, 1, true), lampShadeMat);
    lampShade.position.y = 1.85; lampG.add(lampShade);
    const lampLight = new THREE.PointLight(0xffdca0, 0, 8);
    lampLight.position.y = 1.7; lampG.add(lampLight);
    lampToggle = (on) => {
      lampLight.intensity = on ? 25 : 0;
      lampShadeMat.emissive.setHex(on ? 0xffdca0 : 0x000000);
      lampShadeMat.emissiveIntensity = on ? 0.7 : 0;
    };
    var lampPrompts2 = ['打开落地灯', '关掉落地灯'];
    var lampMeshes2 = [lampShade];
  }
  lampG.position.set(-8.5, 0, 5.5);
  scene.add(lampG);
  addCollider(-8.5, 5.5, 0.5, 0.5);
  {
    const prompts = V ? lampPrompts : lampPrompts2;
    const meshes = V ? lampMeshes : lampMeshes2;
    addInteractable({
      pos: new THREE.Vector3(-8.5, 1, 5.5),
      meshes,
      getPrompt: () => lampOn ? `按 <b>E</b> ${prompts[1]}` : `按 <b>E</b> ${prompts[0]}`,
      action: () => { lampOn = !lampOn; lampToggle(lampOn); },
    });
  }

  // ---------- 储物柜（柜门可开关）----------
  const cabG = new THREE.Group();
  const cabBody = makeBox(1.6, 1.8, 0.55, WOOD_M); cabBody.position.y = 0.9; cabG.add(cabBody);
  const cabDoorMat = new THREE.MeshStandardMaterial({ color: WOOD_XL, roughness: 0.7 });
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
    new THREE.MeshStandardMaterial({ color: V ? 0x1a1a1a : 0xc2554f }));
  hat.position.y = 1.9; hat.castShadow = true; rackG.add(hat);
  rackG.position.set(-9.2, 0, 0);
  scene.add(rackG);
  addCollider(-9.2, 0, 0.6, 0.6);
  addInteractable({
    pos: new THREE.Vector3(-9.2, 1, 0),
    meshes: [rackPole],
    getPrompt: () => '按 <b>E</b> 换衣服 👔',
    action: () => ctx.openDress?.(),
  });

  // ---------- 垃圾桶 + 纸团（整理任务）----------
  const bin = makeCyl(0.25, 0.2, 0.45, V ? 0x8a5f38 : 0x7f8c8d);
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
      new THREE.MeshStandardMaterial({ color: V ? 0xe8d8b0 : 0xf5f5f0, roughness: 1, flatShading: true }));
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

  return { colliders, interactables, tasks, bounds: { W, D }, updaters };
}
