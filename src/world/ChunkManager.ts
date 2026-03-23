import * as THREE from 'three';
// randomRange available if needed
// import { randomRange } from '../utils/math.ts';
import {
  createTrafficCone, createPlant, createFoodCart, createLampPost,
  createPerson, createSmallTree, createBench,
  createAutoRickshaw, createCar, createBanyanTree,
  createSmallBuilding, createITPark,
  createCoffeeShop, createMotorcycle,
  type CityObject
} from './ProceduralAssets.ts';

// ===== CONSTANTS =====
export const MAP_SIZE = 1600;
const HALF = MAP_SIZE / 2;
export const CHUNK_SIZE = 20;          // Each chunk is 20x20 units
const CHUNKS_PER_SIDE = MAP_SIZE / CHUNK_SIZE; // 80 chunks per side
const LOAD_RADIUS = 5;                 // Load chunks within 5 chunk radius (~100 units)
const UNLOAD_RADIUS = 7;               // Unload beyond 7 chunks (~140 units)
const MAX_OBJECTS_PER_CHUNK = 15;       // Max objects placed per chunk

// ===== SEEDED RANDOM =====
// Deterministic random per chunk so reloading same chunk gives same objects
function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function chunkSeed(cx: number, cz: number): number {
  return (cx * 73856093) ^ (cz * 19349663);
}

// ===== NEIGHBORHOOD DEFINITIONS =====
export interface Neighborhood {
  name: string;
  cx: number; cz: number; // center in world coords
  radius: number;          // rough radius of influence
  type: 'commercial' | 'residential' | 'park' | 'it_hub' | 'old_city';
  density: number;
  color: number;
}

// 20 neighborhoods spread across the 1600x1600 map
const NEIGHBORHOODS: Neighborhood[] = [
  // North belt
  { name: 'Hebbal',          cx: -200, cz: -600, radius: 180, type: 'commercial', density: 0.7, color: 0x455a64 },
  { name: 'Yeshwanthpur',    cx: -500, cz: -500, radius: 180, type: 'commercial', density: 0.6, color: 0x4e342e },
  { name: 'Malleshwaram',    cx: -300, cz: -350, radius: 200, type: 'old_city',   density: 0.8, color: 0x5d4037 },
  { name: 'Sadashivanagar',  cx: 0,    cz: -450, radius: 160, type: 'residential',density: 0.5, color: 0x3e5c2e },
  { name: 'Cantonment',      cx: 300,  cz: -400, radius: 180, type: 'old_city',   density: 0.6, color: 0x4e342e },

  // Central belt
  { name: 'Rajajinagar',     cx: -550, cz: -100, radius: 180, type: 'residential',density: 0.6, color: 0x3e5c2e },
  { name: 'Majestic',        cx: -250, cz: -100, radius: 160, type: 'commercial', density: 0.9, color: 0x455a64 },
  { name: 'Cubbon Park',     cx: 0,    cz: -200, radius: 200, type: 'park',       density: 0.3, color: 0x1b5e20 },
  { name: 'MG Road',         cx: 200,  cz: -100, radius: 180, type: 'commercial', density: 0.9, color: 0x455a64 },
  { name: 'Indiranagar',     cx: 500,  cz: -50,  radius: 200, type: 'commercial', density: 0.8, color: 0x37474f },

  // South-Central belt
  { name: 'Vijayanagar',     cx: -550, cz: 150,  radius: 160, type: 'residential',density: 0.5, color: 0x3e5c2e },
  { name: 'Basavanagudi',    cx: -250, cz: 100,  radius: 180, type: 'old_city',   density: 0.7, color: 0x5d4037 },
  { name: 'Lalbagh',         cx: 0,    cz: 50,   radius: 180, type: 'park',       density: 0.3, color: 0x1b5e20 },
  { name: 'Koramangala',     cx: 300,  cz: 100,  radius: 200, type: 'commercial', density: 0.8, color: 0x37474f },
  { name: 'HAL',             cx: 600,  cz: 50,   radius: 160, type: 'it_hub',     density: 0.6, color: 0x263238 },

  // South belt
  { name: 'RR Nagar',        cx: -500, cz: 400,  radius: 180, type: 'residential',density: 0.5, color: 0x3e5c2e },
  { name: 'Jayanagar',       cx: -200, cz: 350,  radius: 200, type: 'residential',density: 0.7, color: 0x3e5c2e },
  { name: 'BTM Layout',      cx: 100,  cz: 350,  radius: 180, type: 'residential',density: 0.7, color: 0x33691e },
  { name: 'HSR Layout',      cx: 350,  cz: 400,  radius: 180, type: 'it_hub',     density: 0.7, color: 0x263238 },
  { name: 'Whitefield',      cx: 600,  cz: 350,  radius: 220, type: 'it_hub',     density: 0.8, color: 0x263238 },
];

