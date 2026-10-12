import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createCar, setBrakes } from "@/game/cars";
import { bindKeyboard, installProbe, readInput, type TouchPad } from "@/game/input";
import { createSim, snapshot, stepSim, type HudSnapshot, type Sim } from "@/game/sim";
import { sampleAt, trackById, type Track } from "@/game/track";
import { playFanfare, resumeAudio, setEngineSpeed, startRaceAudio, stopRaceAudio } from "@/game/audio";
import type { Racer } from "@/game/catalog";

const ROAD_HALF = 7.2;

function leftOf(tx: number, tz: number) {
  const yaw = Math.atan2(-tx, -tz);
  return { x: -Math.cos(yaw), z: Math.sin(yaw) };
}

function pushQuad(
  positions: number[],
  colors: number[],
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
  cx: number,
  cy: number,
  cz: number,
  dx: number,
  dy: number,
  dz: number,
  color: THREE.Color,
) {
  const verts = [
    [ax, ay, az],
    [bx, by, bz],
    [cx, cy, cz],
    [ax, ay, az],
    [cx, cy, cz],
    [dx, dy, dz],
  ];
  for (const [x, y, z] of verts) {
    positions.push(x, y, z);
    colors.push(color.r, color.g, color.b);
  }
}

function coloredMesh(positions: number[], colors: number[]) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
  );
  return mesh;
}

