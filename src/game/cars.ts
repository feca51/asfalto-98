import * as THREE from "three";

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
    for (const side of [-1, 1]) {
      const wheel = new THREE.Mesh(geo, tire);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(side * half, radius, z);
      group.add(wheel);
    }
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
  const trim = lambert(0xc9c2b2);

  if (carId === "nite") {
    addBox(group, body, 1.72, 0.46, 3.7, 0, 0.58, 0);
    addBox(group, body, 1.5, 0.34, 1.45, 0, 0.92, -0.15);
    addBox(group, glass, 1.28, 0.26, 1.2, 0, 1.08, -0.05);
    addBox(group, trim, 0.18, 0.1, 0.35, -0.55, 0.78, 1.55);
    addBox(group, trim, 0.18, 0.1, 0.35, 0.55, 0.78, 1.55);
    addWheels(group, [1.25, -1.25], 0.86);
    lights(group, 1.9, -1.9, 0.62, 0.58);
  } else if (carId === "kuro") {
    addBox(group, body, 1.86, 0.58, 3.45, 0, 0.66, 0.05);
    addBox(group, body, 1.62, 0.46, 1.55, 0, 1.12, -0.15);
    addBox(group, glass, 1.4, 0.28, 1.25, 0, 1.32, -0.05);
    addBox(group, dark, 0.46, 0.16, 0.7, 0, 1.58, -0.1);
    addBox(group, body, 0.28, 0.22, 0.85, 0.98, 0.58, 0.3);
    addBox(group, body, 0.28, 0.22, 0.85, -0.98, 0.58, 0.3);
    addWheels(group, [1.15, -1.2], 0.92, 0.38);
    lights(group, 1.78, -1.72, 0.7, 0.62);
  } else if (carId === "alba") {
    addBox(group, body, 1.05, 0.36, 3.9, 0, 0.48, 0.1);
    addBox(group, body, 0.42, 0.2, 1.5, 0.78, 0.4, 0.15);
    addBox(group, body, 0.42, 0.2, 1.5, -0.78, 0.4, 0.15);
    addBox(group, glass, 0.62, 0.28, 0.72, 0, 0.78, 0.45);
    addBox(group, dark, 1.85, 0.06, 0.55, 0, 1.15, -1.65);
    addBox(group, dark, 0.08, 0.42, 0.08, 0.4, 0.92, -1.65);
    addBox(group, dark, 0.08, 0.42, 0.08, -0.4, 0.92, -1.65);
    addWheels(group, [1.35, -1.35], 0.78, 0.36);
    lights(group, 2.05, -1.95, 0.48, 0.32);
  } else if (carId === "thunder") {
    addBox(group, body, 1.95, 0.5, 4.25, 0, 0.6, 0.05);
    addBox(group, body, 1.55, 0.38, 1.15, 0, 1.0, -0.95);
    addBox(group, glass, 1.35, 0.24, 0.95, 0, 1.16, -0.9);
    addBox(group, dark, 0.7, 0.16, 0.55, 0, 0.9, 0.85);
    addWheels(group, [1.35, -1.4], 0.98, 0.38);
    lights(group, 2.18, -2.12, 0.62, 0.7);
  } else if (carId === "lumen") {
    addBox(group, body, 1.82, 0.4, 4.05, 0, 0.52, 0);
    addBox(group, body, 1.45, 0.32, 1.15, 0, 0.84, 0.75);
    addBox(group, glass, 1.22, 0.22, 0.95, 0, 1.02, 0.8);
    addBox(group, body, 0.32, 0.28, 1.1, 0.95, 0.5, -0.2);
    addBox(group, body, 0.32, 0.28, 1.1, -0.95, 0.5, -0.2);
    addBox(group, dark, 1.7, 0.08, 0.35, 0, 0.86, -1.7);
    addWheels(group, [1.3, -1.35], 0.88);
    lights(group, 2.05, -2.02, 0.55, 0.55);
  } else {
    addBox(group, body, 1.78, 0.3, 3.5, 0, 0.46, -0.05);
    addBox(group, body, 1.5, 0.22, 1.35, 0, 0.42, 1.45, -0.42);
    addBox(group, glass, 1.22, 0.22, 0.95, 0, 0.7, -0.35);
    addBox(group, dark, 1.62, 0.06, 0.28, 0, 0.78, -1.55);
    addWheels(group, [1.2, -1.25], 0.84, 0.32);
    lights(group, 1.85, -1.78, 0.48, 0.52);
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
