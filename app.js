// Mooncake Oracle — tap the 3D mooncake to break it open and reveal a Chinese quote.
// Three.js scene: a round mooncake with a 福 imprint on top, splits along the equator.

import * as THREE from "three";
import { pickRandom } from "./quotes.js";

// ---------- DOM ----------
const canvas = document.getElementById("cookie-canvas");
const wrap = document.getElementById("canvas-wrap");
const card = document.getElementById("quote-card");
const elZh = document.getElementById("quote-zh");
const elPy = document.getElementById("quote-pinyin");
const elEn = document.getElementById("quote-en");
const elAuthor = document.getElementById("quote-author");
const hint = document.getElementById("hint");
const againBtn = document.getElementById("again-btn");
const resetBtn = document.getElementById("reset-btn");

// ---------- Scene ----------
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 3.4, 5.4);
camera.lookAt(0, -0.1, 0);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- Lighting (cool moonlit ambience) ----------
const ambient = new THREE.AmbientLight(0xb8c8ff, 0.45);
scene.add(ambient);

// Warm key light from above-front (gold) — emphasizes the 福 stamp on top
const key = new THREE.DirectionalLight(0xffe6b0, 2.2);
key.position.set(2, 6, 3);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 20;
key.shadow.camera.left = -3;
key.shadow.camera.right = 3;
key.shadow.camera.top = 3;
key.shadow.camera.bottom = -3;
key.shadow.bias = -0.0005;
scene.add(key);

// Cool rim light from behind (indigo/jade)
const rim = new THREE.DirectionalLight(0x88a8ff, 0.85);
rim.position.set(-3, 2, -4);
scene.add(rim);

// Soft fill from below (warm)
const fill = new THREE.PointLight(0xffb060, 0.5, 12);
fill.position.set(0, -2.5, 3);
scene.add(fill);

// Background glow halo
const glowTex = makeRadialGradient("#3a2a6a", "#000000", 256);
const glowMat = new THREE.MeshBasicMaterial({
  map: glowTex, transparent: true, opacity: 0.55, depthWrite: false
});
const glowSprite = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), glowMat);
glowSprite.position.set(0, 0, -3);
scene.add(glowSprite);

// Subtle pedestal disc (catches shadow, reads as "table")
const pedestalGeo = new THREE.CircleGeometry(2.6, 64);
const pedestalMat = new THREE.MeshStandardMaterial({
  color: 0x1a1138,
  roughness: 0.9,
  metalness: 0.1,
  transparent: true,
  opacity: 0.85
});
const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
pedestal.rotation.x = -Math.PI / 2;
pedestal.position.y = -0.85;
pedestal.receiveShadow = true;
scene.add(pedestal);

// ---------- Mooncake geometry ----------
// A mooncake is a short, fluted cylinder with a slightly domed top.
// Top has a stamped 福 character + scalloped edge.
const MC_RADIUS = 1.25;
const MC_HEIGHT = 0.85;
const MC_FLUTES = 16;
const MC_FLUTE_DEPTH = 0.05;

// Build the side wall as a fluted lathe, then cap with stamped top + flat bottom.
function makeMooncakeSide() {
  // Lathe profile: from bottom-outer up to top-outer with a slight dome.
  const points = [];
  const segs = 14;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // Profile bows outward slightly in the middle for a hand-pressed feel
    const bow = Math.sin(t * Math.PI) * 0.04;
    const r = MC_RADIUS + bow;
    const y = -MC_HEIGHT / 2 + t * MC_HEIGHT;
    points.push(new THREE.Vector2(r, y));
  }
  const geo = new THREE.LatheGeometry(points, 96);
  // Add fluting via vertex displacement around theta
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const theta = Math.atan2(z, x);
    const r0 = Math.sqrt(x * x + z * z);
    // Sinusoidal flutes; deeper near the equator, smoother near top/bottom
    const yNorm = y / (MC_HEIGHT / 2); // -1 .. 1
    const flutMask = Math.cos(yNorm * Math.PI / 2); // 1 in middle, 0 at ends
    const r = r0 - Math.abs(Math.cos(theta * MC_FLUTES)) * MC_FLUTE_DEPTH * flutMask;
    pos.setX(i, r * Math.cos(theta));
    pos.setZ(i, r * Math.sin(theta));
  }
  geo.computeVertexNormals();
  return geo;
}

