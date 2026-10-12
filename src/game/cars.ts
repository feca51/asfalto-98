import * as THREE from "three";
import { carById } from "@/game/catalog";

function lambert(color: THREE.ColorRepresentation) {
  return new THREE.MeshLambertMaterial({ color, flatShading: true });
}

function addBox(
  group: THREE.Group,
  material: THREE.Material,
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
  rotX = 0,
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.rotation.x = rotX;
  group.add(mesh);
  return mesh;
}

function addWheels(group: THREE.Group, zPairs: number[], half = 0.82, radius = 0.34) {
  const tire = lambert(0x141414);
  const geo = new THREE.CylinderGeometry(radius, radius, 0.3, 6);
  for (const z of zPairs) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0, z);
    if (z > 0.2) pivot.userData.role = "steer";
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(geo, tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * half, radius, 0);
      pivot.add(wheel);
    }
    group.add(pivot);
  }
}

function lights(group: THREE.Group, zFront: number, zRear: number, y = 0.55, half = 0.55) {
  const head = new THREE.MeshBasicMaterial({ color: 0xffe7a8 });
  const brake = lambert(0x2a0000);
  brake.emissive = new THREE.Color(0xff2418);
  brake.emissiveIntensity = 0.35;
  for (const side of [-1, 1]) {
    const lamp = addBox(group, head, 0.22, 0.12, 0.08, side * half, y, zFront);
    lamp.userData.role = "head";
    const tail = addBox(group, brake.clone(), 0.24, 0.12, 0.08, side * (half * 0.85), y, zRear);
    tail.userData.role = "brake";
  }
}

export function createCar(carId: string, color: string): THREE.Group {
  const group = new THREE.Group();
  const body = lambert(color);
  const glass = lambert(0x142033);
  const dark = lambert(0x1b1b1b);
  const klass = carById(carId).klass;

  if (klass === "moto") {
    addBox(group, body, 0.28, 0.32, 1.7, 0, 0.72, 0.05);
    addBox(group, dark, 0.42, 0.16, 0.55, 0, 0.78, 0.85);
    addBox(group, body, 0.22, 0.45, 0.22, 0, 1.15, -0.15);
    addBox(group, dark, 0.36, 0.08, 0.28, 0, 1.42, -0.15);
    addWheels(group, [0.85, -0.7], 0.02, 0.38);
    lights(group, 0.95, -0.85, 0.7, 0.12);
  } else if (klass === "util") {
    addBox(group, body, 1.9, 1.15, 4.1, 0, 1.05, 0);
    addBox(group, glass, 1.7, 0.42, 0.9, 0, 1.55, 1.15);
    addBox(group, dark, 1.5, 0.7, 0.08, 0, 1.15, -2.02);
    addWheels(group, [1.35, -1.35], 0.98, 0.42);
    lights(group, 2.08, -2.08, 0.7, 0.7);
  } else if (klass === "ev") {
    addBox(group, body, 1.8, 0.42, 4.0, 0, 0.5, 0);
    addBox(group, body, 1.62, 0.36, 1.7, 0, 0.82, -0.15);
    addBox(group, glass, 1.45, 0.28, 1.45, 0, 1.05, -0.1);
    addBox(group, dark, 1.55, 0.06, 0.2, 0, 0.62, 1.95);
    addWheels(group, [1.3, -1.3], 0.9, 0.36);
    lights(group, 2.02, -2.0, 0.55, 0.62);
  } else if (klass === "tito") {
    addBox(group, body, 1.25, 0.7, 2.15, 0, 0.72, 0);
    addBox(group, glass, 1.1, 0.32, 0.85, 0, 1.15, 0.15);
    addWheels(group, [0.7, -0.7], 0.66, 0.28);
    lights(group, 1.1, -1.08, 0.55, 0.4);
  } else if (klass === "mono") {
    addBox(group, dark, 0.18, 0.9, 0.18, 0, 0.7, 0);
    addBox(group, body, 0.34, 0.08, 1.15, 0, 0.18, 0.05);
    addBox(group, body, 0.42, 0.08, 0.28, 0, 1.15, -0.05);
    addWheels(group, [0.4, -0.4], 0.02, 0.16);
  } else if (klass === "tuk") {
    addBox(group, body, 1.45, 1.15, 1.5, 0, 1.05, 0.35);
    addBox(group, glass, 1.25, 0.45, 0.9, 0, 1.35, 0.4);
    addBox(group, dark, 1.2, 0.2, 1.3, 0, 0.45, -0.7);
    addBox(group, body, 0.9, 0.5, 0.9, 0, 0.85, -0.75);
    addWheels(group, [0.85], 0.72, 0.32);
    const front = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.22, 6), lambert(0x141414));
    front.rotation.z = Math.PI / 2;
    front.position.set(0, 0.3, 1.15);
    group.add(front);
    lights(group, 1.35, -1.15, 0.7, 0.4);
  } else {
    addBox(group, body, 1.78, 0.32, 3.6, 0, 0.48, -0.05);
    addBox(group, body, 1.5, 0.28, 1.4, 0, 0.72, -0.2);
    addBox(group, glass, 1.28, 0.24, 1.05, 0, 0.92, -0.15);
    addBox(group, dark, 1.55, 0.08, 0.22, 0, 0.7, 1.7);
    addWheels(group, [1.2, -1.25], 0.86, 0.34);
    lights(group, 1.85, -1.8, 0.5, 0.55);
  }

  group.userData.carId = carId;
  return group;
}

export function setBrakes(group: THREE.Group, hard: boolean) {
  group.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh) || obj.userData.role !== "brake") return;
    const material = obj.material;
    if (material instanceof THREE.MeshLambertMaterial) {
      material.emissiveIntensity = hard ? 1.6 : 0.28;
    }
  });
}