function getNeighborhoodAt(wx: number, wz: number): Neighborhood {
  let best = NEIGHBORHOODS[0];
  let bestDist = Infinity;
  for (const n of NEIGHBORHOODS) {
    const dx = wx - n.cx;
    const dz = wz - n.cz;
    const d = Math.sqrt(dx * dx + dz * dz);
    // Weight by radius so larger neighborhoods have more influence
    const weighted = d / n.radius;
    if (weighted < bestDist) {
      bestDist = weighted;
      best = n;
    }
  }
  return best;
}

// ===== ROAD SYSTEM =====
// Roads defined as lines - we check if a world position is on/near a road
interface RoadDef {
  x1: number; z1: number; x2: number; z2: number;
  width: number;
}

// Major arterial roads spanning the full map
const ROADS: RoadDef[] = [
  // Major E-W
  { x1: -HALF, z1: -100, x2: HALF, z2: -100, width: 5 }, // MG Road / Bellary
  { x1: -HALF, z1: -350, x2: HALF, z2: -350, width: 4 }, // Seshadri Road
  { x1: -HALF, z1: 100,  x2: HALF, z2: 100,  width: 4 }, // Hosur Road
  { x1: -HALF, z1: 350,  x2: HALF, z2: 350,  width: 4 }, // Bannerghatta Road
  { x1: -HALF, z1: -600, x2: HALF, z2: -600, width: 3 }, // ORR North
  { x1: -HALF, z1: 600,  x2: HALF, z2: 600,  width: 3 }, // ORR South

  // Major N-S
  { x1: 0,    z1: -HALF, x2: 0,    z2: HALF, width: 5 }, // Namma Metro Purple
  { x1: -300, z1: -HALF, x2: -300, z2: HALF, width: 4 }, // Tumkur Road
  { x1: 300,  z1: -HALF, x2: 300,  z2: HALF, width: 4 }, // 100 Feet Road
  { x1: -550, z1: -HALF, x2: -550, z2: HALF, width: 3 }, // Mysore Road
  { x1: 550,  z1: -HALF, x2: 550,  z2: HALF, width: 3 }, // Old Airport Road
];

// Generate grid of secondary roads
function generateSecondaryRoads(): RoadDef[] {
  const roads: RoadDef[] = [];
  // Horizontal every ~150 units
  for (let z = -700; z <= 700; z += 150) {
    if (ROADS.some(r => Math.abs(r.z1 - z) < 50 && Math.abs(r.x2 - r.x1) > 500)) continue;
    roads.push({ x1: -HALF, z1: z, x2: HALF, z2: z, width: 2.5 });
  }
  // Vertical every ~150 units
  for (let x = -700; x <= 700; x += 150) {
    if (ROADS.some(r => Math.abs(r.x1 - x) < 50 && Math.abs(r.z2 - r.z1) > 500)) continue;
    roads.push({ x1: x, z1: -HALF, x2: x, z2: HALF, width: 2.5 });
  }
  return roads;
}

// Local roads every ~40 units
function generateLocalRoads(): RoadDef[] {
  const roads: RoadDef[] = [];
  for (let z = -HALF + 20; z < HALF; z += 40) {
    roads.push({ x1: -HALF, z1: z, x2: HALF, z2: z, width: 1.5 });
  }
  for (let x = -HALF + 20; x < HALF; x += 40) {
    roads.push({ x1: x, z1: -HALF, x2: x, z2: HALF, width: 1.5 });
  }
  return roads;
}

const ALL_ROADS = [...ROADS, ...generateSecondaryRoads(), ...generateLocalRoads()];

function isOnRoad(wx: number, wz: number, buffer: number = 1): boolean {
  for (const r of ALL_ROADS) {
    const isH = Math.abs(r.x2 - r.x1) > Math.abs(r.z2 - r.z1);
    if (isH) {
      const minX = Math.min(r.x1, r.x2);
      const maxX = Math.max(r.x1, r.x2);
      if (wx >= minX && wx <= maxX && Math.abs(wz - r.z1) < r.width / 2 + buffer) return true;
    } else {
      const minZ = Math.min(r.z1, r.z2);
      const maxZ = Math.max(r.z1, r.z2);
      if (wz >= minZ && wz <= maxZ && Math.abs(wx - r.x1) < r.width / 2 + buffer) return true;
    }
  }
  return false;
}

