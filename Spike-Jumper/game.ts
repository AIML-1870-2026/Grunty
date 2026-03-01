// =============================================================
// SPIKE JUMPER — game.ts
// Geometry Dash-style auto-runner rendered on HTML5 Canvas
// =============================================================

// ── Types & Interfaces ────────────────────────────────────────

type GameState = 'menu' | 'playing' | 'boss' | 'dead' | 'skins';
type ObstacleType = 'spike' | 'spikeCluster' | 'saw' | 'wall' | 'bouncePad';
type PlayerState = 'running' | 'jumping' | 'doubleJump' | 'dead';
type LandingGrade = 'PERFECT' | 'CLEAN' | 'STUMBLE' | 'DEAD';
type ZoneTheme = 'Neon City' | 'Lava Caves' | 'Sky Temple' | 'Cyber Grid';

interface Vec2 { x: number; y: number; }

interface Obstacle {
  type: ObstacleType;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;   // for saw rotation
  active: boolean;
}

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

interface FloatingText {
  text: string;
  x: number; y: number;
  vy: number;
  life: number; maxLife: number;
  color: string;
  size: number;
}

interface RagdollSegment {
  x: number; y: number;
  vx: number; vy: number;
  angle: number;
  angVel: number;
  len: number;
}

interface SkinDef {
  id: string;
  name: string;
  color: string;
  headColor: string;
  unlocked: boolean;
  milestone?: string;
}

// ── Skin Definitions ──────────────────────────────────────────

const SKINS: SkinDef[] = [
  { id: 'default',  name: 'Classic',         color: '#ffffff', headColor: '#ffffff', unlocked: true },
  { id: 'caped',    name: 'Caped Crusader',   color: '#1a1a2e', headColor: '#888888', unlocked: false, milestone: 'Beat Boss 1' },
  { id: 'shrek',    name: 'Shrek',            color: '#4a7c59', headColor: '#6a9c69', unlocked: false, milestone: 'Survive 300s' },
  { id: 'doge',     name: 'Doge',             color: '#c8a96e', headColor: '#c8a96e', unlocked: false, milestone: 'Survive 60s' },
  { id: 'thunder',  name: 'Thunder God',      color: '#4040cc', headColor: '#8080ff', unlocked: false, milestone: 'Survive 120s' },
  { id: 'iron',     name: 'Iron Suit',        color: '#c0c0c0', headColor: '#ff6600', unlocked: false, milestone: 'Beat Boss 2' },
];

// ── Zone Theme Palettes ───────────────────────────────────────

const ZONE_PALETTES: Record<ZoneTheme, { sky: string[]; hills: string; buildings: string; accent: string }> = {
  'Neon City':   { sky: ['#0a0020', '#1a0040', '#0a1530'], hills: '#1a0050', buildings: '#0d0030', accent: '#00ffff' },
  'Lava Caves':  { sky: ['#200000', '#400800', '#1a0000'], hills: '#500010', buildings: '#300005', accent: '#ff6600' },
  'Sky Temple':  { sky: ['#1a1040', '#3a2060', '#ff9944'], hills: '#4a3070', buildings: '#6a5090', accent: '#ffd700' },
  'Cyber Grid':  { sky: ['#000000', '#001010', '#000820'], hills: '#001a1a', buildings: '#000d0d', accent: '#00ff88' },
};

const ZONE_ORDER: ZoneTheme[] = ['Neon City', 'Lava Caves', 'Sky Temple', 'Cyber Grid'];

// ── Player ────────────────────────────────────────────────────

class Player {
  x: number = 0;
  y: number = 0;
  vy: number = 0;
  state: PlayerState = 'running';
  angle: number = 0;           // rotation in degrees
  canDoubleJump: boolean = true;
  jumpHeld: boolean = false;
  jumpHeldTime: number = 0;
  trailPositions: Vec2[] = [];

  readonly GRAVITY = 1800;
  readonly JUMP_VEL = -700;
  readonly HOLD_BONUS = -300;
  readonly HOLD_MAX_TIME = 0.4;
  readonly DOUBLE_JUMP_VEL = -550;
  readonly MAX_FALL = 1200;
  readonly WIDTH = 20;
  readonly HEIGHT = 50;

  groundY: number = 0;

  constructor(groundY: number, startX: number) {
    this.groundY = groundY;
    this.x = startX;
    this.y = groundY - this.HEIGHT;
  }

  jump(isDouble: boolean = false): void {
    if (this.state === 'dead') return;
    if (this.state === 'running') {
      this.vy = this.JUMP_VEL;
      this.state = 'jumping';
      this.jumpHeld = true;
      this.jumpHeldTime = 0;
      this.canDoubleJump = true;
    } else if (isDouble && this.canDoubleJump) {
      this.vy = this.DOUBLE_JUMP_VEL;
      this.state = 'doubleJump';
      this.canDoubleJump = false;
      this.jumpHeld = false;
    }
  }

  endHold(): void { this.jumpHeld = false; }

  update(dt: number): void {
    if (this.state === 'dead') return;

    // Hold-jump bonus
    if (this.jumpHeld && (this.state === 'jumping' || this.state === 'doubleJump')) {
      this.jumpHeldTime += dt;
      if (this.jumpHeldTime < this.HOLD_MAX_TIME) {
        this.vy += (this.HOLD_BONUS / this.HOLD_MAX_TIME) * dt;
      }
    }

    if (this.state !== 'running') {
      this.vy += this.GRAVITY * dt;
      if (this.vy > this.MAX_FALL) this.vy = this.MAX_FALL;
      this.y += this.vy * dt;
      this.angle += 720 * dt;
    }

    // Landing
    const bottom = this.y + this.HEIGHT;
    if (bottom >= this.groundY && this.state !== 'running') {
      this.y = this.groundY - this.HEIGHT;
      this.vy = 0;
      this.state = 'running';
      this.angle = 0;
      this.canDoubleJump = true;
      this.jumpHeld = false;
    }

    // Trail
    if (this.state !== 'running') {
      this.trailPositions.push({ x: this.x, y: this.y + this.HEIGHT / 2 });
      if (this.trailPositions.length > 5) this.trailPositions.shift();
    } else {
      this.trailPositions = [];
    }
  }

