// 服装系统 —— 各主题的角色服装与帽子
import * as THREE from 'three';

// ---------- 帽子构建 ----------
export function makeHat(spec) {
  if (!spec) return null;
  const g = new THREE.Group();
  const mat = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const cyl = (rt, rb, h, c, seg = 18) => new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(c));
  const dome = (r, c) => new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(c));
  const box = (w, h, d, c) => new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(c));
  const put = (m, x, y, z, rx = 0, rz = 0) => { m.position.set(x, y, z); m.rotation.x = rx; m.rotation.z = rz; g.add(m); return m; };

  switch (spec.type) {
    case 'top': // 礼帽
      put(cyl(0.26, 0.26, 0.03, spec.color), 0, 1.56, 0);
      put(cyl(0.15, 0.17, 0.24, spec.color), 0, 1.69, 0);
      put(cyl(0.175, 0.18, 0.05, spec.band ?? 0x8a2e2e), 0, 1.6, 0);
      break;
    case 'tall': // 高礼帽
      put(cyl(0.26, 0.26, 0.03, spec.color), 0, 1.56, 0);
      put(cyl(0.14, 0.16, 0.36, spec.color), 0, 1.75, 0);
      put(cyl(0.165, 0.17, 0.05, spec.band ?? 0x444444), 0, 1.62, 0);
      break;
    case 'cap': // 棒球帽
      put(dome(0.195, spec.color), 0, 1.44, 0);
      put(box(0.2, 0.02, 0.2, spec.color), 0, 1.5, 0.24);
      break;
    case 'bucket': // 渔夫帽/雨帽
      put(cyl(0.17, 0.2, 0.14, spec.color), 0, 1.56, 0);
      put(cyl(0.27, 0.27, 0.02, spec.color), 0, 1.5, 0);
      break;
    case 'helmet': // 安全帽/飞行帽
      put(dome(0.22, spec.color), 0, 1.43, 0);
      put(cyl(0.22, 0.23, 0.03, spec.color), 0, 1.46, 0);
      break;
    case 'bandana': // 头巾
      put(dome(0.2, spec.color), 0, 1.44, 0);
      put(cyl(0.2, 0.2, 0.05, spec.color), 0, 1.47, 0);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(spec.color)), 0, 1.48, -0.2);
      break;
    case 'sailor': // 水手帽
      put(cyl(0.17, 0.19, 0.09, spec.color), 0, 1.53, 0);
      put(cyl(0.19, 0.19, 0.02, spec.color), 0, 1.58, 0);
      break;
    case 'safari': // 探险帽
      put(dome(0.18, spec.color), 0, 1.47, 0);
      put(cyl(0.28, 0.28, 0.025, spec.color), 0, 1.5, 0);
      put(cyl(0.185, 0.185, 0.04, 0x6a4a2a), 0, 1.52, 0);
      break;
    case 'wig': // 贵族假发
      put(dome(0.2, spec.color), 0, 1.44, 0);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(spec.color)), -0.18, 1.42, 0);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), mat(spec.color)), 0.18, 1.42, 0);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat(spec.color)), 0, 1.4, -0.19);
      break;
    case 'nightcap': // 睡帽
      put(new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.36, 14), mat(spec.color)), 0.08, 1.66, 0, 0, -0.5);
      put(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(0xffffff)), 0.2, 1.76, 0);
      break;
  }
  g.traverse(m => { if (m.isMesh) m.castShadow = true; });
  return g;
}

// ---------- 各主题服装 ----------
export function getOutfits(theme) {
  if (theme === 'victorian') return [
    { id: 'captain', icon: '🎩', name: '船长礼服', shirt: 0x4a2e2e, pants: 0x2e2a26, hat: { type: 'top', color: 0x1a1a1a, band: 0x8a2e2e } },
    { id: 'pirate', icon: '🏴‍☠️', name: '海盗装', shirt: 0x6a2e2e, pants: 0x2a2a26, hat: { type: 'bandana', color: 0x8a2e2e } },
    { id: 'gentleman', icon: '🤵', name: '绅士燕尾服', shirt: 0x1a1a1a, pants: 0x1a1a1a, hat: { type: 'tall', color: 0x1a1a1a, band: 0x444444 } },
    { id: 'sailor', icon: '⚓', name: '水手服', shirt: 0xf0f0f0, pants: 0x2a3a5a, hat: { type: 'sailor', color: 0xf0f0f0 } },
    { id: 'explorer', icon: '🧭', name: '探险家装', shirt: 0x8a6a3a, pants: 0x5a4a2a, hat: { type: 'safari', color: 0xb59a6a } },
    { id: 'noble', icon: '👑', name: '贵族紫袍', shirt: 0x5a3a6a, pants: 0x3a2a4a, hat: { type: 'wig', color: 0xf0ead8 } },
    { id: 'steampunk', icon: '⚙️', name: '蒸汽朋克装', shirt: 0x6a4a2a, pants: 0x3a3a3a, hat: { type: 'helmet', color: 0x8a6a3a } },
    { id: 'scholar', icon: '📜', name: '学者长袍', shirt: 0x3a3a3a, pants: 0x3a3a3a, hat: null },
  ];
  return [
    { id: 'casual', icon: '👕', name: '蓝色休闲装', shirt: 0x4f7ad9, pants: 0x3d4a5c, hat: null },
    { id: 'hoodie', icon: '🧥', name: '红色卫衣', shirt: 0xd94f4f, pants: 0x333340, hat: { type: 'cap', color: 0xd94f4f } },
    { id: 'worker', icon: '👷', name: '工地工装', shirt: 0xe07830, pants: 0x5a5a60, hat: { type: 'helmet', color: 0xe0c83c } },
    { id: 'rain', icon: '🌧️', name: '黄色雨衣', shirt: 0xe0c83c, pants: 0x3a5a7a, hat: { type: 'bucket', color: 0xe0c83c } },
    { id: 'sport', icon: '🏅', name: '红白运动服', shirt: 0xf0f0f0, pants: 0xd94f4f, hat: { type: 'bandana', color: 0xd94f4f } },
    { id: 'suit', icon: '🤵', name: '黑色西装', shirt: 0x2a2a30, pants: 0x2a2a30, hat: null },
    { id: 'pajama', icon: '😴', name: '粉色睡衣', shirt: 0xe8a0b8, pants: 0xe8a0b8, hat: { type: 'nightcap', color: 0xe8a0b8 } },
    { id: 'cargo', icon: '🌿', name: '绿色工装', shirt: 0x4a7a3a, pants: 0x6a5a3a, hat: { type: 'cap', color: 0x4a5a3a } },
  ];
}