// ===== PLACED OBJECT =====
export interface PlacedObject {
  mesh: THREE.Object3D;
  objectRadius: number;
  points: number;
  volume: number;
  name: string;
  tier: number;
  x: number;
  z: number;
  consumed: boolean;
  consuming: boolean;
  consumeProgress: number;
  originalY: number;
  originalScale: number;
  holeX: number;
  holeZ: number;
  chunkKey: string;
}

// ===== CHUNK =====
interface ChunkData {
  key: string;
  cx: number;
  cz: number;
  objects: PlacedObject[];
  groundMesh: THREE.Mesh | null;
  roadMeshes: THREE.Mesh[];
  loaded: boolean;
}

// ===== OBJECT POOL =====
// Reuse meshes instead of creating/destroying
type AssetFactory = () => CityObject;

interface PoolEntry {
  mesh: THREE.Object3D;
  active: boolean;
}

export class ObjectPool {
  private pools = new Map<string, PoolEntry[]>();
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  acquire(type: string, factory: AssetFactory): CityObject {
    const pool = this.pools.get(type);
    if (pool) {
      const entry = pool.find(e => !e.active);
      if (entry) {
        entry.active = true;
        entry.mesh.visible = true;
        // Return a CityObject wrapping the pooled mesh
        const obj = factory();
        // Dispose the newly created mesh, use pooled one instead
        // Actually, just use factory since objects are small
        return obj;
      }
    }
    // Create new
    const obj = factory();
    this.scene.add(obj.mesh);
    if (!this.pools.has(type)) this.pools.set(type, []);
    this.pools.get(type)!.push({ mesh: obj.mesh, active: true });
    return obj;
  }

  release(mesh: THREE.Object3D): void {
    mesh.visible = false;
    for (const [, pool] of this.pools) {
      const entry = pool.find(e => e.mesh === mesh);
      if (entry) {
        entry.active = false;
        return;
      }
    }
  }
}