function buildCircuit(scene: THREE.Scene, track: Track) {
  const samples = track.samples;
  const roadP: number[] = [];
  const roadC: number[] = [];
  const curbP: number[] = [];
  const curbC: number[] = [];
  const lineP: number[] = [];
  const lineC: number[] = [];
  const asphaltA = new THREE.Color(0x2a3038);
  const asphaltB = new THREE.Color(0x343b44);
  const red = new THREE.Color(0xc83232);
  const cream = new THREE.Color(0xefe6d2);
  const white = new THREE.Color(0xd9d3c4);
  const gold = new THREE.Color(0xc99212);
  const edge = (sample: (typeof samples)[number], side: number, extra = 0) => {
    const left = leftOf(sample.tx, sample.tz);
    return {
      x: sample.x + left.x * side,
      z: sample.z + left.z * side,
      extra,
    };
  };

  const count = samples.length;
  for (let i = 0; i < count; i += 1) {
    const a = samples[i];
    const b = samples[(i + 1) % count];
    const half = ROAD_HALF;
    const al = edge(a, half);
    const ar = edge(a, -half);
    const bl = edge(b, half);
    const br = edge(b, -half);
    const tone = i % 2 === 0 ? asphaltA : asphaltB;
    pushQuad(roadP, roadC, al.x, 0, al.z, ar.x, 0, ar.z, br.x, 0, br.z, bl.x, 0, bl.z, tone);

    const curbOut = half + 0.55;
    const curbIn = half - 0.15;
    const curbColor = Math.floor(i / 2) % 2 === 0 ? red : cream;
    for (const side of [1, -1]) {
      const c0 = edge(a, side * curbIn);
      const c1 = edge(a, side * curbOut);
      const d0 = edge(b, side * curbIn);
      const d1 = edge(b, side * curbOut);
      pushQuad(
        curbP,
        curbC,
        c0.x,
        0.03,
        c0.z,
        c1.x,
        0.03,
        c1.z,
        d1.x,
        0.03,
        d1.z,
        d0.x,
        0.03,
        d0.z,
        curbColor,
      );
    }

    if (i % 4 < 2) {
      const dash = 0.16;
      const c0 = edge(a, dash);
      const c1 = edge(a, -dash);
      const d0 = edge(b, dash);
      const d1 = edge(b, -dash);
      pushQuad(lineP, lineC, c0.x, 0.045, c0.z, c1.x, 0.045, c1.z, d1.x, 0.045, d1.z, d0.x, 0.045, d0.z, gold);
    }
    for (const side of [1, -1]) {
      const outer = half - 0.55;
      const inner = half - 0.85;
      const c0 = edge(a, side * inner);
      const c1 = edge(a, side * outer);
      const d0 = edge(b, side * inner);
      const d1 = edge(b, side * outer);
      pushQuad(lineP, lineC, c0.x, 0.04, c0.z, c1.x, 0.04, c1.z, d1.x, 0.04, d1.z, d0.x, 0.04, d0.z, white);
    }
  }

  scene.add(coloredMesh(roadP, roadC));
  scene.add(coloredMesh(curbP, curbC));
  scene.add(coloredMesh(lineP, lineC));

  const start = sampleAt(0, track);
  const next = sampleAt(1.6, track);
  const squares = 8;
  const checkP: number[] = [];
  const checkC: number[] = [];
  const black = new THREE.Color(0x111111);
  for (let i = 0; i < squares; i += 1) {
    const t0 = -1 + (2 * i) / squares;
    const t1 = -1 + (2 * (i + 1)) / squares;
    const span = ROAD_HALF * 0.92;
    const p = (t: number, sample: typeof start) => {
      const left = leftOf(sample.tx, sample.tz);
      return { x: sample.x + left.x * span * t, z: sample.z + left.z * span * t };
    };
    const a = p(t0, start);
    const b = p(t1, start);
    const c = p(t1, next);
    const d = p(t0, next);
    pushQuad(checkP, checkC, a.x, 0.05, a.z, b.x, 0.05, b.z, c.x, 0.05, c.z, d.x, 0.05, d.z, i % 2 ? black : white);
  }
  scene.add(coloredMesh(checkP, checkC));

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const sample of samples) {
    minX = Math.min(minX, sample.x);
    maxX = Math.max(maxX, sample.x);
    minZ = Math.min(minZ, sample.z);
    maxZ = Math.max(maxZ, sample.z);
  }
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(maxX - minX + 240, maxZ - minZ + 240),
    new THREE.MeshLambertMaterial({ color: 0x102616 }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set((minX + maxX) / 2, -0.08, (minZ + maxZ) / 2);
  scene.add(grass);

  const farFromRoad = (x: number, z: number, min: number, skipIndex: number) => {
    for (let i = 0; i < samples.length; i += 2) {
      const along = Math.abs(i - skipIndex);
      if (Math.min(along, samples.length - along) < 14) continue;
      if (Math.hypot(samples[i].x - x, samples[i].z - z) < min) return false;
    }
    return true;
  };

  const trees: THREE.BufferGeometry[] = [];
  const foliage = new THREE.ConeGeometry(1.15, 3.4, 5);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < samples.length; i += 5) {
    const sample = samples[i];
    const left = leftOf(sample.tx, sample.tz);
    for (const side of [-1, 1]) {
      if ((i + side) % 15 === 0) continue;
      const dist = ROAD_HALF + 5.5 + ((i * 3) % 5);
      const x = sample.x + left.x * side * dist;
      const z = sample.z + left.z * side * dist;
      if (!farFromRoad(x, z, ROAD_HALF + 1.4, i)) continue;
      const h = 2.6 + (i % 4) * 0.45;
      dummy.position.set(x, h * 0.55, z);
      dummy.scale.set(1, h / 3.4, 1);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      const top = foliage.clone();
      top.applyMatrix4(dummy.matrix);
      trees.push(top);
    }
  }
  if (trees.length) {
    const merged = mergeGeometries(trees);
    trees.forEach((geo) => geo.dispose());
    if (merged) {
      const mesh = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x17361c, flatShading: true }));
      scene.add(mesh);
    }
  }
  foliage.dispose();

  const block = lambertBox();
  const step = Math.max(8, Math.floor(samples.length / 8));
  let placed = 0;
  for (let i = step; i < samples.length && placed < 5; i += step) {
    const sample = samples[i];
    const left = leftOf(sample.tx, sample.tz);
    for (const side of [1, -1]) {
      if (placed >= 5) break;
      const dist = 30 + (placed % 3) * 8;
      const x = sample.x + left.x * side * dist;
      const z = sample.z + left.z * side * dist;
      if (!farFromRoad(x, z, 16, i)) continue;
      const w = 12 + (placed % 3) * 4;
      const h = 8 + (placed % 4) * 5;
      const d = 10 + (placed % 2) * 6;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), block);
      mesh.position.set(x, h / 2, z);
      scene.add(mesh);
      const win = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.72, 0.35, 0.2),
        new THREE.MeshBasicMaterial({ color: 0xffb703 }),
      );
      win.position.set(x, h * 0.62, z + d / 2 + 0.05);
      scene.add(win);
      placed += 1;
      break;
    }
  }
}

