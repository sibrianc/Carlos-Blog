import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

export type TransmutationVariant = 'home' | 'projects';

export type TransmutationPhase =
  | 'dormant'
  | 'summoning'
  | 'compression'
  | 'fracture'
  | 'release'
  | 'formationTitle'
  | 'formationMeta'
  | 'formationBody'
  | 'settle'
  | 'handoff'
  | 'handoffComplete'
  | 'shattering';

export interface TransmutationProject {
  id: string;
  title: string;
  slug: string;
  summary: string;
  tagline: string;
  problem: string;
  outcome: string;
  roleLabel: string;
  projectYear: number | null;
  status: string;
  techStack: string[];
  liveUrl: string;
  repoUrl: string;
  isFeatured: boolean;
}

export interface TransmutationViewport {
  width: number;
  height: number;
  dpr: number;
}

export interface TransmutationConfigureOptions {
  projects: TransmutationProject[];
  sourceText: string;
  variant: TransmutationVariant;
  viewport: TransmutationViewport;
}

export interface TransmutationEngineOptions {
  onPhaseChange?: (phase: TransmutationPhase) => void;
}

type Role = 0 | 1 | 2;

interface TimingPreset {
  summoning: number;
  compression: number;
  fracture: number;
  release: number;
  formationTitle: number;
  formationMeta: number;
  formationBody: number;
  settle: number;
  handoff: number;
}

interface VariantSettings {
  maxCap: number;
  areaDivisor: number;
  noiseMultiplier: number;
  radiusRatio: number;
  plaqueAlpha: number;
  portalAlpha: number;
  releaseImpulse: number;
  titleStiffness: number;
  metaStiffness: number;
  bodyStiffness: number;
}

interface FontBucket {
  font: string;
  size: number;
  color: string;
}

interface TextBlockSpec {
  text: string;
  role: Role;
  x: number;
  y: number;
  width: number;
  lineHeight: number;
  fontBucket: number;
}

interface CardPlate {
  x: number;
  y: number;
  width: number;
  height: number;
  mediaX: number;
  mediaY: number;
  mediaWidth: number;
  mediaHeight: number;
  seed: number;
}

interface GlyphTarget {
  glyph: string;
  x: number;
  y: number;
  z: number;
  role: Role;
  fontBucket: number;
}

interface LayoutSpec {
  width: number;
  height: number;
  cards: CardPlate[];
  targets: GlyphTarget[];
  dictionary: string[];
}

const ROLE_TITLE: Role = 0;
const ROLE_META: Role = 1;
const ROLE_BODY: Role = 2;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const FOCAL_LENGTH = 720;
const LOW_ALPHA = 0.01;
const SETTLE_ENERGY_THRESHOLD = 0.018;
const SETTLE_DISTANCE_THRESHOLD = 0.9;
const MAX_DT = 1 / 30;
const TECH_TERMS = [
  'Flask',
  'Jinja',
  'SQLAlchemy',
  'Alembic',
  'React',
  'Vite',
  'Tiptap',
  'Cloudinary',
  'Resend',
  'CSRFProtect',
  'Blueprint',
  'render_template',
  'db.session',
  '@app.route',
  '/api/projects',
  '/admin/projects',
  '/chronicles',
  'ProjectSummary',
  'PortfolioScene',
  'npm run build',
  'python -m flask',
  'deploy',
  'migration',
];
const PORTFOLIO_TERMS = [
  'portfolio',
  'project',
  'archive',
  'codex',
  'fragment',
  'case study',
  'liveUrl',
  'repoUrl',
  'displayOrder',
  'featured',
  'slug',
  'impact',
  'stack',
];
const RITUAL_TERMS = ['cadejo', 'milpa', 'portal', 'relic', 'omen', 'lantern', 'ash', 'sigil', 'threshold', 'black dog'];
const GLYPH_FALLBACK = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/_-.(){}[]:;@$#';
const HOME_TIMING: TimingPreset = {
  summoning: 825,
  compression: 520,
  fracture: 145,
  release: 440,
  formationTitle: 620,
  formationMeta: 520,
  formationBody: 825,
  settle: 575,
  handoff: 320,
};
const PROJECT_TIMING: TimingPreset = {
  summoning: 575,
  compression: 410,
  fracture: 180,
  release: 650,
  formationTitle: 520,
  formationMeta: 460,
  formationBody: 1040,
  settle: 740,
  handoff: 280,
};
const SETTINGS: Record<TransmutationVariant, VariantSettings> = {
  home: {
    maxCap: 4200,
    areaDivisor: 620,
    noiseMultiplier: 0.85,
    radiusRatio: 0.27,
    plaqueAlpha: 0.72,
    portalAlpha: 0.52,
    releaseImpulse: 220,
    titleStiffness: 58,
    metaStiffness: 45,
    bodyStiffness: 36,
  },
  projects: {
    maxCap: 7600,
    areaDivisor: 440,
    noiseMultiplier: 1.45,
    radiusRatio: 0.34,
    plaqueAlpha: 0.8,
    portalAlpha: 0.68,
    releaseImpulse: 340,
    titleStiffness: 66,
    metaStiffness: 52,
    bodyStiffness: 39,
  },
};
const FONT_BUCKETS: FontBucket[] = [
  { font: 'italic 700 26px Newsreader, serif', size: 26, color: '#d8c491' },
  { font: '700 12px Space Grotesk, sans-serif', size: 12, color: '#b99f68' },
  { font: '400 14px Space Grotesk, sans-serif', size: 14, color: '#d8c491' },
  { font: '700 11px Space Grotesk, sans-serif', size: 11, color: '#b99f68' },
  { font: '400 10px Space Grotesk, monospace', size: 10, color: '#3a7472' },
  { font: '400 12px Space Grotesk, monospace', size: 12, color: '#d8c491' },
  { font: '400 15px Space Grotesk, monospace', size: 15, color: '#ae1f35' },
];

