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
  holeX: number;  // X position of the hole that consumed this
  holeZ: number;  // Z position of the hole that consumed this
}

export const MAP_SIZE = 120; // 120x120 unit map
const HALF = MAP_SIZE / 2;

// Road definitions
interface Road {
  x1: number; z1: number; x2: number; z2: number;
  width: number; name: string;
}

const ROADS: Road[] = [
  // Main horizontal roads
  { x1: -HALF, z1: 0, x2: HALF, z2: 0, width: 4, name: 'MG Road' },
  { x1: -HALF, z1: -30, x2: HALF, z2: -30, width: 3, name: 'Brigade Road' },
  { x1: -HALF, z1: 30, x2: HALF, z2: 30, width: 3, name: 'Residency Road' },
  // Main vertical roads
  { x1: 0, z1: -HALF, x2: 0, z2: HALF, width: 4, name: 'Namma Metro' },
  { x1: -30, z1: -HALF, x2: -30, z2: HALF, width: 3, name: 'Bull Temple Road' },
  { x1: 30, z1: -HALF, x2: 30, z2: HALF, width: 3, name: 'Koramangala Road' },
];

export function createRoads(scene: THREE.Scene): void {
  const roadMat = new THREE.MeshStandardMaterial({
    color: 0x37474f,
    roughness: 0.95,
    stencilWrite: false,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilRef: 1,
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
      0.01, // Slightly above ground
      (road.z1 + road.z2) / 2
    );
    mesh.renderOrder = 1;
    scene.add(mesh);
  }

  // Road markings (dashed center lines)
  const markingMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });
  for (const road of ROADS) {
    const dx = road.x2 - road.x1;
    const dz = road.z2 - road.z1;
    const length = Math.sqrt(dx * dx + dz * dz);
    const isHorizontal = Math.abs(dx) > Math.abs(dz);
    const count = Math.floor(length / 3);

    for (let i = 0; i < count; i += 2) {
      const t = i / count;
      const geom = new THREE.PlaneGeometry(isHorizontal ? 1.5 : 0.1, isHorizontal ? 0.1 : 1.5);
      const marking = new THREE.Mesh(geom, markingMat);
      marking.rotation.x = -Math.PI / 2;
      marking.position.set(
        road.x1 + dx * t,
        0.02,
        road.z1 + dz * t
      );
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
      if (x >= minX && x <= maxX && Math.abs(z - road.z1) < road.width / 2 + buffer) {
        return true;
      }
    } else {
      const minZ = Math.min(road.z1, road.z2);
      const maxZ = Math.max(road.z1, road.z2);
      if (z >= minZ && z <= maxZ && Math.abs(x - road.x1) < road.width / 2 + buffer) {
        return true;
      }
    }
  }
  return false;
}

function isNearRoad(x: number, z: number, dist: number = 5): boolean {
  return isOnRoad(x, z, dist);
}

// Park zones (green areas with more trees, benches, people)
interface ParkZone {
  x: number; z: number; w: number; h: number; name: string;
}

const PARK_ZONES: ParkZone[] = [
  { x: 10, z: -15, w: 25, h: 20, name: 'Cubbon Park' },
  { x: -40, z: 20, w: 20, h: 18, name: 'Lalbagh Garden' },
];

function isInPark(x: number, z: number): boolean {
  for (const park of PARK_ZONES) {
    if (x >= park.x - park.w / 2 && x <= park.x + park.w / 2 &&
        z >= park.z - park.h / 2 && z <= park.z + park.h / 2) {
      return true;
    }
  }
  return false;
}

