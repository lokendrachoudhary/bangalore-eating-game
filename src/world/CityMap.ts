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
  objectRadius: number; // Visual size - hole must be bigger to eat
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

// Neighborhoods now tile the ENTIRE 160x160 map with no empty gaps.
// Layout based on real Bangalore relative positions.
const NEIGHBORHOODS: Neighborhood[] = [
  // === ROW 1: NORTH (z: -80 to -30) ===
  { name: 'Yeshwanthpur',   x: -55, z: -55, w: 30, h: 30, type: 'commercial', density: 0.7, color: 0x4e342e },
  { name: 'Malleshwaram',   x: -25, z: -55, w: 30, h: 30, type: 'old_city',   density: 0.8, color: 0x5d4037 },
  { name: 'Sadashivanagar', x: 5,   z: -55, w: 30, h: 30, type: 'residential',density: 0.5, color: 0x3e5c2e },
  { name: 'Cantonment',     x: 35,  z: -55, w: 30, h: 30, type: 'old_city',   density: 0.6, color: 0x4e342e },
  { name: 'Hebbal',         x: 65,  z: -55, w: 30, h: 30, type: 'residential',density: 0.5, color: 0x3e5c2e },

  // === ROW 2: CENTRAL-NORTH (z: -30 to 0) ===
  { name: 'Rajajinagar',    x: -55, z: -20, w: 30, h: 25, type: 'residential',density: 0.6, color: 0x3e5c2e },
  { name: 'Majestic',       x: -25, z: -20, w: 30, h: 25, type: 'commercial', density: 0.9, color: 0x455a64 },
  { name: 'Cubbon Park',    x: 5,   z: -20, w: 30, h: 25, type: 'park',       density: 0.3, color: 0x1b5e20 },
  { name: 'MG Road',        x: 35,  z: -20, w: 30, h: 25, type: 'commercial', density: 0.9, color: 0x455a64 },
  { name: 'Indiranagar',    x: 65,  z: -20, w: 30, h: 25, type: 'commercial', density: 0.8, color: 0x37474f },

  // === ROW 3: CENTRAL-SOUTH (z: 0 to 25) ===
  { name: 'Vijayanagar',    x: -55, z: 8,   w: 30, h: 25, type: 'residential',density: 0.5, color: 0x3e5c2e },
  { name: 'Basavanagudi',   x: -25, z: 8,   w: 30, h: 25, type: 'old_city',   density: 0.7, color: 0x5d4037 },
  { name: 'Lalbagh',        x: 5,   z: 8,   w: 30, h: 25, type: 'park',       density: 0.3, color: 0x1b5e20 },
  { name: 'Koramangala',    x: 35,  z: 8,   w: 30, h: 25, type: 'commercial', density: 0.8, color: 0x37474f },
  { name: 'HAL',            x: 65,  z: 8,   w: 30, h: 25, type: 'it_hub',     density: 0.6, color: 0x263238 },

  // === ROW 4: SOUTH (z: 25 to 55) ===
  { name: 'RR Nagar',       x: -55, z: 38,  w: 30, h: 30, type: 'residential',density: 0.5, color: 0x3e5c2e },
  { name: 'Jayanagar',      x: -25, z: 38,  w: 30, h: 30, type: 'residential',density: 0.7, color: 0x3e5c2e },
  { name: 'BTM Layout',     x: 5,   z: 38,  w: 30, h: 30, type: 'residential',density: 0.7, color: 0x33691e },
  { name: 'HSR Layout',     x: 35,  z: 38,  w: 30, h: 30, type: 'it_hub',     density: 0.7, color: 0x263238 },
  { name: 'Whitefield',     x: 65,  z: 38,  w: 30, h: 30, type: 'it_hub',     density: 0.8, color: 0x263238 },
];

// ===== BANGALORE ROADS =====
interface Road {
  x1: number; z1: number; x2: number; z2: number;
  width: number; name: string;
}