  getLandingGrade(): LandingGrade {
    const norm = ((this.angle % 360) + 360) % 360;
    const dev = Math.min(norm, 360 - norm);
    if (dev < 15)  return 'PERFECT';
    if (dev < 35)  return 'CLEAN';
    if (dev < 70)  return 'STUMBLE';
    return 'DEAD';
  }

  getBottom(): number { return this.y + this.HEIGHT; }
}

// ── Obstacle Manager ──────────────────────────────────────────

class ObstacleManager {
  obstacles: Obstacle[] = [];
  spawnTimer: number = 0;
  nextSpawnInterval: number = 1.5;
  groundY: number = 0;
  canvasW: number = 0;

  constructor(groundY: number, canvasW: number) {
    this.groundY = groundY;
    this.canvasW = canvasW;
  }

  getScrollSpeed(elapsed: number): number {
    if (elapsed < 30)  return 280;
    if (elapsed < 60)  return 310;
    if (elapsed < 120) return 350;
    return 400;
  }

  getAvailableTypes(elapsed: number): ObstacleType[] {
    if (elapsed < 30)  return ['spike', 'spikeCluster'];
    if (elapsed < 60)  return ['spike', 'spikeCluster', 'saw'];
    if (elapsed < 120) return ['spike', 'spikeCluster', 'saw', 'wall'];
    return ['spike', 'spikeCluster', 'saw', 'wall', 'bouncePad'];
  }

  getSpawnInterval(elapsed: number): [number, number] {
    if (elapsed < 30)  return [1.8, 3.5];
    if (elapsed < 60)  return [1.5, 3.0];
    if (elapsed < 120) return [1.2, 2.5];
    return [0.9, 2.0];
  }

  spawnObstacle(elapsed: number): void {
    const types = this.getAvailableTypes(elapsed);
    const type = types[Math.floor(Math.random() * types.length)] as ObstacleType;
    const spawnX = this.canvasW + 60;

    if (type === 'spike') {
      this.obstacles.push({ type, x: spawnX, y: this.groundY - 30, width: 20, height: 30, angle: 0, active: true });
    } else if (type === 'spikeCluster') {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        this.obstacles.push({ type: 'spike', x: spawnX + i * 22, y: this.groundY - 30, width: 20, height: 30, angle: 0, active: true });
      }
    } else if (type === 'saw') {
      this.obstacles.push({ type, x: spawnX, y: this.groundY - 22, width: 44, height: 44, angle: 0, active: true });
    } else if (type === 'wall') {
      this.obstacles.push({ type, x: spawnX, y: this.groundY - 120, width: 60, height: 120, angle: 0, active: true });
    } else if (type === 'bouncePad') {
      this.obstacles.push({ type, x: spawnX, y: this.groundY - 12, width: 50, height: 12, angle: 0, active: true });
    }
  }

  update(dt: number, elapsed: number, scrollSpeed: number): void {
    const speed = scrollSpeed;
    for (const obs of this.obstacles) {
      obs.x -= speed * dt;
      if (obs.type === 'saw') obs.angle += 180 * dt;
    }
    this.obstacles = this.obstacles.filter(o => o.x > -200);

    this.spawnTimer += dt;
    if (this.spawnTimer >= this.nextSpawnInterval) {
      this.spawnTimer = 0;
      const [min, max] = this.getSpawnInterval(elapsed);
      this.nextSpawnInterval = min + Math.random() * (max - min);
      this.spawnObstacle(elapsed);
    }
  }

  checkCollision(player: Player): Obstacle | null {
    const px = player.x - player.WIDTH / 2;
    const py = player.y;
    const pw = player.WIDTH;
    const ph = player.HEIGHT;

    for (const obs of this.obstacles) {
      if (!obs.active) continue;
      const hit = px < obs.x + obs.width &&
                  px + pw > obs.x &&
                  py < obs.y + obs.height &&
                  py + ph > obs.y;
      if (hit) return obs;
    }
    return null;
  }

  clear(): void { this.obstacles = []; this.spawnTimer = 0; }
}

// ── Parallax Background ───────────────────────────────────────

class ParallaxBackground {
  offsets: number[] = [0, 0, 0, 0, 0];
  hillPoints: Vec2[][] = [];
  buildingRects: { x: number; w: number; h: number }[][] = [];
  canvasW: number; canvasH: number; groundY: number;
  zoneIndex: number = 0;
  nextZoneIndex: number = 0;
  crossfadeAlpha: number = 0;
  crossfading: boolean = false;

  constructor(cw: number, ch: number, groundY: number) {
    this.canvasW = cw;
    this.canvasH = ch;
    this.groundY = groundY;
    this.generateHills();
    this.generateBuildings();
  }

  generateHills(): void {
    this.hillPoints = [];
    for (let layer = 0; layer < 2; layer++) {
      const pts: Vec2[] = [];
      const count = 12;
      for (let i = 0; i <= count; i++) {
        pts.push({
          x: (i / count) * this.canvasW * 2,
          y: this.groundY - 60 - Math.random() * (100 + layer * 80)
        });
      }
      this.hillPoints.push(pts);
    }
  }

  generateBuildings(): void {
    this.buildingRects = [];
    for (let layer = 0; layer < 2; layer++) {
      const rects: { x: number; w: number; h: number }[] = [];
      let cx = 0;
      while (cx < this.canvasW * 2) {
        const w = 30 + Math.random() * (60 + layer * 40);
        const h = 50 + Math.random() * (130 + layer * 60);
        rects.push({ x: cx, w, h });
        cx += w + 4 + Math.random() * 20;
      }
      this.buildingRects.push(rects);
    }
  }

  startTransition(nextIdx: number): void {
    this.nextZoneIndex = nextIdx;
    this.crossfading = true;
    this.crossfadeAlpha = 0;
  }

