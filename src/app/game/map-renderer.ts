import { GameEngine } from './engine';
import { Territory } from './types';

export class MapRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private engine: GameEngine;

  // Camera & Viewport
  public cameraX = 1200;
  public cameraY = 700;
  public zoom = 0.85;
  private isDragging = false;
  private dragStartX = 0;
  private dragStartY = 0;
  private cameraStartX = 0;
  private cameraStartY = 0;

  // Hover & Selection state
  public hoveredTerritoryId: string | null = null;
  private animTimer = 0;

  // Particle bursts for battles
  private particles: { x: number; y: number; vx: number; vy: number; color: string; life: number; maxLife: number }[] = [];

  constructor(canvas: HTMLCanvasElement, engine: GameEngine) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D Canvas Context not available');
    this.ctx = ctx;
    this.engine = engine;

    this.setupListeners();
    this.centerCamera();
  }

  public setCanvasSize(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.ctx.scale(dpr, dpr);
  }

  public centerCamera() {
    this.cameraX = 1200;
    this.cameraY = 700;
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      this.zoom = Math.min(rect.width / 2400, rect.height / 1400) * 1.15;
      this.zoom = Math.max(0.45, Math.min(1.8, this.zoom));
    }
  }

  public focusTerritory(territoryId: string) {
    const terr = this.engine.territories.find(t => t.id === territoryId);
    if (terr) {
      this.cameraX = terr.center[0];
      this.cameraY = terr.center[1];
    }
  }

  private setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
    window.addEventListener('mousemove', (e) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.canvas.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Connect engine battle hook to spawn particles
    this.engine.onBattleOccurred = (notif) => {
      const terr = this.engine.territories.find(t => t.id === notif.targetTerritoryId);
      if (terr) {
        this.spawnBattleSparks(terr.center[0], terr.center[1]);
      }
    };
  }

  public screenToWorld(screenX: number, screenY: number): [number, number] {
    const rect = this.canvas.getBoundingClientRect();
    const cssX = screenX - rect.left;
    const cssY = screenY - rect.top;

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const worldX = this.cameraX + (cssX - centerX) / this.zoom;
    const worldY = this.cameraY + (cssY - centerY) / this.zoom;
    return [worldX, worldY];
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button === 0 || e.button === 1 || e.button === 2) {
      this.isDragging = true;
      this.dragStartX = e.clientX;
      this.dragStartY = e.clientY;
      this.cameraStartX = this.cameraX;
      this.cameraStartY = this.cameraY;
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (this.isDragging) {
      const dx = (e.clientX - this.dragStartX) / this.zoom;
      const dy = (e.clientY - this.dragStartY) / this.zoom;
      this.cameraX = this.cameraStartX - dx;
      this.cameraY = this.cameraStartY - dy;
      return;
    }

    // Hit test hovered territory
    const [wx, wy] = this.screenToWorld(e.clientX, e.clientY);
    this.hoveredTerritoryId = this.findTerritoryAt(wx, wy);
  }

  private onMouseUp() {
    this.isDragging = false;
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
    const newZoom = Math.max(0.35, Math.min(2.5, this.zoom * zoomFactor));

    // Zoom centered around mouse position
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;

    this.cameraX += mouseX / this.zoom - mouseX / newZoom;
    this.cameraY += mouseY / this.zoom - mouseY / newZoom;
    this.zoom = newZoom;
  }

  public handleMapClick(clientX: number, clientY: number): Territory | null {
    const [wx, wy] = this.screenToWorld(clientX, clientY);
    const terrId = this.findTerritoryAt(wx, wy);
    if (!terrId) return null;
    return this.engine.territories.find(t => t.id === terrId) || null;
  }

  public findTerritoryAt(wx: number, wy: number): string | null {
    // Fast bounding box check then polygon raycast
    for (const t of this.engine.territories) {
      if (
        wx >= t.bounds.minX - 10 &&
        wx <= t.bounds.maxX + 10 &&
        wy >= t.bounds.minY - 10 &&
        wy <= t.bounds.maxY + 10
      ) {
        if (this.pointInPolygon(wx, wy, t.polygon)) {
          return t.id;
        }
      }
    }
    // Fallback: nearest center within 50px
    let nearestId: string | null = null;
    let nearestDist = 55;
    for (const t of this.engine.territories) {
      const dx = t.center[0] - wx;
      const dy = t.center[1] - wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestId = t.id;
      }
    }
    return nearestId;
  }

  private pointInPolygon(x: number, y: number, poly: [number, number][]): boolean {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const xi = poly[i][0];
      const yi = poly[i][1];
      const xj = poly[j][0];
      const yj = poly[j][1];
      const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }

  private spawnBattleSparks(x: number, y: number) {
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 80;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: Math.random() > 0.5 ? '#f59e0b' : '#ef4444',
        life: 0.5 + Math.random() * 0.4,
        maxLife: 0.9,
      });
    }
  }

  /**
   * Main render call invoked each frame
   */
  public render(dt: number) {
    this.animTimer += dt;
    const rect = this.canvas.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;

    const ctx = this.ctx;
    ctx.save();
    ctx.clearRect(0, 0, width, height);

    // 1. Draw Deep Oceanic Tactical Background
    this.drawOceanBackdrop(width, height);

    // Apply World Camera Transformation
    ctx.translate(width / 2, height / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.cameraX, -this.cameraY);

    // 2. Draw Adjacency Connections / Maritime Straits
    this.drawConnections();

    // 3. Draw Territory Polygons & Borders
    this.drawTerritories();

    // 4. Draw Territory Center Badges, Troops, and Buildings
    this.drawTerritoryBadges();

    // 5. Draw Active Troop Marches
    this.drawTroopMarches();

    // 6. Draw Combat Particles
    this.drawParticles(dt);

    ctx.restore();
  }

  private drawOceanBackdrop(width: number, height: number) {
    const ctx = this.ctx;
    const grad = ctx.createRadialGradient(width / 2, height / 2, 80, width / 2, height / 2, width);
    grad.addColorStop(0, '#0b1329');
    grad.addColorStop(0.5, '#070d1e');
    grad.addColorStop(1, '#030712');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    // Subtle tactical coordinate grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.04)';
    ctx.lineWidth = 1;
    const gridSize = 100 * this.zoom;
    const offsetX = (width / 2 - this.cameraX * this.zoom) % gridSize;
    const offsetY = (height / 2 - this.cameraY * this.zoom) % gridSize;

    ctx.beginPath();
    for (let x = offsetX; x < width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = offsetY; y < height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
  }

  private drawConnections() {
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 6]);

    const renderedPairs = new Set<string>();

    for (const terr of this.engine.territories) {
      for (const nId of terr.neighboringTerritoryIds) {
        const key = [terr.id, nId].sort().join('_');
        if (renderedPairs.has(key)) continue;
        renderedPairs.add(key);

        const neighbor = this.engine.territories.find(t => t.id === nId);
        if (!neighbor) continue;

        ctx.beginPath();
        ctx.moveTo(terr.center[0], terr.center[1]);
        ctx.lineTo(neighbor.center[0], neighbor.center[1]);
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
  }

  private drawTerritories() {
    const ctx = this.ctx;
    const selectedTerr = this.engine.selectedTerritoryId
      ? this.engine.territories.find(t => t.id === this.engine.selectedTerritoryId)
      : null;
    const isPlayerSelected = selectedTerr && selectedTerr.ownerId === this.engine.playerNationId;

    for (const terr of this.engine.territories) {
      const isSelected = terr.id === this.engine.selectedTerritoryId;
      const isHovered = terr.id === this.hoveredTerritoryId;
      const isAdjacentTarget =
        isPlayerSelected &&
        selectedTerr.neighboringTerritoryIds.includes(terr.id) &&
        terr.ownerId !== this.engine.playerNationId;

      const owner = terr.ownerId ? this.engine.nations.get(terr.ownerId) : null;

      // Base territory color
      let fillColor = '#1e293b'; // Neutral dark slate
      let strokeColor = '#334155';
      const lineWidth = 1.5;

      if (owner) {
        fillColor = owner.color;
        strokeColor = owner.borderColor;
      }

      // Draw Polygon Fill
      ctx.beginPath();
      ctx.moveTo(terr.polygon[0][0], terr.polygon[0][1]);
      for (let i = 1; i < terr.polygon.length; i++) {
        ctx.lineTo(terr.polygon[i][0], terr.polygon[i][1]);
      }
      ctx.closePath();

      // Semi-transparent fill with slight gradient/shading
      ctx.save();
      ctx.fillStyle = fillColor;
      ctx.globalAlpha = owner ? 0.65 : 0.45;
      if (isSelected) ctx.globalAlpha = 0.85;
      if (isHovered && !isSelected) ctx.globalAlpha = 0.75;
      ctx.fill();

      // Terrain subtle pattern / tint
      if (terr.terrainType === 'mountains') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fill();
      } else if (terr.terrainType === 'hills') {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.fill();
      }

      ctx.restore();

      // Draw Polygon Stroke
      ctx.save();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = lineWidth;

      if (isAdjacentTarget) {
        // Glowing target border for valid attack options
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 10;
        ctx.setLineDash([8, 4]);
      } else if (isSelected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3.5;
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur = 12;
      } else if (isHovered) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2.5;
      }

      ctx.stroke();
      ctx.restore();

      // Radar pulse ring on selected territory
      if (isSelected) {
        const pulse = (Math.sin(this.animTimer * 4) + 1) * 0.5;
        ctx.save();
        ctx.strokeStyle = 'rgba(56, 189, 248, ' + (0.3 + pulse * 0.5) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(terr.center[0], terr.center[1], 45 + pulse * 12, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }
  }

  private drawTerritoryBadges() {
    const ctx = this.ctx;

    for (const terr of this.engine.territories) {
      const [cx, cy] = terr.center;
      const owner = terr.ownerId ? this.engine.nations.get(terr.ownerId) : null;
      const isPlayer = terr.ownerId === this.engine.playerNationId;

      ctx.save();
      ctx.translate(cx, cy);

      // Center pill badge
      const badgeWidth = 62;
      const badgeHeight = 26;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.strokeStyle = isPlayer ? '#34d399' : owner ? owner.borderColor : '#64748b';
      ctx.lineWidth = isPlayer ? 2 : 1;

      ctx.beginPath();
      ctx.roundRect(-badgeWidth / 2, -badgeHeight / 2, badgeWidth, badgeHeight, 6);
      ctx.fill();
      ctx.stroke();

      // Capital Star Icon
      if (terr.isCapital) {
        ctx.fillStyle = '#facc15';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('★', -badgeWidth / 2 + 10, 0);
      }

      // Troop Count Text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = terr.isCapital ? 'left' : 'center';
      ctx.textBaseline = 'middle';
      const textX = terr.isCapital ? -badgeWidth / 2 + 18 : 0;
      const troopStr = Math.round(terr.troopCount).toLocaleString();
      ctx.fillText(troopStr, textX, 0);

      // Territory Name above badge
      ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(terr.name, 0, -badgeHeight / 2 - 4);

      // Building Icons below badge
      if (terr.buildings.length > 0) {
        let bx = -((terr.buildings.length - 1) * 14) / 2;
        for (const b of terr.buildings) {
          ctx.beginPath();
          ctx.arc(bx, badgeHeight / 2 + 8, 5, 0, Math.PI * 2);

          if (b.type === 'city') {
            ctx.fillStyle = b.completed ? '#38bdf8' : '#64748b'; // Blue city
          } else if (b.type === 'defense_post') {
            ctx.fillStyle = b.completed ? '#f59e0b' : '#64748b'; // Amber shield
          } else {
            ctx.fillStyle = b.completed ? '#ef4444' : '#64748b'; // Red military base
          }
          ctx.fill();

          // Progress ring if constructing
          if (!b.completed) {
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(bx, badgeHeight / 2 + 8, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * b.constructionProgress);
            ctx.stroke();
          }

          bx += 14;
        }
      }

      ctx.restore();
    }
  }

  private drawTroopMarches() {
    const ctx = this.ctx;

    for (const march of this.engine.activeMarches) {
      const attacker = this.engine.nations.get(march.attackerNationId);
      const color = attacker ? attacker.color : '#f59e0b';

      // Current position along curved path
      const p = march.progress;
      const sx = march.startPos[0];
      const sy = march.startPos[1];
      const tx = march.targetPos[0];
      const ty = march.targetPos[1];

      // Quadratic curve midpoint with perpendicular offset
      const mx = (sx + tx) / 2 - (ty - sy) * 0.15;
      const my = (sy + ty) / 2 + (tx - sx) * 0.15;

      // Bezier point formula: B(t) = (1-t)^2*P0 + 2(1-t)t*P1 + t^2*P2
      const cx = (1 - p) * (1 - p) * sx + 2 * (1 - p) * p * mx + p * p * tx;
      const cy = (1 - p) * (1 - p) * sy + 2 * (1 - p) * p * my + p * p * ty;

      // Draw March Trajectory Dash Line
      ctx.save();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.globalAlpha = 0.55;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo(mx, my, tx, ty);
      ctx.stroke();
      ctx.restore();

      // Draw Marching Head (Chevron / Circle + Troops Count)
      ctx.save();
      ctx.translate(cx, cy);

      // Outer glow circle
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();

      // Troops counter badge
      ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
      ctx.beginPath();
      ctx.roundRect(-24, -22, 48, 16, 4);
      ctx.fill();

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${march.troopCount}`, 0, -14);

      ctx.restore();
    }
  }

  private drawParticles(dt: number) {
    const ctx = this.ctx;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;

      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}
