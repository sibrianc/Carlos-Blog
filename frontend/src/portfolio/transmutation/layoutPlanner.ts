import {
  clearCache,
  layoutWithLines,
  measureLineStats,
  measureNaturalWidth,
  prepareWithSegments,
} from '@chenglou/pretext';
import type {
  AmbientPlan,
  CanvasSurfacePlan,
  DomMirrorBlock,
  DomMirrorPlan,
  DomMirrorSpan,
  FontBucket,
  HomeSceneManifestPlan,
  GlyphTarget,
  LayoutPlan,
  LinePlan,
  TextBlockInput,
  Viewport,
} from './types';

export interface PlanInput {
  blocks: TextBlockInput[];
  fontBuckets: FontBucket[];
  viewport: Viewport;
  scaffoldMultiplier?: number;
  minTotalParticles?: number;
  maxTotalParticles?: number;
  surfaces?: CanvasSurfacePlan[];
  homeScene?: HomeSceneManifestPlan;
  extraTargets?: GlyphTarget[];
}

const DEV = typeof import.meta !== 'undefined' && (import.meta as { env?: { DEV?: boolean } }).env?.DEV === true;

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;
let lastMeasurementSignature: string | null = null;

function getMeasureContext(): CanvasRenderingContext2D {
  if (measureCtx) return measureCtx;
  if (typeof document === 'undefined') {
    throw new Error('layoutPlanner: document is unavailable; planLayout() requires a DOM.');
  }
  measureCanvas = document.createElement('canvas');
  measureCanvas.width = 2;
  measureCanvas.height = 2;
  const ctx = measureCanvas.getContext('2d');
  if (!ctx) {
    throw new Error('layoutPlanner: 2D canvas context is unavailable.');
  }
  measureCtx = ctx;
  return ctx;
}

let graphemeSegmenter: Intl.Segmenter | null = null;
function getGraphemeSegmenter(): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;
  if (!graphemeSegmenter) {
    graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  }
  return graphemeSegmenter;
}

function splitGraphemes(text: string): string[] {
  const seg = getGraphemeSegmenter();
  if (seg) {
    const out: string[] = [];
    for (const part of seg.segment(text)) out.push(part.segment);
    return out;
  }
  return Array.from(text);
}

export function fontShorthand(bucket: FontBucket): string {
  const style = bucket.style === 'italic' ? 'italic ' : '';
  return `${style}${bucket.weight} ${bucket.size}px ${bucket.family}`;
}

function assertNamedFont(bucket: FontBucket): void {
  if (!DEV) return;
  if (/\bsystem-ui\b/i.test(bucket.family)) {
    throw new Error(
      `layoutPlanner: font bucket ${bucket.id} uses system-ui, which is unsafe for layout accuracy. Use a named font family.`,
    );
  }
}

function alignStartX(
  align: 'left' | 'center' | 'right',
  originX: number,
  maxWidth: number,
  lineWidth: number,
): number {
  if (align === 'center') return originX + (maxWidth - lineWidth) / 2;
  if (align === 'right') return originX + (maxWidth - lineWidth);
  return originX;
}

function buildBlockSignature(block: TextBlockInput): string {
  return [
    block.id,
    block.role,
    block.fontBucketId,
    block.text.length,
    block.maxWidth.toFixed(2),
    block.lineHeight.toFixed(2),
    block.align,
    block.originX.toFixed(2),
    block.originY.toFixed(2),
  ].join('|');
}

function buildMeasurementSignature(blocks: TextBlockInput[], fontBuckets: FontBucket[]): string {
  const bucketSig = fontBuckets
    .map((bucket) => [
      bucket.id,
      bucket.family,
      bucket.size.toFixed(3),
      bucket.weight,
      bucket.style,
      bucket.letterSpacing.toFixed(3),
    ].join(':'))
    .join('#');

  const blockSig = blocks
    .map((block) => [
      block.id,
      block.fontBucketId,
      block.role,
      block.text,
      block.lineHeight.toFixed(3),
      block.align,
    ].join(':'))
    .join('#');

  return `${bucketSig}::${blockSig}`;
}

function clampInt(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function computeAmbient(targets: GlyphTarget[], viewport: Viewport, count: number): AmbientPlan {
  if (!targets.length) {
    return {
      centroidX: viewport.width / 2,
      centroidY: viewport.height / 2,
      innerRadius: Math.max(viewport.width, viewport.height) * 0.3,
      outerRadius: Math.max(viewport.width, viewport.height) * 0.55,
      count,
    };
  }
  let sumX = 0;
  let sumY = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const t of targets) {
    sumX += t.x;
    sumY += t.y;
    if (t.x < minX) minX = t.x;
    if (t.x > maxX) maxX = t.x;
    if (t.y < minY) minY = t.y;
    if (t.y > maxY) maxY = t.y;
  }
  const centroidX = sumX / targets.length;
  const centroidY = sumY / targets.length;
  const bboxRadius = Math.max((maxX - minX) / 2, (maxY - minY) / 2);
  const innerRadius = Math.max(bboxRadius * 1.1, 120);
  const outerRadius = Math.max(innerRadius * 1.6, bboxRadius * 1.8);
  return { centroidX, centroidY, innerRadius, outerRadius, count };
}

