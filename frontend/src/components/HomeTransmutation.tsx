import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { SteadyAnchorEngine } from '../portfolio/transmutation/SteadyAnchorEngine';
import { planLayout } from '../portfolio/transmutation/layoutPlanner';
import {
  ROLE_BODY,
  ROLE_META,
  ROLE_TITLE,
  type CanvasSurfacePlan,
  type FontBucket,
  type GlyphTarget,
  type Role,
  type SteadyAnchorHandle,
  type TextBlockInput,
  type TransmutationPhase,
} from '../portfolio/transmutation/types';

import './HomeTransmutation.css';

export interface HomeHeroContent {
  kicker: string;
  headline: string;
  body: string;
}

export interface HomeTransmutationProps {
  hero: HomeHeroContent;
  autoStart?: boolean;
  layoutSignature?: string;
  manifestReady?: boolean;
  children?: ReactNode;
}

export interface HomeRevealState {
  started: boolean;
  sky: boolean;
  ground: boolean;
  sun: boolean;
  mountains: boolean;
  header: boolean;
  footerDock: boolean;
  footerReal: boolean;
  hero: boolean;
  featured: boolean;
  complete: boolean;
}

const HOME_REVEAL_CLOSED: HomeRevealState = {
  started: false,
  sky: false,
  ground: false,
  sun: false,
  mountains: false,
  header: false,
  footerDock: false,
  footerReal: false,
  hero: false,
  featured: false,
  complete: false,
};

const HOME_REVEAL_ALL: HomeRevealState = {
  started: true,
  sky: true,
  ground: true,
  sun: true,
  mountains: true,
  header: true,
  footerDock: true,
  footerReal: true,
  hero: true,
  featured: true,
  complete: true,
};

function revealPatchForPhase(phase: TransmutationPhase): Partial<HomeRevealState> | null {
  switch (phase) {
    case 'compression':
    case 'homeSky':
      return { started: true };
    case 'homeGround':
      return { started: true, sky: true };
    case 'homeSun':
      return { started: true, sky: true, ground: true };
    case 'homeMountains':
      return { started: true, sky: true, ground: true, sun: true };
    case 'homeHeader':
      return { started: true, sky: true, ground: true, sun: true, mountains: true };
    case 'homeFooterDock':
      return { started: true, sky: true, ground: true, sun: true, mountains: true, header: true };
    case 'homeFooterReal':
      return {
        started: true,
        sky: true,
        ground: true,
        sun: true,
        mountains: true,
        header: true,
        footerDock: true,
      };
    case 'homeHero':
      return {
        started: true,
        sky: true,
        ground: true,
        sun: true,
        mountains: true,
        header: true,
        footerDock: true,
        footerReal: true,
      };
    case 'homeFeatured':
      return {
        started: true,
        sky: true,
        ground: true,
        sun: true,
        mountains: true,
        header: true,
        footerDock: true,
        footerReal: true,
        hero: true,
      };
    case 'settle':
      return {
        started: true,
        sky: true,
        ground: true,
        sun: true,
        mountains: true,
        header: true,
        footerDock: true,
        footerReal: true,
        hero: true,
        featured: true,
      };
    case 'handoffComplete':
      return HOME_REVEAL_ALL;
    default:
      return null;
  }
}

function parseFontSize(value: string): number {
  const match = /([0-9.]+)/.exec(value);
  if (!match) return 16;
  return parseFloat(match[1]);
}

function parseWeight(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isFinite(n)) return n;
  if (value === 'bold') return 700;
  return 400;
}

function parseLetterSpacing(value: string, fontSize: number): number {
  if (!value || value === 'normal') return 0;
  const match = /(-?[0-9.]+)/.exec(value);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  if (value.endsWith('em')) return n * fontSize;
  return n;
}

function parseLineHeight(value: string, fontSize: number): number {
  if (value === 'normal') return fontSize * 1.2;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fontSize * 1.2;
  if (value.endsWith('px')) return n;
  return n * fontSize;
}

