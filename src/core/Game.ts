import * as THREE from 'three';
import { GameLoop } from './GameLoop.ts';
import { InputManager } from './InputManager.ts';
import { createRenderer, createCamera, createScene } from '../rendering/SceneSetup.ts';
import { HoleRenderer } from '../rendering/HoleRenderer.ts';
import { createRoads, populateCity, MAP_SIZE, type PlacedObject } from '../world/CityMap.ts';
import { canEat, getCurrentTier, TIER_NAMES } from '../world/SizeTier.ts';
import { ParticleSystem } from '../rendering/ParticleSystem.ts';
import { AudioManager } from './AudioManager.ts';
import { lerp, clamp, distance2D, randomRange } from '../utils/math.ts';

interface AIHole {
  renderer: HoleRenderer;
  x: number;
  z: number;
  radius: number;
  totalVolume: number;
  score: number;
  speed: number;
  targetX: number;
  targetZ: number;
  name: string;
  color: string;
}

const BOT_NAMES = [
  'MG Road Muncher', 'Koramangala Crusher', 'Indiranagar Eater',
  'Whitefield Gobbler', 'Jayanagar Chomper',
];

const BOT_COLORS = ['#e91e63', '#ff9800', '#9c27b0', '#00bcd4', '#8bc34a'];

const ROUND_DURATION = 120; // 2 minutes
const BASE_RADIUS = 1.5;
const VOLUME_SCALE = 50;
const HALF_MAP = MAP_SIZE / 2;

export class Game {
  private renderer!: THREE.WebGLRenderer;
  private camera!: THREE.PerspectiveCamera;
  private scene!: THREE.Scene;
  private loop!: GameLoop;
  private input!: InputManager;

  private playerHole!: HoleRenderer;
  private playerX = 0;
  private playerZ = 0;
  private playerRadius = BASE_RADIUS;
  private totalVolume = 0;
  private score = 0;
  private speed = 15;

  private aiHoles: AIHole[] = [];
  private objects: PlacedObject[] = [];
  private particles!: ParticleSystem;
  private audio = new AudioManager();
  private lastTier = 0;

  private timer = ROUND_DURATION;
  private gameState: 'menu' | 'playing' | 'gameover' = 'menu';

  // UI elements
  private timerEl!: HTMLElement;
  private scoreEl!: HTMLElement;
  private sizeEl!: HTMLElement;
  private hudEl!: HTMLElement;
  private leaderboardEl!: HTMLElement;
  private menuEl!: HTMLElement;
  private gameOverEl!: HTMLElement;
  private finalScoreEl!: HTMLElement;
  private finalRankEl!: HTMLElement;

  async init(): Promise<void> {
    const container = document.getElementById('game-container')!;
    this.renderer = createRenderer(container);
    this.camera = createCamera();
    this.scene = createScene();
    this.input = new InputManager();

    // UI references
    this.timerEl = document.getElementById('timer')!;
    this.scoreEl = document.getElementById('score')!;
    this.sizeEl = document.getElementById('size-label')!;
    this.hudEl = document.getElementById('hud')!;
    this.leaderboardEl = document.getElementById('leaderboard')!;
    this.menuEl = document.getElementById('main-menu')!;
    this.gameOverEl = document.getElementById('game-over')!;
    this.finalScoreEl = document.getElementById('final-score')!;
    this.finalRankEl = document.getElementById('final-rank')!;

    // Button handlers
    document.getElementById('play-btn')!.addEventListener('click', () => this.startGame());
    document.getElementById('restart-btn')!.addEventListener('click', () => this.startGame());

    // Game loop
    this.loop = new GameLoop(
      (dt) => this.update(dt),
      (_alpha) => this.render()
    );
    this.loop.start();
  }

  private startGame(): void {
    // Clear previous game objects
    this.clearScene();

    // Ground
    const ground = HoleRenderer.createGround(MAP_SIZE + 40);
    this.scene.add(ground);

    // Roads
    createRoads(this.scene);

    // Map boundary visual
    this.createBoundary();

    // Populate city
    this.objects = populateCity(this.scene);

    // Particle system
    this.particles = new ParticleSystem(this.scene);

    // Player hole
    this.playerHole = new HoleRenderer();
    this.scene.add(this.playerHole.group);
    this.playerX = 0;
    this.playerZ = 10;
    this.playerRadius = BASE_RADIUS;
    this.totalVolume = 0;
    this.score = 0;
    this.speed = 15;
    this.lastTier = 0;
    this.playerHole.setPosition(this.playerX, this.playerZ);
    this.playerHole.setRadius(this.playerRadius);

    // AI holes
    this.aiHoles = [];
    const botRimColors = [0xe91e63, 0xff9800, 0x9c27b0, 0x00bcd4, 0x8bc34a];
    for (let i = 0; i < 4; i++) {
      const holeRenderer = new HoleRenderer(botRimColors[i]);
      this.scene.add(holeRenderer.group);

      const angle = (i / 4) * Math.PI * 2;
      const dist = 25;
      this.aiHoles.push({
        renderer: holeRenderer,
        x: Math.cos(angle) * dist,
        z: Math.sin(angle) * dist,
        radius: BASE_RADIUS,
        totalVolume: 0,
        score: 0,
        speed: 10 + Math.random() * 5,
        targetX: 0,
        targetZ: 0,
        name: BOT_NAMES[i],
        color: BOT_COLORS[i],
      });
    }

    // Timer
    this.timer = ROUND_DURATION;

    // UI
    this.gameState = 'playing';
    this.menuEl.style.display = 'none';
    this.gameOverEl.style.display = 'none';
    this.hudEl.style.display = 'flex';
    this.leaderboardEl.style.display = 'block';
  }