export class TransmutationEngine {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly onPhaseChange?: (phase: TransmutationPhase) => void;
  private variant: TransmutationVariant = 'projects';
  private settings = SETTINGS.projects;
  private timing = PROJECT_TIMING;
  private layout: LayoutSpec = { width: 1, height: 1, cards: [], targets: [], dictionary: [] };
  private phase: TransmutationPhase = 'dormant';
  private lastEmittedPhase: TransmutationPhase = 'dormant';
  private frameId = 0;
  private running = false;
  private startTime = 0;
  private lastTime = 0;
  private handoffStartedAt = 0;
  private releaseProjected = false;
  private routeShatter = false;
  private resolveHandoff: (() => void) | null = null;
  private resolveShatter: (() => void) | null = null;
  private particleCount = 0;
  private validCount = 0;
  private glyphTable: string[] = [];
  private glyphLookup = new Map<string, number>();
  private x = new Float32Array(0);
  private y = new Float32Array(0);
  private z = new Float32Array(0);
  private ox = new Float32Array(0);
  private oy = new Float32Array(0);
  private oz = new Float32Array(0);
  private vx = new Float32Array(0);
  private vy = new Float32Array(0);
  private vz = new Float32Array(0);
  private tx = new Float32Array(0);
  private ty = new Float32Array(0);
  private tz = new Float32Array(0);
  private alpha = new Float32Array(0);
  private mass = new Float32Array(0);
  private delay = new Float32Array(0);
  private stiffness = new Float32Array(0);
  private damping = new Float32Array(0);
  private seed = new Float32Array(0);
  private valid = new Uint8Array(0);
  private alive = new Uint8Array(0);
  private role = new Uint8Array(0);
  private fontBucket = new Uint8Array(0);
  private glyphIndex = new Uint16Array(0);
  private canvasAlpha = 0;
  private dpr = 1;
  private fontCalibration = new Map<string, number>();

  constructor(canvas: HTMLCanvasElement, options: TransmutationEngineOptions = {}) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('Canvas 2D context is not available.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.onPhaseChange = options.onPhaseChange;
  }

  configure(options: TransmutationConfigureOptions) {
    this.variant = options.variant;
    this.settings = SETTINGS[options.variant];
    this.timing = options.variant === 'home' ? HOME_TIMING : PROJECT_TIMING;
    this.dpr = Math.min(options.viewport.dpr || 1, 2);
    this.layout = buildLayoutSpec(options.projects, options.sourceText, options.variant, options.viewport, this.ctx);
    this.calibrateFonts();
    this.seedParticleSystem();
    this.resizeCanvasToLayout();
    this.canvasAlpha = 0;
    this.phase = 'dormant';
    this.lastEmittedPhase = 'dormant';
    this.releaseProjected = false;
    this.routeShatter = false;
    this.handoffStartedAt = 0;
    this.drawStaticDormant();
    this.onPhaseChange?.('dormant');
  }

  beginManifestation() {
    if (!this.layout.targets.length || this.running) {
      return Promise.resolve();
    }

    this.canvasAlpha = 1;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.releaseProjected = false;
    this.routeShatter = false;
    this.handoffStartedAt = 0;
    this.phase = 'summoning';
    this.emitPhase('summoning');
    this.start();

    return new Promise<void>((resolve) => {
      this.resolveHandoff = resolve;
    });
  }

  shatterToFog() {
    if (!this.layout.targets.length) {
      return Promise.resolve();
    }

    this.canvasAlpha = 1;
    this.routeShatter = true;
    this.running = true;
    this.startTime = performance.now();
    this.lastTime = this.startTime;
    this.phase = 'shattering';
    this.emitPhase('shattering');
    this.prepareRouteShatter();
    this.frameId = requestAnimationFrame(this.tick);

    return new Promise<void>((resolve) => {
      this.resolveShatter = resolve;
    });
  }

  destroy() {
    this.stop();
    this.resolveHandoff = null;
    this.resolveShatter = null;
  }

  private start() {
    if (this.running) return;
    this.running = true;
    this.frameId = requestAnimationFrame(this.tick);
  }

  private stop() {
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
    this.frameId = 0;
    this.running = false;
  }

