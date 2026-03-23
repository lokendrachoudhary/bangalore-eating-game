import * as THREE from 'three';
import { SizeTier } from './SizeTier.ts';
import {
  createTrafficCone, createPlant, createFoodCart, createLampPost,
  createPerson, createSmallTree, createBench,
  createAutoRickshaw, createCar, createBanyanTree,
  createBMTCBus, createSmallBuilding, createITPark,
  createVidhanaSoudha, createBangalorePalace, createISKCONTemple,
  createLalbagh, createCoffeeShop, createMotorcycle, createMetroPillar,
  type CityObject
} from './ProceduralAssets.ts';
import { randomRange } from '../utils/math.ts';

export interface PlacedObject {
  mesh: THREE.Group;
  tier: SizeTier;
  points: number;
  volume: number;
  name: string;
  x: number;
  z: number;
  consumed: boolean;
  consuming: boolean;
  consumeProgress: number;
  originalY: number;
  originalScale: number;
  holeX: number;
  holeZ: number;
}

export const MAP_SIZE = 160;
const HALF = MAP_SIZE / 2;

/**
 * Bangalore City Layout (approximate relative positions):
 *
 *            NORTH
 *     Malleshwaram   Sadashivanagar
 *         |              |
 *   Rajajinagar --- Majestic --- Cantonment
 *         |              |            |
 *   Vijayanagar --- MG Road --- Indiranagar
 *         |              |            |
 *   Basavanagudi -- Koramangala  -- HAL
 *         |              |
 *   Jayanagar --- BTM Layout --- HSR Layout
 *            SOUTH
 *
 * East side: IT corridor (Whitefield direction)
 */

// ===== BANGALORE NEIGHBORHOODS =====
interface Neighborhood {
  name: string;
  x: number;
  z: number;
  w: number;
  h: number;
  type: 'commercial' | 'residential' | 'park' | 'it_hub' | 'old_city' | 'market';
  density: number; // 0-1, how packed with objects
  color: number;   // ground accent color
}

const NEIGHBORHOODS: Neighborhood[] = [
  // Central
  { name: 'MG Road',        x: 0,   z: 0,    w: 20, h: 12, type: 'commercial', density: 0.9, color: 0x455a64 },
  { name: 'Brigade Road',   x: -8,  z: -10,  w: 12, h: 10, type: 'market',     density: 0.9, color: 0x546e7a },
  { name: 'Majestic',       x: -20, z: -15,  w: 18, h: 14, type: 'commercial', density: 0.8, color: 0x4e342e },

  // North
  { name: 'Malleshwaram',   x: -35, z: -40,  w: 22, h: 18, type: 'old_city',   density: 0.7, color: 0x5d4037 },
  { name: 'Sadashivanagar', x: -5,  z: -42,  w: 18, h: 14, type: 'residential',density: 0.5, color: 0x33691e },
  { name: 'Cantonment',     x: 25,  z: -35,  w: 20, h: 16, type: 'old_city',   density: 0.6, color: 0x4e342e },

  // East
  { name: 'Indiranagar',    x: 35,  z: 0,    w: 22, h: 16, type: 'commercial', density: 0.8, color: 0x37474f },
  { name: 'Whitefield',     x: 60,  z: 5,    w: 20, h: 20, type: 'it_hub',     density: 0.7, color: 0x263238 },

  // South
  { name: 'Koramangala',    x: 15,  z: 20,   w: 22, h: 16, type: 'commercial', density: 0.8, color: 0x37474f },
  { name: 'Jayanagar',      x: -15, z: 35,   w: 22, h: 18, type: 'residential',density: 0.6, color: 0x2e7d32 },
  { name: 'BTM Layout',     x: 15,  z: 38,   w: 18, h: 14, type: 'residential',density: 0.7, color: 0x33691e },
  { name: 'HSR Layout',     x: 40,  z: 40,   w: 18, h: 16, type: 'it_hub',     density: 0.6, color: 0x263238 },
  { name: 'Basavanagudi',   x: -25, z: 18,   w: 18, h: 14, type: 'old_city',   density: 0.6, color: 0x5d4037 },

  // West
  { name: 'Rajajinagar',    x: -45, z: -10,  w: 18, h: 16, type: 'residential',density: 0.5, color: 0x33691e },
  { name: 'Vijayanagar',    x: -50, z: 10,   w: 16, h: 14, type: 'residential',density: 0.5, color: 0x33691e },

  // Parks
  { name: 'Cubbon Park',    x: 5,   z: -22,  w: 20, h: 14, type: 'park',       density: 0.3, color: 0x1b5e20 },
  { name: 'Lalbagh',        x: -10, z: 15,   w: 18, h: 16, type: 'park',       density: 0.3, color: 0x1b5e20 },
];

