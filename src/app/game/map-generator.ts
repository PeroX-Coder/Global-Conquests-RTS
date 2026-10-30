import { Territory, TerrainType } from './types';
import { GAME_BALANCE } from './balance';

interface ContinentSeed {
  name: string;
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  count: number;
}

export function generateWorldMap(preset: 'world' | 'archipelago' | 'pangaea' = 'world'): Territory[] {
  const width = 2400;
  const height = 1400;

  let continents: ContinentSeed[] = [];

  if (preset === 'world') {
    continents = [
      { name: 'Northland', cx: 620, cy: 420, rx: 380, ry: 260, count: 18 },
      { name: 'Eurania', cx: 1240, cy: 400, rx: 320, ry: 240, count: 16 },
      { name: 'Orientia', cx: 1820, cy: 460, rx: 360, ry: 280, count: 20 },
      { name: 'Austral', cx: 1800, cy: 1040, rx: 280, ry: 200, count: 10 },
      { name: 'Africana', cx: 1260, cy: 900, rx: 280, ry: 300, count: 16 },
      { name: 'Occident', cx: 720, cy: 980, rx: 260, ry: 280, count: 14 },
    ];
  } else if (preset === 'archipelago') {
    continents = [
      { name: 'Zephyr Isles', cx: 480, cy: 400, rx: 240, ry: 200, count: 12 },
      { name: 'Solaris Atolls', cx: 1000, cy: 380, rx: 260, ry: 220, count: 13 },
      { name: 'Dragon Archipelago', cx: 1600, cy: 420, rx: 280, ry: 220, count: 14 },
      { name: 'Pearl Islands', cx: 550, cy: 950, rx: 240, ry: 220, count: 12 },
      { name: 'Azure Reefs', cx: 1150, cy: 950, rx: 250, ry: 210, count: 13 },
      { name: 'Coral Reach', cx: 1850, cy: 950, rx: 260, ry: 230, count: 14 },
    ];
  } else {
    // Pangaea - one colossal interconnected landmass
    continents = [
      { name: 'Greater Pangaea North', cx: 1200, cy: 500, rx: 650, ry: 350, count: 38 },
      { name: 'Greater Pangaea South', cx: 1200, cy: 920, rx: 620, ry: 320, count: 36 },
    ];
  }

  // Generate seed points inside continent ellipses with jitter
  const points: { x: number; y: number; region: string; terrain: TerrainType }[] = [];
  const terrainDistribution: TerrainType[] = ['plains', 'plains', 'coastal', 'hills', 'mountains'];

  let idCounter = 1;
  for (const c of continents) {
    for (let i = 0; i < c.count; i++) {
      // Rejection sampling inside continent ellipse with noisy boundary
      let valid = false;
      let x = 0;
      let y = 0;
      let attempts = 0;
      while (!valid && attempts < 50) {
        attempts++;
        const angle = Math.random() * Math.PI * 2;
        const rad = Math.sqrt(Math.random()) * 0.9;
        const noise = 0.85 + Math.random() * 0.3;
        x = c.cx + Math.cos(angle) * c.rx * rad * noise;
        y = c.cy + Math.sin(angle) * c.ry * rad * noise;

        // Ensure minimum distance from existing points
        const tooClose = points.some(p => {
          const dx = p.x - x;
          const dy = p.y - y;
          return Math.sqrt(dx * dx + dy * dy) < 85;
        });

        if (!tooClose && x > 80 && x < width - 80 && y > 80 && y < height - 80) {
          valid = true;
        }
      }

      if (valid) {
        const terrain = terrainDistribution[Math.floor(Math.random() * terrainDistribution.length)];
        points.push({ x, y, region: c.name, terrain });
      }
    }
  }

  // Generate Voronoi-like convex polygons around points
  const territories: Territory[] = [];

  for (const p of points) {
    const poly: [number, number][] = [];
    const numVerts = 7 + Math.floor(Math.random() * 4); // 7 to 10 vertices
    const baseRadius = 55 + Math.random() * 25;

    for (let v = 0; v < numVerts; v++) {
      const angle = (v / numVerts) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
      const r = baseRadius * (0.8 + Math.random() * 0.4);
      poly.push([
        Math.round(p.x + Math.cos(angle) * r),
        Math.round(p.y + Math.sin(angle) * r)
      ]);
    }

    // Compute bounding box
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [vx, vy] of poly) {
      if (vx < minX) minX = vx;
      if (vy < minY) minY = vy;
      if (vx > maxX) maxX = vx;
      if (vy > maxY) maxY = vy;
    }

    const terrId = `T${idCounter++}`;
    const terrainDef = GAME_BALANCE.TERRAIN_DEFENSE[p.terrain];
    const econValue = p.terrain === 'plains' ? 2.0 : p.terrain === 'coastal' ? 2.5 : p.terrain === 'hills' ? 1.5 : 1.0;
    const initialTroops = Math.floor(
      GAME_BALANCE.NEUTRAL_MIN_GARRISON +
      Math.random() * (GAME_BALANCE.NEUTRAL_MAX_GARRISON - GAME_BALANCE.NEUTRAL_MIN_GARRISON)
    );

    territories.push({
      id: terrId,
      name: `${p.region.split(' ')[0]} ${idCounter - 1}`,
      region: p.region,
      polygon: poly,
      center: [Math.round(p.x), Math.round(p.y)],
      bounds: { minX, minY, maxX, maxY },
      ownerId: null, // Neutral
      neighboringTerritoryIds: [],
      terrainType: p.terrain,
      economicValue: econValue,
      defenseMultiplier: terrainDef,
      troopCount: initialTroops,
      buildings: [],
      isCapital: false,
    });
  }

  // Calculate Neighbors using proximity & Delaunay-like k-nearest graph
  // Guarantee each territory has 3 to 7 neighbors and the graph is connected
  for (let i = 0; i < territories.length; i++) {
    const tA = territories[i];
    const distances: { id: string; dist: number }[] = [];

    for (let j = 0; j < territories.length; j++) {
      if (i === j) continue;
      const tB = territories[j];
      const dx = tA.center[0] - tB.center[0];
      const dy = tA.center[1] - tB.center[1];
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Max connection distance threshold
      if (dist < 260) {
        distances.push({ id: tB.id, dist });
      }
    }

    distances.sort((a, b) => a.dist - b.dist);
    // Connect to at least 3 closest, and up to 5 within range
    const toConnect = distances.slice(0, Math.min(distances.length, Math.max(3, 5)));
    for (const c of toConnect) {
      if (!tA.neighboringTerritoryIds.includes(c.id)) {
        tA.neighboringTerritoryIds.push(c.id);
      }
      const neighbor = territories.find(t => t.id === c.id);
      if (neighbor && !neighbor.neighboringTerritoryIds.includes(tA.id)) {
        neighbor.neighboringTerritoryIds.push(tA.id);
      }
    }
  }

  // Ensure inter-continental bridges (naval/strait connections between closest inter-continental points)
  for (let i = 0; i < continents.length; i++) {
    for (let j = i + 1; j < continents.length; j++) {
      const cA = continents[i];
      const cB = continents[j];
      const terrsA = territories.filter(t => t.region === cA.name);
      const terrsB = territories.filter(t => t.region === cB.name);

      if (terrsA.length === 0 || terrsB.length === 0) continue;

      let bestDist = Infinity;
      let pair: [Territory, Territory] | null = null;

      for (const a of terrsA) {
        for (const b of terrsB) {
          const dx = a.center[0] - b.center[0];
          const dy = a.center[1] - b.center[1];
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < bestDist) {
            bestDist = dist;
            pair = [a, b];
          }
        }
      }

      // If within 480 distance, bridge the continents
      if (pair && bestDist < 480) {
        if (!pair[0].neighboringTerritoryIds.includes(pair[1].id)) {
          pair[0].neighboringTerritoryIds.push(pair[1].id);
        }
        if (!pair[1].neighboringTerritoryIds.includes(pair[0].id)) {
          pair[1].neighboringTerritoryIds.push(pair[0].id);
        }
      }
    }
  }

  return territories;
}