// Top cap with central 福 stamp (texture-driven height + bumpmap effect via normal)
function makeMooncakeCap(top = true) {
  // Slightly domed disc with a stamped indent in the middle
  const segs = 96, rings = 36;
  const geo = new THREE.CircleGeometry(MC_RADIUS, segs);
  // Convert flat circle into a domed disc with stamped center
  const pos = geo.attributes.position;
  // Add radial subdivisions by re-tessellating: we'll instead replace with a custom buffergeom
  const verts = [];
  const idx = [];
  // Build concentric rings
  for (let r = 0; r <= rings; r++) {
    const rt = r / rings;
    const radius = rt * MC_RADIUS;
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      const x = radius * Math.cos(theta);
      const z = radius * Math.sin(theta);
      // Dome height: outer rim higher (raised border), center stamped slightly down
      const rim = smoothstep(0.78, 1.0, rt) * 0.05;
      // Center stamped indent (mild, so 福 reads visible)
      const indent = (1 - smoothstep(0.0, 0.42, rt)) * 0.025;
      // Subtle outer dome
      const dome = (1 - rt) * 0.015;
      // Scalloped edge fluting on the very rim
      const scallop = smoothstep(0.9, 1.0, rt) * Math.cos(theta * MC_FLUTES) * 0.025;
      // Always lift above baseline so cap stays fully above the side cylinder
      const lift = 0.06;
      const y = (top ? 1 : -1) * (lift + dome + rim - indent + scallop);
      verts.push(x, y, z);
    }
  }
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < segs; s++) {
      const a = r * (segs + 1) + s;
      const b = a + 1;
      const c = a + (segs + 1);
      const d = c + 1;
      if (top) { idx.push(a, c, b, b, c, d); }
      else     { idx.push(a, b, c, b, d, c); }
    }
  }
  const bg = new THREE.BufferGeometry();
  bg.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  bg.setIndex(idx);
  bg.computeVertexNormals();
  // UVs for the stamp texture (radial mapping centered)
  const uvs = [];
  for (let r = 0; r <= rings; r++) {
    const rt = r / rings;
    for (let s = 0; s <= segs; s++) {
      const theta = (s / segs) * Math.PI * 2;
      uvs.push(0.5 + rt * 0.5 * Math.cos(theta), 0.5 + rt * 0.5 * Math.sin(theta));
    }
  }
  bg.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  return bg;
}