  private tick = (now: number) => {
    if (!this.running) return;

    const dt = Math.min(MAX_DT, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;

    if (this.routeShatter) {
      this.updateRouteShatter(now, dt);
    } else {
      this.updateManifestation(now, dt);
    }

    this.draw(now);
    this.frameId = requestAnimationFrame(this.tick);
  };

  private updateManifestation(now: number, dt: number) {
    const elapsed = now - this.startTime;
    const marks = getTimelineMarks(this.timing);
    const previousPhase = this.phase;

    if (elapsed < marks.summoning) {
      this.phase = 'summoning';
    } else if (elapsed < marks.compression) {
      this.phase = 'compression';
    } else if (elapsed < marks.fracture) {
      this.phase = 'fracture';
    } else if (elapsed < marks.release) {
      this.phase = 'release';
      if (!this.releaseProjected) this.materializeReleasePositions(now);
      this.integrateReleasedParticles(dt, 0, 0, 0);
    } else if (elapsed < marks.formationTitle) {
      this.phase = 'formationTitle';
      this.integrateReleasedParticles(dt, roleProgress(elapsed, marks.release, this.timing.formationTitle, ROLE_TITLE), 0, 0);
    } else if (elapsed < marks.formationMeta) {
      this.phase = 'formationMeta';
      this.integrateReleasedParticles(dt, 1, roleProgress(elapsed, marks.formationTitle, this.timing.formationMeta, ROLE_META), 0);
    } else if (elapsed < marks.formationBody) {
      this.phase = 'formationBody';
      this.integrateReleasedParticles(dt, 1, 1, roleProgress(elapsed, marks.formationMeta, this.timing.formationBody, ROLE_BODY));
    } else if (
      elapsed < marks.settle ||
      (!this.isSettled() && elapsed < marks.settle + (this.variant === 'home' ? 950 : 1400))
    ) {
      this.phase = 'settle';
      this.integrateReleasedParticles(dt, 1, 1, 1);
    } else if (!this.handoffStartedAt || now - this.handoffStartedAt < this.timing.handoff) {
      this.phase = 'handoff';
      if (!this.handoffStartedAt) this.handoffStartedAt = now;
      this.integrateReleasedParticles(dt, 1, 1, 1);
      this.canvasAlpha = 1 - clamp((now - this.handoffStartedAt) / this.timing.handoff, 0, 1);
    } else {
      this.phase = 'handoffComplete';
      this.canvasAlpha = 0;
      this.draw(now);
      this.emitPhase('handoffComplete');
      this.resolveHandoff?.();
      this.resolveHandoff = null;
      this.stop();
      return;
    }

    if (previousPhase !== this.phase) {
      this.emitPhase(this.phase);
    }
  }

  private updateRouteShatter(now: number, dt: number) {
    const elapsed = now - this.startTime;
    const duration = this.variant === 'home' ? 720 : 860;
    const progress = clamp(elapsed / duration, 0, 1);
    this.phase = 'shattering';
    this.canvasAlpha = 1 - smoothstep(0.62, 1, progress);

    for (let i = 0; i < this.particleCount; i += 1) {
      if (!this.alive[i]) continue;
      const s = this.seed[i];
      this.vx[i] += Math.sin(s * 12.9 + now * 0.005) * 10 * dt;
      this.vy[i] += Math.cos(s * 9.1 + now * 0.004) * 8 * dt;
      this.vz[i] += Math.sin(s * 4.7 + progress * 9) * 15 * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
      this.alpha[i] *= 1 - 1.8 * dt;
      if (this.alpha[i] < LOW_ALPHA) this.alive[i] = 0;
    }

    if (progress >= 1) {
      this.emitPhase('handoffComplete');
      this.resolveShatter?.();
      this.resolveShatter = null;
      this.stop();
    }
  }

  private integrateReleasedParticles(dt: number, titleProgress: number, metaProgress: number, bodyProgress: number) {
    for (let i = 0; i < this.particleCount; i += 1) {
      if (!this.alive[i]) continue;

      if (this.valid[i]) {
        const groupProgress = this.role[i] === ROLE_TITLE
          ? titleProgress
          : this.role[i] === ROLE_META
            ? metaProgress
            : bodyProgress;
        if (groupProgress > this.delay[i]) {
          const local = clamp((groupProgress - this.delay[i]) / Math.max(0.001, 1 - this.delay[i]), 0, 1);
          const k = this.stiffness[i] * (0.55 + local * 0.55);
          const c = this.damping[i];
          const ax = (-k * (this.x[i] - this.tx[i]) - c * this.vx[i]) / this.mass[i];
          const ay = (-k * (this.y[i] - this.ty[i]) - c * this.vy[i]) / this.mass[i];
          const az = (-k * (this.z[i] - this.tz[i]) - c * this.vz[i]) / this.mass[i];
          this.vx[i] += ax * dt;
          this.vy[i] += ay * dt;
          this.vz[i] += az * dt;
          this.alpha[i] += (0.96 - this.alpha[i]) * Math.min(1, dt * 4.5);
        } else {
          this.vx[i] *= 0.992;
          this.vy[i] *= 0.992;
          this.vz[i] *= 0.992;
        }
      } else {
        this.vx[i] *= 0.986;
        this.vy[i] = this.vy[i] * 0.982 - 8 * dt;
        this.vz[i] *= 0.98;
        this.alpha[i] *= 1 - dt * (this.variant === 'home' ? 1.7 : 2.1);
        if (this.alpha[i] < LOW_ALPHA) this.alive[i] = 0;
      }

      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
    }
  }

  private isSettled() {
    let energy = 0;
    let distance = 0;
    let count = 0;
    for (let i = 0; i < this.validCount; i += 1) {
      const speed2 = this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i];
      const dx = this.x[i] - this.tx[i];
      const dy = this.y[i] - this.ty[i];
      energy += 0.5 * this.mass[i] * speed2;
      distance += Math.sqrt(dx * dx + dy * dy);
      count += 1;
    }
    if (!count) return true;
    return energy / count < SETTLE_ENERGY_THRESHOLD && distance / count < SETTLE_DISTANCE_THRESHOLD;
  }

  private draw(now: number) {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.layout.width, this.layout.height);
    ctx.globalAlpha = this.canvasAlpha;
    drawBackdrop(ctx, this.layout, this.phase, now, this.variant);
    this.drawPlates(now);