// ===== BANGALORE ROADS =====
interface Road {
  x1: number; z1: number; x2: number; z2: number;
  width: number; name: string;
}

const ROADS: Road[] = [
  // Major East-West roads
  { x1: -HALF, z1: 0,   x2: HALF, z2: 0,   width: 5, name: 'MG Road' },
  { x1: -HALF, z1: -15, x2: HALF, z2: -15, width: 4, name: 'Seshadri Road' },
  { x1: -HALF, z1: 20,  x2: HALF, z2: 20,  width: 4, name: 'Hosur Road' },
  { x1: -40,   z1: -35, x2: 50,   z2: -35, width: 3, name: 'Bellary Road' },
  { x1: -40,   z1: 38,  x2: 50,   z2: 38,  width: 3, name: 'Bannerghatta Road' },
  { x1: -HALF, z1: -8,  x2: -10,  z2: -8,  width: 3, name: 'Chord Road' },

  // Major North-South roads
  { x1: 0,    z1: -HALF, x2: 0,    z2: HALF, width: 5, name: 'Namma Metro (Purple)' },
  { x1: -20,  z1: -HALF, x2: -20,  z2: HALF, width: 4, name: 'Tumkur Road' },
  { x1: 25,   z1: -HALF, x2: 25,   z2: HALF, width: 4, name: '100 Feet Road' },
  { x1: -40,  z1: -50,   x2: -40,  z2: 30,   width: 3, name: 'Bull Temple Road' },
  { x1: 50,   z1: -40,   x2: 50,   z2: 50,   width: 3, name: 'Old Airport Road' },

  // Secondary roads
  { x1: -10,  z1: -10, x2: -10,  z2: 30,  width: 2.5, name: 'DVG Road' },
  { x1: 15,   z1: 5,   x2: 15,   z2: 45,  width: 2.5, name: 'Sarjapur Road' },
  { x1: 35,   z1: -20, x2: 35,   z2: 20,  width: 2.5, name: 'CMH Road' },
  { x1: -30,  z1: -30, x2: -30,  z2: 0,   width: 2.5, name: 'Sampige Road' },
];

export function createRoads(scene: THREE.Scene): void {
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x2c2c2c,
    roughness: 0.95,
  });

  for (const road of ROADS) {
    const dx = road.x2 - road.x1;
    const dz = road.z2 - road.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const isHorizontal = Math.abs(dx) > Math.abs(dz);

    const geom = isHorizontal
      ? new THREE.PlaneGeometry(length, road.width)
      : new THREE.PlaneGeometry(road.width, length);

    const mesh = new THREE.Mesh(geom, roadMat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(
      (road.x1 + road.x2) / 2,
      0.01,
      (road.z1 + road.z2) / 2
    );
    mesh.renderOrder = 1;
    scene.add(mesh);
  }

  // Dashed center lines
  const markingMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
  for (const road of ROADS) {
    const dx = road.x2 - road.x1;
    const dz = road.z2 - road.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const isHorizontal = Math.abs(dx) > Math.abs(dz);
    const count = Math.floor(length / 4);
    for (let i = 0; i < count; i += 2) {
      const t = (i + 0.5) / count;
      const geom = new THREE.PlaneGeometry(isHorizontal ? 2 : 0.12, isHorizontal ? 0.12 : 2);
      const marking = new THREE.Mesh(geom, markingMat);
      marking.rotation.x = -Math.PI / 2;
      marking.position.set(road.x1 + dx * t, 0.02, road.z1 + dz * t);
      marking.renderOrder = 1;
      scene.add(marking);
    }
  }
}

function isOnRoad(x: number, z: number, buffer: number = 2): boolean {
  for (const road of ROADS) {
    const isHorizontal = Math.abs(road.x2 - road.x1) > Math.abs(road.z2 - road.z1);
    if (isHorizontal) {
      const minX = Math.min(road.x1, road.x2);
      const maxX = Math.max(road.x1, road.x2);
      if (x >= minX && x <= maxX && Math.abs(z - road.z1) < road.width / 2 + buffer) return true;
    } else {
      const minZ = Math.min(road.z1, road.z2);
      const maxZ = Math.max(road.z1, road.z2);
      if (z >= minZ && z <= maxZ && Math.abs(x - road.x1) < road.width / 2 + buffer) return true;
    }
  }
  return false;
}

function isNearRoad(x: number, z: number, dist: number = 5): boolean {
  return isOnRoad(x, z, dist);
}