function smoothstep(a, b, x) {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------- Textures ----------
function makeRadialGradient(c1, c2, size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  g.addColorStop(0, c1);
  g.addColorStop(1, c2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Mooncake side texture: warm baked gold-brown with subtle noise
function makeMooncakeSideTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#d8a45a");
  g.addColorStop(0.5, "#b9803d");
  g.addColorStop(1, "#8c5824");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Speckle bake
  for (let i = 0; i < 2200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.4 + 0.3;
    ctx.fillStyle = `rgba(60,30,5,${Math.random() * 0.28 + 0.05})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Highlights
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.5 + 0.6;
    ctx.fillStyle = `rgba(255,225,170,${Math.random() * 0.15})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(2, 1);
  return tex;
}

// Mooncake top texture: stamped 福 character + scalloped border
function makeMooncakeTopTexture(size = 1024) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  // Base radial gradient (center darker = stamped indent)
  const g = ctx.createRadialGradient(size/2, size/2, size*0.05, size/2, size/2, size/2);
  g.addColorStop(0, "#7d5026");
  g.addColorStop(0.35, "#a06f37");
  g.addColorStop(0.7, "#c89456");
  g.addColorStop(0.92, "#dca964");
  g.addColorStop(1.0, "#a87238");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // Outer scalloped band (rosette pattern around 福)
  ctx.save();
  ctx.translate(size/2, size/2);
  const petals = 16;
  for (let i = 0; i < petals; i++) {
    ctx.save();
    ctx.rotate((i / petals) * Math.PI * 2);
    ctx.beginPath();
    ctx.ellipse(size * 0.36, 0, size * 0.06, size * 0.025, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(70,40,15,0.55)";
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(size * 0.36, 0, size * 0.055, size * 0.02, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,210,140,0.18)";
    ctx.fill();
    ctx.restore();
  }
  // Inner thin ring around the 福
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.22, 0, Math.PI * 2);
  ctx.lineWidth = size * 0.006;
  ctx.strokeStyle = "rgba(70,40,15,0.55)";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.215, 0, Math.PI * 2);
  ctx.lineWidth = size * 0.002;
  ctx.strokeStyle = "rgba(255,225,170,0.4)";
  ctx.stroke();

  // 福 character — stamped, drawn larger, sharper, with crisp inner shadow
  ctx.font = `900 ${size * 0.34}px "Songti SC", "STSong", "Noto Serif SC", "PingFang SC", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // Darker stamped fill
  ctx.fillStyle = "rgba(38,18,4,0.92)";
  ctx.fillText("福", 0, size * 0.005);
  // Subtle highlight on the top edge of the strokes (relief)
  ctx.fillStyle = "rgba(255,225,170,0.22)";
  ctx.fillText("福", -size * 0.005, -size * 0.003);

  // Speckle/bake noise
  ctx.restore();
  for (let i = 0; i < 2500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.2 + 0.3;
    ctx.fillStyle = `rgba(40,20,5,${Math.random() * 0.20 + 0.04})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const sideTex = makeMooncakeSideTexture();
const topTex = makeMooncakeTopTexture();

const sideMat = new THREE.MeshStandardMaterial({
  map: sideTex,
  color: 0xc9904f,
  roughness: 0.7,
  metalness: 0.05
});
const topMat = new THREE.MeshStandardMaterial({
  map: topTex,
  color: 0xd9a35e,
  roughness: 0.55,
  metalness: 0.1,
  side: THREE.DoubleSide
});
// Inner crumb (revealed when broken)
const innerMat = new THREE.MeshStandardMaterial({
  color: 0x6b4422,
  roughness: 1.0,
  metalness: 0.0,
  emissive: 0x2a1408,
  emissiveIntensity: 0.2
});

// ---------- Build top half and bottom half groups ----------
// Strategy: each half is a short cylinder (with fluted side via vertex displacement)
// and a separate sculpted top/bottom face mesh that uses the stamp texture.
const topGroup = new THREE.Group();
const botGroup = new THREE.Group();

function makeFlutedCylinder(yMin, yMax, radialSegs = 96, heightSegs = 4) {
  const height = yMax - yMin;
  const geo = new THREE.CylinderGeometry(MC_RADIUS, MC_RADIUS, height, radialSegs, heightSegs, true);
  geo.translate(0, (yMin + yMax) / 2, 0);
  // Add fluting via vertex displacement
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const theta = Math.atan2(z, x);
    const r0 = Math.sqrt(x * x + z * z);
    const yNorm = y / (MC_HEIGHT / 2);
    // Bow outward in middle
    const bow = Math.sin((y + MC_HEIGHT/2) / MC_HEIGHT * Math.PI) * 0.04;
    // Fluting strongest near equator, fades toward top/bottom
    const flutMask = Math.cos(yNorm * Math.PI / 2);
    const r = r0 + bow - Math.abs(Math.cos(theta * MC_FLUTES)) * MC_FLUTE_DEPTH * flutMask;
    pos.setX(i, r * Math.cos(theta));
    pos.setZ(i, r * Math.sin(theta));
  }
  geo.computeVertexNormals();
  return geo;
}

const topSide = new THREE.Mesh(makeFlutedCylinder(0, MC_HEIGHT / 2), sideMat);
topSide.castShadow = topSide.receiveShadow = true;
const botSide = new THREE.Mesh(makeFlutedCylinder(-MC_HEIGHT / 2, 0), sideMat);
botSide.castShadow = botSide.receiveShadow = true;

// Domed top cap with 福 stamp — built via radial subdivisions, properly UV-mapped
const topCap = new THREE.Mesh(makeMooncakeCap(true), topMat);
topCap.position.y = MC_HEIGHT / 2 + 0.005; // tiny offset to avoid z-fighting
topCap.castShadow = topCap.receiveShadow = true;

// Bottom flat cap
const botCap = new THREE.Mesh(makeMooncakeCap(false), sideMat);
botCap.position.y = -MC_HEIGHT / 2 - 0.005;
botCap.castShadow = botCap.receiveShadow = true;

// Inner faces (broken interior)
const innerDiscGeo = new THREE.CircleGeometry(MC_RADIUS - 0.02, 64);
const topInnerDisc = new THREE.Mesh(innerDiscGeo, innerMat);
topInnerDisc.rotation.x = Math.PI / 2;
topInnerDisc.position.y = 0.001;

const botInnerDisc = new THREE.Mesh(innerDiscGeo, innerMat);
botInnerDisc.rotation.x = -Math.PI / 2;
botInnerDisc.position.y = -0.001;

topGroup.add(topSide);
topGroup.add(topCap);
topGroup.add(topInnerDisc);

botGroup.add(botSide);
botGroup.add(botCap);
botGroup.add(botInnerDisc);

const cookie = new THREE.Group();
cookie.add(topGroup);
cookie.add(botGroup);
scene.add(cookie);

// ---------- Paper fortune slip ----------
const paperGeo = new THREE.PlaneGeometry(1.5, 0.32, 1, 1);
const paperMat = new THREE.MeshStandardMaterial({
  color: 0xfff5d8,
  roughness: 0.9,
  metalness: 0.0,
  side: THREE.DoubleSide,
  emissive: 0x55432a,
  emissiveIntensity: 0.18
});
const paper = new THREE.Mesh(paperGeo, paperMat);
paper.position.set(0, 0, 0);
paper.rotation.z = -0.12;
paper.scale.setScalar(0.001);
paper.visible = false;
cookie.add(paper);

// ---------- Crumb particles ----------
const CRUMB_COUNT = 80;
const crumbs = [];
const crumbGeo = new THREE.IcosahedronGeometry(0.06, 0);
const crumbMat = new THREE.MeshStandardMaterial({ color: 0x8c5824, roughness: 1.0 });
for (let i = 0; i < CRUMB_COUNT; i++) {
  const m = new THREE.Mesh(crumbGeo, crumbMat);
  m.visible = false;
  m.castShadow = true;
  scene.add(m);
  crumbs.push({
    mesh: m,
    vel: new THREE.Vector3(),
    spin: new THREE.Vector3(),
    life: 0
  });
}

// ---------- Floating sparkle motes ----------
const MOTE_COUNT = 40;
const moteGeo = new THREE.SphereGeometry(0.015, 6, 6);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xffd97a, transparent: true, opacity: 0.85 });
const motes = [];
for (let i = 0; i < MOTE_COUNT; i++) {
  const m = new THREE.Mesh(moteGeo, moteMat);
  m.position.set(
    (Math.random() - 0.5) * 6,
    (Math.random() - 0.5) * 3,
    (Math.random() - 0.5) * 4 - 1
  );
  scene.add(m);
  motes.push({
    mesh: m,
    speed: 0.05 + Math.random() * 0.1,
    phase: Math.random() * Math.PI * 2,
    base: m.position.clone()
  });
}