  update(dt: number, scrollSpeed: number): void {
    const mults = [0.05, 0.2, 0.45, 1.0, 1.3];
    for (let i = 0; i < 5; i++) {
      this.offsets[i] += scrollSpeed * mults[i] * dt;
    }
    if (this.crossfading) {
      this.crossfadeAlpha += dt / 2;
      if (this.crossfadeAlpha >= 1) {
        this.crossfadeAlpha = 1;
        this.zoneIndex = this.nextZoneIndex;
        this.crossfading = false;
      }
    }
  }

  drawSky(ctx: CanvasRenderingContext2D, palette: typeof ZONE_PALETTES['Neon City']): void {
    const grad = ctx.createLinearGradient(0, 0, 0, this.groundY);
    grad.addColorStop(0, palette.sky[0]);
    grad.addColorStop(0.5, palette.sky[1]);
    grad.addColorStop(1, palette.sky[2]);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.canvasW, this.groundY);
  }

  drawHills(ctx: CanvasRenderingContext2D, layerIdx: number, color: string, offset: number): void {
    const pts = this.hillPoints[layerIdx];
    if (!pts) return;
    const off = offset % (this.canvasW * 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    for (const p of pts) {
      ctx.lineTo(p.x - off, p.y);
    }
    ctx.lineTo(this.canvasW, this.groundY);
    ctx.closePath();
    ctx.fill();
    // tile second copy
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    for (const p of pts) {
      ctx.lineTo(p.x - off + this.canvasW * 2, p.y);
    }
    ctx.lineTo(this.canvasW * 4, this.groundY);
    ctx.closePath();
    ctx.fill();
  }

  drawBuildings(ctx: CanvasRenderingContext2D, layerIdx: number, color: string, offset: number): void {
    const rects = this.buildingRects[layerIdx];
    if (!rects) return;
    ctx.fillStyle = color;
    const tileW = this.canvasW * 2;
    const off = offset % tileW;
    for (const r of rects) {
      const dx = r.x - off;
      ctx.fillRect(dx, this.groundY - r.h, r.w, r.h);
      ctx.fillRect(dx + tileW, this.groundY - r.h, r.w, r.h);
    }
  }

  drawDebris(ctx: CanvasRenderingContext2D, accent: string, offset: number): void {
    const off = offset % this.canvasW;
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 8; i++) {
      const x = ((i * 137 + 50) % this.canvasW * 1.2) - off;
      const y = this.groundY - 20 - ((i * 79) % 60);
      const s = 2 + (i % 3);
      ctx.fillRect(x, y, s, s);
      ctx.fillRect(x + this.canvasW, y, s, s);
    }
    ctx.globalAlpha = 1;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const palette = ZONE_PALETTES[ZONE_ORDER[this.zoneIndex]];
    this.drawSky(ctx, palette);
    this.drawHills(ctx, 0, this.adjustBrightness(palette.hills, 1.3), this.offsets[1]);
    this.drawHills(ctx, 1, palette.hills, this.offsets[1] * 0.7);
    this.drawBuildings(ctx, 0, this.adjustBrightness(palette.buildings, 1.4), this.offsets[2]);
    this.drawBuildings(ctx, 1, palette.buildings, this.offsets[2] * 0.6);
    this.drawDebris(ctx, palette.accent, this.offsets[4]);

    if (this.crossfading && this.crossfadeAlpha < 1) {
      const nextPalette = ZONE_PALETTES[ZONE_ORDER[this.nextZoneIndex]];
      ctx.globalAlpha = this.crossfadeAlpha;
      this.drawSky(ctx, nextPalette);
      this.drawHills(ctx, 0, this.adjustBrightness(nextPalette.hills, 1.3), this.offsets[1]);
      this.drawBuildings(ctx, 0, nextPalette.buildings, this.offsets[2]);
      ctx.globalAlpha = 1;
    }
  }

  adjustBrightness(hex: string, factor: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const clamp = (v: number) => Math.min(255, Math.floor(v * factor));
    return `rgb(${clamp(r)},${clamp(g)},${clamp(b)})`;
  }
}

// ── Boss Manager ──────────────────────────────────────────────

interface BossState {
  id: number;
  name: string;
  x: number; y: number;
  hp: number; maxHp: number;
  phase: number;
  attackTimer: number;
  attackInterval: number;
  projectiles: { x: number; y: number; vx: number; vy: number; r: number }[];
  sawOrbit: { angle: number; radius: number; speed: number }[];
  laserActive: boolean;
  laserTimer: number;
  hitZone: { x: number; y: number; w: number; h: number; active: boolean };
  eyeOpen: boolean;
  eyeTimer: number;
  defeated: boolean;
  animAngle: number;
}

class BossManager {
  boss: BossState | null = null;
  shakeTime: number = 0;
  groundY: number; canvasW: number; canvasH: number;
  onDefeat?: (bossId: number) => void;

  constructor(groundY: number, canvasW: number, canvasH: number) {
    this.groundY = groundY;
    this.canvasW = canvasW;
    this.canvasH = canvasH;
  }

  spawnBoss(id: number): void {
    if (id === 1) {
      this.boss = {
        id: 1, name: 'SPIKE KING',
        x: this.canvasW * 0.75, y: this.groundY - 130,
        hp: 100, maxHp: 100, phase: 1,
        attackTimer: 0, attackInterval: 2.5,
        projectiles: [], sawOrbit: [],
        laserActive: false, laserTimer: 0,
        hitZone: { x: this.canvasW * 0.75 - 25, y: this.groundY - 110, w: 50, h: 20, active: true },
        eyeOpen: false, eyeTimer: 0,
        defeated: false, animAngle: 0
      };
    } else {
      this.boss = {
        id: 2, name: 'SAW CYCLOPS',
        x: this.canvasW * 0.75, y: this.groundY - 100,
        hp: 100, maxHp: 100, phase: 1,
        attackTimer: 0, attackInterval: 3.0,
        projectiles: [],
        sawOrbit: [
          { angle: 0, radius: 80, speed: 2 },
          { angle: 120, radius: 80, speed: 2 },
          { angle: 240, radius: 80, speed: 2 },
        ],
        laserActive: false, laserTimer: 0,
        hitZone: { x: this.canvasW * 0.75 - 20, y: this.groundY - 120, w: 40, h: 40, active: false },
        eyeOpen: false, eyeTimer: 0,
        defeated: false, animAngle: 0
      };
    }
    this.updateBossUI();
  }