function getNeighborhood(x: number, z: number): Neighborhood | null {
  for (const n of NEIGHBORHOODS) {
    if (x >= n.x - n.w / 2 && x <= n.x + n.w / 2 &&
        z >= n.z - n.h / 2 && z <= n.z + n.h / 2) {
      return n;
    }
  }
  return null;
}

export function isInPark(x: number, z: number): boolean {
  const n = getNeighborhood(x, z);
  return n !== null && n.type === 'park';
}

// ===== NEIGHBORHOOD GROUND PATCHES =====
function createNeighborhoodGrounds(scene: THREE.Scene): void {
  for (const n of NEIGHBORHOODS) {
    // Ground patch
    const mat = new THREE.MeshStandardMaterial({
      color: n.type === 'park' ? 0x2d6a30 : n.color,
      roughness: 0.92,
    });
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(n.w, n.h), mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(n.x, 0.005, n.z);
    ground.renderOrder = 0;
    scene.add(ground);

    // Park hedges
    if (n.type === 'park') {
      const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, flatShading: true });
      const sides = [
        { sx: n.w, sz: 0.3, px: n.x, pz: n.z - n.h / 2 },
        { sx: n.w, sz: 0.3, px: n.x, pz: n.z + n.h / 2 },
        { sx: 0.3, sz: n.h, px: n.x - n.w / 2, pz: n.z },
        { sx: 0.3, sz: n.h, px: n.x + n.w / 2, pz: n.z },
      ];
      for (const s of sides) {
        const hedge = new THREE.Mesh(new THREE.BoxGeometry(s.sx, 0.3, s.sz), hedgeMat);
        hedge.position.set(s.px, 0.15, s.pz);
        scene.add(hedge);
      }
    }
  }
}

// ===== AREA NAME LABELS =====
function createAreaLabels(scene: THREE.Scene): void {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 64;

  for (const n of NEIGHBORHOODS) {
    // Draw text to canvas
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = n.type === 'park' ? '#a5d6a7' : '#b0bec5';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.name, 128, 32);

    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const labelMat = new THREE.SpriteMaterial({
      map: texture.clone(),
      transparent: true,
      opacity: 0.7,
      depthTest: false,
    });
    // Clone needed because we reuse the canvas
    labelMat.map!.needsUpdate = true;

    const sprite = new THREE.Sprite(labelMat);
    sprite.position.set(n.x, 6, n.z);
    sprite.scale.set(10, 2.5, 1);
    sprite.renderOrder = 10;
    scene.add(sprite);
  }
}

// ===== OBJECT PLACEMENT =====
type AssetFactory = () => CityObject;

function placeObjects(
  scene: THREE.Scene,
  objects: PlacedObject[],
  factory: AssetFactory,
  count: number,
  filter: (x: number, z: number) => boolean = () => true
): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 8) {
    attempts++;
    const x = randomRange(-HALF + 5, HALF - 5);
    const z = randomRange(-HALF + 5, HALF - 5);
    if (!filter(x, z)) continue;
    const tooClose = objects.some(
      o => Math.abs(o.x - x) < 1.5 && Math.abs(o.z - z) < 1.5
    );
    if (tooClose) continue;

    const obj = factory();
    obj.mesh.position.set(x, 0, z);
    obj.mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(obj.mesh);
    objects.push({
      ...obj, x, z,
      consumed: false, consuming: false, consumeProgress: 0,
      originalY: 0, originalScale: 1, holeX: 0, holeZ: 0,
    });
    placed++;
  }
}

function placeInArea(
  scene: THREE.Scene,
  objects: PlacedObject[],
  factory: AssetFactory,
  count: number,
  area: Neighborhood,
  extraFilter: (x: number, z: number) => boolean = () => true
): void {
  let placed = 0;
  let attempts = 0;
  while (placed < count && attempts < count * 10) {
    attempts++;
    const x = randomRange(area.x - area.w / 2 + 1, area.x + area.w / 2 - 1);
    const z = randomRange(area.z - area.h / 2 + 1, area.z + area.h / 2 - 1);
    if (!extraFilter(x, z)) continue;
    const tooClose = objects.some(
      o => Math.abs(o.x - x) < 1.2 && Math.abs(o.z - z) < 1.2
    );
    if (tooClose) continue;

    const obj = factory();
    obj.mesh.position.set(x, 0, z);
    obj.mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(obj.mesh);
    objects.push({
      ...obj, x, z,
      consumed: false, consuming: false, consumeProgress: 0,
      originalY: 0, originalScale: 1, holeX: 0, holeZ: 0,
    });
    placed++;
  }
}