export function planLayout(input: PlanInput): LayoutPlan {
  const ctx = getMeasureContext();
  const { viewport, fontBuckets, blocks } = input;
  const measurementSignature = buildMeasurementSignature(blocks, fontBuckets);

  if (lastMeasurementSignature !== null && lastMeasurementSignature !== measurementSignature) {
    clearCache();
  }
  lastMeasurementSignature = measurementSignature;

  const bucketById = new Map<number, FontBucket>();
  for (const bucket of fontBuckets) {
    assertNamedFont(bucket);
    bucketById.set(bucket.id, bucket);
  }

  const lines: LinePlan[] = [];
  const targets: GlyphTarget[] = [];
  const mirrorBlocks: DomMirrorBlock[] = [];
  const signatureParts: string[] = [];

  for (const block of blocks) {
    signatureParts.push(buildBlockSignature(block));

    const bucket = bucketById.get(block.fontBucketId);
    if (!bucket) {
      throw new Error(`layoutPlanner: block ${block.id} references missing fontBucket ${block.fontBucketId}.`);
    }
    const font = fontShorthand(bucket);
    ctx.font = font;

    const prepared = prepareWithSegments(block.text, font);
    const blockStats = measureLineStats(prepared, block.maxWidth);
    const naturalWidth = measureNaturalWidth(prepared);
    const { lines: pretextLines } = layoutWithLines(prepared, block.maxWidth, block.lineHeight);

    const spans: DomMirrorSpan[] = [];
    let glyphCursor = 0;

    const halfLeading = Math.max(0, (block.lineHeight - bucket.size) / 2);

    for (let lineIndex = 0; lineIndex < pretextLines.length; lineIndex += 1) {
      const line = pretextLines[lineIndex];
      const graphemes = splitGraphemes(line.text);
      const measuredWidth = ctx.measureText(line.text).width;
      const spacingWidth = Math.max(0, graphemes.length - 1) * bucket.letterSpacing;
      const referenceWidth = (Number.isFinite(line.width) && line.width > 0 ? line.width : measuredWidth) + spacingWidth;
      const startX = alignStartX(block.align, block.originX, block.maxWidth, referenceWidth);
      const baselineY = block.originY + lineIndex * block.lineHeight + halfLeading + bucket.ascent;

      lines.push({
        blockId: block.id,
        role: block.role,
        fontBucketId: block.fontBucketId,
        lineIndex,
        text: line.text,
        width: referenceWidth,
        measuredWidth,
        startX,
        baselineY,
      });

      let cumulativeWidth = 0;
      let cumulativeText = '';
      for (let g = 0; g < graphemes.length; g += 1) {
        const glyph = graphemes[g];
        const x = startX + cumulativeWidth + (bucket.letterSpacing * g);
        cumulativeText += glyph;
        const nextWidth = ctx.measureText(cumulativeText).width;
        const width = nextWidth - cumulativeWidth;
        const y = baselineY;
        targets.push({
          glyph,
          x,
          y,
          role: block.role,
          fontBucketId: block.fontBucketId,
          blockId: block.id,
          glyphIndex: glyphCursor,
        });
        spans.push({
          glyph,
          glyphIndex: glyphCursor,
          lineIndex,
          x,
          y,
          width,
        });
        cumulativeWidth = nextWidth;
        glyphCursor += 1;
      }
    }

    const lineCount = Math.max(blockStats.lineCount, pretextLines.length, 1);
    const maxLineWidth = Math.max(blockStats.maxLineWidth, 0);
    const blockHeight = lineCount * block.lineHeight;

    mirrorBlocks.push({
      id: block.id,
      role: block.role,
      fontBucketId: block.fontBucketId,
      align: block.align,
      originX: block.originX,
      originY: block.originY,
      width: block.maxWidth,
      height: blockHeight || block.lineHeight,
      lineHeight: block.lineHeight,
      lineCount,
      naturalWidth,
      maxLineWidth,
      spans,
    });
  }

  const allTargets = input.extraTargets?.length ? targets.concat(input.extraTargets) : targets;

  const desiredTotal = clampInt(
    allTargets.length * (input.scaffoldMultiplier ?? 1.35),
    input.minTotalParticles ?? 220,
    input.maxTotalParticles ?? 360,
  );
  const scaffoldCount = Math.max(0, desiredTotal - allTargets.length);

  const ambient = computeAmbient(allTargets, viewport, scaffoldCount);

  const domMirror: DomMirrorPlan = {
    width: viewport.width,
    height: viewport.height,
    blocks: mirrorBlocks,
  };

  return {
    viewport,
    fontBuckets,
    blocks,
    surfaces: input.surfaces ?? [],
    homeScene: input.homeScene,
    lines,
    targets: allTargets,
    contentGlyphCount: targets.length,
    totalParticleCount: allTargets.length + scaffoldCount,
    ambient,
    domMirror,
    measurementSignature,
    signature: signatureParts.join('#') + '|v=' + viewport.width + 'x' + viewport.height,
  };
}