function lambertBox() {
  return new THREE.MeshLambertMaterial({ color: 0x1a2333, flatShading: true });
}

function nameTag(alias: string, color: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.fillStyle = "rgba(12,16,24,0.72)";
  ctx.fillRect(0, 8, 256, 48);
  ctx.fillStyle = color;
  ctx.fillRect(0, 8, 8, 48);
  ctx.font = "700 32px sans-serif";
  ctx.fillStyle = "#efe6d2";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(alias.slice(0, 12).toUpperCase(), 132, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.position.y = 2.55;
  sprite.scale.set(4.2, 1.05, 1);
  return sprite;
}

export function mountRace(
  canvas: HTMLCanvasElement,
  opts: {
    racers: Racer[];
    mode: "drive" | "watch";
    trackId: string;
    touch: { current: TouchPad };
    watchId: { current: string | null };
    onHud: (hud: HudSnapshot) => void;
  },
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0c1018, 1);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1018);
  scene.fog = new THREE.Fog(0x0c1018, 36, 145);
  scene.add(new THREE.AmbientLight(0x8ea0b8, 0.95));
  const moon = new THREE.DirectionalLight(0xfff2d2, 1.45);
  moon.position.set(-30, 70, 18);
  scene.add(moon);
  const fill = new THREE.DirectionalLight(0x7f96c4, 0.4);
  fill.position.set(40, 24, -30);
  scene.add(fill);

  const circuit = trackById(opts.trackId);
  buildCircuit(scene, circuit.track);

  const sim: Sim = createSim(opts.racers, opts.mode, circuit.track);
  const groups = new Map<string, THREE.Group>();
  for (const racer of opts.racers) {
    const group = createCar(racer.carId, racer.color);
    const tag = nameTag(racer.alias, racer.color);
    if (tag) group.add(tag);
    scene.add(group);
    groups.set(racer.id, group);
  }

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 260);
  const desired = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookSmooth = new THREE.Vector3();
  let camReady = false;

  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const scale = 0.58;
    renderer.setSize(Math.max(16, Math.floor(w * scale)), Math.max(16, Math.floor(h * scale)), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  window.addEventListener("resize", resize);

  const unbindKeys = bindKeyboard();
  const player = () => sim.cars.find((car) => car.player);
  const removeProbe = installProbe(
    () => player()?.yaw ?? 0,
    () => player()?.speed ?? 0,
  );

  startRaceAudio();
  let last = performance.now();
  let acc = 0;
  let hudAcc = 0;
  let fanfareSent = false;
  let running = true;
  let raf = 0;

  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    let delta = (now - last) / 1000;
    last = now;
    if (delta > 0.1) delta = 0.1;
    acc += delta;
    const step = 1 / 60;
    while (acc >= step) {
      stepSim(sim, step, readInput(opts.touch.current));
      acc -= step;
    }

    for (const car of sim.cars) {
      const group = groups.get(car.id);
      if (!group) continue;
      group.position.set(car.x, 0, car.z);
      group.rotation.y = car.yaw + Math.PI;
    }
    const inputNow = readInput(opts.touch.current);
    const human = player();
    if (human) {
      const group = groups.get(human.id);
      if (group) setBrakes(group, inputNow.brake > 0);
    }

    const order = [...sim.cars].sort((a, b) => b.progress - a.progress);
    const locked = opts.watchId.current
      ? sim.cars.find((car) => car.id === opts.watchId.current)
      : undefined;
    const focus = sim.mode === "drive" ? (player() ?? order[0]) : (locked ?? order[0]);
    if (focus) {
      const fx = -Math.sin(focus.yaw);
      const fz = -Math.cos(focus.yaw);
      const dist = sim.phase === "finished" ? 16 : sim.mode === "watch" ? 12 : 9.2;
      const height = sim.phase === "finished" ? 7.2 : sim.mode === "watch" ? 5.4 : 3.8;
      desired.set(focus.x - fx * dist, height, focus.z - fz * dist);
      look.set(focus.x + fx * 8, 1.05, focus.z + fz * 8);
      if (!camReady) {
        camera.position.copy(desired);
        lookSmooth.copy(look);
        camReady = true;
      }
      const k = 1 - Math.exp(-3.4 * delta);
      camera.position.lerp(desired, k);
      lookSmooth.lerp(look, k);
      camera.lookAt(lookSmooth);
      const fov = sim.phase === "finished" ? 60 : 66 + Math.min(14, focus.speed * 0.2);
      if (Math.abs(camera.fov - fov) > 0.3) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
      const input = inputNow;
      setEngineSpeed(focus.speed, focus.player ? input.throttle : 0.7);
    }

    if (sim.phase === "finished" && !fanfareSent) {
      fanfareSent = true;
      playFanfare();
    }

    renderer.render(scene, camera);
    hudAcc += delta;
    if (hudAcc > 0.1 || sim.phase === "finished") {
      hudAcc = 0;
      opts.onHud(snapshot(sim, focus?.id ?? null));
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      unbindKeys();
      removeProbe();
      stopRaceAudio();
      const geos = new Set<THREE.BufferGeometry>();
      const mats = new Set<THREE.Material>();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          geos.add(obj.geometry);
          const material = obj.material;
          const list = Array.isArray(material) ? material : [material];
          for (const item of list) mats.add(item);
        } else if (obj instanceof THREE.Sprite) {
          const material = obj.material;
          if (material.map) material.map.dispose();
          mats.add(material);
        }
      });
      geos.forEach((geo) => geo.dispose());
      mats.forEach((item) => item.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}