  updateBossUI(): void {
    const bar = document.getElementById('bossBar');
    const fill = document.getElementById('bossBarFill') as HTMLElement;
    const name = document.getElementById('bossName') as HTMLElement;
    if (!this.boss) { bar?.classList.add('hidden'); return; }
    bar?.classList.remove('hidden');
    bar?.classList.add('active');
    name.textContent = this.boss.name;
    fill.style.width = (this.boss.hp / this.boss.maxHp * 100) + '%';
  }

  update(dt: number, player: Player): boolean {
    if (!this.boss || this.boss.defeated) return false;
    const b = this.boss;
    b.animAngle += dt;

    // Phase transitions
    const hpPct = b.hp / b.maxHp;
    if (hpPct <= 0.33 && b.phase < 3) b.phase = 3;
    else if (hpPct <= 0.66 && b.phase < 2) b.phase = 2;

    const speedFactor = 1 + (b.phase - 1) * 0.4;
    b.attackInterval = 2.5 / speedFactor;
    b.attackTimer += dt;

    if (b.id === 1) {
      // Spike King attacks
      if (b.attackTimer >= b.attackInterval) {
        b.attackTimer = 0;
        this.shakeTime = 0.3;
        // Spike waves on ground
        for (let i = 0; i < 3; i++) {
          b.projectiles.push({
            x: this.canvasW * 0.6 - i * 80, y: this.groundY - 30,
            vx: -120, vy: 0, r: 15
          });
        }
        if (b.phase >= 2) {
          // Spike rain
          for (let i = 0; i < b.phase; i++) {
            b.projectiles.push({
              x: Math.random() * this.canvasW * 0.6,
              y: -20, vx: 0, vy: 400, r: 12
            });
          }
        }
      }

      b.hitZone.x = b.x - 25;
      b.hitZone.y = b.y + 10;
      b.hitZone.active = true;
    } else {
      // Saw Cyclops
      for (const s of b.sawOrbit) {
        s.angle += s.speed * dt * 60 * (Math.PI / 180);
      }

      b.eyeTimer += dt;
      if (b.eyeTimer > 3) {
        b.eyeOpen = !b.eyeOpen;
        b.eyeTimer = 0;
        b.hitZone.active = b.eyeOpen;
      }

      if (b.attackTimer >= b.attackInterval) {
        b.attackTimer = 0;
        // Fire orbiting saws outward
        for (let i = 0; i < 4; i++) {
          const ang = (Math.PI * 2 / 4) * i;
          b.projectiles.push({ x: b.x, y: b.y, vx: Math.cos(ang) * 200, vy: Math.sin(ang) * 200, r: 18 });
        }
        if (b.phase >= 2) {
          b.laserActive = true;
          b.laserTimer = 1.5;
        }
      }

      if (b.laserActive) {
        b.laserTimer -= dt;
        if (b.laserTimer <= 0) b.laserActive = false;
      }
    }

    // Update projectiles
    b.projectiles = b.projectiles.filter(p => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.x > -100 && p.x < this.canvasW + 100 && p.y < this.canvasH + 100 && p.y > -100;
    });

    if (this.shakeTime > 0) this.shakeTime -= dt;

    // Player collision with boss projectiles
    for (const proj of b.projectiles) {
      const dx = (player.x - proj.x);
      const dy = (player.y + player.HEIGHT / 2 - proj.y);
      if (Math.sqrt(dx * dx + dy * dy) < proj.r + 10) {
        return true; // hit player
      }
    }

    // Laser collision
    if (b.id === 2 && b.laserActive) {
      if (player.getBottom() >= this.groundY - 5) {
        return true;
      }
    }

    // Check player damaging boss
    if (b.hitZone.active) {
      const px = player.x;
      const py = player.y + player.HEIGHT / 2;
      const hz = b.hitZone;
      if (px > hz.x && px < hz.x + hz.w && py > hz.y && py < hz.y + hz.h) {
        const grade = player.getLandingGrade();
        if (grade === 'PERFECT') { b.hp -= 20; this.updateBossUI(); }
        else if (grade === 'CLEAN') { b.hp -= 10; this.updateBossUI(); }
        hz.active = false;
        setTimeout(() => { if (b) hz.active = true; }, 1000);
      }
    }

    if (b.hp <= 0 && !b.defeated) {
      b.defeated = true;
      this.onDefeat?.(b.id);
      const bar = document.getElementById('bossBar');
      bar?.classList.add('hidden');
      bar?.classList.remove('active');
    }