export function populateCity(scene: THREE.Scene): PlacedObject[] {
  const objects: PlacedObject[] = [];

  // Neighborhood ground patches + area labels
  createNeighborhoodGrounds(scene);
  createAreaLabels(scene);

  // ===== GLOBAL OBJECTS (scattered everywhere) =====
  placeObjects(scene, objects, createTrafficCone, 50, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createLampPost, 40, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createPerson, 60, (x, z) => !isOnRoad(x, z, 0));
  placeObjects(scene, objects, createMotorcycle, 30, (x, z) => isNearRoad(x, z, 5));
  placeObjects(scene, objects, createAutoRickshaw, 40, (x, z) => isNearRoad(x, z, 5));
  placeObjects(scene, objects, createCar, 25, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createBMTCBus, 12, (x, z) => isNearRoad(x, z, 5));
  placeObjects(scene, objects, createPlant, 40);
  placeObjects(scene, objects, createSmallTree, 30, (x, z) => !isOnRoad(x, z, 1));

  // ===== PER-NEIGHBORHOOD OBJECTS =====
  for (const n of NEIGHBORHOODS) {
    const notOnRoad = (x: number, z: number) => !isOnRoad(x, z, 1);
    const nearRoad = (x: number, z: number) => isNearRoad(x, z, 5);

    switch (n.type) {
      case 'commercial':
      case 'market':
        placeInArea(scene, objects, createSmallBuilding, Math.floor(8 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createCoffeeShop, Math.floor(5 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createFoodCart, Math.floor(6 * n.density), n, nearRoad);
        placeInArea(scene, objects, createPerson, Math.floor(8 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createBench, Math.floor(3 * n.density), n, notOnRoad);
        break;
      case 'residential':
        placeInArea(scene, objects, createSmallBuilding, Math.floor(6 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createSmallTree, Math.floor(5 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createPlant, Math.floor(4 * n.density), n);
        placeInArea(scene, objects, createPerson, Math.floor(4 * n.density), n, notOnRoad);
        break;
      case 'it_hub':
        placeInArea(scene, objects, createITPark, Math.floor(4 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createSmallBuilding, Math.floor(3 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createCar, Math.floor(5 * n.density), n, nearRoad);
        placeInArea(scene, objects, createPerson, Math.floor(4 * n.density), n, notOnRoad);
        break;
      case 'old_city':
        placeInArea(scene, objects, createSmallBuilding, Math.floor(5 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createCoffeeShop, Math.floor(4 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createFoodCart, Math.floor(5 * n.density), n, nearRoad);
        placeInArea(scene, objects, createBanyanTree, Math.floor(3 * n.density), n, notOnRoad);
        placeInArea(scene, objects, createAutoRickshaw, Math.floor(4 * n.density), n, nearRoad);
        placeInArea(scene, objects, createPerson, Math.floor(6 * n.density), n, notOnRoad);
        break;
      case 'park':
        placeInArea(scene, objects, createSmallTree, Math.floor(10 * n.density), n);
        placeInArea(scene, objects, createBanyanTree, Math.floor(5 * n.density), n);
        placeInArea(scene, objects, createBench, Math.floor(6 * n.density), n);
        placeInArea(scene, objects, createPerson, Math.floor(8 * n.density), n);
        placeInArea(scene, objects, createPlant, Math.floor(6 * n.density), n);
        break;
    }
  }

  // ===== METRO PILLARS along Namma Metro line =====
  for (let z = -HALF + 10; z < HALF - 10; z += 12) {
    if (!isOnRoad(0, z, 0)) continue;
    placeObjects(scene, objects, createMetroPillar, 1, (x, _z) => Math.abs(x) < 3 && Math.abs(_z - z) < 3);
  }

  // ===== LANDMARKS at real Bangalore positions =====
  const landmarks: Array<{ factory: AssetFactory; x: number; z: number }> = [
    { factory: createVidhanaSoudha, x: -10, z: -18 },    // Near Cubbon Park
    { factory: createBangalorePalace, x: -30, z: -35 },  // Malleshwaram area
    { factory: createISKCONTemple, x: 25, z: -30 },      // Rajajinagar/Cantonment
    { factory: createLalbagh, x: -10, z: 15 },            // Lalbagh Garden
  ];

  for (const lm of landmarks) {
    const obj = lm.factory();
    obj.mesh.position.set(lm.x, 0, lm.z);
    scene.add(obj.mesh);
    objects.push({
      ...obj, x: lm.x, z: lm.z,
      consumed: false, consuming: false, consumeProgress: 0,
      originalY: 0, originalScale: 1, holeX: 0, holeZ: 0,
    });
  }

  return objects;
}