  private clearScene(): void {
    // Remove all objects except lights and fog
    const toRemove: THREE.Object3D[] = [];
    this.scene.traverse((child) => {
      if (child instanceof THREE.Mesh || child instanceof THREE.Group) {
        toRemove.push(child);
      }
    });
    for (const obj of toRemove) {
      obj.removeFromParent();
    }
    // Rebuild scene
    this.scene = createScene();
  }

  private createBoundary(): void {
    const mat = new THREE.MeshBasicMaterial({ color: 0x1a237e, transparent: true, opacity: 0.3 });
    const thickness = 2;
    const h = 3;
    const positions = [
      { x: 0, z: -HALF_MAP, sx: MAP_SIZE + 4, sz: thickness }, // North
      { x: 0, z: HALF_MAP, sx: MAP_SIZE + 4, sz: thickness },  // South
      { x: -HALF_MAP, z: 0, sx: thickness, sz: MAP_SIZE + 4 }, // West
      { x: HALF_MAP, z: 0, sx: thickness, sz: MAP_SIZE + 4 },  // East
    ];
    for (const p of positions) {
      const wall = new THREE.Mesh(
        new THREE.BoxGeometry(p.sx, h, p.sz),
        mat
      );
      wall.position.set(p.x, h / 2, p.z);
      wall.renderOrder = 3;
      this.scene.add(wall);
    }
  }

  private update(dt: number): void {
    if (this.gameState !== 'playing') return;

    // Timer
    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = 0;
      this.endGame();
      return;
    }

    // Player movement
    const move = this.input.getMovement();
    // Speed scales down slightly as hole gets bigger
    const moveSpeed = this.speed * (1 - this.playerRadius * 0.01);
    this.playerX += move.x * moveSpeed * dt;
    this.playerZ += move.z * moveSpeed * dt;

    // Clamp to map
    this.playerX = clamp(this.playerX, -HALF_MAP + 2, HALF_MAP - 2);
    this.playerZ = clamp(this.playerZ, -HALF_MAP + 2, HALF_MAP - 2);

    this.playerHole.setPosition(this.playerX, this.playerZ);

    // Check consumption
    this.checkConsumption(this.playerX, this.playerZ, this.playerRadius, true);

    // Update consuming animations
    this.updateConsumingAnimations(dt);

    // Update particles
    this.particles.update(dt);

    // Check player eating AI holes
    this.checkHoleVsHole();

    // Update AI
    this.updateAI(dt);

    // Update camera
    this.updateCamera(dt);

