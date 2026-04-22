import { fontShorthand } from './layoutPlanner';
import {
  ROLE_BODY,
  ROLE_META,
  ROLE_SCAFFOLD,
  ROLE_TITLE,
  type EngineOptions,
  type FontBucket,
  type LayoutPlan,
  type Role,
  type TransmutationPhase,
} from './types';

const DEV = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

const MAX_DT = 1 / 30;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const COMPOSE_TIMING = {
  shatter: 320,
  formationTitle: 620,
  formationMeta: 460,
  formationBody: 820,
  settleMin: 420,
  settleMax: 1800,
} as const;

const HOME_TIMING = {
  compression: 240,
  sky: 620,
  ground: 620,
  sun: 520,
  mountains: 620,
  header: 480,
  footerDock: 360,
  footerReal: 360,
  hero: 900,
  featured: 950,
  settleMin: 520,
  settleMax: 650,
} as const;

const RETURN_TIMING = {
  shatter: 360,
  reform: 980,
} as const;

const SPHERE_SPRING = {
  k: 28,
  c: 9,
} as const;

const LIQUID_SPHERE = {
  glyphSize: 12,
  hoverExpansion: 0.18,
  membraneWave: 0.045,
  surfaceShear: 0.026,
} as const;

interface RolePhysics {
  k: number;
  c: number;
  delayBase: number;
  delaySpread: number;
  finalAlpha: number;
  sphereAlpha: number;
}

const ROLE_PHYSICS: Record<Role, RolePhysics> = {
  [ROLE_TITLE]: { k: 110, c: 18, delayBase: 0, delaySpread: 0.06, finalAlpha: 0.98, sphereAlpha: 0.86 },
  [ROLE_META]: { k: 84, c: 15, delayBase: 0.04, delaySpread: 0.1, finalAlpha: 0.9, sphereAlpha: 0.78 },
  [ROLE_BODY]: { k: 70, c: 13, delayBase: 0.08, delaySpread: 0.14, finalAlpha: 0.84, sphereAlpha: 0.74 },
  [ROLE_SCAFFOLD]: { k: 22, c: 8, delayBase: 0, delaySpread: 0, finalAlpha: 0.1, sphereAlpha: 0.52 },
};

const SYMBOL_BANK = Array.from('{}[]()<>=+-/*:;,.!?@#$%^&|~0123456789');

type TransitionRoute = 'none' | 'compose' | 'sphere';

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function devAssert(condition: unknown, message: string): void {
  if (!DEV) return;
  if (!condition) {
    throw new Error('[SteadyAnchorEngine] invariant violated: ' + message);
  }
}

function scaledFontShorthand(bucket: FontBucket, scale: number): string {
  if (Math.abs(scale - 1) < 0.01) {
    return fontShorthand(bucket);
  }
  const style = bucket.style === 'italic' ? 'italic ' : '';
  return `${style}${bucket.weight} ${Math.max(6, bucket.size * scale)}px ${bucket.family}`;
}

export class SteadyAnchorEngine {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly onPhaseChange?: (phase: TransmutationPhase) => void;

  private capacity = 0;
  private particleCount = 0;
  private nextId = 1;

  private id: Uint32Array = new Uint32Array(0);
  private x: Float32Array = new Float32Array(0);
  private y: Float32Array = new Float32Array(0);
  private vx: Float32Array = new Float32Array(0);
  private vy: Float32Array = new Float32Array(0);
  private ox: Float32Array = new Float32Array(0);
  private oy: Float32Array = new Float32Array(0);
  private oz: Float32Array = new Float32Array(0);
  private tx: Float32Array = new Float32Array(0);
  private ty: Float32Array = new Float32Array(0);
  private alpha: Float32Array = new Float32Array(0);
  private alive: Uint8Array = new Uint8Array(0);
  private role: Uint8Array = new Uint8Array(0);
  private fontBucketId: Uint16Array = new Uint16Array(0);
  private glyphIndex: Uint16Array = new Uint16Array(0);
  private stiffness: Float32Array = new Float32Array(0);
  private damping: Float32Array = new Float32Array(0);
  private delay: Float32Array = new Float32Array(0);
  private seed: Float32Array = new Float32Array(0);
  private orbitScale: Float32Array = new Float32Array(0);
  private orbitSpeed: Float32Array = new Float32Array(0);
  private depth: Float32Array = new Float32Array(0);
  private scale: Float32Array = new Float32Array(0);
  private glyphAssigned: Uint8Array = new Uint8Array(0);

  private glyphTable: string[] = [];
  private glyphLookup = new Map<string, number>();
  private bucketCache = new Map<number, FontBucket>();
  private plan: LayoutPlan | null = null;

  private phase: TransmutationPhase = 'dormant';
  private lastEmittedPhase: TransmutationPhase = 'dormant';
  private running = false;
  private frameId = 0;
  private lastTime = 0;
  private transitionRoute: TransitionRoute = 'none';
  private transitionStart = 0;
  private settleStart = 0;
  private canvasAlpha = 0;
  private contentCount = 0;
  private destroying = false;

  private textCentroidX = 0;
  private textCentroidY = 0;
  private ambientInnerRadius = 0;
  private ambientOuterRadius = 0;

  private sphereCenterX = 0;
  private sphereCenterY = 0;
  private sphereRadius = 0;
  private targetSphereCenterX = 0;
  private targetSphereCenterY = 0;
  private targetSphereRadius = 0;
  private hoverExpansion = 0;
  private targetHoverExpansion = 0;

  private resolveCompose: (() => void) | null = null;
  private resolveSphere: (() => void) | null = null;
  private drawOrder: number[] = [];