function readBucket(id: number, el: HTMLElement): { bucket: FontBucket; lineHeight: number } {
  const cs = window.getComputedStyle(el);
  const size = parseFontSize(cs.fontSize);
  const weight = parseWeight(cs.fontWeight);
  const style = (cs.fontStyle === 'italic' ? 'italic' : 'normal') as 'italic' | 'normal';
  const letterSpacing = parseLetterSpacing(cs.letterSpacing, size);
  const family = cs.fontFamily;
  const color = cs.color;
  const lineHeight = parseLineHeight(cs.lineHeight, size);
  return {
    bucket: {
      id,
      family,
      size,
      weight,
      style,
      letterSpacing,
      color,
      ascent: size * 0.78,
      descent: size * 0.22,
    },
    lineHeight,
  };
}

function roleFromElement(el: HTMLElement): Role {
  const role = el.dataset.steadyRole;
  if (role === 'title') return ROLE_TITLE;
  if (role === 'meta') return ROLE_META;
  return ROLE_BODY;
}

function alignFromStyle(value: string): TextBlockInput['align'] {
  if (value === 'center') return 'center';
  if (value === 'right' || value === 'end') return 'right';
  return 'left';
}

function isIgnoredTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('[data-ha-ignore-pointer="true"], a, button, input, textarea, select, summary, [role="button"]'));
}

function pointerSphereFactor(event: ReactPointerEvent<HTMLElement>): number {
  const rect = event.currentTarget.getBoundingClientRect();
  const minSide = Math.max(320, Math.min(rect.width, rect.height));
  const cx = rect.left + rect.width * 0.5;
  const cy = rect.top + rect.height * 0.48;
  const radius = minSide * 0.36;
  const dx = event.clientX - cx;
  const dy = event.clientY - cy;
  const distance = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0, Math.min(1, 1 - (distance - radius * 0.72) / (radius * 0.56)));
}

async function waitFontsReady(): Promise<void> {
  if (typeof document === 'undefined') return;
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (fonts?.ready) {
    await fonts.ready;
  }
}

const MASK_GLYPHS = Array.from('SibrianDev{}[]()/\\|<>:*+=-_01');

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function maskGlyph(index: number): string {
  return MASK_GLYPHS[index % MASK_GLYPHS.length] ?? '.';
}

function maskTarget(blockId: string, x: number, y: number, fontBucketId: number, index: number): GlyphTarget {
  return {
    glyph: maskGlyph(index),
    x,
    y,
    role: ROLE_BODY,
    fontBucketId,
    blockId,
    glyphIndex: index,
  };
}

function rectTargets(
  blockId: string,
  x: number,
  y: number,
  width: number,
  height: number,
  count: number,
  fontBucketId: number,
  startIndex: number,
): GlyphTarget[] {
  const out: GlyphTarget[] = [];
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  for (let i = 0; i < count; i += 1) {
    const px = x + hash01((startIndex + i) * 2.17) * safeWidth;
    const py = y + hash01((startIndex + i) * 3.91) * safeHeight;
    out.push(maskTarget(blockId, px, py, fontBucketId, startIndex + i));
  }
  return out;
}

function circleTargets(
  blockId: string,
  cx: number,
  cy: number,
  radius: number,
  count: number,
  fontBucketId: number,
  startIndex: number,
): GlyphTarget[] {
  const out: GlyphTarget[] = [];
  for (let i = 0; i < count; i += 1) {
    const angle = hash01((startIndex + i) * 5.13) * Math.PI * 2;
    const radial = Math.sqrt(hash01((startIndex + i) * 7.77)) * radius;
    out.push(maskTarget(blockId, cx + Math.cos(angle) * radial, cy + Math.sin(angle) * radial, fontBucketId, startIndex + i));
  }
  return out;
}

function lineTargets(
  blockId: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  count: number,
  fontBucketId: number,
  startIndex: number,
): GlyphTarget[] {
  const out: GlyphTarget[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = count <= 1 ? 0.5 : i / (count - 1);
    const jitter = (hash01((startIndex + i) * 8.33) - 0.5) * 5;
    out.push(maskTarget(blockId, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t + jitter, fontBucketId, startIndex + i));
  }
  return out;
}

