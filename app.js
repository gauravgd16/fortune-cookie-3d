// Fortune Cookie Oracle — tap the 3D fortune cookie to crack it open
// and watch a paper slip slide out from one side, revealing a Chinese quote.

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
camera.position.set(0, 1.0, 5.0);
camera.lookAt(0, 0.1, 0);

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

// ---------- Lighting ----------
const ambient = new THREE.AmbientLight(0xb8c8ff, 0.45);
scene.add(ambient);

const key = new THREE.DirectionalLight(0xffe6b0, 2.0);
key.position.set(2, 5, 4);
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

const rim = new THREE.DirectionalLight(0x88a8ff, 0.85);
rim.position.set(-3, 2, -4);
scene.add(rim);

const fill = new THREE.PointLight(0xffb060, 0.5, 12);
fill.position.set(0, -2.5, 3);
scene.add(fill);

// Background glow halo
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
const glowTex = makeRadialGradient("#3a2a6a", "#000000", 256);
const glowMat = new THREE.MeshBasicMaterial({
  map: glowTex, transparent: true, opacity: 0.55, depthWrite: false
});
const glowSprite = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), glowMat);
glowSprite.position.set(0, 0, -3);
scene.add(glowSprite);

// Pedestal
const pedestal = new THREE.Mesh(
  new THREE.CircleGeometry(2.6, 64),
  new THREE.MeshStandardMaterial({
    color: 0x1a1138, roughness: 0.9, metalness: 0.1, transparent: true, opacity: 0.85
  })
);
pedestal.rotation.x = -Math.PI / 2;
pedestal.position.y = -0.85;
pedestal.receiveShadow = true;
scene.add(pedestal);

// ---------- Fortune cookie textures ----------
function makeCookieTexture(size = 512) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d");
  // Base baked-cream wafer color
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#f7d488");
  g.addColorStop(0.4, "#e9b660");
  g.addColorStop(0.7, "#d99748");
  g.addColorStop(1, "#a86628");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // Speckle bake
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.4 + 0.3;
    ctx.fillStyle = `rgba(80,40,10,${Math.random() * 0.30 + 0.06})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Highlights
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 2.2 + 0.6;
    ctx.fillStyle = `rgba(255,235,190,${Math.random() * 0.18})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Subtle dark scorch streaks for fortune-cookie character
  for (let i = 0; i < 18; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.random() * Math.PI * 2);
    ctx.fillStyle = `rgba(60,28,5,${Math.random() * 0.18 + 0.05})`;
    ctx.fillRect(-Math.random() * 30 - 10, -1.5, Math.random() * 60 + 20, 3);
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}
const cookieTex = makeCookieTexture();

// ---------- Build a fortune cookie half ----------
// A traditional fortune cookie is a folded, pinched wafer crescent.
// We model each half as a parametric surface of revolution-of-an-arc, then
// pinch the two ends so they meet at the central seam (the "fold").
//
// The classic fortune-cookie silhouette from the side is a "C" shape:
// a curved disc that has been folded along a diameter, with the two ends
// pinched together at the equator. Here we approximate it with a custom
// parametric surface.