  constructor(canvas: HTMLCanvasElement, options: EngineOptions = {}) {
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) {
      throw new Error('SteadyAnchorEngine: 2D canvas context is unavailable.');
    }
    this.canvas = canvas;
    this.ctx = ctx;
    this.onPhaseChange = options.onPhaseChange;
  }

  configure(plan: LayoutPlan): void {
    this.plan = plan;
    this.bucketCache = new Map(plan.fontBuckets.map((bucket) => [bucket.id, bucket] as const));
    this.contentCount = plan.targets.length;
    this.textCentroidX = plan.ambient.centroidX;
    this.textCentroidY = plan.ambient.centroidY;
    this.ambientInnerRadius = plan.ambient.innerRadius;
    this.ambientOuterRadius = plan.ambient.outerRadius;

    const initialSetup = this.particleCount === 0 || this.phase === 'dormant';

    this.resizeCanvas(plan);
    this.updateSphereMetrics(plan, initialSetup);

    const required = Math.max(plan.totalParticleCount, plan.targets.length + plan.ambient.count);
    this.ensureCapacity(required);

    const previousCount = this.particleCount;
    this.setParticleCount(Math.max(this.particleCount, required));

    for (let i = previousCount; i < this.particleCount; i += 1) {
      this.initializeSlot(i);
    }

    for (let i = 0; i < this.particleCount; i += 1) {
      if (this.alive[i] === 0) {
        this.setAlive(i, 1);
      }
    }

    this.assignContentTargets(plan);
    this.assignScaffoldTargets(plan);

    const now = performance.now();
    if (initialSetup) {
      for (let i = 0; i < this.particleCount; i += 1) {
        const sphere = this.computeSphereProjection(i, now);
        this.x[i] = sphere.x;
        this.y[i] = sphere.y;
        this.vx[i] = 0;
        this.vy[i] = 0;
        this.depth[i] = sphere.depth;
        this.scale[i] = sphere.scale;
        this.alpha[i] = this.targetSphereAlpha(i, sphere.depth);
      }
      this.transitionRoute = 'none';
      this.transitionStart = 0;
      this.settleStart = 0;
      this.emitPhase('idleSphere');
    }

    this.setCanvasAlpha(1);
    this.draw(now);
    this.start();
  }

  retarget(plan: LayoutPlan): void {
    if (!this.plan) {
      this.configure(plan);
      return;
    }

    this.plan = plan;
    this.bucketCache = new Map(plan.fontBuckets.map((bucket) => [bucket.id, bucket] as const));
    this.contentCount = plan.targets.length;
    this.textCentroidX = plan.ambient.centroidX;
    this.textCentroidY = plan.ambient.centroidY;
    this.ambientInnerRadius = plan.ambient.innerRadius;
    this.ambientOuterRadius = plan.ambient.outerRadius;

    this.resizeCanvas(plan);
    this.updateSphereMetrics(plan, false);

    const required = Math.max(plan.totalParticleCount, plan.targets.length + plan.ambient.count);
    this.ensureCapacity(required);
    const previousCount = this.particleCount;
    this.setParticleCount(Math.max(this.particleCount, required));

    for (let i = previousCount; i < this.particleCount; i += 1) {
      this.initializeSlot(i);
      const sphere = this.computeSphereProjection(i, performance.now());
      this.x[i] = sphere.x;
      this.y[i] = sphere.y;
      this.vx[i] = 0;
      this.vy[i] = 0;
      this.depth[i] = sphere.depth;
      this.scale[i] = sphere.scale;
      this.alpha[i] = this.targetSphereAlpha(i, sphere.depth);
    }

    this.assignContentTargets(plan);
    this.assignScaffoldTargets(plan);
    this.start();
  }

  beginManifestation(): Promise<void> {
    if (!this.plan || this.particleCount === 0) {
      return Promise.resolve();
    }
    if (this.transitionRoute === 'compose') {
      return Promise.resolve();
    }
    if (this.phase !== 'idleSphere' && this.phase !== 'returnToSphere' && this.phase !== 'dormant') {
      return Promise.resolve();
    }

    this.transitionRoute = 'compose';
    this.transitionStart = performance.now();
    this.settleStart = 0;
    this.primeShatterImpulse(this.textCentroidX, this.textCentroidY, 96, 188);
    this.setCanvasAlpha(1);
    this.emitPhase('shatter');
    this.start();

    return new Promise<void>((resolve) => {
      this.resolveCompose = resolve;
    });
  }

  shatterToFog(): Promise<void> {
    if (!this.plan || this.particleCount === 0) {
      return Promise.resolve();
    }
    if (this.transitionRoute === 'sphere') {
      return Promise.resolve();
    }
    if (this.phase !== 'settle' && this.phase !== 'handoffComplete') {
      return Promise.resolve();
    }

    this.setCanvasAlpha(1);
    this.transitionRoute = 'sphere';
    this.transitionStart = performance.now();
    this.primeShatterImpulse(this.textCentroidX, this.textCentroidY, 112, 210);
    this.emitPhase('shatterToFog');
    this.start();

    return new Promise<void>((resolve) => {
      this.resolveSphere = resolve;
    });
  }

  setHoverExpansion(factor: number): void {
    this.targetHoverExpansion = clamp(factor, 0, 1);
  }

  completeHandoff(): void {
    this.transitionRoute = 'none';
    this.setCanvasAlpha(0);
    this.emitPhase('handoffComplete');
    this.stop();
  }

  destroy(): void {
    this.destroying = true;
    this.stop();
    this.resolveCompose = null;
    this.resolveSphere = null;
    this.setCanvasAlpha(0);
    for (let i = 0; i < this.particleCount; i += 1) {
      this.setAlive(i, 0);
    }
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.phase = 'dormant';
    this.lastEmittedPhase = 'dormant';
    this.destroying = false;
  }

  getPhase(): TransmutationPhase {
    return this.phase;
  }

  getPixelPositionsForBlock(blockId: string): Array<{ glyphIndex: number; x: number; y: number }> {
    if (!this.plan) return [];
    const out: Array<{ glyphIndex: number; x: number; y: number }> = [];
    for (let i = 0; i < this.contentCount; i += 1) {
      const target = this.plan.targets[i];
      if (target?.blockId !== blockId) continue;
      out.push({ glyphIndex: target.glyphIndex, x: this.x[i], y: this.y[i] });
    }
    return out;
  }

  private ensureCapacity(newCount: number): void {
    if (newCount <= this.capacity) return;

    const nextCapacity = Math.max(newCount, Math.ceil(this.capacity * 1.5), 32);
    const grow = <T extends Float32Array | Uint32Array | Uint16Array | Uint8Array>(
      current: T,
      factory: (length: number) => T,
    ): T => {
      const next = factory(nextCapacity);
      next.set(current);
      return next;
    };

    this.id = grow(this.id, (length) => new Uint32Array(length));
    this.x = grow(this.x, (length) => new Float32Array(length));
    this.y = grow(this.y, (length) => new Float32Array(length));
    this.vx = grow(this.vx, (length) => new Float32Array(length));
    this.vy = grow(this.vy, (length) => new Float32Array(length));
    this.ox = grow(this.ox, (length) => new Float32Array(length));
    this.oy = grow(this.oy, (length) => new Float32Array(length));
    this.oz = grow(this.oz, (length) => new Float32Array(length));
    this.tx = grow(this.tx, (length) => new Float32Array(length));
    this.ty = grow(this.ty, (length) => new Float32Array(length));
    this.alpha = grow(this.alpha, (length) => new Float32Array(length));
    this.alive = grow(this.alive, (length) => new Uint8Array(length));
    this.role = grow(this.role, (length) => new Uint8Array(length));
    this.fontBucketId = grow(this.fontBucketId, (length) => new Uint16Array(length));
    this.glyphIndex = grow(this.glyphIndex, (length) => new Uint16Array(length));
    this.stiffness = grow(this.stiffness, (length) => new Float32Array(length));
    this.damping = grow(this.damping, (length) => new Float32Array(length));
    this.delay = grow(this.delay, (length) => new Float32Array(length));
    this.seed = grow(this.seed, (length) => new Float32Array(length));
    this.orbitScale = grow(this.orbitScale, (length) => new Float32Array(length));
    this.orbitSpeed = grow(this.orbitSpeed, (length) => new Float32Array(length));
    this.depth = grow(this.depth, (length) => new Float32Array(length));
    this.scale = grow(this.scale, (length) => new Float32Array(length));
    this.glyphAssigned = grow(this.glyphAssigned, (length) => new Uint8Array(length));

    for (let i = this.capacity; i < nextCapacity; i += 1) {
      devAssert(this.id[i] === 0, 'id slot rewritten during pool growth');
      this.id[i] = this.nextId++;
    }

    this.capacity = nextCapacity;
  }

  private resizeCanvas(plan: LayoutPlan): void {
    const width = Math.max(1, Math.floor(plan.viewport.width * plan.viewport.dpr));
    const height = Math.max(1, Math.floor(plan.viewport.height * plan.viewport.dpr));

    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    this.canvas.style.width = `${plan.viewport.width}px`;
    this.canvas.style.height = `${plan.viewport.height}px`;
  }

  private setParticleCount(nextCount: number): void {
    devAssert(nextCount >= this.particleCount, 'particleCount cannot decrease');
    this.particleCount = nextCount;
    this.drawOrder.length = nextCount;
  }

  private setCanvasAlpha(nextAlpha: number): void {
    devAssert(Number.isInteger(nextAlpha), 'canvasAlpha must be integer-only');
    devAssert(nextAlpha === 0 || nextAlpha === 1, 'canvasAlpha must remain in {0, 1}');
    this.canvasAlpha = nextAlpha;
  }

  private setAlive(index: number, next: number): void {
    devAssert(next === 0 || next === 1, 'alive flag must stay binary');
    if (next === 0) {
      devAssert(this.destroying, 'alive[i] may only become 0 inside destroy()');
    }
    this.alive[index] = next;
  }

  private getGlyphTableIndex(glyph: string): number {
    const cached = this.glyphLookup.get(glyph);
    if (cached !== undefined) return cached;
    const next = this.glyphTable.length;
    this.glyphTable.push(glyph);
    this.glyphLookup.set(glyph, next);
    return next;
  }

  private assignGlyph(index: number, glyph: string): void {
    const glyphTableIndex = this.getGlyphTableIndex(glyph);
    if (this.glyphAssigned[index]) {
      devAssert(this.glyphIndex[index] === glyphTableIndex, 'glyph identity was rewritten for an existing slot');
      return;
    }
    this.glyphIndex[index] = glyphTableIndex;
    this.glyphAssigned[index] = 1;
  }

  private initializeSlot(index: number): void {
    const slotSeed = hash01(this.id[index] * 0.731 + 1.17);
    this.seed[index] = slotSeed;
    this.orbitScale[index] = 0.88 + hash01(slotSeed * 13.7) * 0.18;
    this.orbitSpeed[index] = 0.52 + hash01(slotSeed * 19.1) * 0.42;
    this.alpha[index] = 0;
    this.scale[index] = 1;
    this.depth[index] = 0.5;
    this.seedFibonacciDirection(index);
    this.setAlive(index, 1);
  }

  private seedFibonacciDirection(index: number): void {
    const count = Math.max(this.particleCount, index + 1, 1);
    const y = 1 - 2 * ((index + 0.5) / count);
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index + hash01(this.id[index] * 0.91) * 0.32;
    this.ox[index] = Math.cos(theta) * radius;
    this.oy[index] = y;
    this.oz[index] = Math.sin(theta) * radius;
  }

  private updateSphereMetrics(plan: LayoutPlan, snap: boolean): void {
    const minSide = Math.max(320, Math.min(plan.viewport.width, plan.viewport.height));
    this.targetSphereCenterX = plan.viewport.width * 0.5;
    this.targetSphereCenterY = plan.viewport.height * 0.48;
    this.targetSphereRadius = minSide * 0.36;

    if (snap) {
      this.sphereCenterX = this.targetSphereCenterX;
      this.sphereCenterY = this.targetSphereCenterY;
      this.sphereRadius = this.targetSphereRadius;
    }
  }

  private assignContentTargets(plan: LayoutPlan): void {
    for (let i = 0; i < plan.targets.length; i += 1) {
      const target = plan.targets[i];
      const physics = ROLE_PHYSICS[target.role];
      this.assignGlyph(i, target.glyph);
      this.role[i] = target.role;
      this.fontBucketId[i] = target.fontBucketId;
      this.tx[i] = target.x;
      this.ty[i] = target.y;
      this.stiffness[i] = physics.k;
      this.damping[i] = physics.c;
      this.delay[i] = physics.delayBase + hash01(this.seed[i] * 29.7) * physics.delaySpread;
      if (this.alive[i] === 0) {
        this.setAlive(i, 1);
      }
    }
  }

  private assignScaffoldTargets(plan: LayoutPlan): void {
    const ambientCount = Math.max(1, this.particleCount - this.contentCount);
    const bucketFallback = plan.fontBuckets[0]?.id ?? 0;

    for (let offset = 0; offset < ambientCount; offset += 1) {
      const index = this.contentCount + offset;
      if (index >= this.particleCount) break;

      const t = ambientCount === 1 ? 0.5 : offset / Math.max(1, ambientCount - 1);
      const radial = lerp(this.ambientInnerRadius, this.ambientOuterRadius, Math.sqrt(t));
      const angle = GOLDEN_ANGLE * offset + hash01(this.seed[index] * 7.7) * 0.6;
      const jitter = (hash01(this.seed[index] * 37.9) - 0.5) * Math.max(12, this.ambientOuterRadius * 0.08);
      const physics = ROLE_PHYSICS[ROLE_SCAFFOLD];
      const bucketId = plan.fontBuckets[offset % Math.max(1, plan.fontBuckets.length)]?.id ?? bucketFallback;

      this.assignGlyph(index, SYMBOL_BANK[offset % SYMBOL_BANK.length] ?? '.');
      this.role[index] = ROLE_SCAFFOLD;
      this.fontBucketId[index] = bucketId;
      this.tx[index] = this.textCentroidX + Math.cos(angle) * (radial + jitter);
      this.ty[index] = this.textCentroidY + Math.sin(angle) * (radial + jitter * 0.6);
      this.stiffness[index] = physics.k;
      this.damping[index] = physics.c;
      this.delay[index] = 0;
      if (this.alive[index] === 0) {
        this.setAlive(index, 1);
      }
    }
  }

  private start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
  }

  private stop(): void {
    this.running = false;
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const dt = Math.min(MAX_DT, Math.max(0.001, (now - this.lastTime) / 1000));
    this.lastTime = now;
    this.easeSphereMetrics(dt);
    this.hoverExpansion = lerp(this.hoverExpansion, this.targetHoverExpansion, Math.min(1, dt * 7.5));

    if (this.transitionRoute === 'compose') {
      this.stepCompose(now, dt);
    } else if (this.transitionRoute === 'sphere') {
      this.stepSphereReturn(now, dt);
    } else if (this.phase === 'settle') {
      this.integrateToLayout(dt, 1, 1, 1);
    } else {
      this.emitPhase('idleSphere');
      this.integrateToSphere(dt, now, 1);
    }

    this.draw(now);
    if (this.running) {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private stepCompose(now: number, dt: number): void {
    if (this.plan?.homeScene) {
      this.stepHomeCompose(now, dt);
      return;
    }

    const elapsed = now - this.transitionStart;
    const titleStart = COMPOSE_TIMING.shatter;
    const metaStart = titleStart + COMPOSE_TIMING.formationTitle;
    const bodyStart = metaStart + COMPOSE_TIMING.formationMeta;
    const settleStart = bodyStart + COMPOSE_TIMING.formationBody;

    if (elapsed < COMPOSE_TIMING.shatter) {
      this.emitPhase('shatter');
      this.integrateBallistic(dt, 0.92, 0.89);
      return;
    }

    let titleProgress = clamp((elapsed - titleStart) / COMPOSE_TIMING.formationTitle, 0, 1);
    let metaProgress = clamp((elapsed - metaStart) / COMPOSE_TIMING.formationMeta, 0, 1);
    let bodyProgress = clamp((elapsed - bodyStart) / COMPOSE_TIMING.formationBody, 0, 1);

    if (elapsed < metaStart) {
      metaProgress = 0;
      bodyProgress = 0;
      this.emitPhase('formationTitle');
    } else if (elapsed < bodyStart) {
      bodyProgress = 0;
      this.emitPhase('formationMeta');
    } else if (elapsed < settleStart) {
      this.emitPhase('formationBody');
    } else {
      titleProgress = 1;
      metaProgress = 1;
      bodyProgress = 1;
      if (this.settleStart === 0) {
        this.settleStart = now;
      }
      this.emitPhase('settle');
    }

    this.integrateToLayout(dt, titleProgress, metaProgress, bodyProgress);

    if (this.phase === 'settle') {
      const settleElapsed = now - this.settleStart;
      if (settleElapsed >= COMPOSE_TIMING.settleMin) {
        this.transitionRoute = 'none';
        const resolve = this.resolveCompose;
        this.resolveCompose = null;
        resolve?.();
      }
    }
  }

  private stepSphereReturn(now: number, dt: number): void {
    const elapsed = now - this.transitionStart;
    if (elapsed < RETURN_TIMING.shatter) {
      this.emitPhase('shatterToFog');
      this.integrateBallistic(dt, 0.9, 0.88);
      return;
    }

    this.emitPhase('returnToSphere');
    this.integrateToSphere(dt, now, 1.28);

    if (elapsed >= RETURN_TIMING.shatter + RETURN_TIMING.reform) {
      this.transitionRoute = 'none';
      this.emitPhase('idleSphere');
      const resolve = this.resolveSphere;
      this.resolveSphere = null;
      resolve?.();
    }
  }

  private integrateBallistic(dt: number, dragX: number, dragY: number): void {
    for (let i = 0; i < this.particleCount; i += 1) {
      this.vx[i] *= Math.max(0, 1 - dragX * dt);
      this.vy[i] *= Math.max(0, 1 - dragY * dt);
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.depth[i] += (0.52 - this.depth[i]) * Math.min(1, dt * 4);
      this.scale[i] += (1.02 - this.scale[i]) * Math.min(1, dt * 5);

      const role = this.role[i] as Role;
      const alphaTarget = role === ROLE_SCAFFOLD ? 0.2 : 0.86;
      this.alpha[i] += (alphaTarget - this.alpha[i]) * Math.min(1, dt * 6);
    }
  }

  private integrateToLayout(
    dt: number,
    titleProgress: number,
    metaProgress: number,
    bodyProgress: number,
    progressForIndex?: (index: number, role: Role) => number,
    alphaForIndex?: (index: number, role: Role, activation: number, fallbackAlpha: number) => number,
  ): void {
    for (let i = 0; i < this.particleCount; i += 1) {
      const particleRole = this.role[i] as Role;
      const phaseProgress =
        progressForIndex ? progressForIndex(i, particleRole) :
        particleRole === ROLE_TITLE ? titleProgress :
        particleRole === ROLE_META ? metaProgress :
        particleRole === ROLE_BODY ? bodyProgress :
        1;
      const delay = this.delay[i];
      const activation = particleRole === ROLE_SCAFFOLD
        ? 1
        : clamp((phaseProgress - delay) / Math.max(0.001, 1 - delay), 0, 1);
      const springMix = particleRole === ROLE_SCAFFOLD
        ? 0.36
        : progressForIndex
          ? activation * 0.94
          : 0.12 + activation * 0.88;
      const k = this.stiffness[i] * springMix;
      const c = this.damping[i];

      const ax = k * (this.tx[i] - this.x[i]) - c * this.vx[i];
      const ay = k * (this.ty[i] - this.y[i]) - c * this.vy[i];

      this.vx[i] += ax * dt;
      this.vy[i] += ay * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;

      const physics = ROLE_PHYSICS[particleRole];
      const fallbackAlphaTarget = particleRole === ROLE_SCAFFOLD
        ? physics.finalAlpha
        : lerp(progressForIndex ? 0.08 : 0.24, physics.finalAlpha, activation);
      const alphaTarget = alphaForIndex
        ? alphaForIndex(i, particleRole, activation, fallbackAlphaTarget)
        : fallbackAlphaTarget;
      const scaleTarget = particleRole === ROLE_SCAFFOLD
        ? 0.88
        : lerp(progressForIndex ? 0.68 : 0.74, 1, activation);

      this.alpha[i] += (alphaTarget - this.alpha[i]) * Math.min(1, dt * 8);
      this.scale[i] += (scaleTarget - this.scale[i]) * Math.min(1, dt * 8);
      this.depth[i] += (0.5 - this.depth[i]) * Math.min(1, dt * 6);
    }
  }

  private integrateToHomeLayout(dt: number, progress: Record<string, number>, activeKey: string | null): void {
    this.integrateToLayout(dt, 0, 0, 0, (index, particleRole) => {
      if (particleRole === ROLE_SCAFFOLD) {
        return 1;
      }

      const blockId = this.plan?.targets[index]?.blockId ?? '';
      const key = this.homeKeyForBlock(blockId);
      if (blockId.startsWith('hero-')) {
        if (particleRole === ROLE_BODY) {
          return clamp(((progress.hero ?? 0) - 0.42) / 0.58, 0, 1);
        }
        return clamp((progress.hero ?? 0) / 0.58, 0, 1);
      }

      if (key && key !== 'featured') {
        return progress[key] ?? 0;
      }

      const featuredProgress = progress.featured ?? 0;
      if (particleRole === ROLE_META) {
        return clamp(featuredProgress / 0.42, 0, 1);
      }
      if (particleRole === ROLE_TITLE) {
        return clamp((featuredProgress - 0.16) / 0.54, 0, 1);
      }
      if (particleRole === ROLE_BODY) {
        return clamp((featuredProgress - 0.5) / 0.5, 0, 1);
      }
      return featuredProgress;
    }, (index, particleRole, activation, fallbackAlpha) => {
      if (particleRole === ROLE_SCAFFOLD) return fallbackAlpha;
      const blockId = this.plan?.targets[index]?.blockId ?? '';
      const key = this.homeKeyForBlock(blockId);
      if (key) {
        if (activeKey === key) {
          const phaseProgress = progress[key] ?? 0;
          const fadeOut = clamp((1 - phaseProgress) / 0.18, 0, 1);
          return lerp(0.08, fallbackAlpha, activation) * fadeOut;
        }
        return (progress[key] ?? 0) >= 1 ? 0 : 0.01;
      }
      return fallbackAlpha;
    });
  }

  private homeKeyForBlock(blockId: string): string | null {
    if (blockId.startsWith('home-mask-sky')) return 'sky';
    if (blockId.startsWith('home-mask-ground')) return 'ground';
    if (blockId.startsWith('home-mask-sun')) return 'sun';
    if (blockId.startsWith('home-mask-mountains')) return 'mountains';
    if (blockId.startsWith('home-mask-header')) return 'header';
    if (blockId.startsWith('home-mask-footer-dock')) return 'footerDock';
    if (blockId.startsWith('home-mask-footer-real')) return 'footerReal';
    if (blockId.startsWith('hero-')) return 'hero';
    if (blockId.startsWith('home-featured')) return 'featured';
    return null;
  }

  private integrateToSphere(dt: number, now: number, stiffnessScale: number): void {
    for (let i = 0; i < this.particleCount; i += 1) {
      const sphere = this.computeSphereProjection(i, now);
      const ax = SPHERE_SPRING.k * stiffnessScale * (sphere.x - this.x[i]) - SPHERE_SPRING.c * stiffnessScale * this.vx[i];
      const ay = SPHERE_SPRING.k * stiffnessScale * (sphere.y - this.y[i]) - SPHERE_SPRING.c * stiffnessScale * this.vy[i];

      this.vx[i] += ax * dt;
      this.vy[i] += ay * dt;
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;

      this.depth[i] += (sphere.depth - this.depth[i]) * Math.min(1, dt * 6);
      this.scale[i] += (sphere.scale - this.scale[i]) * Math.min(1, dt * 6);
      this.alpha[i] += (this.targetSphereAlpha(i, sphere.depth) - this.alpha[i]) * Math.min(1, dt * 6);
    }
  }

  private easeSphereMetrics(dt: number): void {
    const t = Math.min(1, dt * 3.5);
    this.sphereCenterX = lerp(this.sphereCenterX, this.targetSphereCenterX, t);
    this.sphereCenterY = lerp(this.sphereCenterY, this.targetSphereCenterY, t);
    this.sphereRadius = lerp(this.sphereRadius, this.targetSphereRadius, t);
  }

  private computeSphereProjection(index: number, now: number): { x: number; y: number; depth: number; scale: number } {
    const spin = now * 0.00034 * this.orbitSpeed[index] + this.seed[index] * Math.PI * 2;
    const tilt = 0.28 + Math.sin(now * 0.00016 + this.seed[index] * 6.3) * 0.12;

    const cosSpin = Math.cos(spin);
    const sinSpin = Math.sin(spin);
    const cosTilt = Math.cos(tilt);
    const sinTilt = Math.sin(tilt);

    const waveA = Math.sin(now * 0.0011 + this.seed[index] * 14.7);
    const waveB = Math.cos(now * 0.00073 + this.seed[index] * 21.1);
    const membrane = 1 + waveA * LIQUID_SPHERE.membraneWave + waveB * LIQUID_SPHERE.surfaceShear;
    const hover = this.hoverExpansion * LIQUID_SPHERE.hoverExpansion;

    const x0 = this.ox[index] * (membrane + hover);
    const y0 = this.oy[index] * (1 + hover * 0.78 + waveB * 0.018);
    const z0 = this.oz[index] * (membrane + hover * 1.18);

    const x1 = x0 * cosSpin + z0 * sinSpin;
    const z1 = -x0 * sinSpin + z0 * cosSpin;
    const y2 = y0 * cosTilt - z1 * sinTilt;
    const z2 = y0 * sinTilt + z1 * cosTilt;

    const localRadius = this.sphereRadius * this.orbitScale[index];
    const px = x1 * localRadius;
    const py = y2 * localRadius;
    const pz = z2 * localRadius;
    const perspective = 1 / Math.max(0.44, 1 + pz / Math.max(120, localRadius * 2.4));
    const depth = clamp((pz / Math.max(1, localRadius) + 1) * 0.5, 0, 1);

    return {
      x: this.sphereCenterX + px * perspective,
      y: this.sphereCenterY + py * perspective,
      depth,
      scale: 1,
    };
  }

  private targetSphereAlpha(index: number, depth: number): number {
    const glyph = this.glyphTable[this.glyphIndex[index]] ?? '';
    if (/^\s+$/.test(glyph)) {
      return 0;
    }
    const physics = ROLE_PHYSICS[this.role[index] as Role] ?? ROLE_PHYSICS[ROLE_SCAFFOLD];
    return physics.sphereAlpha * lerp(0.62, 1.08, depth);
  }

  private primeShatterImpulse(centerX: number, centerY: number, minImpulse: number, maxImpulse: number): void {
    for (let i = 0; i < this.particleCount; i += 1) {
      const dx = this.x[i] - centerX;
      const dy = this.y[i] - centerY;
      const angle = Math.atan2(dy || 0.0001, dx || 0.0001) + (hash01(this.seed[i] * 57.7) - 0.5) * 0.18;
      const roleFactor = this.role[i] === ROLE_SCAFFOLD ? 0.72 : 1;
      const impulse = lerp(minImpulse, maxImpulse, hash01(this.seed[i] * 61.3)) * roleFactor;
      this.vx[i] += Math.cos(angle) * impulse;
      this.vy[i] += Math.sin(angle) * impulse;
    }
  }

  private isSettled(): boolean {
    if (this.contentCount === 0) return true;
    let distance = 0;
    let speed = 0;
    for (let i = 0; i < this.contentCount; i += 1) {
      const dx = this.tx[i] - this.x[i];
      const dy = this.ty[i] - this.y[i];
      distance += Math.sqrt(dx * dx + dy * dy);
      speed += Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    }
    return distance / this.contentCount < 0.95 && speed / this.contentCount < 6;
  }

  private isNearSphere(now: number): boolean {
    if (this.particleCount === 0) return true;
    let distance = 0;
    let speed = 0;
    for (let i = 0; i < this.particleCount; i += 1) {
      const sphere = this.computeSphereProjection(i, now);
      const dx = sphere.x - this.x[i];
      const dy = sphere.y - this.y[i];
      distance += Math.sqrt(dx * dx + dy * dy);
      speed += Math.sqrt(this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i]);
    }
    return distance / this.particleCount < 3.4 && speed / this.particleCount < 14;
  }

  private draw(now: number): void {
    if (!this.plan) return;

    const ctx = this.ctx;
    ctx.setTransform(this.plan.viewport.dpr, 0, 0, this.plan.viewport.dpr, 0, 0);
    ctx.clearRect(0, 0, this.plan.viewport.width, this.plan.viewport.height);

    if (this.canvasAlpha <= 0) return;

    if (!this.plan.homeScene) {
      this.drawSurfaces(now);
    }

    for (let i = 0; i < this.particleCount; i += 1) {
      this.drawOrder[i] = i;
    }
    if (!this.plan.homeScene && this.particleCount <= 3600) {
      this.drawOrder.sort((left, right) => this.depth[left] - this.depth[right]);
    }

    const fallbackBucket = this.plan.fontBuckets[0];
    const orbitPhase =
      this.phase === 'idleSphere' ||
      this.phase === 'shatter' ||
      this.phase === 'compression' ||
      this.phase === 'homeSky' ||
      this.phase === 'homeGround' ||
      this.phase === 'homeSun' ||
      this.phase === 'homeMountains' ||
      this.phase === 'homeHeader' ||
      this.phase === 'homeFooterDock' ||
      this.phase === 'homeFooterReal' ||
      this.phase === 'shatterToFog' ||
      this.phase === 'returnToSphere';

    ctx.textBaseline = 'alphabetic';
    if (orbitPhase) {
      ctx.font = `500 ${LIQUID_SPHERE.glyphSize}px "Space Grotesk", sans-serif`;
    }
    for (let order = 0; order < this.drawOrder.length; order += 1) {
      const index = this.drawOrder[order];
      if (!this.alive[index] || this.alpha[index] <= 0.005) continue;

      const glyph = this.glyphTable[this.glyphIndex[index]] ?? '';
      if (!glyph || /^\s+$/.test(glyph)) continue;

      const bucket = this.bucketCache.get(this.fontBucketId[index]) ?? fallbackBucket;
      if (!bucket) continue;

      const drawColor = orbitPhase ? '#d8c491' : bucket.color;
      if (!orbitPhase) {
        ctx.font = scaledFontShorthand(bucket, this.scale[index]);
      }
      ctx.fillStyle = orbitPhase && this.phase === 'shatter' && hash01(this.seed[index] * 91.3) > 0.965
        ? '#7a1711'
        : drawColor;
      ctx.shadowColor = orbitPhase ? 'transparent' : drawColor;
      ctx.shadowBlur = orbitPhase ? 0 : 1.5;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      ctx.globalAlpha = this.canvasAlpha * this.alpha[index];
      ctx.fillText(glyph, this.x[index], this.y[index]);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    void now;
  }

  private drawSurfaces(now: number): void {
    if (!this.plan?.surfaces.length) return;

    const alpha = this.surfaceAlpha();
    if (alpha <= 0) return;

    const ctx = this.ctx;
    const fracture = this.phase === 'shatter' || this.phase === 'shatterToFog';

    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < this.plan.surfaces.length; i += 1) {
      const surface = this.plan.surfaces[i];
      const breath = Math.sin(now * 0.0011 + i * 1.73);
      const pressure = fracture ? 0.018 : 0.006;
      const x = surface.x + breath * surface.width * pressure;
      const y = surface.y + Math.cos(now * 0.0009 + i) * surface.height * pressure;
      const width = surface.width;
      const height = surface.height;

      ctx.globalAlpha = this.canvasAlpha * alpha * (fracture ? 0.7 : 1);
      ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
      ctx.shadowBlur = 34;
      ctx.fillStyle = 'rgba(3, 2, 2, 0.82)';
      this.tracePlate(ctx, x, y, width, height, 3);
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.strokeStyle = fracture ? 'rgba(122, 23, 17, 0.32)' : 'rgba(216, 196, 145, 0.13)';
      ctx.lineWidth = 1;
      this.tracePlate(ctx, x + 0.5, y + 0.5, Math.max(0, width - 1), Math.max(0, height - 1), 3);
      ctx.stroke();

      const mediaX = x + (surface.mediaX - surface.x);
      const mediaY = y + (surface.mediaY - surface.y);
      ctx.globalAlpha = this.canvasAlpha * alpha * 0.72;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      ctx.fillRect(mediaX, mediaY, surface.mediaWidth, surface.mediaHeight);
      ctx.strokeStyle = 'rgba(216, 196, 145, 0.08)';
      ctx.strokeRect(mediaX + 0.5, mediaY + 0.5, Math.max(0, surface.mediaWidth - 1), Math.max(0, surface.mediaHeight - 1));

      const inscriptionY = mediaY + surface.mediaHeight + Math.max(12, height * 0.08);
      ctx.globalAlpha = this.canvasAlpha * alpha * 0.2;
      ctx.fillStyle = 'rgba(216, 196, 145, 0.12)';
      ctx.fillRect(x + Math.max(16, width * 0.06), inscriptionY, width * 0.34, 1);
      ctx.fillRect(x + Math.max(16, width * 0.06), inscriptionY + 16, width * 0.56, 1);
    }

    ctx.restore();
  }

  private surfaceAlpha(): number {
    switch (this.phase) {
      case 'shatter':
      case 'shatterToFog':
        return 0.16;
      case 'formationTitle':
        return 0.48;
      case 'formationMeta':
        return 0.66;
      case 'formationBody':
        return 0.82;
      case 'homeFeatured':
        return 0.82;
      case 'settle':
        return 1;
      default:
        return 0;
    }
  }

  private stepHomeCompose(now: number, dt: number): void {
    const elapsed = now - this.transitionStart;
    const skyStart = HOME_TIMING.compression;
    const groundStart = skyStart + HOME_TIMING.sky;
    const sunStart = groundStart + HOME_TIMING.ground;
    const mountainsStart = sunStart + HOME_TIMING.sun;
    const headerStart = mountainsStart + HOME_TIMING.mountains;
    const footerDockStart = headerStart + HOME_TIMING.header;
    const footerRealStart = footerDockStart + HOME_TIMING.footerDock;
    const heroStart = footerRealStart + HOME_TIMING.footerReal;
    const featuredStart = heroStart + HOME_TIMING.hero;
    const settleStart = featuredStart + HOME_TIMING.featured;

    if (elapsed < skyStart) {
      this.emitPhase('compression');
      this.integrateBallistic(dt, 1.34, 1.24);
      return;
    }

    const progress = {
      sky: clamp((elapsed - skyStart) / HOME_TIMING.sky, 0, 1),
      ground: clamp((elapsed - groundStart) / HOME_TIMING.ground, 0, 1),
      sun: clamp((elapsed - sunStart) / HOME_TIMING.sun, 0, 1),
      mountains: clamp((elapsed - mountainsStart) / HOME_TIMING.mountains, 0, 1),
      header: clamp((elapsed - headerStart) / HOME_TIMING.header, 0, 1),
      footerDock: clamp((elapsed - footerDockStart) / HOME_TIMING.footerDock, 0, 1),
      footerReal: clamp((elapsed - footerRealStart) / HOME_TIMING.footerReal, 0, 1),
      hero: clamp((elapsed - heroStart) / HOME_TIMING.hero, 0, 1),
      featured: clamp((elapsed - featuredStart) / HOME_TIMING.featured, 0, 1),
    };

    let activeKey: string | null = null;
    if (elapsed < groundStart) {
      this.emitPhase('homeSky');
      activeKey = 'sky';
    } else if (elapsed < sunStart) {
      this.emitPhase('homeGround');
      activeKey = 'ground';
    } else if (elapsed < mountainsStart) {
      this.emitPhase('homeSun');
      activeKey = 'sun';
    } else if (elapsed < headerStart) {
      this.emitPhase('homeMountains');
      activeKey = 'mountains';
    } else if (elapsed < footerDockStart) {
      this.emitPhase('homeHeader');
      activeKey = 'header';
    } else if (elapsed < footerRealStart) {
      this.emitPhase('homeFooterDock');
      activeKey = 'footerDock';
    } else if (elapsed < heroStart) {
      this.emitPhase('homeFooterReal');
      activeKey = 'footerReal';
    } else if (elapsed < featuredStart) {
      this.emitPhase('homeHero');
      activeKey = 'hero';
    } else if (elapsed < settleStart) {
      this.emitPhase('homeFeatured');
      activeKey = 'featured';
    } else {
      if (this.settleStart === 0) {
        this.settleStart = now;
      }
      this.emitPhase('settle');
    }

    this.integrateToHomeLayout(dt, progress, activeKey);

    if (this.phase === 'settle') {
      const settleElapsed = now - this.settleStart;
      if (settleElapsed >= HOME_TIMING.settleMin && (settleElapsed >= HOME_TIMING.settleMax || this.isSettled())) {
        this.transitionRoute = 'none';
        const resolve = this.resolveCompose;
        this.resolveCompose = null;
        resolve?.();
      }
    }
  }

  private tracePlate(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    const r = Math.max(0, Math.min(radius, width / 2, height / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + width - r, y);
    ctx.arcTo(x + width, y, x + width, y + r, r);
    ctx.lineTo(x + width, y + height - r);
    ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
    ctx.lineTo(x + r, y + height);
    ctx.arcTo(x, y + height, x, y + height - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }

  private emitPhase(next: TransmutationPhase): void {
    this.phase = next;
    if (this.lastEmittedPhase === next) return;
    this.lastEmittedPhase = next;
    this.onPhaseChange?.(next);
  }
}