function polygonTargets(
  blockId: string,
  points: Array<{ x: number; y: number }>,
  count: number,
  fontBucketId: number,
  startIndex: number,
): GlyphTarget[] {
  const out: GlyphTarget[] = [];
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  let attempts = 0;
  while (out.length < count && attempts < count * 24) {
    const seed = startIndex + attempts;
    const x = minX + hash01(seed * 2.71) * Math.max(1, maxX - minX);
    const y = minY + hash01(seed * 4.41) * Math.max(1, maxY - minY);
    if (pointInPolygon(x, y, points)) {
      out.push(maskTarget(blockId, x, y, fontBucketId, startIndex + out.length));
    }
    attempts += 1;
  }
  return out;
}

function pointInPolygon(x: number, y: number, points: Array<{ x: number; y: number }>): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const pi = points[i];
    const pj = points[j];
    const crosses = (pi.y > y) !== (pj.y > y) && x < ((pj.x - pi.x) * (y - pi.y)) / ((pj.y - pi.y) || 1) + pi.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function landscapeFacets(width: number, height: number): Array<{ points: Array<{ x: number; y: number }> }> {
  const horizonY = height * 0.82;
  return [
    ...sharpVolcano(width * -0.05, horizonY, width * 0.1, width * 0.13, horizonY - height * 0.25, width * 0.25, horizonY, width),
    ...sharpVolcano(width * 0.15, horizonY, width * 0.42, width * 0.48, horizonY - height * 0.45, width * 0.75, horizonY, width),
    ...sharpVolcano(width * 0.65, horizonY, width * 0.72, width * 0.75, horizonY - height * 0.2, width * 0.85, horizonY, width),
  ];
}

function sharpVolcano(
  startX: number,
  startY: number,
  peakStartX: number,
  peakEndX: number,
  peakY: number,
  endX: number,
  endY: number,
  width: number,
): Array<{ points: Array<{ x: number; y: number }> }> {
  const ridges = [
    { x: startX, y: startY },
    { x: startX + (peakStartX - startX) * 0.4, y: startY - (startY - peakY) * 0.3 },
    { x: peakStartX, y: peakY },
    { x: peakEndX, y: peakY },
    { x: endX - (endX - peakEndX) * 0.4, y: startY - (startY - peakY) * 0.4 },
    { x: endX, y: endY },
  ];
  const baseCenter = { x: (startX + endX) / 2, y: startY };
  return [
    { points: [{ x: startX, y: startY }, ridges[1], { x: ridges[1].x - width * 0.05, y: startY }] },
    { points: [ridges[1], ridges[2], { x: ridges[1].x + width * 0.08, y: startY }] },
    { points: [ridges[1], { x: ridges[1].x + width * 0.08, y: startY }, { x: ridges[1].x - width * 0.05, y: startY }] },
    { points: [ridges[2], ridges[3], baseCenter] },
    { points: [ridges[2], baseCenter, { x: ridges[1].x + width * 0.08, y: startY }] },
    { points: [ridges[3], ridges[4], baseCenter] },
    { points: [ridges[4], { x: endX, y: endY }, { x: baseCenter.x + width * 0.1, y: startY }] },
    { points: [ridges[4], { x: baseCenter.x + width * 0.1, y: startY }, baseCenter] },
  ];
}