const ROADS: Road[] = [
  // === MAJOR EAST-WEST ARTERIES ===
  { x1: -HALF, z1: -7,  x2: HALF, z2: -7,  width: 5, name: 'MG Road / Bellary Road' },
  { x1: -HALF, z1: -35, x2: HALF, z2: -35, width: 4, name: 'Seshadri Road' },
  { x1: -HALF, z1: 22,  x2: HALF, z2: 22,  width: 4, name: 'Hosur Road' },
  { x1: -HALF, z1: 50,  x2: HALF, z2: 50,  width: 3, name: 'Bannerghatta Road' },
  { x1: -HALF, z1: -65, x2: HALF, z2: -65, width: 3, name: 'ORR North' },

  // === MAJOR NORTH-SOUTH ARTERIES ===
  { x1: 5,    z1: -HALF, x2: 5,    z2: HALF, width: 5, name: 'Namma Metro (Purple)' },
  { x1: -25,  z1: -HALF, x2: -25,  z2: HALF, width: 4, name: 'Tumkur Road' },
  { x1: 35,   z1: -HALF, x2: 35,   z2: HALF, width: 4, name: '100 Feet Road' },
  { x1: -55,  z1: -HALF, x2: -55,  z2: HALF, width: 3, name: 'Mysore Road' },
  { x1: 65,   z1: -HALF, x2: 65,   z2: HALF, width: 3, name: 'Old Airport Road' },

  // === SECONDARY GRID (creates city block feel) ===
  // Horizontal
  { x1: -HALF, z1: -50, x2: HALF, z2: -50, width: 2.5, name: 'Palace Road' },
  { x1: -HALF, z1: -20, x2: HALF, z2: -20, width: 2.5, name: 'Residency Road' },
  { x1: -HALF, z1: 8,   x2: HALF, z2: 8,   width: 2.5, name: 'Lalbagh Road' },
  { x1: -HALF, z1: 35,  x2: HALF, z2: 35,  width: 2.5, name: 'JP Nagar Road' },

  // Vertical
  { x1: -40,  z1: -HALF, x2: -40,  z2: HALF, width: 2.5, name: 'Bull Temple Road' },
  { x1: -10,  z1: -HALF, x2: -10,  z2: HALF, width: 2.5, name: 'KR Road' },
  { x1: 20,   z1: -HALF, x2: 20,   z2: HALF, width: 2.5, name: 'St Marks Road' },
  { x1: 50,   z1: -HALF, x2: 50,   z2: HALF, width: 2.5, name: 'HAL Road' },

  // === LOCAL ROADS (more grid density) ===
  { x1: -HALF, z1: -42, x2: HALF, z2: -42, width: 1.8, name: '' },
  { x1: -HALF, z1: -28, x2: HALF, z2: -28, width: 1.8, name: '' },
  { x1: -HALF, z1: -12, x2: HALF, z2: -12, width: 1.8, name: '' },
  { x1: -HALF, z1: 15,  x2: HALF, z2: 15,  width: 1.8, name: '' },
  { x1: -HALF, z1: 28,  x2: HALF, z2: 28,  width: 1.8, name: '' },
  { x1: -HALF, z1: 42,  x2: HALF, z2: 42,  width: 1.8, name: '' },
  { x1: -48,  z1: -HALF, x2: -48, z2: HALF, width: 1.8, name: '' },
  { x1: -33,  z1: -HALF, x2: -33, z2: HALF, width: 1.8, name: '' },
  { x1: -18,  z1: -HALF, x2: -18, z2: HALF, width: 1.8, name: '' },
  { x1: -3,   z1: -HALF, x2: -3,  z2: HALF, width: 1.8, name: '' },
  { x1: 12,   z1: -HALF, x2: 12,  z2: HALF, width: 1.8, name: '' },
  { x1: 28,   z1: -HALF, x2: 28,  z2: HALF, width: 1.8, name: '' },
  { x1: 42,   z1: -HALF, x2: 42,  z2: HALF, width: 1.8, name: '' },
  { x1: 57,   z1: -HALF, x2: 57,  z2: HALF, width: 1.8, name: '' },
  { x1: 72,   z1: -HALF, x2: 72,  z2: HALF, width: 1.8, name: '' },
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

  // ===== GLOBAL OBJECTS (scattered across the whole map) =====
  placeObjects(scene, objects, createTrafficCone, 80, (x, z) => isNearRoad(x, z, 3));
  placeObjects(scene, objects, createLampPost, 70, (x, z) => isNearRoad(x, z, 3));
  placeObjects(scene, objects, createPerson, 100, (x, z) => !isOnRoad(x, z, 0));
  placeObjects(scene, objects, createMotorcycle, 50, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createAutoRickshaw, 60, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createCar, 40, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createBMTCBus, 18, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createPlant, 60);
  placeObjects(scene, objects, createSmallTree, 50, (x, z) => !isOnRoad(x, z, 1));
  placeObjects(scene, objects, createFoodCart, 30, (x, z) => isNearRoad(x, z, 5));

  // ===== PER-NEIGHBORHOOD OBJECTS (area-specific density) =====
  for (const n of NEIGHBORHOODS) {
    const notOnRoad = (x: number, z: number) => !isOnRoad(x, z, 1);
    const nearRoad = (x: number, z: number) => isNearRoad(x, z, 4);
    // Scale count by area size
    const areaScale = (n.w * n.h) / 400; // normalized to ~1.0 for 20x20

    switch (n.type) {
      case 'commercial':
      case 'market':
        placeInArea(scene, objects, createSmallBuilding, Math.floor(12 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createCoffeeShop, Math.floor(8 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createFoodCart, Math.floor(8 * n.density * areaScale), n, nearRoad);
        placeInArea(scene, objects, createPerson, Math.floor(10 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createBench, Math.floor(4 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createAutoRickshaw, Math.floor(5 * n.density * areaScale), n, nearRoad);
        break;
      case 'residential':
        placeInArea(scene, objects, createSmallBuilding, Math.floor(10 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createSmallTree, Math.floor(8 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createPlant, Math.floor(6 * n.density * areaScale), n);
        placeInArea(scene, objects, createPerson, Math.floor(6 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createCar, Math.floor(4 * n.density * areaScale), n, nearRoad);
        break;
      case 'it_hub':
        placeInArea(scene, objects, createITPark, Math.floor(6 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createSmallBuilding, Math.floor(5 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createCar, Math.floor(8 * n.density * areaScale), n, nearRoad);
        placeInArea(scene, objects, createPerson, Math.floor(6 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createCoffeeShop, Math.floor(3 * n.density * areaScale), n, notOnRoad);
        break;
      case 'old_city':
        placeInArea(scene, objects, createSmallBuilding, Math.floor(8 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createCoffeeShop, Math.floor(6 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createFoodCart, Math.floor(7 * n.density * areaScale), n, nearRoad);
        placeInArea(scene, objects, createBanyanTree, Math.floor(4 * n.density * areaScale), n, notOnRoad);
        placeInArea(scene, objects, createAutoRickshaw, Math.floor(6 * n.density * areaScale), n, nearRoad);
        placeInArea(scene, objects, createPerson, Math.floor(8 * n.density * areaScale), n, notOnRoad);
        break;
      case 'park':
        placeInArea(scene, objects, createSmallTree, Math.floor(14 * n.density * areaScale), n);
        placeInArea(scene, objects, createBanyanTree, Math.floor(6 * n.density * areaScale), n);
        placeInArea(scene, objects, createBench, Math.floor(8 * n.density * areaScale), n);
        placeInArea(scene, objects, createPerson, Math.floor(10 * n.density * areaScale), n);
        placeInArea(scene, objects, createPlant, Math.floor(8 * n.density * areaScale), n);
        break;
    }
  }

  // ===== METRO PILLARS along Namma Metro line (x=5) =====
  for (let z = -HALF + 10; z < HALF - 10; z += 12) {
    placeObjects(scene, objects, createMetroPillar, 1, (x, _z) => Math.abs(x - 5) < 3 && Math.abs(_z - z) < 3);
  }

  // ===== LANDMARKS at real Bangalore positions =====
  const landmarks: Array<{ factory: AssetFactory; x: number; z: number }> = [
    { factory: createVidhanaSoudha, x: 8,   z: -22 },   // In Cubbon Park area
    { factory: createBangalorePalace, x: -28, z: -50 },  // Malleshwaram
    { factory: createISKCONTemple, x: 60,  z: -20 },     // Near Indiranagar
    { factory: createLalbagh, x: 5,   z: 10 },            // Lalbagh area
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
