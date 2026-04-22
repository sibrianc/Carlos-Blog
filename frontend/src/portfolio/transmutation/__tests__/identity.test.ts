import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SteadyAnchorEngine } from '../SteadyAnchorEngine';
import { planLayout } from '../layoutPlanner';
import {
  ROLE_BODY,
  ROLE_META,
  ROLE_TITLE,
  type FontBucket,
  type LayoutPlan,
  type TextBlockInput,
} from '../types';

function makeBucket(id: number, size: number, family = 'Newsreader'): FontBucket {
  return {
    id,
    family,
    size,
    weight: 400,
    style: 'normal',
    letterSpacing: 0,
    color: 'rgb(240, 235, 220)',
    ascent: size * 0.78,
    descent: size * 0.22,
  };
}

function buildPlan(options?: {
  viewportWidth?: number;
  viewportHeight?: number;
  minTotalParticles?: number;
  maxTotalParticles?: number;
  scaffoldMultiplier?: number;
}): LayoutPlan {
  const fontBuckets: FontBucket[] = [
    makeBucket(0, 48, 'Newsreader'),
    makeBucket(1, 12, 'Space Grotesk'),
    makeBucket(2, 18, 'Newsreader'),
  ];
  const blocks: TextBlockInput[] = [
    {
      id: 'hero-headline',
      text: 'Words breathe within the deep quiet.',
      role: ROLE_TITLE,
      fontBucketId: 0,
      originX: 40,
      originY: 120,
      maxWidth: (options?.viewportWidth ?? 960) * 0.7,
      lineHeight: 56,
      align: 'left',
    },
    {
      id: 'hero-kicker',
      text: 'Volume I: The Inscription',
      role: ROLE_META,
      fontBucketId: 1,
      originX: 40,
      originY: 80,
      maxWidth: (options?.viewportWidth ?? 960) * 0.7,
      lineHeight: 18,
      align: 'left',
    },
    {
      id: 'hero-body',
      text: 'A living artifact of fragments and whispered truths etched into the ether.',
      role: ROLE_BODY,
      fontBucketId: 2,
      originX: 40,
      originY: 220,
      maxWidth: (options?.viewportWidth ?? 960) * 0.58,
      lineHeight: 28,
      align: 'left',
    },
  ];
  return planLayout({
    blocks,
    fontBuckets,
    viewport: {
      width: options?.viewportWidth ?? 960,
      height: options?.viewportHeight ?? 720,
      dpr: 1,
    },
    minTotalParticles: options?.minTotalParticles,
    maxTotalParticles: options?.maxTotalParticles,
    scaffoldMultiplier: options?.scaffoldMultiplier,
  });
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 720;
  return canvas;
}