function buildHomeMaskTargets(width: number, height: number, fontBucketId: number): GlyphTarget[] {
  const out: GlyphTarget[] = [];
  const push = (targets: GlyphTarget[]) => out.push(...targets);
  const next = () => out.length;
  const horizonY = height * 0.82;
  const headerHeight = Math.max(72, Math.min(96, height * 0.11));
  const dockHeight = Math.max(92, Math.min(132, height * 0.14));

  push(rectTargets('home-mask-sky', 0, 0, width, horizonY, 680, fontBucketId, next()));
  push(rectTargets('home-mask-ground', 0, horizonY, width, height - horizonY, 320, fontBucketId, next()));
  for (let i = 0; i < 16; i += 1) {
    const x = (i / 15) * width;
    const buildingWidth = 8 + hash01(i * 2.8) * 22;
    const buildingHeight = 24 + hash01(i * 4.9) * 72;
    push(rectTargets('home-mask-ground', x - buildingWidth / 2, horizonY - buildingHeight, buildingWidth, buildingHeight, 10, fontBucketId, next()));
  }
  push(circleTargets('home-mask-sun', width * 0.9, height * 0.85, height * 0.28, 520, fontBucketId, next()));
  const facets = landscapeFacets(width, height);
  for (let i = 0; i < facets.length; i += 1) {
    push(polygonTargets('home-mask-mountains', facets[i].points, 34, fontBucketId, next()));
  }
  push(rectTargets('home-mask-header', 0, 0, width, headerHeight, 190, fontBucketId, next()));
  push(lineTargets('home-mask-header', 28, headerHeight * 0.55, 160, headerHeight * 0.55, 36, fontBucketId, next()));
  push(lineTargets('home-mask-header', width - 250, headerHeight * 0.55, width - 70, headerHeight * 0.55, 60, fontBucketId, next()));
  push(rectTargets('home-mask-footer-dock', 0, Math.max(0, height - dockHeight), width, dockHeight, 210, fontBucketId, next()));
  push(lineTargets('home-mask-footer-dock', width * 0.36, height - dockHeight * 0.52, width * 0.64, height - dockHeight * 0.52, 70, fontBucketId, next()));
  const footerY = Math.max(height - 180, height * 0.78);
  push(rectTargets('home-mask-footer-real', width * 0.18, footerY, width * 0.64, Math.min(180, height - footerY), 280, fontBucketId, next()));

  return out;
}