    if (this.phase === 'summoning' || this.phase === 'compression' || this.phase === 'fracture') {
      this.drawRelicParticles(now);
    } else {
      this.drawReleasedParticles();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawStaticDormant() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.layout.width, this.layout.height);
  }

  private drawPlates(now: number) {
    const ctx = this.ctx;
    const plateFade = this.phase === 'summoning'
      ? 0.34
      : this.phase === 'compression'
        ? 0.5
        : this.phase === 'fracture'
          ? 0.62
          : 1;
    const breathe = 0.96 + Math.sin(now * 0.0013) * 0.04;
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < this.layout.cards.length; i += 1) {
      const card = this.layout.cards[i];
      const irregular = (hash01(card.seed) - 0.5) * 1.2;
      ctx.globalAlpha = this.canvasAlpha * this.settings.plaqueAlpha * plateFade;
      ctx.fillStyle = '#050303';
      roundRect(ctx, card.x + irregular, card.y, card.width, card.height, 7);
      ctx.fill();

      ctx.globalAlpha = this.canvasAlpha * 0.28 * breathe * plateFade;
      ctx.strokeStyle = '#d8c491';
      roundRect(ctx, card.x + 0.5 + irregular, card.y + 0.5, card.width - 1, card.height - 1, 7);
      ctx.stroke();

      ctx.globalAlpha = this.canvasAlpha * 0.18 * plateFade;
      ctx.fillStyle = '#17100c';
      roundRect(ctx, card.mediaX, card.mediaY, card.mediaWidth, card.mediaHeight, 5);
      ctx.fill();

      ctx.globalAlpha = this.canvasAlpha * 0.14 * plateFade;
      ctx.strokeStyle = '#7a1711';
      ctx.strokeRect(card.mediaX + 8, card.mediaY + 8, card.mediaWidth - 16, card.mediaHeight - 16);

      ctx.globalAlpha = this.canvasAlpha * 0.12 * plateFade;
      ctx.fillStyle = '#d8c491';
      for (let p = 0; p < 18; p += 1) {
        const px = card.mediaX + hash01(card.seed + p * 11) * card.mediaWidth;
        const py = card.mediaY + hash01(card.seed + p * 17) * card.mediaHeight;
        ctx.fillRect(px, py, 0.75, 0.75);
      }
    }
  }

  private drawRelicParticles(now: number) {
    const ctx = this.ctx;
    const centerX = this.layout.width * 0.5;
    const centerY = Math.min(this.layout.height * 0.46, window.innerHeight * 0.55);
    const elapsed = now - this.startTime;
    const marks = getTimelineMarks(this.timing);
    const summoning = clamp(elapsed / this.timing.summoning, 0, 1);
    const compression = smoothstep(marks.summoning, marks.compression, elapsed);
    const fracture = smoothstep(marks.compression, marks.fracture, elapsed);
    const pulse = 1 - compression * 0.28 + Math.sin(now * 0.018) * fracture * 0.018;
    const rotX = Math.sin(now * 0.00023) * 0.45;
    const rotY = now * 0.00018 + Math.sin(now * 0.00031) * 0.3;
    let lastFont = -1;

    ctx.globalCompositeOperation = fracture > 0 ? 'lighter' : 'screen';
    for (let i = 0; i < this.particleCount; i += 1) {
      const projected = projectRelic(this.ox[i] * pulse, this.oy[i] * pulse, this.oz[i] * pulse, centerX, centerY, rotX, rotY);
      const depth = clamp((projected.z + 420) / 840, 0, 1);
      const bucket = depth > 0.72 ? 6 : depth > 0.42 ? 5 : 4;
      if (bucket !== lastFont) {
        ctx.font = FONT_BUCKETS[bucket].font;
        lastFont = bucket;
      }
      ctx.fillStyle = fracture > 0 && hash01(this.seed[i] * 91) > 0.72 ? '#ae1f35' : FONT_BUCKETS[bucket].color;
      ctx.globalAlpha = this.canvasAlpha * summoning * (0.1 + depth * 0.55) * this.alpha[i];
      ctx.fillText(this.glyphTable[this.glyphIndex[i]], projected.x, projected.y);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawReleasedParticles() {
    const ctx = this.ctx;
    const routeMode = this.phase === 'shattering';
    let lastFont = -1;
    ctx.globalCompositeOperation = this.phase === 'release' || routeMode ? 'screen' : 'source-over';

    for (let i = 0; i < this.particleCount; i += 1) {
      if (!this.alive[i]) continue;
      const bucket = this.valid[i] ? this.fontBucket[i] : (hash01(this.seed[i] * 21) > 0.9 ? 4 : 5);
      if (bucket !== lastFont) {
        ctx.font = FONT_BUCKETS[bucket].font;
        lastFont = bucket;
      }

      const depth = clamp((this.z[i] + 220) / 440, 0, 1);
      ctx.fillStyle = this.valid[i]
        ? FONT_BUCKETS[bucket].color
        : hash01(this.seed[i] * 43) > 0.86 ? '#3a7472' : '#7a1711';
      ctx.globalAlpha = this.canvasAlpha * this.alpha[i] * (0.34 + depth * 0.66);
      if (routeMode || this.phase === 'release') {
        ctx.globalAlpha *= 0.72;
        ctx.fillText(this.glyphTable[this.glyphIndex[i]], this.x[i] + 0.8, this.y[i] + 0.8);
        ctx.globalAlpha = this.canvasAlpha * this.alpha[i] * (0.34 + depth * 0.66);
      }
      ctx.fillText(this.glyphTable[this.glyphIndex[i]], this.x[i], this.y[i]);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private materializeReleasePositions(now: number) {
    const centerX = this.layout.width * 0.5;
    const centerY = Math.min(this.layout.height * 0.46, window.innerHeight * 0.55);
    const rotX = Math.sin(now * 0.00023) * 0.45;
    const rotY = now * 0.00018 + Math.sin(now * 0.00031) * 0.3;

    for (let i = 0; i < this.particleCount; i += 1) {
      const projected = projectRelic(this.ox[i] * 0.72, this.oy[i] * 0.72, this.oz[i] * 0.72, centerX, centerY, rotX, rotY);
      this.x[i] = projected.x;
      this.y[i] = projected.y;
      this.z[i] = projected.z * 0.15;
      const angle = Math.atan2(this.y[i] - centerY, this.x[i] - centerX);
      const impulse = this.settings.releaseImpulse * (0.55 + hash01(this.seed[i] * 7) * 0.55);
      this.vx[i] = Math.cos(angle) * impulse + (hash01(this.seed[i] * 31) - 0.5) * 86;
      this.vy[i] = Math.sin(angle) * impulse + (hash01(this.seed[i] * 37) - 0.5) * 72;
      this.vz[i] = (hash01(this.seed[i] * 41) - 0.5) * 90;
    }

    this.releaseProjected = true;
  }

  private prepareRouteShatter() {
    const centerX = this.layout.width * 0.5;
    const centerY = Math.min(this.layout.height * 0.5, window.innerHeight * 0.62);
    for (let i = 0; i < this.particleCount; i += 1) {
      this.alive[i] = 1;
      this.alpha[i] = this.valid[i] ? 0.96 : 0.28;
      if (this.valid[i]) {
        this.x[i] = this.tx[i];
        this.y[i] = this.ty[i];
        this.z[i] = 0;
      }
      const angle = Math.atan2(this.y[i] - centerY, this.x[i] - centerX);
      const impulse = this.settings.releaseImpulse * (0.8 + hash01(this.seed[i] * 53) * 0.95);
      this.vx[i] = Math.cos(angle) * impulse + (hash01(this.seed[i] * 59) - 0.5) * 170;
      this.vy[i] = Math.sin(angle) * impulse + (hash01(this.seed[i] * 61) - 0.5) * 160;
      this.vz[i] = (hash01(this.seed[i] * 67) - 0.5) * 180;
    }
  }

  private seedParticleSystem() {
    this.glyphTable = [];
    this.glyphLookup.clear();
    const targets = this.layout.targets;
    this.validCount = targets.length;
    for (let i = 0; i < targets.length; i += 1) {
      this.getGlyphIndex(targets[i].glyph);
    }

    const adaptiveCap = getAdaptiveParticleCap(this.layout, this.variant, this.dpr, sampleFrameBudget());
    const desiredNoise = Math.floor(targets.length * this.settings.noiseMultiplier);
    this.particleCount = Math.max(targets.length, Math.min(adaptiveCap, targets.length + desiredNoise));
    this.ensureCapacity(this.particleCount);

    const dictionary = this.layout.dictionary.length ? this.layout.dictionary : TECH_TERMS;
    for (let i = 0; i < this.particleCount; i += 1) {
      const target = targets[i];
      this.valid[i] = target ? 1 : 0;
      this.alive[i] = 1;
      this.seed[i] = hash01(i * 97.13 + this.layout.width * 0.17);
      this.mass[i] = 0.85 + hash01(i * 29.7) * 0.6;
      this.alpha[i] = target ? 0.8 : 0.22 + hash01(i * 3.7) * 0.26;

      if (target) {
        this.glyphIndex[i] = this.getGlyphIndex(target.glyph);
        this.tx[i] = target.x;
        this.ty[i] = target.y;
        this.tz[i] = target.z;
        this.role[i] = target.role;
        this.fontBucket[i] = target.fontBucket;
        this.delay[i] = hash01(i * 5.31) * 0.18;
        const roleSettings = target.role === ROLE_TITLE
          ? this.settings.titleStiffness
          : target.role === ROLE_META
            ? this.settings.metaStiffness
            : this.settings.bodyStiffness;
        this.stiffness[i] = roleSettings;
        this.damping[i] = 2 * Math.sqrt(roleSettings * this.mass[i]) * 0.82;
      } else {
        const word = dictionary[Math.floor(hash01(i * 13.17) * dictionary.length)] || GLYPH_FALLBACK;
        this.glyphIndex[i] = this.getGlyphIndex(pickGlyph(word, this.seed[i]));
        this.tx[i] = this.layout.width * 0.5;
        this.ty[i] = this.layout.height * 0.5;
        this.tz[i] = 0;
        this.role[i] = ROLE_BODY;
        this.fontBucket[i] = hash01(i * 11.3) > 0.82 ? 4 : 5;
        this.delay[i] = 0;
        this.stiffness[i] = 0;
        this.damping[i] = 0;
      }
    }

    this.seedFibonacciRelic();
  }

  private seedFibonacciRelic() {
    const centerRadius = Math.min(this.layout.width, Math.min(this.layout.height, window.innerHeight || this.layout.height));
    const radius = Math.max(120, centerRadius * this.settings.radiusRatio);
    const count = Math.max(1, this.particleCount);

    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      const y = 1 - 2 * t;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * GOLDEN_ANGLE + hash01(i * 0.41) * 0.22;
      const warp = 0.82 + hash01(i * 9.91) * 0.32 + Math.sin(i * 0.117) * 0.08;
      const band = 1 + Math.sin(i * 0.031) * 0.12;
      this.ox[i] = Math.cos(theta) * ring * radius * warp;
      this.oy[i] = y * radius * 0.82 * band + Math.sin(theta * 3.1) * 8;
      this.oz[i] = Math.sin(theta) * ring * radius * (0.92 + hash01(i * 2.73) * 0.28);
      this.vx[i] = 0;
      this.vy[i] = 0;
      this.vz[i] = 0;
      this.x[i] = this.ox[i];
      this.y[i] = this.oy[i];
      this.z[i] = this.oz[i];
    }
  }

  private ensureCapacity(count: number) {
    if (this.x.length >= count) return;
    this.x = new Float32Array(count);
    this.y = new Float32Array(count);
    this.z = new Float32Array(count);
    this.ox = new Float32Array(count);
    this.oy = new Float32Array(count);
    this.oz = new Float32Array(count);
    this.vx = new Float32Array(count);
    this.vy = new Float32Array(count);
    this.vz = new Float32Array(count);
    this.tx = new Float32Array(count);
    this.ty = new Float32Array(count);
    this.tz = new Float32Array(count);
    this.alpha = new Float32Array(count);
    this.mass = new Float32Array(count);
    this.delay = new Float32Array(count);
    this.stiffness = new Float32Array(count);
    this.damping = new Float32Array(count);
    this.seed = new Float32Array(count);
    this.valid = new Uint8Array(count);
    this.alive = new Uint8Array(count);
    this.role = new Uint8Array(count);
    this.fontBucket = new Uint8Array(count);
    this.glyphIndex = new Uint16Array(count);
  }

  private resizeCanvasToLayout() {
    this.canvas.width = Math.max(1, Math.floor(this.layout.width * this.dpr));
    this.canvas.height = Math.max(1, Math.floor(this.layout.height * this.dpr));
    this.canvas.style.width = `${this.layout.width}px`;
    this.canvas.style.height = `${this.layout.height}px`;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private calibrateFonts() {
    this.fontCalibration.clear();
    for (let i = 0; i < FONT_BUCKETS.length; i += 1) {
      this.ctx.font = FONT_BUCKETS[i].font;
      const sentinel = i === 0 ? 'Manifest Codex' : 'Flask / Project 1850';
      const width = this.ctx.measureText(sentinel).width;
      this.fontCalibration.set(FONT_BUCKETS[i].font, width > 0 ? 1 : 1);
    }
  }

  private getGlyphIndex(glyph: string) {
    const existing = this.glyphLookup.get(glyph);
    if (existing !== undefined) return existing;
    const next = this.glyphTable.length;
    this.glyphTable.push(glyph);
    this.glyphLookup.set(glyph, next);
    return next;
  }

  private emitPhase(phase: TransmutationPhase) {
    if (phase === this.lastEmittedPhase) return;
    this.lastEmittedPhase = phase;
    this.onPhaseChange?.(phase);
  }
}

export function buildProjectSourceText(projects: TransmutationProject[], domText: string) {
  const projectText = projects.flatMap((project) => [
    project.title,
    project.slug,
    project.summary,
    project.tagline,
    project.problem,
    project.outcome,
    project.roleLabel,
    project.status,
    project.liveUrl,
    project.repoUrl,
    ...project.techStack,
  ]).join(' ');
  return `${domText} ${projectText}`.replace(/\s+/g, ' ').trim();
}

function buildLayoutSpec(
  projects: TransmutationProject[],
  sourceText: string,
  variant: TransmutationVariant,
  viewport: TransmutationViewport,
  ctx: CanvasRenderingContext2D,
): LayoutSpec {
  const dictionary = buildNoiseDictionary(projects, sourceText);
  if (variant === 'home') {
    return buildHomeLayout(projects.slice(0, 1), viewport, ctx, dictionary);
  }
  return buildProjectsLayout(projects, viewport, ctx, dictionary);
}

function buildHomeLayout(
  projects: TransmutationProject[],
  viewport: TransmutationViewport,
  ctx: CanvasRenderingContext2D,
  dictionary: string[],
): LayoutSpec {
  const width = Math.max(280, viewport.width);
  const isMobile = width < 680;
  const cardWidth = Math.min(width, isMobile ? 320 : 500);
  const cardX = Math.max(0, (width - cardWidth) / 2);
  const mediaHeight = isMobile ? 180 : 240;
  const padding = isMobile ? 18 : 22;
  const contentWidth = cardWidth - padding * 2;
  const blocks: TextBlockSpec[] = [];
  const targets: GlyphTarget[] = [];
  const project = projects[0];
  let y = mediaHeight + padding + 18;

  if (project) {
    y = addBlock(blocks, projectStatus(project), ROLE_META, cardX + padding, y, contentWidth, 18, 1);
    y = addBlock(blocks, project.title, ROLE_TITLE, cardX + padding, y + 6, contentWidth, 32, 0);
    y = addBlock(blocks, project.tagline || project.summary, ROLE_META, cardX + padding, y + 8, contentWidth, 23, 2);
    y = addBlock(blocks, `Case: ${project.problem || project.summary || 'Context pending.'}`, ROLE_BODY, cardX + padding, y + 8, contentWidth, 23, 2);
    y = addBlock(blocks, `Impact: ${project.outcome || project.tagline || 'Impact pending.'}`, ROLE_BODY, cardX + padding, y + 6, contentWidth, 23, 2);
    y = addTechBlocks(blocks, project.techStack.slice(0, 4), cardX + padding, y + 14, contentWidth, ROLE_META);
  }

  const cardHeight = Math.max(isMobile ? 420 : 540, y + padding - 10);
  const height = Math.ceil(cardHeight + 28);
  const card: CardPlate = {
    x: cardX,
    y: 8,
    width: cardWidth,
    height: cardHeight,
    mediaX: cardX,
    mediaY: 8,
    mediaWidth: cardWidth,
    mediaHeight,
    seed: 107,
  };

  materializeTargets(blocks, ctx, targets, 8);
  return { width, height, cards: project ? [card] : [], targets, dictionary };
}

function buildProjectsLayout(
  projects: TransmutationProject[],
  viewport: TransmutationViewport,
  ctx: CanvasRenderingContext2D,
  dictionary: string[],
): LayoutSpec {
  const width = Math.max(280, viewport.width);
  const desktop = width >= 900;
  const gap = 26;
  const targets: GlyphTarget[] = [];
  const cards: CardPlate[] = [];
  let cursorY = 0;

  for (let index = 0; index < projects.length; index += 1) {
    const project = projects[index];
    const padding = desktop ? 22 : 20;
    const cardWidth = width;
    const mediaHeight = desktop ? 320 : 200;
    const mediaWidth = desktop ? Math.floor(cardWidth * 1.1 / 2.1) : cardWidth;
    const contentWidth = desktop ? cardWidth - mediaWidth : cardWidth;
    const even = index % 2 === 1;
    const mediaX = desktop && even ? cardWidth - mediaWidth : 0;
    const contentX = desktop && even ? padding : desktop ? mediaWidth + padding : padding;
    const contentY = desktop ? cursorY + padding : cursorY + mediaHeight + padding;
    const blockWidth = Math.max(120, (desktop ? contentWidth : cardWidth) - padding * 2);
    const blocks: TextBlockSpec[] = [];
    let y = contentY;

    y = addBlock(blocks, projectStatus(project), ROLE_META, contentX, y, blockWidth, 18, 1);
    y = addBlock(blocks, project.title, ROLE_TITLE, contentX, y + 6, blockWidth, 32, 0);
    y = addBlock(blocks, project.tagline || project.summary, ROLE_META, contentX, y + 8, blockWidth, 24, 2);
    y = addBlock(blocks, `Case: ${project.problem || project.summary || 'Project context pending.'}`, ROLE_BODY, contentX, y + 8, blockWidth, 24, 2);
    y = addBlock(blocks, `Impact: ${project.outcome || project.tagline || 'Impact notes pending.'}`, ROLE_BODY, contentX, y + 6, blockWidth, 24, 2);
    y = addTechBlocks(blocks, project.techStack.slice(0, 4), contentX, y + 14, blockWidth, ROLE_META);
    y = addBlock(blocks, 'View Case', ROLE_META, contentX, y + 16, blockWidth, 18, 3);

    const contentHeight = y - cursorY + padding;
    const cardHeight = Math.max(mediaHeight, contentHeight);
    cards.push({
      x: 0,
      y: cursorY,
      width: cardWidth,
      height: cardHeight,
      mediaX,
      mediaY: cursorY,
      mediaWidth,
      mediaHeight: desktop ? cardHeight : mediaHeight,
      seed: 301 + index * 71,
    });
    materializeTargets(blocks, ctx, targets, 0);
    cursorY += cardHeight + gap;
  }

  return {
    width,
    height: Math.max(320, Math.ceil(cursorY - gap + 4)),
    cards,
    targets,
    dictionary,
  };
}

function addBlock(
  blocks: TextBlockSpec[],
  text: string,
  role: Role,
  x: number,
  y: number,
  width: number,
  lineHeight: number,
  fontBucket: number,
) {
  const cleanText = normalizeText(text);
  if (!cleanText) return y;

  const font = FONT_BUCKETS[fontBucket].font;
  const lineCount = layoutWithLines(getPrepared(cleanText, font), width, lineHeight).lineCount;
  blocks.push({
    text: cleanText,
    role,
    x,
    y,
    width,
    lineHeight,
    fontBucket,
  });
  return y + Math.max(1, lineCount) * lineHeight;
}

function addTechBlocks(
  blocks: TextBlockSpec[],
  techStack: string[],
  x: number,
  y: number,
  width: number,
  role: Role,
) {
  if (!techStack.length) return y;
  return addBlock(blocks, techStack.join(' / '), role, x, y, width, 18, 3);
}

function materializeTargets(
  blocks: TextBlockSpec[],
  ctx: CanvasRenderingContext2D,
  targets: GlyphTarget[],
  offsetY: number,
) {
  for (const block of blocks) {
    const bucket = FONT_BUCKETS[block.fontBucket];
    const prepared = getPrepared(block.text, bucket.font);
    const lines = layoutWithLines(prepared, block.width, block.lineHeight).lines;
    ctx.font = bucket.font;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const line = lines[lineIndex];
      const graphemes = splitGraphemes(line.text);
      let x = block.x;
      const y = block.y + offsetY + lineIndex * block.lineHeight + bucket.size;

      for (let glyphIndex = 0; glyphIndex < graphemes.length; glyphIndex += 1) {
        const glyph = graphemes[glyphIndex];
        if (!glyph.trim()) {
          x += ctx.measureText(glyph).width;
          continue;
        }

        const width = ctx.measureText(glyph).width;
        targets.push({
          glyph,
          x,
          y,
          z: block.role === ROLE_TITLE ? 18 : block.role === ROLE_META ? 8 : 0,
          role: block.role,
          fontBucket: block.fontBucket,
        });
        x += width;
      }
    }
  }
}

const preparedCache = new Map<string, ReturnType<typeof prepareWithSegments>>();

function getPrepared(text: string, font: string) {
  const key = `${font}\n${text}`;
  const cached = preparedCache.get(key);
  if (cached) return cached;
  const prepared = prepareWithSegments(text, font, { whiteSpace: 'normal', wordBreak: 'normal' });
  preparedCache.set(key, prepared);
  if (preparedCache.size > 240) {
    const first = preparedCache.keys().next().value;
    if (first) preparedCache.delete(first);
  }
  return prepared;
}

function buildNoiseDictionary(projects: TransmutationProject[], sourceText: string) {
  const projectTerms = projects.flatMap((project) => [
    project.title,
    project.slug,
    project.status,
    project.roleLabel,
    project.isFeatured ? 'featured' : '',
    ...project.techStack,
  ]);
  const sourceTerms = normalizeText(sourceText)
    .split(/\s+/)
    .filter((word) => word.length > 2 && word.length < 24)
    .slice(0, 120);

  const dictionary: string[] = [];
  const addWeighted = (items: string[], weight: number) => {
    for (const item of items) {
      const clean = normalizeText(item);
      if (!clean) continue;
      for (let i = 0; i < weight; i += 1) dictionary.push(clean);
    }
  };

  addWeighted([...TECH_TERMS, ...sourceTerms], 7);
  addWeighted([...PORTFOLIO_TERMS, ...projectTerms], 3);
  addWeighted(RITUAL_TERMS, 1);
  return dictionary.length ? dictionary : TECH_TERMS;
}

function getAdaptiveParticleCap(
  layout: LayoutSpec,
  variant: TransmutationVariant,
  dpr: number,
  frameBudget: number,
) {
  const settings = SETTINGS[variant];
  const visibleArea = layout.width * Math.min(layout.height, Math.max(480, window.innerHeight || layout.height));
  const areaCap = Math.floor(visibleArea / settings.areaDivisor / Math.max(1, dpr * 0.78));
  const cardPressure = layout.cards.length * (variant === 'home' ? 360 : 520);
  const budgetScale = frameBudget < 12
    ? 0.54
    : frameBudget < 16
      ? 0.72
      : frameBudget < 22
        ? 0.88
        : 1;
  const validReserve = layout.targets.length + cardPressure;
  return Math.max(layout.targets.length, Math.floor(Math.min(settings.maxCap, areaCap + validReserve) * budgetScale));
}

function sampleFrameBudget() {
  const hardware = navigator.hardwareConcurrency || 4;
  const memory = 'deviceMemory' in navigator
    ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory)
    : 4;
  return hardware * 3.2 + memory * 2.4;
}

function getTimelineMarks(timing: TimingPreset) {
  const summoning = timing.summoning;
  const compression = summoning + timing.compression;
  const fracture = compression + Math.min(220, timing.fracture);
  const release = fracture + timing.release;
  const formationTitle = release + timing.formationTitle;
  const formationMeta = formationTitle + timing.formationMeta;
  const formationBody = formationMeta + timing.formationBody;
  const settle = formationBody + timing.settle;
  const handoff = settle + timing.handoff;
  return {
    summoning,
    compression,
    fracture,
    release,
    formationTitle,
    formationMeta,
    formationBody,
    settle,
    handoff,
  };
}

function roleProgress(elapsed: number, start: number, duration: number, role: Role) {
  const delay = role === ROLE_TITLE ? 0 : role === ROLE_META ? 0.08 : 0.16;
  return easeOutCubic(clamp((elapsed - start) / duration - delay, 0, 1));
}

function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  layout: LayoutSpec,
  phase: TransmutationPhase,
  now: number,
  variant: TransmutationVariant,
) {
  const width = layout.width;
  const height = layout.height;
  const centerX = width * 0.5;
  const centerY = Math.min(height * 0.46, window.innerHeight * 0.55);
  const tension = phase === 'compression' ? 0.42 : phase === 'fracture' ? 0.72 : phase === 'shattering' ? 0.55 : 0;
  const portalAlpha = SETTINGS[variant].portalAlpha;

  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  const base = ctx.createLinearGradient(0, 0, 0, height);
  base.addColorStop(0, '#030202');
  base.addColorStop(0.56, '#070505');
  base.addColorStop(1, '#010000');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, width, height);

  const portal = ctx.createRadialGradient(centerX, centerY, 8, centerX, centerY, Math.max(width, height) * 0.62);
  portal.addColorStop(0, `rgba(0, 0, 0, ${0.96 + tension * 0.04})`);
  portal.addColorStop(0.18, `rgba(13, 6, 6, ${0.5 * portalAlpha})`);
  portal.addColorStop(0.42, `rgba(86, 0, 0, ${0.12 * portalAlpha + tension * 0.18})`);
  portal.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = portal;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.12 + tension * 0.16;
  ctx.strokeStyle = tension > 0 ? '#7a1711' : '#2f2116';
  ctx.lineWidth = 1;
  for (let i = 0; i < 5; i += 1) {
    const radiusX = 84 + i * 38 + Math.sin(now * 0.0008 + i) * 5;
    const radiusY = radiusX * (0.32 + hash01(i * 17.1) * 0.1);
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, now * 0.00014 + i * 0.38, 0.35, Math.PI * (1.5 + hash01(i) * 0.3));
    ctx.stroke();
  }

  if (phase === 'fracture') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.34;
    ctx.strokeStyle = '#ae1f35';
    ctx.lineWidth = 1;
    for (let i = 0; i < 7; i += 1) {
      const angle = hash01(i * 91.7) * Math.PI * 2;
      const length = 36 + hash01(i * 7.4) * 92;
      ctx.beginPath();
      ctx.moveTo(centerX + Math.cos(angle) * 24, centerY + Math.sin(angle) * 18);
      ctx.lineTo(centerX + Math.cos(angle) * length, centerY + Math.sin(angle) * length * 0.72);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.globalAlpha = 0.08;
  ctx.fillStyle = '#d8c491';
  for (let i = 0; i < 120; i += 1) {
    const x = hash01(i * 19.17) * width;
    const y = hash01(i * 23.91) * height;
    const flicker = 0.35 + hash01(i * 3.3 + Math.floor(now / 500)) * 0.65;
    ctx.globalAlpha = 0.025 * flicker;
    ctx.fillRect(x, y, 0.7, 0.7);
  }

  const vignette = ctx.createRadialGradient(centerX, centerY, Math.min(width, height) * 0.12, centerX, centerY, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.82)');
  ctx.globalAlpha = 1;
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
}