// ---------- Interaction ----------
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let cracked = false;
let lastQuote = null;

canvas.addEventListener("pointerdown", onClick);
canvas.addEventListener("pointermove", onHover);
againBtn.addEventListener("click", reset);
resetBtn.addEventListener("click", reset);

function pointerToNDC(e) {
  const rect = canvas.getBoundingClientRect();
  pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
}

function onHover(e) {
  if (cracked) return;
  pointerToNDC(e);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(cookie, true).length > 0;
  canvas.style.cursor = hit ? "pointer" : "default";
}

function onClick(e) {
  if (cracked) return;
  pointerToNDC(e);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(cookie, true);
  if (hits.length === 0) return;
  crack();
}

// ---------- Break animation ----------
function crack() {
  cracked = true;
  hint.classList.add("fade");

  const q = pickRandom(lastQuote);
  lastQuote = q;
  elZh.textContent = q.zh;
  elPy.textContent = q.pinyin;
  elEn.textContent = "“" + q.en + "”";
  elAuthor.textContent = "— " + q.author;

  const startTime = performance.now();
  const shakeDur = 240;
  const splitDur = 850;

  // Spawn crumbs around equator
  for (const c of crumbs) {
    c.mesh.visible = true;
    const a = Math.random() * Math.PI * 2;
    const r = MC_RADIUS * (0.6 + Math.random() * 0.5);
    c.mesh.position.set(Math.cos(a) * r, (Math.random() - 0.5) * 0.1, Math.sin(a) * r);
    c.vel.set(
      Math.cos(a) * (0.02 + Math.random() * 0.04),
      0.04 + Math.random() * 0.05,
      Math.sin(a) * (0.02 + Math.random() * 0.04)
    );
    c.spin.set(
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.25
    );
    c.life = 1.0;
  }

  paper.visible = true;
  paper.scale.setScalar(0.001);

  const animateCrack = (now) => {
    const t = now - startTime;
    if (t < shakeDur) {
      const k = (t / shakeDur);
      const amp = 0.05 * (1 - k);
      cookie.position.x = (Math.random() - 0.5) * amp;
      cookie.position.y = idleY + (Math.random() - 0.5) * amp;
      cookie.rotation.z = (Math.random() - 0.5) * amp * 0.5;
      requestAnimationFrame(animateCrack);
      return;
    }
    cookie.position.x = 0;
    cookie.rotation.z = 0;

    const k = Math.min((t - shakeDur) / splitDur, 1);
    const ease = 1 - Math.pow(1 - k, 3);

    // Top half lifts up and tilts back
    topGroup.position.y = ease * 0.7;
    topGroup.rotation.x = -ease * 0.55;
    topGroup.position.z = ease * 0.2;

    // Bottom half nudges down and tilts forward slightly
    botGroup.position.y = -ease * 0.15;
    botGroup.rotation.x = ease * 0.18;

    // Reveal paper (grows up between halves)
    paper.scale.setScalar(0.001 + ease * 1.3);
    paper.position.y = ease * 0.18;
    paper.rotation.z = -0.12 + Math.sin(t * 0.005) * 0.03;

    if (k >= 1) {
      setTimeout(() => card.classList.remove("hidden"), 150);
      return;
    }
    requestAnimationFrame(animateCrack);
  };
  requestAnimationFrame(animateCrack);
}