function makeCookieHalfGeometry(isLeft) {
  // Half-torus arch geometry. The cookie is a folded wafer arc spanning
  // alpha=0 (left tip on table) → alpha=PI/2 (apex of the arch) → alpha=PI
  // (right tip on table). We split the cookie into LEFT and RIGHT halves
  // around the apex (alpha=PI/2), so when cracked the two halves separate
  // sideways and a slip can emerge from the gap.
  //
  // Cross-section: full tube around (squashed into a flat wafer).

  const Nv = 32;          // around the tube cross-section
  const R = 1.05;         // major radius (size of the arc curve)
  const r = 0.42;         // tube minor radius
  const tubeFlatY = 0.65; // squash factor (oval, not round)
  const tubeFlatZ = 1.30; // stretch front-back (wider wafer)
  const seamGap = 0.02;   // tiny gap so faces don't z-fight at the seam

  // Each half spans half the arc
  const alphaStart = isLeft ? 0 : Math.PI / 2 + seamGap;
  const alphaEnd   = isLeft ? Math.PI / 2 - seamGap : Math.PI;
  const Nu = 40;

  const verts = [];
  const idx = [];
  const uvs = [];

  for (let i = 0; i <= Nu; i++) {
    const u = i / Nu;
    const alpha = alphaStart + u * (alphaEnd - alphaStart);
    // Center of the tube at this arc step, in CANONICAL world coords
    // We'll compute global alpha (0..PI) for the taper so both halves match.
    const globalU = alpha / Math.PI; // 0..1 across full cookie
    const cx = -R * Math.cos(alpha);
    const cy = R * Math.sin(alpha) - 0.4;
    const cz = 0;
    const tx = Math.sin(alpha);
    const ty = Math.cos(alpha);
    const tipTaper = 0.40 + 0.60 * Math.sin(globalU * Math.PI);

    for (let j = 0; j <= Nv; j++) {
      const v = j / Nv;
      const beta = v * 2 * Math.PI;
      const localUp = r * Math.cos(beta) * tubeFlatY * tipTaper;
      const localOut = r * Math.sin(beta) * tubeFlatZ * tipTaper;
      const x = cx + localUp * tx;
      const y = cy + localUp * ty;
      const z = cz + localOut;
      const wobble = Math.sin(globalU * Math.PI * 5) * 0.01 * Math.cos(beta);
      verts.push(x + wobble, y, z);
      uvs.push(globalU, v);
    }
  }
  for (let i = 0; i < Nu; i++) {
    for (let j = 0; j < Nv; j++) {
      const a = i * (Nv + 1) + j;
      const b = a + 1;
      const c = a + (Nv + 1);
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

const cookieMat = new THREE.MeshStandardMaterial({
  map: cookieTex,
  color: 0xe6b270,
  roughness: 0.78,
  metalness: 0.04,
  side: THREE.DoubleSide
});

const leftGroup = new THREE.Group();
const rightGroup = new THREE.Group();

const leftMesh = new THREE.Mesh(makeCookieHalfGeometry(true), cookieMat);
leftMesh.castShadow = leftMesh.receiveShadow = true;
leftGroup.add(leftMesh);

const rightMesh = new THREE.Mesh(makeCookieHalfGeometry(false), cookieMat);
rightMesh.castShadow = rightMesh.receiveShadow = true;
rightGroup.add(rightMesh);

const cookie = new THREE.Group();
cookie.add(leftGroup);
cookie.add(rightGroup);
// Tilt cookie so the slip-exit slot (long axis) faces the camera nicely
cookie.rotation.y = 0.0;
scene.add(cookie);

// ---------- Paper fortune slip ----------
const PAPER_W = 1.65, PAPER_H = 0.40;
const PAPER_CANVAS_W = 1280, PAPER_CANVAS_H = 280;

const paperCanvas = document.createElement("canvas");
paperCanvas.width = PAPER_CANVAS_W;
paperCanvas.height = PAPER_CANVAS_H;
const paperCtx = paperCanvas.getContext("2d");

function drawPaperSlip(zh, attribution) {
  const ctx = paperCtx;
  const w = PAPER_CANVAS_W, h = PAPER_CANVAS_H;
  // Cream paper base
  const bg = ctx.createLinearGradient(0, 0, 0, h);
  bg.addColorStop(0, "#fff8e0");
  bg.addColorStop(0.5, "#fdeec0");
  bg.addColorStop(1, "#f3dca0");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  // Subtle vignette (much lighter than before so it doesn't read as a shadow)
  const vg = ctx.createRadialGradient(w/2, h/2, h*0.35, w/2, h/2, w*0.6);
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(160,110,50,0.08)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
  // Paper grain
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(${130 + Math.random()*40},${95 + Math.random()*30},${45 + Math.random()*20},${Math.random()*0.07})`;
    ctx.fillRect(Math.random()*w, Math.random()*h, 1, 1);
  }
  // Red border (fortune-slip aesthetic)
  ctx.strokeStyle = "#a83232";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.strokeStyle = "#c95a4a";
  ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  // Chinese quote — auto-fit horizontally
  ctx.fillStyle = "#1a0f06";
  let fontSize = 110;
  ctx.font = `700 ${fontSize}px "Songti SC", "STSong", "Noto Serif SC", "PingFang SC", serif`;
  while (ctx.measureText(zh).width > w - 120 && fontSize > 40) {
    fontSize -= 4;
    ctx.font = `700 ${fontSize}px "Songti SC", "STSong", "Noto Serif SC", "PingFang SC", serif`;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(zh, w / 2, h / 2 - 22);

  // Attribution
  ctx.font = `500 28px "Songti SC", "STSong", "Noto Serif SC", "PingFang SC", serif`;
  ctx.fillStyle = "#a83232";
  ctx.fillText(attribution, w / 2, h - 50);

  paperTex.needsUpdate = true;
}

const paperTex = new THREE.CanvasTexture(paperCanvas);
paperTex.colorSpace = THREE.SRGBColorSpace;
paperTex.anisotropy = 8;
drawPaperSlip("签语饼", "— Fortune Oracle");

const paperGeo = new THREE.PlaneGeometry(PAPER_W, PAPER_H, 1, 1);
const paperMat = new THREE.MeshBasicMaterial({
  map: paperTex,
  color: 0xffffff,
  side: THREE.DoubleSide,
  toneMapped: false
});
const paper = new THREE.Mesh(paperGeo, paperMat);
// Sits inside the cookie initially, slightly forward so it's never occluded
paper.position.set(0, 0, 0.08);
paper.visible = false;
scene.add(paper); // attached to scene (NOT cookie) so spin doesn't whip it

// ---------- Crumb particles ----------
const CRUMB_COUNT = 60;
const crumbs = [];
const crumbGeo = new THREE.IcosahedronGeometry(0.05, 0);
const crumbMat = new THREE.MeshStandardMaterial({ color: 0xc9904f, roughness: 1.0 });
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

// ---------- Floating motes ----------
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
  // If the user clicks anywhere in the canvas, crack — being lenient since
  // the cookie's hit area is small and the spinning bob can dodge clicks.
  crack();
}

// ---------- Break + slide animation ----------
function crack() {
  cracked = true;
  hint.classList.add("fade");
  // Snap cookie to face-camera so the slip slides along screen X
  cookie.rotation.set(0, 0, 0);
  cookie.position.set(0, 0, 0);

  const q = pickRandom(lastQuote);
  lastQuote = q;
  elZh.textContent = q.zh;
  elPy.textContent = q.pinyin;
  elEn.textContent = "“" + q.en + "”";
  elAuthor.textContent = "— " + q.author;

  drawPaperSlip(q.zh, "— " + q.author);

  // Initial paper position: well in front of the cookie, BELOW the arch
  paper.visible = true;
  paper.scale.set(1, 1, 1);
  paper.position.set(-1.0, -0.20, 1.4);
  paper.rotation.set(0, 0, 0); // face camera flat — no tilt that creates shading
  // Render paper on top so cookie geometry never occludes it
  paperMat.depthTest = false;
  paper.renderOrder = 999;

  const startTime = performance.now();
  const shakeDur = 220;
  const splitDur = 600;
  const slideDur = 1100;

  // Spawn crumbs
  for (const c of crumbs) {
    c.mesh.visible = true;
    const a = (Math.random() - 0.5) * Math.PI;
    const r = 0.6 + Math.random() * 0.5;
    c.mesh.position.set((Math.random() - 0.5) * 1.8, 0, (Math.random() - 0.3) * 0.5);
    c.vel.set(
      (Math.random() - 0.5) * 0.05,
      0.04 + Math.random() * 0.05,
      (Math.random() - 0.3) * 0.05
    );
    c.spin.set(
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.25,
      (Math.random() - 0.5) * 0.25
    );
    c.life = 1.0;
  }

  const animateCrack = (now) => {
    const t = now - startTime;

    // Phase 1: shake
    if (t < shakeDur) {
      const k = (t / shakeDur);
      const amp = 0.05 * (1 - k);
      cookie.position.x = (Math.random() - 0.5) * amp;
      cookie.position.y = (Math.random() - 0.5) * amp;
      cookie.rotation.z = (Math.random() - 0.5) * amp * 0.5;
      requestAnimationFrame(animateCrack);
      return;
    }
    cookie.position.x = 0;
    cookie.rotation.z = 0;

    // Phase 2: split (left half slides left + tips left, right does mirror)
    const splitT = Math.min((t - shakeDur) / splitDur, 1);
    const splitEase = 1 - Math.pow(1 - splitT, 3);
    leftGroup.position.x = -splitEase * 0.30;
    leftGroup.rotation.z = splitEase * 0.35;     // tip outward (apex falls left)
    leftGroup.position.y = -splitEase * 0.05;
    rightGroup.position.x = splitEase * 0.30;
    rightGroup.rotation.z = -splitEase * 0.35;
    rightGroup.position.y = -splitEase * 0.05;

    // Phase 3: slip slides from left → right
    const slideStart = shakeDur + splitDur * 0.4; // start sliding before split fully done
    if (t > slideStart) {
      const slideT = Math.min((t - slideStart) / slideDur, 1);
      const slideEase = 1 - Math.pow(1 - slideT, 2);
      // Slide from x=-1.6 to x=+1.6 (off-screen right)... no, we want it to LAND visible
      // Final resting position: just to the right of the cookie, fully visible
      const xStart = -1.0;
      const xEnd = 0.6;
      paper.position.x = xStart + (xEnd - xStart) * slideEase;
      paper.position.y = -0.20 + Math.sin(slideT * Math.PI) * 0.10;
      paper.position.z = 1.4; // far forward, no z-fighting
      // Subtle wave as it slides
      paper.rotation.z = Math.sin(slideT * Math.PI * 2) * 0.025;
      // Show quote card after the slip is mostly out
      if (slideT > 0.55 && card.classList.contains("hidden")) {
        card.classList.remove("hidden");
      }
      if (slideT >= 1) return; // done
    }

    requestAnimationFrame(animateCrack);
  };
  requestAnimationFrame(animateCrack);
}

function reset() {
  cracked = false;
  card.classList.add("hidden");
  hint.classList.remove("fade");
  leftGroup.position.set(0, 0, 0);
  leftGroup.rotation.set(0, 0, 0);
  rightGroup.position.set(0, 0, 0);
  rightGroup.rotation.set(0, 0, 0);
  paper.visible = false;
  paper.position.set(-1.0, -0.20, 1.4);
  paper.rotation.set(0, 0, 0);
  paper.scale.set(1, 1, 1);
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
    // Gentle bob and tiny tilt — but never rotate around Y (would spin the C edge-on)
    cookie.rotation.x = Math.sin(t * 0.5) * 0.08;
    cookie.rotation.z = Math.sin(t * 0.7) * 0.04;
    cookie.position.y = Math.sin(t * 1.2) * 0.05;
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
