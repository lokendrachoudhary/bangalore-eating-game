import * as THREE from 'three';

/**
 * Creates the black hole visual effect.
 *
 * Simplified approach: Instead of complex stencil operations,
 * we use a dark circle on the ground with a gradient shader
 * and a slightly recessed interior to create depth illusion.
 * This is more reliable across devices and still looks great.
 */
export class HoleRenderer {
  readonly group: THREE.Group;

  private holeSurface: THREE.Mesh;
  private holeInterior: THREE.Mesh;
  private rim: THREE.Mesh;
  private innerRim: THREE.Mesh;

  private currentRadius = 1.5;

  constructor(rimColor: number = 0x1a1a2e) {
    this.group = new THREE.Group();

    // 1. Dark hole surface (flat circle on ground)
    const surfaceGeom = new THREE.CircleGeometry(1, 64);
    const surfaceMat = new THREE.MeshBasicMaterial({
      color: 0x050505,
      depthWrite: true,
    });
    this.holeSurface = new THREE.Mesh(surfaceGeom, surfaceMat);
    this.holeSurface.rotation.x = -Math.PI / 2;
    this.holeSurface.position.y = 0.03;
    this.holeSurface.renderOrder = 1;
    this.group.add(this.holeSurface);

    // 2. Interior bowl (inverted half-sphere below ground to show depth)
    const interiorGeom = new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const interiorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
    });
    this.holeInterior = new THREE.Mesh(interiorGeom, interiorMat);
    this.holeInterior.rotation.x = Math.PI;
    this.holeInterior.position.y = -0.05;
    this.holeInterior.renderOrder = 0;
    this.group.add(this.holeInterior);

    // 3. Outer rim ring (dark edge)
    const rimGeom = new THREE.RingGeometry(0.92, 1.0, 64);
    const rimMat = new THREE.MeshBasicMaterial({
      color: rimColor,
      side: THREE.DoubleSide,
    });
    this.rim = new THREE.Mesh(rimGeom, rimMat);
    this.rim.rotation.x = -Math.PI / 2;
    this.rim.position.y = 0.04;
    this.rim.renderOrder = 2;
    this.group.add(this.rim);

    // 4. Inner gradient ring (creates depth illusion at edge)
    const innerRimGeom = new THREE.RingGeometry(0.7, 0.95, 64);
    const innerRimMat = new THREE.MeshBasicMaterial({
      color: 0x111122,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    this.innerRim = new THREE.Mesh(innerRimGeom, innerRimMat);
    this.innerRim.rotation.x = -Math.PI / 2;
    this.innerRim.position.y = 0.035;
    this.innerRim.renderOrder = 1;
    this.group.add(this.innerRim);

    this.setRadius(this.currentRadius);
  }

  setRadius(radius: number): void {
    this.currentRadius = radius;
    this.holeSurface.scale.set(radius, radius, 1);
    this.holeInterior.scale.set(radius, radius * 0.5, radius);
    this.rim.scale.set(radius, radius, 1);
    this.innerRim.scale.set(radius, radius, 1);
  }

  getRadius(): number {
    return this.currentRadius;
  }

  setPosition(x: number, z: number): void {
    this.group.position.set(x, 0, z);
  }

  /**
   * Creates the ground plane.
   */
  static createGround(size: number): THREE.Mesh {
    const geom = new THREE.PlaneGeometry(size, size);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x4a7c59, // Grass green
      roughness: 0.9,
    });
    const ground = new THREE.Mesh(geom, mat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0;
    ground.renderOrder = 0;
    return ground;
  }
}
