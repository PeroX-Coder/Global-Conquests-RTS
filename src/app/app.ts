import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameEngine } from './game/engine';
import { MapRenderer } from './game/map-renderer';
import { soundSynth } from './game/sound-synth';
import {
  BuildingType,
  Difficulty,
  GameConfig,
  GameStatistics,
  MatchStatus,
  Nation,
  Territory,
  BattleNotification,
} from './game/types';
import { GAME_BALANCE } from './game/balance';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapCanvas', { static: false }) mapCanvasRef!: ElementRef<HTMLCanvasElement>;

  // Game Engine & Renderer
  public engine: GameEngine;
  private renderer: MapRenderer | null = null;
  private animFrameId: number | null = null;
  private lastTime = 0;

  // Game Config Form Signals
  public aiCount = signal<number>(30);
  public difficulty = signal<Difficulty>('normal');
  public mapPreset = signal<'world' | 'archipelago' | 'pangaea'>('world');
  public randomStart = signal<boolean>(false);
  public deployPercentage = signal<number>(50);

  // Runtime Signals
  public matchStatus = signal<MatchStatus>('setup');
  public isPaused = signal<boolean>(false);
  public gameSpeed = signal<number>(1);
  public isMuted = signal<boolean>(false);
  public gameTime = signal<number>(0);
  public showLeftDrawer = signal<boolean>(false);
  public showRightDrawer = signal<boolean>(false);

  // Selected Territory & Quick Intel
  public selectedTerritory = signal<Territory | null>(null);
  public hoveredTerritory = signal<Territory | null>(null);
  public playerNation = signal<Nation | null>(null);

  // Live Statistics & Leaderboard
  public stats = signal<GameStatistics>({
    elapsedTimeSec: 0,
    totalBattles: 0,
    totalTroopsLost: 0,
    totalTroopsGenerated: 0,
    eliminatedNationsCount: 0,
    playerRank: 1,
    playerTerritoryPercentage: 0,
  });

  public rankedNations = signal<Nation[]>([]);
  public battleFeed = signal<BattleNotification[]>([]);

  // Computed values
  public adjacentTargets = computed(() => {
    const sel = this.selectedTerritory();
    if (!sel || sel.ownerId !== this.engine.playerNationId) return [];
    return this.engine.getAdjacentEnemyTargets(sel.id);
  });

  public totalTerritoriesCount = computed(() => this.engine.territories.length);

  public buildingCosts = GAME_BALANCE.BUILDINGS;
  protected readonly Math = Math;

  constructor() {
    this.engine = new GameEngine();

    // Wire procedural audio events
    this.engine.onSoundTrigger = (sound: string) => {
      if (sound === 'click') soundSynth.playClick();
      else if (sound === 'select') soundSynth.playSelectTerritory();
      else if (sound === 'attack') soundSynth.playAttackDeploy();
      else if (sound === 'clash') soundSynth.playCombatClash();
      else if (sound === 'conquest') soundSynth.playConquestFanfare();
      else if (sound === 'build') soundSynth.playBuildingConstruct();
      else if (sound === 'warning') soundSynth.playWarningAlarm();
      else if (sound === 'victory') soundSynth.playVictory();
      else if (sound === 'defeat') soundSynth.playDefeat();
    };
  }

  ngOnInit() {
    // Autostart URL parameter handling
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('autostart') === '1') {
        this.randomStart.set(true);
        setTimeout(() => this.startGame(), 50);
      }
    }

    this.setupWindowListeners();
  }

  ngAfterViewInit() {
    if (this.mapCanvasRef) {
      const canvas = this.mapCanvasRef.nativeElement;
      this.renderer = new MapRenderer(canvas, this.engine);
      this.onResize();

      canvas.addEventListener('click', (e) => this.onCanvasClick(e));

      // Start render & simulation loop
      this.lastTime = performance.now();
      this.loop(this.lastTime);
    }
  }

  ngOnDestroy() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    this.removeWindowListeners();
  }

  private setupWindowListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('resize', this.onResizeBound);
    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('blur', this.onWindowBlurBound);
  }

  private removeWindowListeners() {
    if (typeof window === 'undefined') return;

    window.removeEventListener('resize', this.onResizeBound);
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('blur', this.onWindowBlurBound);
  }

  private onResizeBound = () => this.onResize();
  private onKeyDownBound = (e: KeyboardEvent) => this.onKeyDown(e);
  private onWindowBlurBound = () => this.onWindowBlur();

  private onResize() {
    if (!this.mapCanvasRef || !this.renderer) return;
    const canvas = this.mapCanvasRef.nativeElement;
    const rect = canvas.parentElement?.getBoundingClientRect() || { width: window.innerWidth, height: window.innerHeight };
    this.renderer.setCanvasSize(rect.width, rect.height);
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key.toLowerCase();

    // Start on Enter / Space in title
    if ((key === 'enter' || key === ' ') && this.matchStatus() === 'setup') {
      e.preventDefault();
      this.startGame();
      return;
    }

    // Toggle Pause on Esc or P
    if (key === 'escape' || key === 'p') {
      if (this.matchStatus() === 'playing') {
        this.togglePause();
      }
    }

    // Toggle Mute on M
    if (key === 'm') {
      this.toggleMute();
    }

    // Reset Camera on C
    if (key === 'c') {
      this.resetCamera();
    }

    // Quick Speed controls 1, 2, 4
    if (key === '1') this.setSpeed(1);
    if (key === '2') this.setSpeed(2);
    if (key === '4') this.setSpeed(4);
  }

  private onWindowBlur() {
    // Clear any held actions
  }

  private uiSyncTimer = 0;
  private lastRenderTime = 0;
  private readonly TARGET_FRAME_MS = 1000 / 30; // 30 FPS cap for silky smooth & CPU-efficient rendering

  private loop = (timestamp: number) => {
    const rawDt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    const dt = Math.min(rawDt, 0.05);

    // Update Simulation
    if (this.matchStatus() === 'playing' && !this.isPaused()) {
      this.engine.update(dt);
      this.uiSyncTimer += dt;
      if (this.uiSyncTimer >= 0.1) {
        this.uiSyncTimer = 0;
        this.syncUIState();
      }
    }

    // Render Canvas with frame limiter to avoid CPU exhaustion
    if (timestamp - this.lastRenderTime >= this.TARGET_FRAME_MS) {
      const renderDt = Math.min((timestamp - this.lastRenderTime) / 1000, 0.05);
      this.lastRenderTime = timestamp;
      if (this.renderer) {
        this.renderer.render(renderDt);
      }
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  private syncUIState() {
    this.gameTime.set(this.engine.gameTime);
    this.matchStatus.set(this.engine.matchStatus);
    document.body.dataset['state'] = this.engine.matchStatus === 'setup' ? 'title' : this.engine.matchStatus;

    const p = this.engine.nations.get(this.engine.playerNationId);
    this.playerNation.set(p ? { ...p } : null);

    // Sync selected territory info
    if (this.engine.selectedTerritoryId) {
      const terr = this.engine.territories.find(t => t.id === this.engine.selectedTerritoryId);
      this.selectedTerritory.set(terr ? { ...terr } : null);
    } else {
      this.selectedTerritory.set(null);
    }

    // Sync battle feed
    this.battleFeed.set([...this.engine.battleNotifications.slice(0, 10)]);

    // Update Leaderboard
    const sorted = Array.from(this.engine.nations.values())
      .filter(n => !n.isEliminated && n.ownedTerritoryIds.length > 0)
      .sort((a, b) => b.ownedTerritoryIds.length - a.ownedTerritoryIds.length);
    this.rankedNations.set(sorted);

    // Update Statistics
    this.stats.set(this.engine.getStatistics());
  }

  public startGame() {
    soundSynth.playClick();
    const config: Partial<GameConfig> = {
      aiCount: this.aiCount(),
      difficulty: this.difficulty(),
      gameSpeed: this.gameSpeed(),
      randomStart: this.randomStart(),
      mapPreset: this.mapPreset(),
    };

    this.engine.initMatch(config);
    this.matchStatus.set(this.engine.matchStatus);
    document.body.dataset['state'] = this.engine.matchStatus === 'setup' ? 'title' : this.engine.matchStatus;

    if (this.renderer) {
      this.renderer.centerCamera();
    }

    this.syncUIState();
  }

  public onCanvasClick(e: MouseEvent) {
    if (!this.renderer) return;

    const terr = this.renderer.handleMapClick(e.clientX, e.clientY);
    if (!terr) {
      this.engine.selectTerritory(null);
      this.syncUIState();
      return;
    }

    // If we're selecting a starting territory for manual mode:
    if (this.matchStatus() === 'selecting_capital') {
      if (terr.ownerId === null) {
        this.engine.claimStartingTerritory(terr.id);
        this.syncUIState();
        if (this.renderer) this.renderer.focusTerritory(terr.id);
      }
      return;
    }

    // If playing:
    const currentSelected = this.engine.selectedTerritoryId
      ? this.engine.territories.find(t => t.id === this.engine.selectedTerritoryId)
      : null;

    // Check if player clicked an adjacent territory while their own territory is selected:
    if (
      currentSelected &&
      currentSelected.ownerId === this.engine.playerNationId &&
      currentSelected.neighboringTerritoryIds.includes(terr.id) &&
      terr.ownerId !== this.engine.playerNationId
    ) {
      // Launch attack!
      this.engine.launchAttack(
        this.engine.playerNationId,
        currentSelected.id,
        terr.id,
        this.deployPercentage()
      );
      this.syncUIState();
      return;
    }

    // Otherwise select the clicked territory
    this.engine.selectTerritory(terr.id);
    this.syncUIState();
  }

  public selectTarget(targetTerritoryId: string) {
    const sel = this.selectedTerritory();
    if (!sel || sel.ownerId !== this.engine.playerNationId) return;

    this.engine.launchAttack(
      this.engine.playerNationId,
      sel.id,
      targetTerritoryId,
      this.deployPercentage()
    );
    this.syncUIState();
  }

  public setDeployPercentage(pct: number) {
    this.deployPercentage.set(pct);
    soundSynth.playClick();
  }

  public onSliderChange(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.deployPercentage.set(val);
  }

  public onAiCountChange(event: Event) {
    const val = Number((event.target as HTMLInputElement).value);
    this.aiCount.set(val);
  }

  public buildStructure(type: BuildingType) {
    const sel = this.selectedTerritory();
    if (!sel) return;

    const ok = this.engine.constructBuilding(this.engine.playerNationId, sel.id, type);
    if (ok) {
      this.syncUIState();
    }
  }

  public autoPickCapital() {
    const neutrals = this.engine.territories.filter(t => t.ownerId === null);
    if (neutrals.length > 0) {
      const chosen = neutrals[Math.floor(Math.random() * neutrals.length)];
      this.engine.claimStartingTerritory(chosen.id);
      this.syncUIState();
      if (this.renderer) this.renderer.focusTerritory(chosen.id);
    }
  }

  public resetCamera() {
    if (this.renderer) {
      this.renderer.centerCamera();
      soundSynth.playClick();
    }
  }

  public togglePause() {
    this.isPaused.update(p => !p);
    this.engine.isPaused = this.isPaused();
    soundSynth.playClick();
  }

  public setSpeed(speed: number) {
    this.gameSpeed.set(speed);
    this.engine.config.gameSpeed = speed;
    soundSynth.playClick();
  }

  public toggleMute() {
    const muted = soundSynth.toggleMute();
    this.isMuted.set(muted);
    soundSynth.playClick();
  }

  public formatTime(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  public restartMatch() {
    soundSynth.playClick();
    this.startGame();
  }

  public toggleLeftDrawer() {
    this.showLeftDrawer.update(v => !v);
  }

  public toggleRightDrawer() {
    this.showRightDrawer.update(v => !v);
  }

  public returnToMenu() {
    soundSynth.playClick();
    this.matchStatus.set('setup');
    this.engine.matchStatus = 'setup';
    document.body.dataset['state'] = 'title';
  }
}