describe('SteadyAnchorEngine — identity invariant', () => {
  let rafHandles: Array<(t: number) => void> = [];
  let originalRAF: typeof globalThis.requestAnimationFrame;
  let originalCAF: typeof globalThis.cancelAnimationFrame;

  beforeEach(() => {
    rafHandles = [];
    originalRAF = globalThis.requestAnimationFrame;
    originalCAF = globalThis.cancelAnimationFrame;
    globalThis.requestAnimationFrame = ((cb: (t: number) => void): number => {
      rafHandles.push(cb);
      return rafHandles.length;
    }) as typeof globalThis.requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() => {}) as typeof globalThis.cancelAnimationFrame;
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRAF;
    globalThis.cancelAnimationFrame = originalCAF;
    vi.restoreAllMocks();
  });

  function runFrames(count: number, startT: number, stepMs: number): number {
    let t = startT;
    for (let i = 0; i < count; i += 1) {
      const cb = rafHandles.shift();
      if (!cb) break;
      t += stepMs;
      cb(t);
    }
    return t;
  }

  function readIds(engine: SteadyAnchorEngine): number[] {
    const raw = (engine as unknown as { id: Uint32Array }).id;
    const count = (engine as unknown as { particleCount: number }).particleCount;
    return Array.from(raw.slice(0, count));
  }

  it('assigns unique ids on configure and preserves them across repeated ping-pong cycles', async () => {
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas);
    engine.configure(buildPlan());

    const initialIds = readIds(engine);
    expect(initialIds.length).toBeGreaterThan(0);
    expect(new Set(initialIds).size).toBe(initialIds.length);

    const t0 = performance.now();
    const manifest = engine.beginManifestation();
    runFrames(1600, t0, 16);
    await manifest;

    const shatter = engine.shatterToFog();
    runFrames(1600, t0 + 1600 * 16, 16);
    await shatter;

    const manifestAgain = engine.beginManifestation();
    runFrames(1600, t0 + 3200 * 16, 16);
    await manifestAgain;

    expect(readIds(engine)).toEqual(initialIds);
    engine.destroy();
  });

  it('retarget keeps current positions and velocities while targets change on resize', () => {
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas);
    engine.configure(buildPlan({ viewportWidth: 960, viewportHeight: 720 }));

    const beforeIds = readIds(engine);
    const x = (engine as unknown as { x: Float32Array }).x;
    const y = (engine as unknown as { y: Float32Array }).y;
    const vx = (engine as unknown as { vx: Float32Array }).vx;
    const vy = (engine as unknown as { vy: Float32Array }).vy;
    const tx = (engine as unknown as { tx: Float32Array }).tx;
    const ty = (engine as unknown as { ty: Float32Array }).ty;

    const snapshotX = Array.from(x.slice(0, beforeIds.length));
    const snapshotY = Array.from(y.slice(0, beforeIds.length));
    const snapshotVX = Array.from(vx.slice(0, beforeIds.length));
    const snapshotVY = Array.from(vy.slice(0, beforeIds.length));
    const snapshotTX = Array.from(tx.slice(0, beforeIds.length));
    const snapshotTY = Array.from(ty.slice(0, beforeIds.length));

    engine.retarget(buildPlan({ viewportWidth: 1180, viewportHeight: 760 }));

    expect(readIds(engine).slice(0, beforeIds.length)).toEqual(beforeIds);
    expect(Array.from(x.slice(0, beforeIds.length))).toEqual(snapshotX);
    expect(Array.from(y.slice(0, beforeIds.length))).toEqual(snapshotY);
    expect(Array.from(vx.slice(0, beforeIds.length))).toEqual(snapshotVX);
    expect(Array.from(vy.slice(0, beforeIds.length))).toEqual(snapshotVY);
    expect(Array.from(tx.slice(0, beforeIds.length))).not.toEqual(snapshotTX);
    expect(Array.from(ty.slice(0, beforeIds.length))).not.toEqual(snapshotTY);

    engine.destroy();
  });

  it('pool capacity and active particle count are grow-only across retargets', () => {
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas);
    engine.configure(buildPlan({ minTotalParticles: 220, maxTotalParticles: 240 }));

    const initialCapacity = (engine as unknown as { capacity: number }).capacity;
    const initialCount = (engine as unknown as { particleCount: number }).particleCount;

    engine.retarget(buildPlan({ minTotalParticles: 320, maxTotalParticles: 340 }));
    const grownCapacity = (engine as unknown as { capacity: number }).capacity;
    const grownCount = (engine as unknown as { particleCount: number }).particleCount;
    expect(grownCapacity).toBeGreaterThanOrEqual(initialCapacity);
    expect(grownCount).toBeGreaterThanOrEqual(initialCount);

    engine.retarget(buildPlan({ minTotalParticles: 220, maxTotalParticles: 240 }));
    const shrunkCapacity = (engine as unknown as { capacity: number }).capacity;
    const shrunkCount = (engine as unknown as { particleCount: number }).particleCount;
    expect(shrunkCapacity).toBe(grownCapacity);
    expect(shrunkCount).toBe(grownCount);

    engine.destroy();
  });

  it('alive is never reset to 0 during animation and only drops inside destroy()', async () => {
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas);
    engine.configure(buildPlan());

    const alive = (engine as unknown as { alive: Uint8Array }).alive;
    const count = (engine as unknown as { particleCount: number }).particleCount;

    for (let i = 0; i < count; i += 1) {
      expect(alive[i]).toBe(1);
    }

    const manifest = engine.beginManifestation();
    runFrames(1200, performance.now(), 16);
    await manifest;

    for (let i = 0; i < count; i += 1) {
      expect(alive[i]).toBe(1);
    }

    engine.destroy();

    for (let i = 0; i < count; i += 1) {
      expect(alive[i]).toBe(0);
    }
  });
});
