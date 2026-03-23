# Bangalore Eating Game

## Overview
A Hole.io-style 3D city eating game set in Bangalore, India. Players control a black hole that roams the city, swallowing auto-rickshaws, BMTC buses, IT parks, and iconic landmarks like Vidhana Soudha. The map is 1600x1600 units with chunk-based streaming.

## Tech Stack
- **Rendering:** Three.js (WebGL)
- **Build:** Vite 6 + TypeScript (strict mode)
- **Audio:** Web Audio API (procedural sounds, no files)
- **Mobile:** Capacitor 6 (planned)
- **Architecture:** Chunk-streaming world with procedural generation

## Project Structure
```
src/
  main.ts                  - Entry point, bootstraps the game
  core/
    Game.ts                - Main game orchestrator (update loop, state, UI)
    GameLoop.ts            - Fixed-timestep loop (60Hz physics, display-rate render)
    InputManager.ts        - Keyboard (WASD/arrows) + touch (floating joystick)
    AudioManager.ts        - Procedural Web Audio sound effects
    EventBus.ts            - Typed pub/sub for game events
  rendering/
    SceneSetup.ts          - Camera, lights, fog, renderer init
    HoleRenderer.ts        - Black hole visual (dark circle + rim + interior)
    ParticleSystem.ts      - Dust particle bursts on consumption (pooled)
  world/
    ChunkManager.ts        - ★ Chunk streaming system (load/unload 20x20 chunks)
    CityMap.ts             - Legacy city map (kept for reference)
    ProceduralAssets.ts    - All 20 Bangalore-themed 3D object factories
    SizeTier.ts            - Size tier constants and helpers
  utils/
    math.ts                - lerp, clamp, distance2D, randomRange
public/assets/             - Reserved for future GLB models, textures, audio
```

## Key Technical Details

### Chunk Streaming System (ChunkManager.ts)
The world is divided into 20x20 unit chunks (6,400 total for the 1600x1600 map).
- **Load radius:** 5 chunks (~100 units) around the player
- **Unload radius:** 7 chunks (~140 units) - chunks beyond this are disposed
- **~80 chunks loaded at any time** out of 6,400 total
- **Seeded random per chunk:** `chunkSeed(cx, cz)` ensures the same chunk always generates the same objects, so re-entering an area looks consistent
- Each chunk creates: ground patch (colored by neighborhood), road segments, and 5-15 objects based on neighborhood type and density

### Neighborhood System
20 Bangalore neighborhoods with Voronoi-like assignment:
- Each neighborhood has: name, center position, radius, type, density, ground color
- Types: `commercial`, `residential`, `park`, `it_hub`, `old_city`
- Object palette varies by type (IT parks in tech hubs, food carts in old city, etc.)

### Hole Rendering
Dark circle on the ground with depth illusion:
1. Dark surface circle (renderOrder 1)
2. Inverted hemisphere below ground (depth effect)
3. Colored rim ring (dark navy for player, colored for AI bots)
4. Inner gradient ring (edge depth illusion)

### Consumption Logic (Visual/Radius-Based)
Each object has an `objectRadius` (e.g., traffic cone = 0.2, auto-rickshaw = 0.7, building = 1.5).
- **Can eat:** `holeRadius >= object.objectRadius`
- **Triggers when:** object center is within `1.0x holeRadius`
- **Gravitational pull:** objects within `2.0x holeRadius` are pulled toward center at 6% per frame
- **Growth formula:** `radius = 2.0 × (1 + totalVolume / 50) ^ (1/3)`

### Object Size Reference
| Object | objectRadius | Points | Volume |
|--------|-------------|--------|--------|
| Traffic Cone | 0.2 | 10 | 1 |
| Lamp Post | 0.15 | 10 | 1 |
| Person | 0.2 | 25 | 3 |
| Plant | 0.3 | 10 | 1 |
| Motorcycle | 0.4 | 30 | 4 |
| Bench | 0.5 | 20 | 3 |
| Food Cart | 0.5 | 15 | 2 |
| Small Tree | 0.6 | 20 | 4 |
| Auto Rickshaw | 0.7 | 50 | 12 |
| Coffee Shop | 0.8 | 30 | 5 |
| Car | 0.9 | 40 | 15 |
| Building | 1.5 | 80 | 40 |
| Metro Pillar | 1.5 | 90 | 45 |
| Banyan Tree | 1.8 | 35 | 10 |
| BMTC Bus | 1.8 | 100 | 50 |
| IT Park | 2.0 | 120 | 60 |
| ISKCON Temple | 3.5 | 500 | 200 |
| Bangalore Palace | 4.0 | 500 | 200 |
| Lalbagh Glasshouse | 4.0 | 500 | 200 |
| Vidhana Soudha | 5.0 | 500 | 200 |

### Road System
Auto-generated grid covering the 1600x1600 map:
- **Major arteries** (width 4-5): MG Road, Namma Metro, Tumkur Road, 100 Feet Road, etc.
- **Secondary roads** (width 2.5): every ~150 units
- **Local roads** (width 1.5): every ~40 units
- Roads are rendered per-chunk (only visible road segments are drawn)

### AI Bots
4 AI opponents with steering behaviors:
- Seek nearest edible object
- Avoid larger holes
- Chase smaller holes
- Names: MG Road Muncher, Koramangala Crusher, Indiranagar Eater, Whitefield Gobbler

### Game Features
- 2-minute timed rounds with leaderboard
- Hole-vs-hole mechanic (bigger eats smaller)
- Particle dust effects on consumption
- Floating score popups (+10, +50, etc.)
- SIZE UP! notification on tier progression
- Minimap (local 200-unit view around player)
- Procedural audio (eat, tier-up, death, game over sounds)
- Sound toggle button
- Keyboard (WASD/arrows) and touch controls

## Commands
```bash
npm install          # Install dependencies
npm run dev          # Start dev server (Vite HMR)
npm run build        # Production build to dist/
npm run preview      # Preview production build
npx gh-pages -d dist # Deploy to GitHub Pages
```

## Deployment
- **GitHub Pages:** https://lokendrachoudhary.github.io/bangalore-eating-game/
- **GitHub Repo:** https://github.com/lokendrachoudhary/bangalore-eating-game

## Current Status
- Phase 1: MVP Core - COMPLETE
- Phase 2: Bangalore City Map - COMPLETE (1600x1600 with chunk streaming)
- Phase 3: AI Opponents - COMPLETE
- Phase 4: Mobile (Capacitor) - Pending
- Phase 5: Polish & Expansion - IN PROGRESS

## Next Steps
- InstancedMesh for repeated objects (trees, cones, people) to reduce draw calls
- Level of Detail (LOD): billboard sprites for distant objects
- Sidewalks along roads, compound walls between buildings
- More landmarks (Bull Temple, Bangalore Fort, UB City, Nandi Hills)
- Additional cities (Delhi, Mumbai)
- Capacitor wrapping for Android/iOS