export function mountPreview(canvas: HTMLCanvasElement, carId: string, color: string) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0c1018, 1);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c1018);
  scene.add(new THREE.AmbientLight(0x9aabc2, 1));
  const key = new THREE.DirectionalLight(0xfff0cc, 1.5);
  key.position.set(3, 6, 4);
  scene.add(key);
  const floor = new THREE.Mesh(
    new THREE.CircleGeometry(3.4, 8),
    new THREE.MeshLambertMaterial({ color: 0x182232 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;
  scene.add(floor);
  const car = createCar(carId, color);
  scene.add(car);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 40);
  camera.position.set(5.4, 2.35, 5.1);
  camera.lookAt(0, 0.7, 0);

  const reduced =
    typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  let running = true;
  let raf = 0;
  let last = performance.now();
  const resize = () => {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(Math.floor(w * 0.72), Math.floor(h * 0.72), false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  resize();
  const frame = (now: number) => {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduced) car.rotation.y += dt * 0.7;
    else car.rotation.y = 0.6;
    renderer.render(scene, camera);
  };
  raf = requestAnimationFrame(frame);
  return {
    destroy() {
      running = false;
      cancelAnimationFrame(raf);
      scene.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh)) return;
        obj.geometry.dispose();
        const material = obj.material;
        if (Array.isArray(material)) material.forEach((item) => item.dispose());
        else material.dispose();
      });
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