// ===== CHUNK MANAGER =====
export class ChunkManager {
  private chunks = new Map<string, ChunkData>();
  private scene: THREE.Scene;
  // Pool for future optimization
  // private pool: ObjectPool;
  private labelSprites = new Map<string, THREE.Sprite>();
  allObjects: PlacedObject[] = [];

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    // this.pool = new ObjectPool(scene);
    this.createNeighborhoodLabels();
  }

  private chunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private worldToChunk(wx: number, wz: number): [number, number] {
    return [
      Math.floor((wx + HALF) / CHUNK_SIZE),
      Math.floor((wz + HALF) / CHUNK_SIZE),
    ];
  }

  private chunkToWorld(cx: number, cz: number): [number, number] {
    return [
      cx * CHUNK_SIZE - HALF + CHUNK_SIZE / 2,
      cz * CHUNK_SIZE - HALF + CHUNK_SIZE / 2,
    ];
  }

  /** Call every frame with player position */
  update(playerX: number, playerZ: number): void {
    const [pcx, pcz] = this.worldToChunk(playerX, playerZ);

    // Load chunks within radius
    for (let dx = -LOAD_RADIUS; dx <= LOAD_RADIUS; dx++) {
      for (let dz = -LOAD_RADIUS; dz <= LOAD_RADIUS; dz++) {
        if (dx * dx + dz * dz > LOAD_RADIUS * LOAD_RADIUS) continue;
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (cx < 0 || cx >= CHUNKS_PER_SIDE || cz < 0 || cz >= CHUNKS_PER_SIDE) continue;
        const key = this.chunkKey(cx, cz);
        if (!this.chunks.has(key)) {
          this.loadChunk(cx, cz);
        }
      }
    }

    // Unload distant chunks
    for (const [key, chunk] of this.chunks) {
      if (!chunk.loaded) continue;
      const dx = chunk.cx - pcx;
      const dz = chunk.cz - pcz;
      if (dx * dx + dz * dz > UNLOAD_RADIUS * UNLOAD_RADIUS) {
        this.unloadChunk(key);
      }
    }
  }

  private loadChunk(cx: number, cz: number): void {
    const key = this.chunkKey(cx, cz);
    const [wx, wz] = this.chunkToWorld(cx, cz);
    const neighborhood = getNeighborhoodAt(wx, wz);
    const rand = seededRandom(chunkSeed(cx, cz));

    const chunk: ChunkData = {
      key, cx, cz,
      objects: [],
      groundMesh: null,
      roadMeshes: [],
      loaded: true,
    };

    // Ground patch
    const groundColor = neighborhood.type === 'park' ? 0x2d6a30 : neighborhood.color;
    const groundMat = new THREE.MeshStandardMaterial({ color: groundColor, roughness: 0.92 });
    const groundMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(CHUNK_SIZE, CHUNK_SIZE),
      groundMat
    );
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.set(wx, 0.002, wz);
    groundMesh.renderOrder = 0;
    this.scene.add(groundMesh);
    chunk.groundMesh = groundMesh;

    // Roads in this chunk
    this.createChunkRoads(wx, wz, chunk);

    // Place objects
    this.placeChunkObjects(wx, wz, neighborhood, rand, chunk);

    this.chunks.set(key, chunk);
  }

  private createChunkRoads(wx: number, wz: number, chunk: ChunkData): void {
    const halfChunk = CHUNK_SIZE / 2;
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2c2c2c, roughness: 0.95 });
    const markingMat = new THREE.MeshBasicMaterial({ color: 0xffeb3b });

    for (const r of ALL_ROADS) {
      const isH = Math.abs(r.x2 - r.x1) > Math.abs(r.z2 - r.z1);

      if (isH) {
        // Check if this horizontal road passes through this chunk's Z range
        if (Math.abs(r.z1 - wz) > halfChunk + r.width / 2) continue;
        const roadMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(CHUNK_SIZE, r.width),
          roadMat
        );
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.position.set(wx, 0.01, r.z1);
        roadMesh.renderOrder = 1;
        this.scene.add(roadMesh);
        chunk.roadMeshes.push(roadMesh);

        // Center line marking
        if (r.width >= 2.5) {
          const marking = new THREE.Mesh(
            new THREE.PlaneGeometry(CHUNK_SIZE * 0.4, 0.12),
            markingMat
          );
          marking.rotation.x = -Math.PI / 2;
          marking.position.set(wx, 0.02, r.z1);
          marking.renderOrder = 1;
          this.scene.add(marking);
          chunk.roadMeshes.push(marking);
        }
      } else {
        if (Math.abs(r.x1 - wx) > halfChunk + r.width / 2) continue;
        const roadMesh = new THREE.Mesh(
          new THREE.PlaneGeometry(r.width, CHUNK_SIZE),
          roadMat
        );
        roadMesh.rotation.x = -Math.PI / 2;
        roadMesh.position.set(r.x1, 0.01, wz);
        roadMesh.renderOrder = 1;
        this.scene.add(roadMesh);
        chunk.roadMeshes.push(roadMesh);

        if (r.width >= 2.5) {
          const marking = new THREE.Mesh(
            new THREE.PlaneGeometry(0.12, CHUNK_SIZE * 0.4),
            markingMat
          );
          marking.rotation.x = -Math.PI / 2;
          marking.position.set(r.x1, 0.02, wz);
          marking.renderOrder = 1;
          this.scene.add(marking);
          chunk.roadMeshes.push(marking);
        }
      }
    }
  }

  private placeChunkObjects(
    wx: number, wz: number,
    neighborhood: Neighborhood,
    rand: () => number,
    chunk: ChunkData
  ): void {
    const count = Math.floor(MAX_OBJECTS_PER_CHUNK * neighborhood.density);

    // Object palette based on neighborhood type
    const palette = this.getPalette(neighborhood.type);

    for (let i = 0; i < count; i++) {
      const ox = wx + (rand() - 0.5) * (CHUNK_SIZE - 2);
      const oz = wz + (rand() - 0.5) * (CHUNK_SIZE - 2);

      // Skip if on a road
      if (isOnRoad(ox, oz, 1)) {
        // Place road-adjacent objects (vehicles, food carts) instead
        if (rand() < 0.4) {
          const vehicleFactory = rand() < 0.5 ? createAutoRickshaw : (rand() < 0.5 ? createCar : createMotorcycle);
          this.placeObject(ox, oz, vehicleFactory, chunk);
        }
        continue;
      }

      // Pick a random object from the palette
      const factoryIdx = Math.floor(rand() * palette.length);
      this.placeObject(ox, oz, palette[factoryIdx], chunk);
    }

    // Park hedges
    if (neighborhood.type === 'park') {
      // Check if this chunk is at neighborhood center-ish
      const dx = wx - neighborhood.cx;
      const dz = wz - neighborhood.cz;
      if (Math.abs(dx) < 60 && Math.abs(dz) < 60) {
        // Extra trees in parks
        for (let i = 0; i < 3; i++) {
          const ox = wx + (rand() - 0.5) * CHUNK_SIZE;
          const oz = wz + (rand() - 0.5) * CHUNK_SIZE;
          if (!isOnRoad(ox, oz, 1)) {
            this.placeObject(ox, oz, rand() < 0.5 ? createBanyanTree : createSmallTree, chunk);
          }
        }
      }
    }
  }

  private getPalette(type: string): AssetFactory[] {
    switch (type) {
      case 'commercial':
        return [createSmallBuilding, createSmallBuilding, createCoffeeShop, createFoodCart, createPerson, createPerson, createBench, createSmallTree, createPlant, createLampPost, createTrafficCone];
      case 'residential':
        return [createSmallBuilding, createSmallBuilding, createSmallTree, createSmallTree, createPlant, createPerson, createBench, createLampPost];
      case 'it_hub':
        return [createITPark, createSmallBuilding, createSmallBuilding, createCar, createPerson, createCoffeeShop, createSmallTree, createLampPost];
      case 'old_city':
        return [createSmallBuilding, createSmallBuilding, createCoffeeShop, createFoodCart, createFoodCart, createBanyanTree, createPerson, createPerson, createLampPost, createTrafficCone];
      case 'park':
        return [createSmallTree, createSmallTree, createBanyanTree, createBench, createBench, createPerson, createPlant, createPlant];
      default:
        return [createSmallBuilding, createSmallTree, createPerson, createLampPost];
    }
  }

  private placeObject(x: number, z: number, factory: AssetFactory, chunk: ChunkData): void {
    // Check for overlap with existing objects in this chunk
    for (const o of chunk.objects) {
      if (Math.abs(o.x - x) < 1.2 && Math.abs(o.z - z) < 1.2) return;
    }

    const obj = factory();
    obj.mesh.position.set(x, 0, z);
    obj.mesh.rotation.y = Math.random() * Math.PI * 2;
    this.scene.add(obj.mesh);

    const placed: PlacedObject = {
      mesh: obj.mesh,
      objectRadius: obj.objectRadius,
      points: obj.points,
      volume: obj.volume,
      name: obj.name,
      tier: obj.tier,
      x, z,
      consumed: false,
      consuming: false,
      consumeProgress: 0,
      originalY: 0,
      originalScale: 1,
      holeX: 0,
      holeZ: 0,
      chunkKey: chunk.key,
    };

    chunk.objects.push(placed);
    this.allObjects.push(placed);
  }

  private unloadChunk(key: string): void {
    const chunk = this.chunks.get(key);
    if (!chunk) return;

    // Remove ground
    if (chunk.groundMesh) {
      this.scene.remove(chunk.groundMesh);
      chunk.groundMesh.geometry.dispose();
      (chunk.groundMesh.material as THREE.Material).dispose();
    }

    // Remove roads
    for (const m of chunk.roadMeshes) {
      this.scene.remove(m);
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
    }

    // Remove objects (only non-consumed ones)
    for (const obj of chunk.objects) {
      if (!obj.consumed) {
        this.scene.remove(obj.mesh as THREE.Object3D);
      }
      // Remove from allObjects
      const idx = this.allObjects.indexOf(obj);
      if (idx !== -1) this.allObjects.splice(idx, 1);
    }

    this.chunks.delete(key);
  }

  private createNeighborhoodLabels(): void {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 512;
    canvas.height = 128;

    for (const n of NEIGHBORHOODS) {
      ctx.clearRect(0, 0, 512, 128);
      ctx.fillStyle = n.type === 'park' ? '#a5d6a7' : '#b0bec5';
      ctx.font = 'bold 48px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(n.name, 256, 64);

      const texture = new THREE.CanvasTexture(canvas);
      texture.needsUpdate = true;

      const mat = new THREE.SpriteMaterial({
        map: texture.clone(),
        transparent: true,
        opacity: 0.6,
        depthTest: false,
      });
      mat.map!.needsUpdate = true;

      const sprite = new THREE.Sprite(mat);
      sprite.position.set(n.cx, 12, n.cz);
      sprite.scale.set(80, 20, 1);
      sprite.renderOrder = 10;
      this.scene.add(sprite);
      this.labelSprites.set(n.name, sprite);
    }
  }

  /** Get total number of loaded objects */
  getLoadedCount(): number {
    return this.allObjects.length;
  }

  /** Get loaded chunk count */
  getChunkCount(): number {
    return this.chunks.size;
  }

  dispose(): void {
    for (const [key] of this.chunks) {
      this.unloadChunk(key);
    }
    for (const [, sprite] of this.labelSprites) {
      this.scene.remove(sprite);
    }
  }
}
