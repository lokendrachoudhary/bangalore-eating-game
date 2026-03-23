import * as THREE from 'three';

export function createRenderer(container: HTMLElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = false;
  renderer.setClearColor(0x8ec8e8); // Warm Bangalore sky
  container.insertBefore(renderer.domElement, container.firstChild);

  window.addEventListener('resize', () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return renderer;
}

export function createCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );
  // Start with a top-down-ish view
  camera.position.set(0, 25, 20);
  camera.lookAt(0, 0, 0);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  return camera;
}

export function createScene(): THREE.Scene {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x8ec8e8, 100, 250);

  // Warm ambient light (Bangalore's golden sunlight)
  const ambient = new THREE.AmbientLight(0xfff8e1, 0.6);
  scene.add(ambient);

  // Warm directional sun light
  const sun = new THREE.DirectionalLight(0xfff3e0, 0.9);
  sun.position.set(50, 80, 30);
  scene.add(sun);

  // Fill light from below for better visibility
  const fill = new THREE.HemisphereLight(0x87ceeb, 0x4a7c59, 0.3);
  scene.add(fill);

  return scene;
}