    return false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.boss || this.boss.defeated) return;
    const b = this.boss;

    if (b.id === 1) {
      this.drawSpikeKing(ctx, b);
    } else {
      this.drawSawCyclops(ctx, b);
    }

    // Draw projectiles
    for (const p of b.projectiles) {
      ctx.save();
      ctx.fillStyle = b.id === 1 ? '#ff4444' : '#ff8800';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      if (b.id === 1) {
        // Draw ground spike projectile
        ctx.beginPath();
        ctx.moveTo(p.x, p.y + p.r);
        ctx.lineTo(p.x + p.r * 0.7, p.y - p.r);
        ctx.lineTo(p.x - p.r * 0.7, p.y - p.r);
        ctx.closePath();
        ctx.fill();
      } else {
        // Saw projectile
        ctx.translate(p.x, p.y);
        ctx.rotate(b.animAngle * 3);
        drawSawShape(ctx, p.r, '#ff8800');
      }
      ctx.restore();
    }

    // Laser
    if (b.id === 2 && b.laserActive) {
      ctx.save();
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 6;
      ctx.shadowColor = '#ff0000';
      ctx.shadowBlur = 20;
      ctx.globalAlpha = 0.7 + 0.3 * Math.sin(Date.now() * 0.01);
      ctx.beginPath();
      ctx.moveTo(0, this.groundY - 5);
      ctx.lineTo(this.canvasW, this.groundY - 5);
      ctx.stroke();
      ctx.restore();
    }

    // Hit zone indicator
    if (b.hitZone.active) {
      ctx.save();
      ctx.strokeStyle = '#00ff88';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00ff88';
      ctx.shadowBlur = 10;
      ctx.globalAlpha = 0.6 + 0.4 * Math.sin(Date.now() * 0.005);
      ctx.strokeRect(b.hitZone.x, b.hitZone.y, b.hitZone.w, b.hitZone.h);
      ctx.restore();
    }
  }

  drawSpikeKing(ctx: CanvasRenderingContext2D, b: BossState): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    // Body
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 60); ctx.stroke();
    // Head
    ctx.fillStyle = '#dd4444';
    ctx.beginPath(); ctx.arc(0, -20, 22, 0, Math.PI * 2); ctx.fill();
    // Crown
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.moveTo(-22, -28); ctx.lineTo(-22, -48);
    ctx.lineTo(-10, -38); ctx.lineTo(0, -55);
    ctx.lineTo(10, -38); ctx.lineTo(22, -48); ctx.lineTo(22, -28);
    ctx.closePath(); ctx.fill();
    // Eyes
    ctx.fillStyle = '#ffff00';
    ctx.beginPath(); ctx.arc(-8, -22, 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(8, -22, 5, 0, Math.PI * 2); ctx.fill();
    // Arms
    ctx.strokeStyle = '#cc3333';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-10, 15); ctx.lineTo(-35, 35); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 15); ctx.lineTo(35, 35); ctx.stroke();
    // Legs
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(-18, 90); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, 60); ctx.lineTo(18, 90); ctx.stroke();
    ctx.restore();
  }

  drawSawCyclops(ctx: CanvasRenderingContext2D, b: BossState): void {
    ctx.save();
    ctx.translate(b.x, b.y);
    // Body (eyeball)
    const grad = ctx.createRadialGradient(0, 0, 5, 0, 0, 60);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.4, '#ffddcc');
    grad.addColorStop(1, '#cc8844');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(0, 0, 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#8844aa'; ctx.lineWidth = 3;
    ctx.stroke();
    // Pupil
    if (b.eyeOpen) {
      ctx.fillStyle = '#220044';
      ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(7, -7, 6, 0, Math.PI * 2); ctx.fill();
    } else {
      // Closed eye (line)
      ctx.strokeStyle = '#440088'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
    }
    // Orbiting saws
    for (const s of b.sawOrbit) {
      const sx = Math.cos(s.angle) * s.radius;
      const sy = Math.sin(s.angle) * s.radius;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(b.animAngle * 5);
      drawSawShape(ctx, 16, '#888888');
      ctx.restore();
    }
    ctx.restore();
  }
}

// ── Utility Draw Functions ────────────────────────────────────

