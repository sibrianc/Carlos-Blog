import { describe, expect, it } from 'vitest';
import { planLayout } from '../layoutPlanner';
import { ROLE_BODY, type FontBucket, type TextBlockInput } from '../types';

function makeBucket(id: number, size: number, family = 'Newsreader'): FontBucket {
  return {
    id,
    family,
    size,
    weight: 400,
    style: 'normal',
    letterSpacing: 1.5,
    color: '#f0ebde',
    ascent: size * 0.78,
    descent: size * 0.22,
  };
}

describe('planLayout', () => {
  it('derives grapheme targets, line metrics, and a bounded particle count from Pretext', () => {
    const blocks: TextBlockInput[] = [
      {
        id: 'body',
        text: 'Linea uno.\nLinea dos.',
        role: ROLE_BODY,
        fontBucketId: 0,
        originX: 24,
        originY: 60,
        maxWidth: 240,
        lineHeight: 30,
        align: 'left',
      },
    ];

    const plan = planLayout({
      blocks,
      fontBuckets: [makeBucket(0, 18)],
      viewport: { width: 480, height: 320, dpr: 1 },
      minTotalParticles: 220,
      maxTotalParticles: 260,
    });

    expect(plan.lines.length).toBeGreaterThan(0);
    expect(plan.targets.length).toBeGreaterThan(0);
    expect(plan.contentGlyphCount).toBe(plan.targets.length);
    expect(plan.totalParticleCount).toBeGreaterThanOrEqual(220);
    expect(plan.totalParticleCount).toBeLessThanOrEqual(260);
    expect(plan.domMirror.blocks[0]?.lineCount).toBeGreaterThanOrEqual(1);
    expect(plan.domMirror.blocks[0]?.naturalWidth).toBeGreaterThan(0);
    expect(plan.domMirror.blocks[0]?.maxLineWidth).toBeGreaterThan(0);
    expect(plan.measurementSignature.length).toBeGreaterThan(0);

    const firstLineTargets = plan.targets.filter((target) => target.y === plan.targets[0]?.y);
    for (let i = 1; i < firstLineTargets.length; i += 1) {
      expect(firstLineTargets[i]!.x).toBeGreaterThanOrEqual(firstLineTargets[i - 1]!.x);
    }
  });
});
