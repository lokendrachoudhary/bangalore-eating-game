import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
}

const MAX_PARTICLES = 100;

export class ParticleSystem {
  private particles: Particle[] = [];
  private pool: THREE.Mesh[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;

    // Pre-allocate particle meshes
    const geom = new THREE.SphereGeometry(0.08, 4, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xbcaaa4,
      transparent: true,
    });

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const mesh = new THREE.Mesh(geom, mat.clone());
      mesh.visible = false;
      scene.add(mesh);
      this.pool.push(mesh);
    }
  }

  /** Burst particles at a position (e.g., when an object is consumed) */
  burst(x: number, y: number, z: number, count: number = 8, color: number = 0xbcaaa4): void {
    for (let i = 0; i < count; i++) {
      const mesh = this.pool.pop();
      if (!mesh) return;

      mesh.visible = true;
      mesh.position.set(x, y + 0.2, z);
      (mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
      (mesh.material as THREE.MeshBasicMaterial).opacity = 1;

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 2 + Math.random() * 3;
      const upSpeed = 2 + Math.random() * 3;

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3(
          Math.cos(angle) * speed,
          upSpeed,
          Math.sin(angle) * speed
        ),
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;

      if (p.life >= p.maxLife) {
        p.mesh.visible = false;
        this.pool.push(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }

      const t = p.life / p.maxLife;

      // Move
      p.mesh.position.x += p.velocity.x * dt;
      p.mesh.position.y += p.velocity.y * dt;
      p.mesh.position.z += p.velocity.z * dt;

      // Gravity
      p.velocity.y -= 10 * dt;

      // Fade out
      (p.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;

      // Shrink
      const scale = 1 - t * 0.5;
      p.mesh.scale.set(scale, scale, scale);
    }
  }

  dispose(): void {
    for (const p of this.particles) {
      this.scene.remove(p.mesh);
    }
    for (const m of this.pool) {
      this.scene.remove(m);
    }
    this.particles = [];
    this.pool = [];
  }
}
