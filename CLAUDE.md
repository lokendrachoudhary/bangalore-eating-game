# Bangalore Eating Game

## Overview
A Hole.io-style 3D city eating game set in Bangalore, India. Players control a black hole that roams the city, swallowing auto-rickshaws, BMTC buses, IT parks, and iconic landmarks like Vidhana Soudha.

## Tech Stack
- **Rendering:** Three.js (WebGL/WebGPU)
- **Physics:** Rapier.js (Rust→WASM, 3-5x faster than JS alternatives)
- **Build:** Vite 6 + TypeScript (strict mode)
- **Audio:** Howler.js
- **Mobile:** Capacitor 6 (Android + iOS)
- **Architecture:** Lightweight Entity-Component-System (ECS)

## Project Structure
```
src/
  main.ts              - Entry point, bootstraps the game
  core/                - Game loop, input, asset loading, audio, events
  ecs/                 - Entity-Component-System framework
  components/          - ECS components (Transform, Mesh, Physics, Hole, AI, etc.)
  systems/             - ECS systems (Physics, Movement, Growth, Swallow, AI, Render, etc.)
  rendering/           - Three.js scene setup, hole stencil effect, shaders, object pool
  world/               - City map loading, object placement, size tiers
  physics/             - Rapier.js world init, collision groups, hole collider
  ui/                  - HTML/CSS overlay: HUD, menus, leaderboard
  utils/               - Math helpers, platform detection, performance monitoring
public/assets/         - 3D models (GLB), textures, audio, map configs
```

## Key Technical Details

### Hole Rendering (Stencil Buffer)
The black hole effect uses Three.js stencil buffer, NOT mesh deformation:
1. Circle mesh writes to stencil buffer (renderOrder 0)
2. Ground plane skips stencil=1 pixels (renderOrder 1)
3. Dark hemisphere renders only in stencil=1 area (renderOrder 2)
4. All other objects render normally (renderOrder 3)

### Game Loop
Fixed timestep at 60Hz for physics, render at display refresh rate. Physics state is interpolated for smooth visuals.

### Object Size Tiers
- XS (radius 1-2): traffic cones, plants, food carts
- S (radius 2-4): people, benches, motorcycles
- M (radius 4-7): auto-rickshaws, cars, bus stops
- L (radius 7-12): BMTC buses, small buildings
- XL (radius 12+): Vidhana Soudha, Bangalore Palace, ISKCON Temple

### Art Style
Low-poly colorful with exaggerated Bangalore color palettes. Procedural Three.js geometries for MVP, replaceable with GLB models later.

## Commands
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite)
npm run build        # Production build
npm run preview      # Preview production build
```

## Current Status
- Phase 1: MVP Core - IN PROGRESS
- Phase 2: Bangalore City Map - Pending
- Phase 3: AI Opponents - Pending
- Phase 4: Mobile (Capacitor) - Pending
- Phase 5: Polish & Expansion - Pending