    // Update HUD
    this.updateHUD();
  }

  private checkHoleVsHole(): void {
    for (const ai of this.aiHoles) {
      if (!ai.renderer.group.visible) continue;

      const dist = distance2D(this.playerX, this.playerZ, ai.x, ai.z);

      // Player eats AI
      if (this.playerRadius > ai.radius * 1.3 && dist < this.playerRadius * 0.6) {
        ai.renderer.group.visible = false;
        this.totalVolume += ai.totalVolume * 0.5;
        this.playerRadius = BASE_RADIUS * Math.pow(1 + this.totalVolume / VOLUME_SCALE, 1 / 3);
        this.playerHole.setRadius(this.playerRadius);
        this.score += 200;
        this.particles.burst(ai.x, 0.1, ai.z, 15, 0xff5252);
        this.audio.playBigEat();
        this.showScorePopup(ai.x, ai.z, 200);
      }

      // AI eats player (respawn player)
      if (ai.radius > this.playerRadius * 1.3 && dist < ai.radius * 0.6) {
        // Respawn at random location
        this.playerX = randomRange(-HALF_MAP + 10, HALF_MAP - 10);
        this.playerZ = randomRange(-HALF_MAP + 10, HALF_MAP - 10);
        this.totalVolume = Math.max(0, this.totalVolume * 0.3);
        this.playerRadius = BASE_RADIUS * Math.pow(1 + this.totalVolume / VOLUME_SCALE, 1 / 3);
        this.playerHole.setRadius(this.playerRadius);
        this.score = Math.max(0, this.score - 100);
        this.particles.burst(this.playerX, 0.1, this.playerZ, 10, 0x4fc3f7);
        this.audio.playDeath();
      }
    }
  }

  private checkConsumption(holeX: number, holeZ: number, holeRadius: number, isPlayer: boolean): number {
    let consumed = 0;
    for (const obj of this.objects) {
      if (obj.consumed || obj.consuming) continue;
      if (!canEat(holeRadius, obj.tier)) continue;

      const dist = distance2D(holeX, holeZ, obj.x, obj.z);
      if (dist < holeRadius * 0.7) {
        obj.consuming = true;
        obj.consumeProgress = 0;
        obj.originalY = obj.mesh.position.y;
        obj.originalScale = 1;
        obj.holeX = holeX;
        obj.holeZ = holeZ;

        // Dust particle burst
        this.particles.burst(obj.x, 0.1, obj.z, 6 + obj.tier * 2, 0xbcaaa4);

        if (isPlayer) {
          this.totalVolume += obj.volume;
          this.playerRadius = BASE_RADIUS * Math.pow(1 + this.totalVolume / VOLUME_SCALE, 1 / 3);
          this.playerHole.setRadius(this.playerRadius);
          this.score += obj.points;
          this.audio.playEat(obj.tier);
          // Check for tier up
          const newTier = getCurrentTier(this.playerRadius);
          if (newTier > this.lastTier) {
            this.lastTier = newTier;
            this.audio.playTierUp();
          }
          // Floating score popup
          this.showScorePopup(obj.x, obj.z, obj.points);
        }
        consumed++;
      }
    }
    return consumed;
  }

  private updateConsumingAnimations(dt: number): void {
    for (const obj of this.objects) {
      if (!obj.consuming) continue;

      obj.consumeProgress += dt * 2.5; // 0.4 second animation

      if (obj.consumeProgress >= 1) {
        obj.consumed = true;
        obj.consuming = false;
        obj.mesh.visible = false;
      } else {
        const t = obj.consumeProgress;
        // Scale down
        const scale = 1 - t;
        obj.mesh.scale.set(scale, scale, scale);
        // Pull toward hole center
        obj.mesh.position.x = lerp(obj.x, obj.holeX, t * t);
        obj.mesh.position.z = lerp(obj.z, obj.holeZ, t * t);
        // Move down into the hole
        obj.mesh.position.y = obj.originalY - t * t * 4;
        // Spin as it falls in
        obj.mesh.rotation.y += dt * (8 + t * 15);
      }
    }
  }

  private scorePopups: Array<{ el: HTMLDivElement; life: number }> = [];

  private showScorePopup(x: number, z: number, points: number): void {
    const div = document.createElement('div');
    div.textContent = `+${points}`;
    div.style.cssText = `
      position: absolute; font-family: system-ui; font-size: 20px; font-weight: 900;
      color: #ffeb3b; text-shadow: 0 2px 4px rgba(0,0,0,0.5);
      pointer-events: none; z-index: 20; transition: transform 0.8s, opacity 0.8s;
      transform: translateY(0px); opacity: 1;
    `;

    // Project 3D to screen
    const vec = new THREE.Vector3(x, 2, z);
    vec.project(this.camera);
    const sx = (vec.x * 0.5 + 0.5) * window.innerWidth;
    const sy = (-vec.y * 0.5 + 0.5) * window.innerHeight;
    div.style.left = `${sx}px`;
    div.style.top = `${sy}px`;

    document.getElementById('ui-overlay')!.appendChild(div);

    // Animate up and fade
    requestAnimationFrame(() => {
      div.style.transform = 'translateY(-60px)';
      div.style.opacity = '0';
    });

    this.scorePopups.push({ el: div, life: 0 });

    // Clean up after animation
    setTimeout(() => {
      div.remove();
      this.scorePopups = this.scorePopups.filter(p => p.el !== div);
    }, 900);
  }

  private updateAI(dt: number): void {
    for (const ai of this.aiHoles) {
      // Find nearest edible target
      const distToTarget = distance2D(ai.x, ai.z, ai.targetX, ai.targetZ);
      if (distToTarget < 2 || Math.random() < 0.02) {
        // Pick new target
        let bestObj: PlacedObject | null = null;
        let bestDist = Infinity;
        for (const obj of this.objects) {
          if (obj.consumed || obj.consuming) continue;
          if (!canEat(ai.radius, obj.tier)) continue;
          const d = distance2D(ai.x, ai.z, obj.x, obj.z);
          if (d < bestDist) {
            bestDist = d;
            bestObj = obj;
          }
        }
        if (bestObj) {
          ai.targetX = bestObj.x;
          ai.targetZ = bestObj.z;
        } else {
          ai.targetX = randomRange(-HALF_MAP + 10, HALF_MAP - 10);
          ai.targetZ = randomRange(-HALF_MAP + 10, HALF_MAP - 10);
        }
      }

      // Avoid player if player is bigger
      let avoidX = 0, avoidZ = 0;
      if (this.playerRadius > ai.radius * 1.3) {
        const distToPlayer = distance2D(ai.x, ai.z, this.playerX, this.playerZ);
        if (distToPlayer < this.playerRadius * 3) {
          const dx = ai.x - this.playerX;
          const dz = ai.z - this.playerZ;
          const mag = Math.sqrt(dx * dx + dz * dz) || 1;
          avoidX = (dx / mag) * 2;
          avoidZ = (dz / mag) * 2;
        }
      }

      // Move toward target
      const dx = ai.targetX - ai.x + avoidX;
      const dz = ai.targetZ - ai.z + avoidZ;
      const dist = Math.sqrt(dx * dx + dz * dz) || 1;
      const moveSpeed = ai.speed * (1 - ai.radius * 0.008);

      ai.x += (dx / dist) * moveSpeed * dt;
      ai.z += (dz / dist) * moveSpeed * dt;
      ai.x = clamp(ai.x, -HALF_MAP + 2, HALF_MAP - 2);
      ai.z = clamp(ai.z, -HALF_MAP + 2, HALF_MAP - 2);

      ai.renderer.setPosition(ai.x, ai.z);

      // AI consumption
      for (const obj of this.objects) {
        if (obj.consumed || obj.consuming) continue;
        if (!canEat(ai.radius, obj.tier)) continue;
        const d = distance2D(ai.x, ai.z, obj.x, obj.z);
        if (d < ai.radius * 0.7) {
          obj.consuming = true;
          obj.consumeProgress = 0;
          obj.originalY = obj.mesh.position.y;
          obj.holeX = ai.x;
          obj.holeZ = ai.z;
          this.particles.burst(obj.x, 0.1, obj.z, 4, 0xbcaaa4);
          ai.totalVolume += obj.volume;
          ai.radius = BASE_RADIUS * Math.pow(1 + ai.totalVolume / VOLUME_SCALE, 1 / 3);
          ai.renderer.setRadius(ai.radius);
          ai.score += obj.points;
        }
      }
    }
  }

  private updateCamera(_dt: number): void {
    // Camera height and distance scale with hole size
    const targetHeight = 15 + this.playerRadius * 3;
    const targetBack = 10 + this.playerRadius * 2;

    this.camera.position.x = lerp(this.camera.position.x, this.playerX, 0.05);
    this.camera.position.z = lerp(this.camera.position.z, this.playerZ + targetBack, 0.05);
    this.camera.position.y = lerp(this.camera.position.y, targetHeight, 0.05);

    this.camera.lookAt(
      lerp(this.camera.position.x, this.playerX, 0.5),
      0,
      lerp(this.camera.position.z - targetBack, this.playerZ, 0.5)
    );
  }

  private updateHUD(): void {
    // Timer
    const mins = Math.floor(this.timer / 60);
    const secs = Math.floor(this.timer % 60);
    this.timerEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

    // Score
    this.scoreEl.textContent = `Score: ${this.score}`;

    // Size tier
    const tier = getCurrentTier(this.playerRadius);
    this.sizeEl.textContent = `Size: ${TIER_NAMES[tier]}`;

    // Leaderboard
    const entries = [
      { name: 'You', score: this.score, isPlayer: true },
      ...this.aiHoles.map(ai => ({ name: ai.name, score: ai.score, isPlayer: false })),
    ].sort((a, b) => b.score - a.score);

    this.leaderboardEl.innerHTML = '<h3>Leaderboard</h3>' +
      entries.map((e, i) =>
        `<div class="lb-entry${e.isPlayer ? ' player' : ''}">`
        + `<span>${i + 1}. ${e.name}</span>`
        + `<span>${e.score}</span></div>`
      ).join('');
  }

  private endGame(): void {
    this.gameState = 'gameover';
    this.audio.playGameOver();

    const entries = [
      { name: 'You', score: this.score, isPlayer: true },
      ...this.aiHoles.map(ai => ({ name: ai.name, score: ai.score, isPlayer: false })),
    ].sort((a, b) => b.score - a.score);

    const rank = entries.findIndex(e => e.isPlayer) + 1;

    this.finalScoreEl.textContent = `Score: ${this.score}`;
    this.finalRankEl.textContent = `Rank: #${rank} of ${entries.length}`;

    this.hudEl.style.display = 'none';
    this.leaderboardEl.style.display = 'none';
    this.gameOverEl.style.display = 'flex';
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera);
  }
}
