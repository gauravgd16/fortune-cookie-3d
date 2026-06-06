// 3D Fortune Cookie — click to crack, reveal a Chinese quote.
// Three.js scene with a procedurally-generated torus-based cookie split into two halves.

import * as THREE from "three";
import { QUOTES, pickRandom } from "./quotes.js";

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

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
camera.position.set(0, 0.4, 6.2);
camera.lookAt(0, 0, 0);

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
renderer.toneMappingExposure = 1.15;

function resize() {
  const w = wrap.clientWidth;
  const h = wrap.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// ---------- Lighting ----------
const ambient = new THREE.AmbientLight(0xfff1d9, 0.55);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffd9a3, 1.7);
key.position.set(4, 5, 5);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 20;
key.shadow.bias = -0.0008;
scene.add(key);

const rim = new THREE.DirectionalLight(0xff6e9c, 0.9);
rim.position.set(-4, 2, -3);
scene.add(rim);

const fill = new THREE.PointLight(0xffb347, 0.6, 20);
fill.position.set(0, -3, 4);
scene.add(fill);

// Soft glow plane behind cookie
const glowTex = makeRadialGradient("#ffb86b", "#000000", 256);
const glowMat = new THREE.MeshBasicMaterial({
  map: glowTex, transparent: true, opacity: 0.55, depthWrite: false
});
const glowSprite = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), glowMat);
glowSprite.position.set(0, 0, -2.5);
scene.add(glowSprite);

// ---------- Cookie material ----------
const cookieTex = makeCookieTexture(512);
const cookieMat = new THREE.MeshStandardMaterial({
  map: cookieTex,
  color: 0xf6c879,
  roughness: 0.62,
  metalness: 0.05,
  flatShading: false
});
// Inner crumb (slightly darker, more matte)
const innerMat = new THREE.MeshStandardMaterial({
  color: 0xd9a45a,
  roughness: 0.95,
  metalness: 0.0
});

// ---------- Cookie geometry (folded torus halves) ----------
// We approximate a fortune-cookie shape as a torus pinched along Y, then split
// along the seam plane to make two openable halves.
function makeCookieHalfGeometry(top = true) {
  // Half of a torus: theta from 0..PI (top) or PI..2PI (bottom)
  const radius = 1.05;
  const tube = 0.42;
  const radialSegs = 80;
  const tubeSegs = 24;
  const geo = new THREE.TorusGeometry(radius, tube, tubeSegs, radialSegs, Math.PI);
  // Squash slightly to look more cookie-like
  geo.scale(1, 0.62, 1);
  // Rotate so the open side faces along +Z
  geo.rotateX(Math.PI / 2);
  // For the bottom half, flip
  if (!top) geo.rotateZ(Math.PI);
  geo.computeVertexNormals();
  return geo;
}

const topHalf = new THREE.Mesh(makeCookieHalfGeometry(true), cookieMat);
const botHalf = new THREE.Mesh(makeCookieHalfGeometry(false), cookieMat);
topHalf.castShadow = topHalf.receiveShadow = true;
botHalf.castShadow = botHalf.receiveShadow = true;

// Cap each half's open face with a thin disk so it looks solid from inside
function makeCap(yOffsetDir = 1) {
  const shape = new THREE.Shape();
  const r = 1.05, w = 0.42;
  // ring shape: outer ellipse minus inner ellipse approximation
  const segs = 64;
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    const x = (r + w) * Math.cos(t);
    const y = (r + w) * Math.sin(t) * 0.62;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const hole = new THREE.Path();
  for (let i = 0; i <= segs; i++) {
    const t = (i / segs) * Math.PI * 2;
    const x = (r - w) * Math.cos(t);
    const y = (r - w) * Math.sin(t) * 0.62;
    if (i === 0) hole.moveTo(x, y); else hole.lineTo(x, y);
  }
  shape.holes.push(hole);
  const geo = new THREE.ShapeGeometry(shape, 64);
  return geo;
}

const capGeo = makeCap();
const capTop = new THREE.Mesh(capGeo, innerMat);
capTop.rotation.x = -Math.PI / 2;
capTop.position.y = 0;
const capBot = new THREE.Mesh(capGeo, innerMat);
capBot.rotation.x = Math.PI / 2;
capBot.position.y = 0;

// Group halves so we can animate each independently
const topGroup = new THREE.Group();
topGroup.add(topHalf);
topGroup.add(capTop);

const botGroup = new THREE.Group();
botGroup.add(botHalf);
botGroup.add(capBot);

const cookie = new THREE.Group();
cookie.add(topGroup);
cookie.add(botGroup);
scene.add(cookie);

// ---------- Paper fortune slip (hidden inside) ----------
const paperGeo = new THREE.PlaneGeometry(1.4, 0.32, 1, 1);
const paperMat = new THREE.MeshStandardMaterial({
  color: 0xfff8e6,
  roughness: 0.85,
  metalness: 0.0,
  side: THREE.DoubleSide,
  emissive: 0x332211,
  emissiveIntensity: 0.05
});
const paper = new THREE.Mesh(paperGeo, paperMat);
paper.position.set(0, 0, 0);
paper.rotation.z = -0.15;
paper.scale.setScalar(0.001); // start tiny, grow on reveal
paper.visible = false;
cookie.add(paper);