function createParkGrounds(scene: THREE.Scene): void {
  const parkMat = new THREE.MeshStandardMaterial({
    color: 0x2d6a30, // Darker green for parks
    roughness: 0.95,
  });
  for (const park of PARK_ZONES) {
    const parkGround = new THREE.Mesh(
      new THREE.PlaneGeometry(park.w, park.h),
      parkMat
    );
    parkGround.rotation.x = -Math.PI / 2;
    parkGround.position.set(park.x, 0.005, park.z);
    parkGround.renderOrder = 0;
    scene.add(parkGround);

    // Park border (low fence/hedge)
    const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x1b5e20, flatShading: true });
    const hedgeH = 0.3;
    const sides = [
      { sx: park.w, sz: 0.3, px: park.x, pz: park.z - park.h / 2 },
      { sx: park.w, sz: 0.3, px: park.x, pz: park.z + park.h / 2 },
      { sx: 0.3, sz: park.h, px: park.x - park.w / 2, pz: park.z },
      { sx: 0.3, sz: park.h, px: park.x + park.w / 2, pz: park.z },
    ];
    for (const s of sides) {
      const hedge = new THREE.Mesh(
        new THREE.BoxGeometry(s.sx, hedgeH, s.sz),
        hedgeMat
      );
      hedge.position.set(s.px, hedgeH / 2, s.pz);
      scene.add(hedge);
    }
  }
}

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
  while (placed < count && attempts < count * 5) {
    attempts++;
    const x = randomRange(-HALF + 5, HALF - 5);
    const z = randomRange(-HALF + 5, HALF - 5);
    if (!filter(x, z)) continue;
    // Don't overlap existing objects
    const tooClose = objects.some(
      o => Math.abs(o.x - x) < 2 && Math.abs(o.z - z) < 2
    );
    if (tooClose) continue;

    const obj = factory();
    obj.mesh.position.set(x, 0, z);
    obj.mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(obj.mesh);
    objects.push({
      ...obj,
      x, z,
      consumed: false,
      consuming: false,
      consumeProgress: 0,
      originalY: 0,
      originalScale: 1,
      holeX: 0,
      holeZ: 0,
    });
    placed++;
  }
}

export function populateCity(scene: THREE.Scene): PlacedObject[] {
  const objects: PlacedObject[] = [];

  // Create park grounds first (visual only)
  createParkGrounds(scene);

  // XS tier - lots of small objects
  placeObjects(scene, objects, createTrafficCone, 30, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createPlant, 30);
  placeObjects(scene, objects, createFoodCart, 15, (x, z) => isNearRoad(x, z, 6));
  placeObjects(scene, objects, createLampPost, 25, (x, z) => isNearRoad(x, z, 4));

  // S tier
  placeObjects(scene, objects, createPerson, 40, (x, z) => !isOnRoad(x, z, 0));
  placeObjects(scene, objects, createSmallTree, 20, (x, z) => !isOnRoad(x, z, 1));
  placeObjects(scene, objects, createSmallTree, 15, (x, z) => isInPark(x, z)); // Extra trees in parks
  placeObjects(scene, objects, createBench, 10, (x, z) => isInPark(x, z)); // Benches in parks
  placeObjects(scene, objects, createBench, 8, (x, z) => !isOnRoad(x, z, 1));
  placeObjects(scene, objects, createCoffeeShop, 10, (x, z) => !isOnRoad(x, z, 2));
  placeObjects(scene, objects, createMotorcycle, 15, (x, z) => isNearRoad(x, z, 5));

  // M tier
  placeObjects(scene, objects, createAutoRickshaw, 25, (x, z) => isNearRoad(x, z, 5));
  placeObjects(scene, objects, createCar, 15, (x, z) => isNearRoad(x, z, 4));
  placeObjects(scene, objects, createBanyanTree, 8, (x, z) => isInPark(x, z));
  placeObjects(scene, objects, createBanyanTree, 6, (x, z) => !isOnRoad(x, z, 2));

  // L tier
  placeObjects(scene, objects, createBMTCBus, 8, (x, z) => isNearRoad(x, z, 5));
  placeObjects(scene, objects, createSmallBuilding, 18, (x, z) => !isOnRoad(x, z, 3) && !isInPark(x, z));
  placeObjects(scene, objects, createITPark, 5, (x, z) => !isOnRoad(x, z, 4) && x > 10 && !isInPark(x, z));
  placeObjects(scene, objects, createMetroPillar, 6, (x, z) => isOnRoad(x, z, 0) && Math.abs(x) < 3);

  // XL tier - landmarks at fixed positions
  const landmarks: Array<{ factory: AssetFactory; x: number; z: number }> = [
    { factory: createVidhanaSoudha, x: -35, z: -40 },
    { factory: createBangalorePalace, x: 35, z: -35 },
    { factory: createISKCONTemple, x: 40, z: 40 },
    { factory: createLalbagh, x: -40, z: 20 }, // In Lalbagh Garden park
  ];

  for (const lm of landmarks) {
    const obj = lm.factory();
    obj.mesh.position.set(lm.x, 0, lm.z);
    scene.add(obj.mesh);
    objects.push({
      ...obj,
      x: lm.x,
      z: lm.z,
      consumed: false,
      consuming: false,
      consumeProgress: 0,
      originalY: 0,
      originalScale: 1,
      holeX: 0,
      holeZ: 0,
    });
  }

  return objects;
}