function reset() {
  cracked = false;
  card.classList.add("hidden");
  hint.classList.remove("fade");
  topGroup.position.set(0, 0, 0);
  topGroup.rotation.set(0, 0, 0);
  botGroup.position.set(0, 0, 0);
  botGroup.rotation.set(0, 0, 0);
  paper.visible = false;
  paper.scale.setScalar(0.001);
  for (const c of crumbs) {
    c.mesh.visible = false;
    c.life = 0;
  }
}

// ---------- Render loop ----------
const clock = new THREE.Clock();
let idleY = 0;
function tick() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  if (!cracked) {
    // Gentle Y-spin only — keeps the 福 stamp visible from above
    cookie.rotation.y = t * 0.18;
    cookie.rotation.x = 0;
    idleY = Math.sin(t * 1.0) * 0.04;
    cookie.position.y = idleY;
  } else {
    cookie.rotation.y += dt * 0.18;
  }

  for (const c of crumbs) {
    if (!c.mesh.visible) continue;
    c.life -= dt * 0.55;
    if (c.life <= 0) { c.mesh.visible = false; continue; }
    c.vel.y -= dt * 0.18;
    c.mesh.position.add(c.vel);
    c.mesh.rotation.x += c.spin.x;
    c.mesh.rotation.y += c.spin.y;
    c.mesh.rotation.z += c.spin.z;
    c.mesh.scale.setScalar(Math.max(0, c.life));
  }

  // Floating motes
  for (const m of motes) {
    m.mesh.position.y = m.base.y + Math.sin(t * m.speed + m.phase) * 0.25;
    m.mesh.material.opacity = 0.3 + (Math.sin(t * 2 + m.phase) + 1) * 0.3;
  }

  glowSprite.material.opacity = 0.5 + Math.sin(t * 1.2) * 0.08;
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

setTimeout(() => { if (!cracked) hint.classList.add("fade"); }, 9000);