export const HomeTransmutation = forwardRef<SteadyAnchorHandle, HomeTransmutationProps>(
  function HomeTransmutation({ hero, autoStart = false, children, layoutSignature = '', manifestReady = true }, ref) {
    const stageRef = useRef<HTMLElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const kickerRef = useRef<HTMLParagraphElement>(null);
    const headlineRef = useRef<HTMLHeadingElement>(null);
    const bodyRef = useRef<HTMLParagraphElement>(null);
    const engineRef = useRef<SteadyAnchorEngine | null>(null);
    const pendingComposeRef = useRef(false);
    const autoStartedRef = useRef(false);

    const [phase, setPhase] = useState<TransmutationPhase>('dormant');
    const [reducedMotion, setReducedMotion] = useState(false);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
    const [revealed, setRevealed] = useState(false);
    const [reveals, setReveals] = useState<HomeRevealState>(HOME_REVEAL_CLOSED);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => setReducedMotion(mq.matches);
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }, []);

    useEffect(() => {
      if (reducedMotion) {
        setPhase('settle');
        setRevealed(true);
        setReveals(HOME_REVEAL_ALL);
        pendingComposeRef.current = false;
        autoStartedRef.current = false;
      }
    }, [reducedMotion]);

    useEffect(() => {
      if (typeof window === 'undefined') return;
      window.dispatchEvent(new CustomEvent('home-transmutation-state', { detail: { revealed: reveals.complete, reveals } }));
    }, [reveals]);

    useLayoutEffect(() => {
      const stage = stageRef.current;
      if (!stage || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver((entries) => {
        const rect = entries[0]?.contentRect;
        if (!rect) return;
        setStageSize({
          width: Math.max(0, Math.floor(rect.width)),
          height: Math.max(0, Math.floor(rect.height)),
        });
      });
      observer.observe(stage);
      return () => observer.disconnect();
    }, []);

    const handlePhaseChange = useCallback((next: TransmutationPhase) => {
      setPhase(next);
      const patch = revealPatchForPhase(next);
      if (patch) {
        setReveals((current) => ({ ...current, ...patch }));
      }
    }, []);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || reducedMotion) {
        engineRef.current?.destroy();
        engineRef.current = null;
        return;
      }

      const engine = new SteadyAnchorEngine(canvas, { onPhaseChange: handlePhaseChange });
      engineRef.current = engine;
      return () => {
        engine.destroy();
        if (engineRef.current === engine) {
          engineRef.current = null;
        }
      };
    }, [reducedMotion, handlePhaseChange]);

    const configurePlan = useCallback(async () => {
      if (reducedMotion) return;

      const stage = stageRef.current;
      const content = contentRef.current;
      const engine = engineRef.current;
      if (!stage || !content || !engine) return;
      if (stageSize.width === 0 || stageSize.height === 0) return;

      await waitFontsReady();

      const stageRect = stage.getBoundingClientRect();
      const elements = Array.from(content.querySelectorAll<HTMLElement>('[data-steady-block]'));
      const cards = Array.from(content.querySelectorAll<HTMLElement>('.home-archival-plate'));
      const fontBuckets: FontBucket[] = [];
      const blocks: TextBlockInput[] = [];
      const surfaces: CanvasSurfacePlan[] = [];

      for (let i = 0; i < cards.length; i += 1) {
        const card = cards[i];
        const cardRect = card.getBoundingClientRect();
        const mediaRect = card.querySelector<HTMLElement>('.plate-media')?.getBoundingClientRect();
        if (cardRect.width <= 0 || cardRect.height <= 0) continue;
        surfaces.push({
          id: card.dataset.surfaceId || `home-featured-surface-${i}`,
          x: cardRect.left - stageRect.left,
          y: cardRect.top - stageRect.top,
          width: cardRect.width,
          height: cardRect.height,
          mediaX: mediaRect ? mediaRect.left - stageRect.left : cardRect.left - stageRect.left,
          mediaY: mediaRect ? mediaRect.top - stageRect.top : cardRect.top - stageRect.top,
          mediaWidth: mediaRect ? mediaRect.width : cardRect.width,
          mediaHeight: mediaRect ? mediaRect.height : Math.min(cardRect.height * 0.52, 260),
        });
      }

      for (let i = 0; i < elements.length; i += 1) {
        const el = elements[i];
        const text = el.textContent?.replace(/\s+/g, ' ').trim() || '';
        const rect = el.getBoundingClientRect();
        if (!text || rect.width <= 0 || rect.height <= 0) continue;

        const read = readBucket(i, el);
        fontBuckets.push(read.bucket);
        blocks.push({
          id: el.dataset.steadyBlock || `home-block-${i}`,
          text,
          role: roleFromElement(el),
          fontBucketId: i,
          originX: rect.left - stageRect.left,
          originY: rect.top - stageRect.top,
          maxWidth: rect.width > 0 ? rect.width : stageSize.width,
          lineHeight: read.lineHeight,
          align: alignFromStyle(window.getComputedStyle(el).textAlign),
        });
      }

      if (!blocks.length || !fontBuckets.length) return;

      const maskTargets = buildHomeMaskTargets(stageSize.width, stageSize.height, fontBuckets[0].id);
      const plan = planLayout({
        blocks,
        fontBuckets,
        surfaces,
        homeScene: { enabled: true },
        extraTargets: maskTargets,
        scaffoldMultiplier: 7.2,
        minTotalParticles: Math.min(5200, Math.max(2400, Math.floor(stageSize.width * stageSize.height / 520))),
        maxTotalParticles: 6200,
        viewport: {
          width: stageSize.width,
          height: stageSize.height,
          dpr: Math.min(window.devicePixelRatio || 1, 2),
        },
      });

      if (engine.getPhase() === 'dormant') {
        engine.configure(plan);
      } else {
        engine.retarget(plan);
      }

      if (manifestReady && autoStart && !autoStartedRef.current && engine.getPhase() === 'idleSphere') {
        autoStartedRef.current = true;
        setReveals((current) => ({ ...current, started: true }));
        void engine.beginManifestation().then(() => {
          engine.completeHandoff();
          setReveals(HOME_REVEAL_ALL);
          setRevealed(true);
        });
      }

      if (manifestReady && pendingComposeRef.current && engine.getPhase() === 'idleSphere') {
        pendingComposeRef.current = false;
        setReveals((current) => ({ ...current, started: true }));
        void engine.beginManifestation().then(() => {
          engine.completeHandoff();
          setReveals(HOME_REVEAL_ALL);
          setRevealed(true);
        });
      }
    }, [autoStart, hero, layoutSignature, manifestReady, reducedMotion, stageSize]);

    useEffect(() => {
      void configurePlan();
    }, [configurePlan]);

    const beginManifestation = useCallback(async () => {
      const engine = engineRef.current;
      if (!manifestReady) {
        pendingComposeRef.current = true;
        return;
      }

      if (!engine) {
        pendingComposeRef.current = true;
        return;
      }

      const currentPhase = engine.getPhase();
      if (currentPhase === 'dormant') {
        pendingComposeRef.current = true;
        return;
      }

      if (currentPhase !== 'idleSphere' && currentPhase !== 'returnToSphere') {
        return;
      }

      pendingComposeRef.current = false;
      engine.setHoverExpansion(0);
      setReveals((current) => ({ ...current, started: true }));
      await engine.beginManifestation();
      engine.completeHandoff();
      setReveals(HOME_REVEAL_ALL);
      setRevealed(true);
    }, [manifestReady]);

    const shatterToFog = useCallback(async () => {
      setRevealed(false);
      setReveals(HOME_REVEAL_CLOSED);
      await engineRef.current?.shatterToFog();
    }, []);

    const setHoverExpansion = useCallback((factor: number) => {
      engineRef.current?.setHoverExpansion(factor);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        beginManifestation,
        shatterToFog,
        setHoverExpansion,
        destroy: () => {
          engineRef.current?.destroy();
        },
      }),
      [beginManifestation, setHoverExpansion, shatterToFog],
    );

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
      if (reducedMotion) return;
      if (isIgnoredTarget(event.target)) return;

      const engine = engineRef.current;
      if (!engine) {
        pendingComposeRef.current = true;
        return;
      }

      const currentPhase = engine.getPhase();
      if (currentPhase === 'idleSphere' || currentPhase === 'returnToSphere' || currentPhase === 'dormant') {
        if (pointerSphereFactor(event) <= 0) return;
        pendingComposeRef.current = false;
        void beginManifestation();
        return;
      }

      if (currentPhase === 'settle') {
        void engine.shatterToFog();
      }
    }, [beginManifestation, reducedMotion]);

    const handlePointerPresence = useCallback((event: ReactPointerEvent<HTMLElement>) => {
      if (!reducedMotion && !revealed && !reveals.started) {
        setHoverExpansion(pointerSphereFactor(event));
      }
    }, [reducedMotion, revealed, reveals.started, setHoverExpansion]);

    const handlePointerLeave = useCallback(() => {
      setHoverExpansion(0);
    }, [setHoverExpansion]);

    return (
      <section
        ref={stageRef}
        className={[
          'ha-stage',
          `is-${phase}`,
          revealed ? 'is-revealed' : 'is-concealed',
          reveals.sky || reducedMotion ? 'has-scene-open' : '',
          reveals.hero || reducedMotion ? 'show-hero' : '',
          reveals.featured || reducedMotion ? 'show-featured' : '',
          reducedMotion ? 'is-reduced-motion' : '',
        ].filter(Boolean).join(' ')}
        data-transmutation-phase={phase}
        onPointerDownCapture={handlePointerDown}
        onPointerEnter={handlePointerPresence}
        onPointerMove={handlePointerPresence}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      >
        <canvas
          ref={canvasRef}
          className="ha-canvas"
          aria-hidden="true"
          style={{ display: reducedMotion ? 'none' : 'block' }}
        />
        <div ref={contentRef} className="ha-dom" aria-hidden={!revealed && !reducedMotion}>
          <div className="ha-mirror" aria-hidden="false">
            <p ref={kickerRef} className="ha-kicker" data-steady-block="hero-kicker" data-steady-role="meta">
              {hero.kicker}
            </p>
            <h1 ref={headlineRef} className="ha-headline" data-steady-block="hero-headline" data-steady-role="title">
              {hero.headline}
            </h1>
            <p ref={bodyRef} className="ha-body" data-steady-block="hero-body" data-steady-role="body">
              {hero.body}
            </p>
          </div>
          {children ? (
            <div className="ha-featured-flow">
              {children}
            </div>
          ) : null}
        </div>
      </section>
    );
  },
);