function drawSawShape(ctx: CanvasRenderingContext2D, r: number, color: string): void {
  const teeth = 8;
  ctx.fillStyle = color;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const angle = (i / (teeth * 2)) * Math.PI * 2;
    const radius = i % 2 === 0 ? r : r * 0.65;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawStickman(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  angle: number, runFrame: number,
  skin: SkinDef, airborne: boolean
): void {
  ctx.save();
  ctx.translate(x, y + 25);  // y + half-height pivot
  if (airborne) ctx.rotate((angle * Math.PI) / 180);

  const c = skin.color;
  const hc = skin.headColor;
  ctx.strokeStyle = c;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';

  // Head
  ctx.fillStyle = hc;
  ctx.beginPath(); ctx.arc(0, -25, 14, 0, Math.PI * 2); ctx.fill();

  // Body (neck to hips)
  ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(0, 15); ctx.stroke();

  // Arms swing during run
  const armSwing = airborne ? 0 : Math.sin(runFrame * 0.2) * 20;
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(-20, 12 + armSwing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(20, 12 - armSwing); ctx.stroke();

  // Legs cycle during run
  const legSwing = airborne ? 15 : Math.sin(runFrame * 0.2) * 25;
  ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(-14, 37 + legSwing); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(14, 37 - legSwing); ctx.stroke();

  // Cape for caped skin
  if (skin.id === 'caped') {
    ctx.fillStyle = '#440088';
    ctx.beginPath();
    ctx.moveTo(-5, -8); ctx.lineTo(-25, 25); ctx.lineTo(5, 15); ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
}

// ── Main Game Controller ──────────────────────────────────────

class Game {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  state: GameState = 'menu';
  groundY: number = 0;

  player!: Player;
  obstacles!: ObstacleManager;
  parallax!: ParallaxBackground;
  bossManager!: BossManager;

  elapsed: number = 0;
  lastTime: number = 0;
  runFrame: number = 0;
  scrollSpeed: number = 280;
  bossSpawnTimer: number = 0;
  bossActive: boolean = false;
  zoneTimer: number = 0;
  shakeX: number = 0; shakeY: number = 0;

  particles: Particle[] = [];
  floatingTexts: FloatingText[] = [];
  ragdoll: RagdollSegment[] = [];
  ragdollTimer: number = 0;

  combo: number = 0;
  maxCombo: number = 0;
  jumps: number = 0;
  perfectLandings: number = 0;
  bossesDefeated: number = 0;
  causeOfDeath: string = 'Unknown';
  distance: number = 0;

  selectedSkin: SkinDef = SKINS[0];
  unlockedSkins: Set<string> = new Set(['default']);
  bestTime: number = 0;

  // Input state
  jumpPressed: boolean = false;
  jumpHeld: boolean = false;

  constructor() {
    this.canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.loadStorage();
    this.setupInput();
    this.setupUI();
    this.showMenu();
    requestAnimationFrame((t) => this.loop(t));
  }

  resize(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.groundY = this.canvas.height - 80;
  }

  loadStorage(): void {
    this.bestTime = parseFloat(localStorage.getItem('sj_bestTime') || '0');
    const saved = localStorage.getItem('sj_skin') || 'default';
    const savedUnlocked: string[] = JSON.parse(localStorage.getItem('sj_unlocked') || '["default"]');
    this.unlockedSkins = new Set(savedUnlocked);
    for (const sk of SKINS) {
      if (this.unlockedSkins.has(sk.id)) sk.unlocked = true;
    }
    this.selectedSkin = SKINS.find(s => s.id === saved) || SKINS[0];
  }

  saveStorage(): void {
    localStorage.setItem('sj_bestTime', String(this.bestTime));
    localStorage.setItem('sj_skin', this.selectedSkin.id);
    localStorage.setItem('sj_unlocked', JSON.stringify([...this.unlockedSkins]));
  }

  setupInput(): void {
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (!this.jumpPressed) this.handleJump();
        this.jumpPressed = true;
        this.jumpHeld = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        this.jumpPressed = false;
        this.jumpHeld = false;
        if (this.player) this.player.endHold();
      }
    });
    window.addEventListener('mousedown', () => { this.handleJump(); this.jumpHeld = true; });
    window.addEventListener('mouseup', () => { this.jumpHeld = false; if (this.player) this.player.endHold(); });
    window.addEventListener('touchstart', (e) => { e.preventDefault(); this.handleJump(); this.jumpHeld = true; }, { passive: false });
    window.addEventListener('touchend', () => { this.jumpHeld = false; if (this.player) this.player.endHold(); });
  }

  handleJump(): void {
    if (this.state !== 'playing' && this.state !== 'boss') return;
    if (!this.player || this.player.state === 'dead') return;
    const wasAirborne = this.player.state !== 'running';
    this.player.jump(wasAirborne);
    this.jumps++;
  }

  setupUI(): void {
    document.getElementById('playBtn')!.addEventListener('click', () => this.startGame());
    document.getElementById('skinsBtn')!.addEventListener('click', () => this.showSkins());
    document.getElementById('retryBtn')!.addEventListener('click', () => this.startGame());
    document.getElementById('menuBtn')!.addEventListener('click', () => this.showMenu());
    document.getElementById('closeSkins')!.addEventListener('click', () => {
      this.hideSkins();
      if (this.state === 'skins') { this.state = 'menu'; this.showMenu(); }
    });
  }

  showMenu(): void {
    this.state = 'menu';
    this.setOverlay('mainMenu', true);
    this.setOverlay('gameOver', false);
    this.setHUD(false);
    this.hideBossBar();
  }

  showSkins(): void {
    this.state = 'skins';
    this.setOverlay('skinSelector', true);
    this.buildSkinGrid();
  }

  hideSkins(): void {
    this.setOverlay('skinSelector', false);
  }

  setOverlay(id: string, show: boolean): void {
    const el = document.getElementById(id)!;
    if (show) { el.classList.remove('hidden'); el.classList.add('active'); }
    else { el.classList.add('hidden'); el.classList.remove('active'); }
  }

  setHUD(show: boolean): void {
    const hud = document.getElementById('hud')!;
    if (show) { hud.classList.remove('hidden'); hud.classList.add('active'); }
    else { hud.classList.add('hidden'); hud.classList.remove('active'); }
  }

  hideBossBar(): void {
    const bar = document.getElementById('bossBar')!;
    bar.classList.add('hidden'); bar.classList.remove('active');
  }

  startGame(): void {
    this.state = 'playing';
    this.elapsed = 0;
    this.scrollSpeed = 280;
    this.bossSpawnTimer = 0;
    this.bossActive = false;
    this.zoneTimer = 0;
    this.combo = 0; this.maxCombo = 0;
    this.jumps = 0; this.perfectLandings = 0;
    this.bossesDefeated = 0;
    this.distance = 0;
    this.particles = [];
    this.floatingTexts = [];
    this.ragdoll = [];
    this.ragdollTimer = 0;
    this.causeOfDeath = 'Unknown';

    const cw = this.canvas.width;
    const ch = this.canvas.height;
    const gY = this.groundY;

    this.player = new Player(gY, cw * 0.2);
    this.obstacles = new ObstacleManager(gY, cw);
    this.parallax = new ParallaxBackground(cw, ch, gY);
    this.bossManager = new BossManager(gY, cw, ch);
    this.bossManager.onDefeat = (id) => {
      this.bossesDefeated++;
      this.bossActive = false;
      this.state = 'playing';
      this.scrollSpeed *= 1.1;
      this.addFloatingText('BOSS DEFEATED!', cw / 2, ch / 2 - 60, '#ffd700', 32);
      this.checkSkinUnlocks();
    };

    this.setOverlay('mainMenu', false);
    this.setOverlay('gameOver', false);
    this.setHUD(true);
    this.hideBossBar();
  }

  buildSkinGrid(): void {
    const grid = document.getElementById('skinGrid')!;
    grid.innerHTML = '';
    for (const skin of SKINS) {
      const card = document.createElement('div');
      card.className = 'skin-card' + (skin.id === this.selectedSkin.id ? ' selected' : '');
      if (!skin.unlocked) card.style.opacity = '0.5';

      const preview = document.createElement('canvas');
      preview.width = 56; preview.height = 56;
      preview.className = 'skin-preview';
      const pctx = preview.getContext('2d')!;
      pctx.translate(28, 28);
      pctx.scale(0.7, 0.7);
      drawStickman(pctx, 0, 0, 0, 0, skin, false);

      const nameEl = document.createElement('div');
      nameEl.className = 'skin-name';
      nameEl.textContent = skin.name;

      if (!skin.unlocked && skin.milestone) {
        const lock = document.createElement('div');
        lock.style.cssText = 'font-size:0.6rem;color:#888;text-align:center;';
        lock.textContent = skin.milestone;
        card.appendChild(preview); card.appendChild(nameEl); card.appendChild(lock);
      } else {
        card.appendChild(preview); card.appendChild(nameEl);
      }

      card.addEventListener('click', () => {
        if (!skin.unlocked) return;
        this.selectedSkin = skin;
        this.saveStorage();
        this.buildSkinGrid();
      });

      grid.appendChild(card);
    }
  }

  checkSkinUnlocks(): void {
    for (const sk of SKINS) {
      if (sk.unlocked) continue;
      let unlock = false;
      if (sk.id === 'doge' && this.elapsed >= 60) unlock = true;
      if (sk.id === 'thunder' && this.elapsed >= 120) unlock = true;
      if (sk.id === 'shrek' && this.elapsed >= 300) unlock = true;
      if (sk.id === 'caped' && this.bossesDefeated >= 1) unlock = true;
      if (sk.id === 'iron' && this.bossesDefeated >= 2) unlock = true;
      if (unlock) {
        sk.unlocked = true;
        this.unlockedSkins.add(sk.id);
        this.addFloatingText(sk.name + ' UNLOCKED!', this.canvas.width / 2, 120, '#ffd700', 22);
        this.saveStorage();
      }
    }
  }

  die(cause: string): void {
    if (this.player.state === 'dead') return;
    this.player.state = 'dead';
    this.causeOfDeath = cause;
    this.state = 'dead';
    this.spawnRagdoll();
    this.spawnParticles(this.player.x, this.player.y + this.player.HEIGHT / 2, 25, '#ffaa00');
    this.ragdollTimer = 2.5;
    if (this.elapsed > this.bestTime) {
      this.bestTime = this.elapsed;
      this.saveStorage();
    }
    this.checkSkinUnlocks();
  }

  spawnRagdoll(): void {
    const px = this.player.x;
    const py = this.player.y;
    this.ragdoll = [
      { x: px, y: py,      vx: -80, vy: -300, angle: 0, angVel: 6,  len: 14 }, // head
      { x: px, y: py + 20, vx: -40, vy: -200, angle: 0, angVel: 3,  len: 25 }, // torso
      { x: px, y: py + 10, vx: -120,vy: -250, angle: 0, angVel: 8,  len: 20 }, // left arm
      { x: px, y: py + 10, vx: 80,  vy: -280, angle: 0, angVel: -8, len: 20 }, // right arm
      { x: px, y: py + 40, vx: -60, vy: -150, angle: 0, angVel: 5,  len: 20 }, // legs
    ];
  }

  spawnParticles(x: number, y: number, count: number, color: string): void {
    for (let i = 0; i < count; i++) {
      const ang = Math.random() * Math.PI * 2;
      const spd = 100 + Math.random() * 300;
      this.particles.push({
        x, y,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd - 100,
        life: 0.8 + Math.random() * 0.6,
        maxLife: 1.4,
        color,
        size: 3 + Math.random() * 4
      });
    }
  }

  addFloatingText(text: string, x: number, y: number, color: string, size: number = 20): void {
    this.floatingTexts.push({ text, x, y, vy: -60, life: 1.2, maxLife: 1.2, color, size });
  }

  showDeathScreen(): void {
    this.setHUD(false);
    const stats = document.getElementById('finalStats')!;
    const isRecord = this.elapsed >= this.bestTime - 0.01;
    stats.innerHTML = `
      &#x23F1; Time: <span>${this.elapsed.toFixed(1)}s${isRecord ? ' &#x2605; NEW RECORD!' : ''}</span><br>
      &#x1F4CF; Distance: <span>${Math.floor(this.distance)} tiles</span><br>
      &#x1F480; Cause: <span>${this.causeOfDeath}</span><br>
      &#x1F3C6; Bosses: <span>${this.bossesDefeated}</span><br>
      &#x2B50; Perfect Landings: <span>${this.perfectLandings}</span><br>
      &#x1F525; Max Combo: <span>${this.maxCombo}</span>
    `;
    this.setOverlay('gameOver', true);
  }

  updateCombo(grade: LandingGrade): void {
    if (grade === 'STUMBLE' || grade === 'DEAD') {
      this.combo = 0;
    } else {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
      if (grade === 'PERFECT') this.perfectLandings++;
    }
    const comboEl = document.getElementById('combo')!;
    if (this.combo > 1) {
      comboEl.textContent = 'x' + this.combo;
      if (this.combo % 5 === 0) {
        comboEl.classList.remove('pulse');
        void comboEl.offsetWidth; // reflow
        comboEl.classList.add('pulse');
        this.addFloatingText('COMBO x' + this.combo + '!', this.canvas.width - 120, 70, '#ffd700', 22);
      }
    } else {
      comboEl.textContent = '';
    }
  }

  loop(timestamp: number): void {
    const dt = Math.min((timestamp - this.lastTime) / 1000, 0.05);
    this.lastTime = timestamp;

    if (this.state === 'playing' || this.state === 'boss' || this.state === 'dead') {
      this.update(dt);
    }
    this.render();
    requestAnimationFrame((t) => this.loop(t));
  }

  update(dt: number): void {
    if (this.state === 'playing') {
      this.elapsed += dt;
      this.distance += this.scrollSpeed * dt / 40;
      this.bossSpawnTimer += dt;
      this.zoneTimer += dt;
      this.scrollSpeed = this.obstacles.getScrollSpeed(this.elapsed);

      // Zone transitions every 120s
      if (this.zoneTimer >= 120) {
        this.zoneTimer = 0;
        const nextIdx = (this.parallax.zoneIndex + 1) % ZONE_ORDER.length;
        this.parallax.startTransition(nextIdx);
      }

      // Boss trigger every 60s
      if (this.bossSpawnTimer >= 60 && !this.bossActive) {
        this.bossSpawnTimer = 0;
        this.bossActive = true;
        this.state = 'boss';
        const bossId = (this.bossesDefeated % 2) + 1;
        this.bossManager.spawnBoss(bossId);
      }

      this.obstacles.update(dt, this.elapsed, this.scrollSpeed);
    }

    if (this.state === 'boss') {
      const playerHit = this.bossManager.update(dt, this.player);
      if (playerHit) this.die('Boss Attack');
      if (this.bossManager.shakeTime > 0) {
        this.shakeX = (Math.random() - 0.5) * 12;
        this.shakeY = (Math.random() - 0.5) * 8;
      } else {
        this.shakeX = 0; this.shakeY = 0;
      }
    }

    // Player update
    if (this.state !== 'dead' && this.player) {
      const prevState = this.player.state;
      this.player.update(dt);

      // Landing detection
      if (prevState !== 'running' && this.player.state === 'running') {
        const grade = this.player.getLandingGrade();
        this.updateCombo(grade);
        const colors: Record<LandingGrade, string> = { PERFECT: '#00ff88', CLEAN: '#ffff44', STUMBLE: '#ff8800', DEAD: '#ff4444' };
        this.addFloatingText(grade, this.player.x, this.player.y - 10, colors[grade], 18);
        this.spawnParticles(this.player.x, this.player.y + this.player.HEIGHT, 6, colors[grade]);
        if (grade === 'DEAD') this.die('Bad Landing');
      }

      if (this.player.state === 'running') this.runFrame += dt * 60;

      // Obstacle collision (only in playing state, not boss where obstacles are paused)
      if (this.state === 'playing') {
        const hit = this.obstacles.checkCollision(this.player);
        if (hit) {
          const typeName: Record<ObstacleType, string> = {
            spike: 'Ground Spike', spikeCluster: 'Spike Cluster',
            saw: 'Spinning Saw', wall: 'Wall', bouncePad: 'Bounce Pad'
          };
          if (hit.type === 'bouncePad') {
            this.player.vy = -1000;
            this.player.state = 'jumping';
          } else {
            this.die(typeName[hit.type]);
          }
        }
      }
    }

    // Parallax update
    if (this.parallax) {
      const spd = (this.state === 'boss') ? 0 : this.scrollSpeed;
      this.parallax.update(dt, spd);
    }

    // Particles
    for (const p of this.particles) {
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vy += 800 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);

    // Floating texts
    for (const f of this.floatingTexts) {
      f.y += f.vy * dt;
      f.life -= dt;
    }
    this.floatingTexts = this.floatingTexts.filter(f => f.life > 0);

    // Ragdoll
    if (this.state === 'dead' && this.ragdoll.length > 0) {
      for (const seg of this.ragdoll) {
        seg.vy += 1200 * dt;
        seg.x += seg.vx * dt; seg.y += seg.vy * dt;
        seg.angle += seg.angVel * dt;
        if (seg.y + seg.len > this.groundY) {
          seg.y = this.groundY - seg.len;
          seg.vy *= -0.4;
          seg.vx *= 0.7;
          seg.angVel *= 0.8;
        }
      }
      this.ragdollTimer -= dt;
      if (this.ragdollTimer <= 0) {
        this.ragdoll = [];
        this.showDeathScreen();
      }
    }

    // HUD
    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = this.elapsed.toFixed(1) + 's';
  }

  render(): void {
    const ctx = this.ctx;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.save();
    if (this.shakeX || this.shakeY) ctx.translate(this.shakeX, this.shakeY);

    // Background
    if (this.parallax) {
      this.parallax.draw(ctx);
    } else {
      ctx.fillStyle = '#0a0020';
      ctx.fillRect(0, 0, cw, ch);
    }

    // Ground
    ctx.shadowColor = '#8b00ff';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = '#8b44ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(cw, this.groundY);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Ground fill below
    ctx.fillStyle = '#110022';
    ctx.fillRect(0, this.groundY, cw, ch - this.groundY);

    // Speed lines
    if (this.scrollSpeed > 380) {
      ctx.globalAlpha = 0.15;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      for (let i = 0; i < 7; i++) {
        const y = 60 + i * (this.groundY / 7);
        const len = 40 + Math.random() * 80;
        const x = (Date.now() * 0.3 + i * 200) % (cw + 200) - 100;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + len, y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Obstacles
    if (this.obstacles) {
      for (const obs of this.obstacles.obstacles) {
        ctx.save();
        if (obs.type === 'spike') {
          ctx.fillStyle = '#ff4444';
          ctx.shadowColor = '#ff0000'; ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.moveTo(obs.x + obs.width / 2, obs.y);
          ctx.lineTo(obs.x + obs.width, obs.y + obs.height);
          ctx.lineTo(obs.x, obs.y + obs.height);
          ctx.closePath();
          ctx.fill();
        } else if (obs.type === 'saw') {
          ctx.translate(obs.x + obs.width / 2, obs.y + obs.height / 2);
          ctx.rotate((obs.angle * Math.PI) / 180);
          drawSawShape(ctx, 22, '#888888');
        } else if (obs.type === 'wall') {
          ctx.fillStyle = '#8844aa';
          ctx.shadowColor = '#8b00ff'; ctx.shadowBlur = 8;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
          ctx.strokeStyle = '#cc88ff'; ctx.lineWidth = 2;
          ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
        } else if (obs.type === 'bouncePad') {
          ctx.fillStyle = '#00ffcc';
          ctx.shadowColor = '#00ffcc'; ctx.shadowBlur = 10;
          ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
        }
        ctx.restore();
      }
    }

    // Player trail
    if (this.player) {
      for (let i = 0; i < this.player.trailPositions.length; i++) {
        const t = this.player.trailPositions[i];
        const alpha = (i + 1) / this.player.trailPositions.length * 0.35;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.selectedSkin.color;
        ctx.beginPath();
        ctx.arc(t.x, t.y, 6 - i, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Player stickman
      if (this.player.state !== 'dead') {
        drawStickman(
          ctx,
          this.player.x,
          this.player.y,
          this.player.angle,
          this.runFrame,
          this.selectedSkin,
          this.player.state !== 'running'
        );
      }
    }

    // Ragdoll segments
    for (const seg of this.ragdoll) {
      ctx.save();
      ctx.translate(seg.x, seg.y);
      ctx.rotate(seg.angle);
      ctx.strokeStyle = this.selectedSkin.color;
      ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, seg.len); ctx.stroke();
      ctx.restore();
    }

    // Boss
    if (this.bossManager && (this.state === 'boss' || this.bossActive)) {
      this.bossManager.draw(ctx);
    }

    // Particles
    for (const p of this.particles) {
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Floating texts
    for (const f of this.floatingTexts) {
      const alpha = f.life / f.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = f.color;
      ctx.font = `bold ${f.size}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 8;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
    ctx.textAlign = 'left';

    ctx.restore();
  }
}

// ── Bootstrap ─────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Apply .btn class to all buttons for consistent CSS styling
  document.querySelectorAll('button').forEach(b => b.classList.add('btn'));
  new Game();
});