// ---------- Crumb particles ----------
const CRUMB_COUNT = 60;
const crumbs = [];
const crumbGeo = new THREE.IcosahedronGeometry(0.05, 0);
const crumbMat = new THREE.MeshStandardMaterial({ color: 0xd9a45a, roughness: 1.0 });
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

// ---------- Helpers: textures ----------
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

function makeCookieTexture(size) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  // base toasty gradient
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#f7d28a");
  g.addColorStop(0.5, "#e8b066");
  g.addColorStop(1, "#c9874a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // toasty speckles
  for (let i = 0; i < 1500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.6 + 0.3;
    const a = Math.random() * 0.25 + 0.05;
    ctx.fillStyle = `rgba(80,40,10,${a})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  // golden highlights
  for (let i = 0; i < 300; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.5 + 0.5;
    ctx.fillStyle = `rgba(255,230,170,${Math.random() * 0.18})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
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

// ---------- Crack animation ----------
function crack() {
  cracked = true;
  hint.classList.add("fade");

  // Pick a quote
  const q = pickRandom(lastQuote);
  lastQuote = q;
  elZh.textContent = q.zh;
  elPy.textContent = q.pinyin;
  elEn.textContent = "“" + q.en + "”";
  elAuthor.textContent = "— " + q.author;

  // Shake then split
  const startTime = performance.now();
  const shakeDur = 220;
  const splitDur = 700;

  // Spawn crumbs
  for (const c of crumbs) {
    c.mesh.visible = true;
    c.mesh.position.set(
      (Math.random() - 0.5) * 0.3,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.3
    );
    c.vel.set(
      (Math.random() - 0.5) * 0.05,
      Math.random() * 0.05 + 0.02,
      (Math.random() - 0.5) * 0.05
    );
    c.spin.set(
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2,
      (Math.random() - 0.5) * 0.2
    );
    c.life = 1.0;
  }

  paper.visible = true;
  paper.scale.setScalar(0.001);

  const animateCrack = (now) => {
    const t = now - startTime;
    if (t < shakeDur) {
      // Shake
      const k = (t / shakeDur);
      const amp = 0.04 * (1 - k);
      cookie.position.x = (Math.random() - 0.5) * amp;
      cookie.position.y = (Math.random() - 0.5) * amp;
      cookie.rotation.z = (Math.random() - 0.5) * amp * 0.5;
      requestAnimationFrame(animateCrack);
      return;
    }
    cookie.position.set(0, 0, 0);
    cookie.rotation.z = 0;

    const k = Math.min((t - shakeDur) / splitDur, 1);
    const ease = 1 - Math.pow(1 - k, 3); // easeOutCubic

    // Split halves apart and tilt them open like a clamshell
    topGroup.position.y = ease * 0.55;
    topGroup.rotation.x = -ease * 0.6;
    topGroup.position.z = ease * 0.15;

    botGroup.position.y = -ease * 0.45;
    botGroup.rotation.x = ease * 0.5;
    botGroup.position.z = -ease * 0.05;

    // Reveal paper
    paper.scale.setScalar(0.001 + ease * 1.2);
    paper.position.y = ease * 0.05;
    paper.rotation.z = -0.15 + Math.sin(t * 0.005) * 0.02;

    if (k >= 1) {
      // Show quote card after a short delay
      setTimeout(() => card.classList.remove("hidden"), 120);
      return;
    }
    requestAnimationFrame(animateCrack);
  };
  requestAnimationFrame(animateCrack);
}

// ---------- Reset ----------
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
function tick() {
  const dt = clock.getDelta();
  const t = clock.elapsedTime;

  if (!cracked) {
    // Idle gentle rotation + bobbing
    cookie.rotation.y = Math.sin(t * 0.6) * 0.4;
    cookie.rotation.x = Math.sin(t * 0.4) * 0.12;
    cookie.position.y = Math.sin(t * 1.3) * 0.05;
  } else {
    // Slow continuous y-rotation after crack
    cookie.rotation.y += dt * 0.25;
  }

  // Crumbs physics
  for (const c of crumbs) {
    if (!c.mesh.visible) continue;
    c.life -= dt * 0.6;
    if (c.life <= 0) {
      c.mesh.visible = false;
      continue;
    }
    c.vel.y -= dt * 0.15; // gravity
    c.mesh.position.add(c.vel);
    c.mesh.rotation.x += c.spin.x;
    c.mesh.rotation.y += c.spin.y;
    c.mesh.rotation.z += c.spin.z;
    c.mesh.scale.setScalar(Math.max(0, c.life));
  }

  // Sprite glow billboard pulse
  glowSprite.material.opacity = 0.45 + Math.sin(t * 1.5) * 0.08;

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// Fade out hint after 8s if user hasn't clicked
setTimeout(() => { if (!cracked) hint.classList.add("fade"); }, 8000);