function projectRelic(
  x: number,
  y: number,
  z: number,
  centerX: number,
  centerY: number,
  rotX: number,
  rotY: number,
) {
  const cosX = Math.cos(rotX);
  const sinX = Math.sin(rotX);
  const cosY = Math.cos(rotY);
  const sinY = Math.sin(rotY);
  const y1 = y * cosX - z * sinX;
  const z1 = y * sinX + z * cosX;
  const x2 = x * cosY + z1 * sinY;
  const z2 = -x * sinY + z1 * cosY;
  const factor = FOCAL_LENGTH / (FOCAL_LENGTH + z2);

  return {
    x: centerX + x2 * factor,
    y: centerY + y1 * factor,
    z: z2,
    factor,
  };
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function projectStatus(project: TransmutationProject) {
  const status = project.status === 'beta'
    ? 'Beta'
    : project.status === 'archived'
      ? 'Archived'
      : 'Live';
  return `${status}${project.projectYear ? ` / ${project.projectYear}` : ''}${project.isFeatured ? ' / Featured' : ''}`;
}

function pickGlyph(word: string, seed: number) {
  const source = word || GLYPH_FALLBACK;
  const graphemes = splitGraphemes(source);
  if (!graphemes.length) return GLYPH_FALLBACK[Math.floor(seed * GLYPH_FALLBACK.length)] || '*';
  return graphemes[Math.floor(seed * graphemes.length) % graphemes.length] || '*';
}

function splitGraphemes(text: string) {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
    return Array.from(segmenter.segment(text), (segment) => segment.segment);
  }
  return Array.from(text);
}

function normalizeText(text: string | number | null | undefined) {
  return String(text ?? '')
    .replace(/\s+/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

function hash01(value: number) {
  const x = Math.sin(value * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value: number) {
  const t = clamp(value, 0, 1);
  return 1 - Math.pow(1 - t, 3);
}
