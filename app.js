// Gifted HQ: a walkable 3D office building.
// One storey is loaded at a time; the elevator moves your person between storeys.
(function () {
  const T = window.THREE;
  const building = window.BUILDING;
  const businesses = [...building.businesses].sort((a, b) => a.floor - b.floor);
  const lobby = { id: "lobby", name: "Lobby", floor: 0, tagline: building.address, color: "#A87A2A", rooms: [] };
  const stops = [lobby, ...businesses];
  const byId = Object.fromEntries(stops.map(s => [s.id, s]));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const $ = sel => document.querySelector(sel);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const floorLabel = n => (n === 0 ? "L" : String(n).padStart(2, "0"));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage off */ } }
  };

  // ---------- Renderer ----------
  const host = $("#scene");
  let renderer;
  try {
    renderer = new T.WebGLRenderer({ antialias: true });
  } catch (e) {
    host.innerHTML = `<p class="no-gl">This building needs WebGL, which this browser has turned off. Try another browser or turn on hardware acceleration.</p>`;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  if ("outputColorSpace" in renderer) renderer.outputColorSpace = T.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new T.Scene();
  scene.background = new T.Color("#1C2129");
  scene.fog = new T.Fog("#1C2129", 28, 60);
  const camera = new T.PerspectiveCamera(60, 1, 0.1, 200);

  scene.add(new T.HemisphereLight("#F4F1EA", "#3A3F48", 1.1));
  const sun = new T.DirectionalLight("#FFFFFF", 1.4);
  sun.position.set(8, 18, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -20, right: 20, top: 30, bottom: -30, near: 1, far: 60 });
  scene.add(sun, sun.target);

  function resize() {
    const w = host.clientWidth, h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(h, 1);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);

  // ---------- Text on surfaces ----------
  const FONT_DISPLAY = '"Big Shoulders Display", "Arial Narrow", sans-serif';
  const FONT_BODY = '"Instrument Sans", "Helvetica Neue", Arial, sans-serif';
  const FONT_MONO = '"IBM Plex Mono", Menlo, monospace';

  function textTexture(w, h, draw) {
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    draw(c.getContext("2d"), w, h);
    const tex = new T.CanvasTexture(c);
    if ("colorSpace" in tex) tex.colorSpace = T.SRGBColorSpace;
    tex.anisotropy = 4;
    return tex;
  }
  function wrap(ctx, text, maxW) {
    const words = String(text).split(/\s+/); const lines = []; let line = "";
    for (const w of words) {
      const t = line ? line + " " + w : w;
      if (ctx.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    return lines;
  }
  function boardTexture(room, color) {
    return textTexture(1024, 600, (ctx, w, h) => {
      ctx.fillStyle = "#F7F6F1"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, 18);
      ctx.fillStyle = "#586173"; ctx.font = `600 26px ${FONT_MONO}`;
      ctx.fillText(String(room.kind || "room").toUpperCase(), 48, 76);
      ctx.fillStyle = "#1A2130"; ctx.font = `800 72px ${FONT_DISPLAY}`;
      ctx.fillText(room.name.toUpperCase(), 48, 150);
      let y = 214;
      for (const n of room.notes) {
        ctx.font = `${n.muted ? 400 : 500} ${n.muted ? 28 : 34}px ${FONT_BODY}`;
        const lines = wrap(ctx, n.text, w - 140);
        ctx.fillStyle = n.muted ? "#A9B0BC" : color;
        ctx.fillRect(52, y - 22, 14, 14);
        ctx.fillStyle = n.muted ? "#7A8291" : "#1A2130";
        for (const l of lines) { if (y > h - 30) break; ctx.fillText(l, 86, y); y += n.muted ? 36 : 44; }
        y += 12;
      }
    });
  }
  function signTexture(label, title, color) {
    return textTexture(1024, 256, (ctx, w, h) => {
      ctx.fillStyle = "#1C1F24"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color; ctx.fillRect(0, h - 14, w, 14);
      ctx.fillStyle = "#F5B54A"; ctx.font = `600 96px ${FONT_MONO}`;
      ctx.fillText(label, 40, 150);
      ctx.fillStyle = "#F2EFE6"; ctx.font = `800 120px ${FONT_DISPLAY}`;
      ctx.fillText(title.toUpperCase(), 290, 165);
    });
  }
  function doorSignTexture(name, color) {
    return textTexture(512, 128, (ctx, w, h) => {
      ctx.fillStyle = "#F2EFE6"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = color; ctx.fillRect(0, 0, 12, h);
      ctx.fillStyle = "#1A2130"; ctx.font = `700 64px ${FONT_DISPLAY}`;
      ctx.textBaseline = "middle"; ctx.fillText(name.toUpperCase(), 36, h / 2 + 4);
    });
  }
  function directoryTexture() {
    return textTexture(1024, 768, (ctx, w, h) => {
      ctx.fillStyle = "#A87A2A"; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#1C1F24"; ctx.fillRect(18, 18, w - 36, h - 36);
      ctx.fillStyle = "#F2EFE6"; ctx.font = `600 40px ${FONT_MONO}`;
      ctx.textAlign = "center"; ctx.fillText("D I R E C T O R Y", w / 2, 100);
      ctx.fillRect(70, 130, w - 140, 2);
      ctx.textAlign = "left"; let y = 210;
      const top = Math.max(1, ...businesses.map(b => b.floor)) + 1;
      for (let n = top; n >= 1; n--) {
        const b = businesses.find(x => x.floor === n);
        ctx.globalAlpha = b ? 1 : 0.45;
        ctx.font = `500 46px ${FONT_MONO}`;
        ctx.fillText(b ? b.name.toUpperCase() : "AVAILABLE", 80, y);
        ctx.textAlign = "right"; ctx.fillText(floorLabel(n), w - 80, y); ctx.textAlign = "left";
        y += 74;
      }
      ctx.globalAlpha = 1;
    });
  }

  // ---------- Building a storey ----------
  const WALL_H = 3.2, HALF_W = 10, ROOM = 8, HALL = 8, CORRIDOR = 2;
  let level = null;        // the loaded storey's group
  let walls = [];          // collision boxes {x0,x1,z0,z1}
  let wallMeshes = [];     // for keeping the camera inside
  let spots = [];          // places you can use: {kind, x, z, r, room}
  let current = null;      // the stop we are on

  const mat = (color, extra) => new T.MeshStandardMaterial(Object.assign({ color, roughness: 0.85 }, extra));
  function box(w, h, d, material, x, y, z) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    level.add(m); return m;
  }
  function solid(x0, z0, x1, z1) { walls.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }); }
  function wall(x0, z0, x1, z1, material) {
    const t = 0.3;
    const W = x0 === x1 ? t : Math.abs(x1 - x0) + t, D = z0 === z1 ? t : Math.abs(z1 - z0) + t;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    wallMeshes.push(box(W, WALL_H, D, material, cx, WALL_H / 2, cz));
    solid(cx - W / 2, cz - D / 2, cx + W / 2, cz + D / 2);
  }
  function plane(w, h, texture, x, y, z, rotY) {
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshStandardMaterial({ map: texture, roughness: 0.9 }));
    m.position.set(x, y, z); m.rotation.y = rotY; level.add(m); return m;
  }
  function windowStrip(x, z, len, rotY) {
    const m = new T.Mesh(new T.PlaneGeometry(len, 1.4), new T.MeshStandardMaterial({ color: "#9FC4E8", emissive: "#6E9CC9", emissiveIntensity: 0.6, roughness: 0.2 }));
    m.position.set(x, 1.9, z); m.rotation.y = rotY; level.add(m);
  }
  function plant(x, z) {
    box(0.6, 0.6, 0.6, mat("#6E6352"), x, 0.3, z);
    const leaves = new T.Mesh(new T.SphereGeometry(0.6, 12, 10), mat("#3F7A4A"));
    leaves.position.set(x, 1.15, z); leaves.castShadow = true; level.add(leaves);
    solid(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
  }

  function buildStorey(stop) {
    if (level) {
      scene.remove(level);
      level.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } });
    }
    level = new T.Group(); scene.add(level);
    walls = []; wallMeshes = []; spots = [];
    current = stop;

    const color = stop.color;
    const rows = Math.ceil(stop.rooms.length / 2);
    const L = stop.floor === 0 ? 16 : HALL + Math.max(rows, 1) * ROOM;
    const wallMat = mat("#E3E1DA"), trimMat = mat("#2A2F38");

    // floor and corridor runner
    const floorMesh = new T.Mesh(new T.PlaneGeometry(HALF_W * 2, L), mat(stop.floor === 0 ? "#B9B4A8" : "#CFCAC0"));
    floorMesh.rotation.x = -Math.PI / 2; floorMesh.position.set(0, 0, L / 2); floorMesh.receiveShadow = true; level.add(floorMesh);
    const runner = new T.Mesh(new T.PlaneGeometry(CORRIDOR * 2, L - 0.4), mat(color, { roughness: 1 }));
    runner.rotation.x = -Math.PI / 2; runner.position.set(0, 0.01, L / 2); runner.material.color.lerp(new T.Color("#3A3F48"), 0.7); level.add(runner);

    // outer shell
    wall(-HALF_W, 0, HALF_W, 0, wallMat);
    wall(-HALF_W, L, HALF_W, L, wallMat);
    wall(-HALF_W, 0, -HALF_W, L, wallMat);
    wall(HALF_W, 0, HALF_W, L, wallMat);
    windowStrip(0, L - 0.16, 12, Math.PI);

    // elevator on the north wall
    box(2.6, 2.5, 0.12, mat("#A87A2A", { metalness: 0.6, roughness: 0.35 }), 0, 1.25, 0.2);
    box(0.04, 2.4, 0.14, trimMat, 0, 1.2, 0.27);
    plane(2.4, 0.6, signTexture(floorLabel(stop.floor), stop.name, color), 0, 2.85, 0.17, 0);
    spots.push({ kind: "elevator", x: 0, z: 1.4, r: 1.9 });

    if (stop.floor === 0) {
      // Lobby: reception desk, directory board, glass entrance
      box(4.5, 1.1, 1, mat("#2A2F38"), 0, 0.55, 9);
      box(4.7, 0.08, 1.2, mat("#A87A2A", { metalness: 0.5, roughness: 0.4 }), 0, 1.12, 9);
      solid(-2.35, 8.4, 2.35, 9.6);
      plane(3.6, 2.7, directoryTexture(), -HALF_W + 0.17, 1.65, 6, Math.PI / 2);
      spots.push({ kind: "directory", x: -HALF_W + 1.5, z: 6, r: 2.6 });
      windowStrip(-HALF_W + 0.16, 12.5, 4, Math.PI / 2);
      windowStrip(HALF_W - 0.16, 8, 10, -Math.PI / 2);
      box(3, 2.8, 0.1, mat("#9FC4E8", { transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 1.4, L - 0.25);
      plant(-8.5, 1.5); plant(8.5, 1.5); plant(-8.5, 14.5); plant(8.5, 14.5);
    } else {
      // Office floor: rooms down both sides of a corridor
      stop.rooms.forEach((room, i) => {
        const side = i % 2 === 0 ? -1 : 1;
        const row = Math.floor(i / 2);
        const z0 = HALL + row * ROOM, z1 = z0 + ROOM, zc = (z0 + z1) / 2;
        const ix = side * CORRIDOR, ox = side * HALF_W;
        wall(ix, z0, ix, zc - 1.3, wallMat);
        wall(ix, zc + 1.3, ix, z1, wallMat);
        box(0.32, WALL_H - 2.5, 2.6, wallMat, ix, 2.5 + (WALL_H - 2.5) / 2, zc); // lintel above the door
        wall(ix, z0, ox, z0, wallMat);

        // room sign facing the corridor
        plane(1.9, 0.48, doorSignTexture(room.name, color), ix - side * 0.17, 2.75, zc - 2.2, side === -1 ? Math.PI / 2 : -Math.PI / 2);
        // rug, desk and chair
        const rug = new T.Mesh(new T.PlaneGeometry(4.4, 4.4), mat(color, { roughness: 1 }));
        rug.rotation.x = -Math.PI / 2; rug.position.set((ix + ox) / 2, 0.012, zc); level.add(rug);
        const dx = (ix + ox) / 2 - side * 0.6;
        box(1, 0.08, 2.2, mat("#7A5A3A"), dx, 0.78, zc);
        box(0.9, 0.74, 0.1, mat("#2A2F38"), dx, 0.37, zc - 1);
        box(0.9, 0.74, 0.1, mat("#2A2F38"), dx, 0.37, zc + 1);
        box(0.5, 0.5, 0.5, mat("#2A2F38"), dx - side * 0.9, 0.25, zc);
        solid(dx - 0.55, zc - 1.15, dx + 0.55, zc + 1.15);
        plant(ox - side * 0.7, z0 + 0.8);
        // the board with the room's notes
        plane(4.6, 2.7, boardTexture(room, color), ox - side * 0.17, 1.75, zc, side === -1 ? Math.PI / 2 : -Math.PI / 2);
        spots.push({ kind: "board", x: ox - side * 1.8, z: zc, r: 2.4, room });
      });
      windowStrip(-HALF_W + 0.16, HALL / 2, 5, Math.PI / 2);
      windowStrip(HALF_W - 0.16, HALL / 2, 5, -Math.PI / 2);
      plant(-8.5, 1.5); plant(8.5, 1.5);
    }
    sun.target.position.set(0, 0, L / 2);
    return L;
  }

  // ---------- Your person ----------
  const look = store.get("hq-avatar", { shirt: "#4F5BD5", skin: "#8D5A3B" });
  const person = new T.Group();
  const shirtMat = mat(look.shirt), skinMat = mat(look.skin), pantsMat = mat("#2A2F38"), shoeMat = mat("#15181D");
  function limb(w, h, d, m, x, y) {
    const pivot = new T.Group(); pivot.position.set(x, y, 0);
    const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), m); mesh.position.y = -h / 2; mesh.castShadow = true;
    pivot.add(mesh); person.add(pivot); return pivot;
  }
  const legL = limb(0.2, 0.85, 0.22, pantsMat, -0.13, 0.85);
  const legR = limb(0.2, 0.85, 0.22, pantsMat, 0.13, 0.85);
  const torso = new T.Mesh(new T.BoxGeometry(0.56, 0.68, 0.3), shirtMat); torso.position.y = 1.2; torso.castShadow = true; person.add(torso);
  const armL = limb(0.14, 0.66, 0.16, shirtMat, -0.36, 1.5);
  const armR = limb(0.14, 0.66, 0.16, shirtMat, 0.36, 1.5);
  [armL, armR].forEach(a => { const hand = new T.Mesh(new T.SphereGeometry(0.08, 10, 8), skinMat); hand.position.y = -0.7; a.add(hand); });
  const head = new T.Mesh(new T.SphereGeometry(0.2, 18, 14), skinMat); head.position.y = 1.78; head.castShadow = true; person.add(head);
  const hair = new T.Mesh(new T.SphereGeometry(0.21, 18, 14, 0, Math.PI * 2, 0, Math.PI / 2.2), mat("#1A1410")); hair.position.y = 1.8; person.add(hair);
  [-0.07, 0.07].forEach(x => { const eye = new T.Mesh(new T.SphereGeometry(0.025, 8, 6), mat("#15181D")); eye.position.set(x, 1.8, 0.18); person.add(eye); });
  [legL, legR].forEach(l => { const shoe = new T.Mesh(new T.BoxGeometry(0.22, 0.1, 0.32), shoeMat); shoe.position.set(0, -0.86, 0.05); l.add(shoe); });
  scene.add(person);

  const me = { x: 0, z: 4, yaw: 0, stride: 0 };
  let camYaw = 0, camPitch = 0.5;

  // ---------- Input ----------
  const keys = new Set();
  const held = { fwd: false, back: false, left: false, right: false };
  window.addEventListener("keydown", e => {
    if (e.target.closest("input, textarea, select")) return;
    const k = e.key.toLowerCase();
    if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) e.preventDefault();
    if (k === "escape") { closePanels(); return; }
    if ((k === "e" || k === "enter") && !panelOpen()) { useSpot(); return; }
    keys.add(k);
  });
  window.addEventListener("keyup", e => keys.delete(e.key.toLowerCase()));
  window.addEventListener("blur", () => keys.clear());

  let drag = null;
  renderer.domElement.addEventListener("pointerdown", e => { drag = { x: e.clientX, y: e.clientY }; renderer.domElement.setPointerCapture(e.pointerId); });
  renderer.domElement.addEventListener("pointermove", e => {
    if (!drag) return;
    camYaw -= (e.clientX - drag.x) * 0.006;
    camPitch = Math.min(1.2, Math.max(0.12, camPitch + (e.clientY - drag.y) * 0.004));
    drag = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener("pointerup", () => { drag = null; });

  document.querySelectorAll("[data-hold]").forEach(btn => {
    const k = btn.dataset.hold;
    const on = e => { e.preventDefault(); held[k] = true; };
    const off = () => { held[k] = false; };
    btn.addEventListener("pointerdown", on);
    ["pointerup", "pointerleave", "pointercancel"].forEach(t => btn.addEventListener(t, off));
  });

  // ---------- Movement ----------
  const R = 0.35;
  function blocked(x, z) {
    for (const w of walls) if (x > w.x0 - R && x < w.x1 + R && z > w.z0 - R && z < w.z1 + R) return true;
    return false;
  }
  function step(dt) {
    if (panelOpen() || riding) { held.fwd = held.back = held.left = held.right = false; }
    const fwd = !panelOpen() && !riding && (keys.has("w") || keys.has("arrowup") || held.fwd);
    const back = !panelOpen() && !riding && (keys.has("s") || keys.has("arrowdown") || held.back);
    const left = !panelOpen() && !riding && (keys.has("a") || keys.has("arrowleft") || held.left);
    const right = !panelOpen() && !riding && (keys.has("d") || keys.has("arrowright") || held.right);
    const turn = (left ? 1 : 0) - (right ? 1 : 0);
    me.yaw += turn * 2.6 * dt;
    const move = (fwd ? 1 : 0) - (back ? 0.6 : 0);
    const speed = (keys.has("shift") ? 6.5 : 3.6) * move;
    if (move) {
      const nx = me.x + Math.sin(me.yaw) * speed * dt, nz = me.z + Math.cos(me.yaw) * speed * dt;
      if (!blocked(nx, me.z)) me.x = nx;
      if (!blocked(me.x, nz)) me.z = nz;
      me.stride += dt * (keys.has("shift") ? 13 : 9) * Math.sign(move);
      // let the camera drift back behind you while you walk
      camYaw *= Math.pow(0.2, dt);
    } else {
      me.stride *= Math.pow(0.001, dt);
    }
    const swing = Math.sin(me.stride) * (move ? 0.6 : Math.min(0.6, Math.abs(Math.sin(me.stride))));
    legL.rotation.x = swing; legR.rotation.x = -swing;
    armL.rotation.x = -swing * 0.8; armR.rotation.x = swing * 0.8;
    person.position.set(me.x, move ? Math.abs(Math.sin(me.stride)) * 0.04 : 0, me.z);
    person.rotation.y = me.yaw;
  }

  const ray = new T.Raycaster();
  const headPos = new T.Vector3(), camWant = new T.Vector3(), dir = new T.Vector3();
  function placeCamera() {
    const yaw = me.yaw + camYaw, dist = 6.5;
    headPos.set(me.x, 1.6, me.z);
    camWant.set(me.x - Math.sin(yaw) * dist * Math.cos(camPitch), 1.6 + Math.sin(camPitch) * dist, me.z - Math.cos(yaw) * dist * Math.cos(camPitch));
    dir.subVectors(camWant, headPos);
    const len = dir.length(); dir.normalize();
    ray.set(headPos, dir); ray.far = len;
    const hit = ray.intersectObjects(wallMeshes, false)[0];
    if (hit) camWant.copy(headPos).addScaledVector(dir, Math.max(0.6, hit.distance - 0.25));
    camera.position.lerp(camWant, 0.25);
    camera.lookAt(me.x + Math.sin(me.yaw + camYaw) * 1.5, 1.4, me.z + Math.cos(me.yaw + camYaw) * 1.5);
  }

  // ---------- Things you can use ----------
  let near = null;
  const prompt = $("#prompt");
  function checkSpots() {
    let found = null;
    for (const s of spots) if (Math.hypot(me.x - s.x, me.z - s.z) < s.r) { found = s; break; }
    if (found === near) return;
    near = found;
    if (!near || riding) { prompt.hidden = true; return; }
    prompt.hidden = false;
    prompt.textContent = near.kind === "elevator" ? "Call the elevator  [E]" : near.kind === "directory" ? "Read the directory  [E]" : `Read the ${near.room.name} board  [E]`;
  }
  prompt.addEventListener("click", useSpot);

  function useSpot() {
    if (!near || riding) return;
    if (near.kind === "elevator") openElevator();
    else if (near.kind === "directory") openDirectory();
    else openBoard(near.room);
  }

  const panel = $("#panel"), panelBody = $("#panel-body");
  const panelOpen = () => !panel.hidden;
  function showPanel(html) { panelBody.innerHTML = html; panel.hidden = false; prompt.hidden = true; panel.querySelector("button, a")?.focus(); }
  function closePanels() { if (!panel.hidden) { panel.hidden = true; near = null; } }
  $("#panel-close").addEventListener("click", closePanels);
  panelBody.addEventListener("click", e => {
    const b = e.target.closest("[data-go]");
    if (b) { closePanels(); ride(b.dataset.go); }
  });

  function openElevator() {
    const buttons = [...stops].reverse().map(s => `
      <button class="lift-btn" data-go="${esc(s.id)}" ${s === current ? "disabled" : ""} style="--biz:${esc(s.color)}">
        <span class="lift-num">${floorLabel(s.floor)}</span><span>${esc(s.name)}</span>
      </button>`).join("");
    showPanel(`<span class="eyebrow">Elevator · you are on ${current.floor === 0 ? "the lobby" : "floor " + current.floor}</span>
      <h2>Where to?</h2><div class="lift">${buttons}</div>`);
  }
  function openDirectory() {
    const rows = [...businesses].reverse().map(b => `<li><span>${esc(b.name)}</span><span>${esc(b.tagline)}</span><span class="fl">${floorLabel(b.floor)}</span></li>`).join("");
    showPanel(`<span class="eyebrow">Lobby directory</span><h2>${esc(building.name)}</h2><ul class="dir">${rows}</ul>
      <p class="muted">Take the elevator behind you to visit an office.</p>`);
  }
  function openBoard(room) {
    const notes = room.notes.map(n => `<li class="${n.muted ? "muted" : ""}">${n.href ? `<a href="${esc(n.href)}" target="_blank" rel="noopener">${esc(n.text)}</a>` : esc(n.text)}</li>`).join("");
    showPanel(`<span class="eyebrow">${esc(current.name)} · ${esc(room.kind || "room")}</span><h2>${esc(room.name)}</h2><ul class="notes" style="--biz:${esc(current.color)}">${notes}</ul>`);
  }

  // ---------- HUD and elevator ride ----------
  function updateHud() {
    $("#hud-floor").textContent = floorLabel(current.floor);
    $("#hud-name").textContent = current.name;
    $("#hud-line").textContent = current.floor === 0 ? "Walk to the elevator to visit an office" : current.tagline + (current.status ? ` · ${current.status}` : "");
    document.documentElement.style.setProperty("--biz", current.color);
    document.title = current.floor === 0 ? building.name : `${current.name} · ${building.name}`;
  }
  function arrive(stop) {
    buildStorey(stop);
    me.x = 0; me.z = 4; me.yaw = 0; camYaw = 0; near = null;
    person.position.set(me.x, 0, me.z);
    updateHud();
    placeCamera(); camera.position.copy(camWant);
    const hash = stop.id === "lobby" ? "" : stop.id;
    if (location.hash.slice(1) !== hash) {
      ignoreHash = true;
      try { history.replaceState(null, "", hash ? "#" + hash : location.pathname + location.search); }
      catch (e) { location.hash = hash; }
    }
  }
  let riding = false, ignoreHash = false;
  function ride(id) {
    const target = byId[id];
    if (!target || target === current || riding) return;
    if (reduceMotion) { arrive(target); return; }
    riding = true; prompt.hidden = true;
    const overlay = $("#ride"), ind = $("#ride-floor");
    $("#ride-dir").textContent = target.floor > current.floor ? "▲ GOING UP" : "▼ GOING DOWN";
    overlay.hidden = false;
    let f = current.floor; const s = target.floor > f ? 1 : -1;
    ind.textContent = floorLabel(f);
    const tick = setInterval(() => {
      f += s; ind.textContent = floorLabel(f);
      if (f === target.floor) {
        clearInterval(tick);
        setTimeout(() => {
          arrive(target);
          overlay.hidden = true;
          const doors = $("#doors"); doors.hidden = false; doors.classList.remove("open");
          requestAnimationFrame(() => requestAnimationFrame(() => doors.classList.add("open")));
          setTimeout(() => { doors.hidden = true; riding = false; }, 520);
        }, 250);
      }
    }, 300);
  }
  window.addEventListener("hashchange", () => {
    if (ignoreHash) { ignoreHash = false; return; }
    const stop = byId[location.hash.slice(1)] || lobby;
    if (stop !== current) arrive(stop);
  });

  // ---------- Look picker ----------
  const shirts = ["#4F5BD5", "#0E8C7F", "#C8453B", "#E0A526", "#2A2F38", "#F2EFE6"];
  const skins = ["#F1C9A5", "#D9A27A", "#A86B47", "#8D5A3B", "#5C3A26"];
  function swatches(el, list, key, m) {
    el.innerHTML = list.map(c => `<button class="swatch" style="background:${c}" data-c="${c}" aria-label="${key} colour ${c}" aria-pressed="${look[key] === c}"></button>`).join("");
    el.addEventListener("click", e => {
      const b = e.target.closest("[data-c]"); if (!b) return;
      look[key] = b.dataset.c; m.color.set(look[key]); store.set("hq-avatar", look);
      el.querySelectorAll(".swatch").forEach(s => s.setAttribute("aria-pressed", s.dataset.c === look[key]));
    });
  }
  swatches($("#shirt-swatches"), shirts, "shirt", shirtMat);
  swatches($("#skin-swatches"), skins, "skin", skinMat);
  $("#look-toggle").addEventListener("click", () => { const p = $("#look"); p.hidden = !p.hidden; });

  // ---------- Start ----------
  const clock = new T.Clock();
  function frame() {
    const dt = Math.min(clock.getDelta(), 0.05);
    step(dt);
    if (!riding) checkSpots();
    placeCamera();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  const start = () => {
    resize();
    arrive(byId[location.hash.slice(1)] || lobby);
    frame();
  };
  // canvas text only uses a web font once it has loaded, so load them before drawing signs
  const fontsReady = document.fonts
    ? Promise.race([
        Promise.all([`800 72px ${FONT_DISPLAY}`, `700 64px ${FONT_DISPLAY}`, `500 34px ${FONT_BODY}`, `600 40px ${FONT_MONO}`, `500 46px ${FONT_MONO}`].map(f => document.fonts.load(f))).catch(() => {}),
        new Promise(r => setTimeout(r, 2500))
      ])
    : Promise.resolve();
  fontsReady.then(start);
})();
