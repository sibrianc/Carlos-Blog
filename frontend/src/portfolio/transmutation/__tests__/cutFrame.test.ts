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
  type TransmutationPhase,
} from '../types';

function makeBucket(id: number, size: number, family: string): FontBucket {
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

function buildPlan(): LayoutPlan {
  const fontBuckets: FontBucket[] = [
    makeBucket(0, 40, 'Newsreader'),
    makeBucket(1, 12, 'Space Grotesk'),
    makeBucket(2, 16, 'Newsreader'),
  ];
  const blocks: TextBlockInput[] = [
    {
      id: 'hero-headline',
      text: 'The anchor holds steady.',
      role: ROLE_TITLE,
      fontBucketId: 0,
      originX: 40,
      originY: 140,
      maxWidth: 720,
      lineHeight: 48,
      align: 'left',
    },
    {
      id: 'hero-kicker',
      text: 'Volume I',
      role: ROLE_META,
      fontBucketId: 1,
      originX: 40,
      originY: 96,
      maxWidth: 720,
      lineHeight: 18,
      align: 'left',
    },
    {
      id: 'hero-body',
      text: 'One pool, many roles.',
      role: ROLE_BODY,
      fontBucketId: 2,
      originX: 40,
      originY: 240,
      maxWidth: 720,
      lineHeight: 26,
      align: 'left',
    },
  ];
  return planLayout({
    blocks,
    fontBuckets,
    viewport: { width: 960, height: 640, dpr: 1 },
    minTotalParticles: 240,
    maxTotalParticles: 280,
  });
}

function makeCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = 960;
  canvas.height = 640;
  return canvas;
}

describe('SteadyAnchorEngine — home ping-pong cycle', () => {
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

  it('moves through idle sphere, composition, and return to sphere without handoff phases', async () => {
    const phases: TransmutationPhase[] = [];
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas, {
      onPhaseChange: (phase) => phases.push(phase),
    });
    engine.configure(buildPlan());

    expect(engine.getPhase()).toBe('idleSphere');

    const manifest = engine.beginManifestation();
    let t = runFrames(1600, performance.now(), 16);
    await manifest;

    expect(phases).toContain('idleSphere');
    expect(phases).toContain('shatter');
    expect(phases).toContain('formationTitle');
    expect(phases).toContain('formationMeta');
    expect(phases).toContain('formationBody');
    expect(phases).toContain('settle');
    expect(phases).not.toContain('handoffComplete');
    expect(phases).not.toContain('cutPending');

    const shatter = engine.shatterToFog();
    t = runFrames(1600, t, 16);
    await shatter;

    expect(phases).toContain('shatterToFog');
    expect(phases).toContain('returnToSphere');
    expect(engine.getPhase()).toBe('idleSphere');

    engine.destroy();
  });

  it('settles content particles close to their layout targets instead of snapping to a DOM cut', async () => {
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas);
    const plan = buildPlan();
    engine.configure(plan);

    const manifest = engine.beginManifestation();
    runFrames(1800, performance.now(), 16);
    await manifest;

    const x = (engine as unknown as { x: Float32Array }).x;
    const y = (engine as unknown as { y: Float32Array }).y;
    const tx = (engine as unknown as { tx: Float32Array }).tx;
    const ty = (engine as unknown as { ty: Float32Array }).ty;

    const contentCount = plan.targets.length;
    for (let i = 0; i < contentCount; i += 1) {
      expect(Math.abs(x[i] - tx[i])).toBeLessThanOrEqual(2);
      expect(Math.abs(y[i] - ty[i])).toBeLessThanOrEqual(2);
    }

    engine.destroy();
  });

  it('canvasAlpha stays discrete across compose and return cycles', async () => {
    const canvas = makeCanvas();
    const engine = new SteadyAnchorEngine(canvas);
    engine.configure(buildPlan());

    const seen = new Set<number>();
    const snapshot = () => {
      const alpha = (engine as unknown as { canvasAlpha: number }).canvasAlpha;
      seen.add(alpha);
    };

    snapshot();
    const manifest = engine.beginManifestation();
    let t = performance.now();
    for (let frame = 0; frame < 1600; frame += 1) {
      const cb = rafHandles.shift();
      if (!cb) break;
      t += 16;
      cb(t);
      snapshot();
    }
    await manifest;

    const shatter = engine.shatterToFog();
    for (let frame = 0; frame < 1600; frame += 1) {
      const cb = rafHandles.shift();
      if (!cb) break;
      t += 16;
      cb(t);
      snapshot();
    }
    await shatter;
    snapshot();

    expect(Array.from(seen)).toEqual(expect.arrayContaining([1]));
    for (const value of seen) {
      expect([0, 1]).toContain(value);
    }

    engine.destroy();
  });
});
