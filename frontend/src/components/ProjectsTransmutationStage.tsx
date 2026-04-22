import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
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
  type SteadyAnchorHandle,
  type TextBlockInput,
  type TransmutationPhase,
} from '../portfolio/transmutation/types';

interface ProjectsTransmutationStageProps {
  children: ReactNode;
  className?: string;
  signature: string;
}

function parseFontSize(value: string): number {
  const match = /([0-9.]+)/.exec(value);
  return match ? parseFloat(match[1]) : 16;
}

function parseWeight(value: string): number {
  const n = parseInt(value, 10);
  if (Number.isFinite(n)) return n;
  return value === 'bold' ? 700 : 400;
}

function parseLetterSpacing(value: string, fontSize: number): number {
  if (!value || value === 'normal') return 0;
  const match = /(-?[0-9.]+)/.exec(value);
  if (!match) return 0;
  const n = parseFloat(match[1]);
  return value.endsWith('em') ? n * fontSize : n;
}

function parseLineHeight(value: string, fontSize: number): number {
  if (!value || value === 'normal') return fontSize * 1.25;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return fontSize * 1.25;
  return value.endsWith('px') ? n : n * fontSize;
}

function roleFromElement(el: HTMLElement) {
  const role = el.dataset.steadyRole;
  if (role === 'title') return ROLE_TITLE;
  if (role === 'meta') return ROLE_META;
  return ROLE_BODY;
}

function readBucket(id: number, el: HTMLElement): { bucket: FontBucket; lineHeight: number } {
  const cs = window.getComputedStyle(el);
  const size = parseFontSize(cs.fontSize);
  const style = (cs.fontStyle === 'italic' ? 'italic' : 'normal') as 'italic' | 'normal';
  return {
    bucket: {
      id,
      family: cs.fontFamily,
      size,
      weight: parseWeight(cs.fontWeight),
      style,
      letterSpacing: parseLetterSpacing(cs.letterSpacing, size),
      color: cs.color,
      ascent: size * 0.78,
      descent: size * 0.22,
    },
    lineHeight: parseLineHeight(cs.lineHeight, size),
  };
}

async function waitFontsReady(): Promise<void> {
  const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
  if (fonts?.ready) await fonts.ready;
}

export const ProjectsTransmutationStage = forwardRef<SteadyAnchorHandle, ProjectsTransmutationStageProps>(
  function ProjectsTransmutationStage({ children, className = '', signature }, ref) {
    const stageRef = useRef<HTMLElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const domRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<SteadyAnchorEngine | null>(null);
    const pendingComposeRef = useRef(false);

    const [phase, setPhase] = useState<TransmutationPhase>('dormant');
    const [reducedMotion, setReducedMotion] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [stageSize, setStageSize] = useState({ width: 0, height: 0 });

    useEffect(() => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const apply = () => setReducedMotion(mq.matches);
      apply();
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }, []);

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

    useEffect(() => {
      if (reducedMotion) {
        setRevealed(true);
      }
      pendingComposeRef.current = false;
    }, [reducedMotion, signature]);

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas || reducedMotion) {
        engineRef.current?.destroy();
        engineRef.current = null;
        setPhase('handoffComplete');
        return;
      }

      const engine = new SteadyAnchorEngine(canvas, { onPhaseChange: setPhase });
      engineRef.current = engine;
      return () => {
        engine.destroy();
        if (engineRef.current === engine) engineRef.current = null;
      };
    }, [reducedMotion]);

    const configurePlan = useCallback(async () => {
      if (reducedMotion) return;
      const stage = stageRef.current;
      const dom = domRef.current;
      const engine = engineRef.current;
      if (!stage || !dom || !engine || stageSize.width === 0 || stageSize.height === 0) return;

      await waitFontsReady();

      const stageRect = stage.getBoundingClientRect();
      const elements = Array.from(dom.querySelectorAll<HTMLElement>('[data-steady-block]'));
      const plates = Array.from(dom.querySelectorAll<HTMLElement>('.archival-plate'));
      const fontBuckets: FontBucket[] = [];
      const blocks: TextBlockInput[] = [];
      const surfaces: CanvasSurfacePlan[] = [];

      for (let i = 0; i < plates.length; i += 1) {
        const plate = plates[i];
        const plateRect = plate.getBoundingClientRect();
        const mediaRect = plate.querySelector<HTMLElement>('.plate-media')?.getBoundingClientRect();
        if (plateRect.width <= 0 || plateRect.height <= 0) continue;
        surfaces.push({
          id: plate.dataset.surfaceId || `project-surface-${i}`,
          x: plateRect.left - stageRect.left,
          y: plateRect.top - stageRect.top,
          width: plateRect.width,
          height: plateRect.height,
          mediaX: mediaRect ? mediaRect.left - stageRect.left : plateRect.left - stageRect.left,
          mediaY: mediaRect ? mediaRect.top - stageRect.top : plateRect.top - stageRect.top,
          mediaWidth: mediaRect ? mediaRect.width : plateRect.width,
          mediaHeight: mediaRect ? mediaRect.height : Math.min(plateRect.height * 0.5, 220),
        });
      }

      for (let i = 0; i < elements.length; i += 1) {
        const el = elements[i];
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const read = readBucket(i, el);
        fontBuckets.push(read.bucket);
        blocks.push({
          id: el.dataset.steadyBlock || `block-${i}`,
          text: el.textContent?.replace(/\s+/g, ' ').trim() || '',
          role: roleFromElement(el),
          fontBucketId: i,
          originX: rect.left - stageRect.left,
          originY: rect.top - stageRect.top,
          maxWidth: rect.width,
          lineHeight: read.lineHeight,
          align: 'left',
        });
      }

      if (!blocks.length) return;

      const plan = planLayout({
        blocks,
        fontBuckets,
        surfaces,
        scaffoldMultiplier: 5.8,
        minTotalParticles: Math.min(6200, Math.max(2800, Math.floor(stageSize.width * Math.min(stageSize.height, window.innerHeight) / 440))),
        maxTotalParticles: 7600,
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

      if (pendingComposeRef.current && engine.getPhase() === 'idleSphere') {
        pendingComposeRef.current = false;
        void engine.beginManifestation().then(() => {
          engine.completeHandoff();
          setRevealed(true);
        });
      }
    }, [reducedMotion, stageSize, signature]);

    useEffect(() => {
      void configurePlan();
    }, [configurePlan]);

    const beginManifestation = useCallback(async () => {
      const engine = engineRef.current;
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
      await engine.beginManifestation();
      engine.completeHandoff();
      setRevealed(true);
    }, []);

    const shatterToFog = useCallback(async () => {
      setRevealed(false);
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
        destroy: () => engineRef.current?.destroy(),
      }),
      [beginManifestation, setHoverExpansion, shatterToFog],
    );

    const handlePointerDown = useCallback(() => {
      if (reducedMotion || revealed) return;
      void beginManifestation();
    }, [beginManifestation, reducedMotion, revealed]);

    const handlePointerEnter = useCallback(() => {
      if (!reducedMotion && !revealed) setHoverExpansion(1);
    }, [reducedMotion, revealed, setHoverExpansion]);

    const handlePointerLeave = useCallback(() => {
      setHoverExpansion(0);
    }, [setHoverExpansion]);

    return (
      <section
        ref={stageRef}
        className={[
          'steady-project-stage',
          `is-${phase}`,
          revealed ? 'is-revealed' : 'is-concealed',
          reducedMotion ? 'is-reduced-motion' : '',
          className,
        ].filter(Boolean).join(' ')}
        data-transmutation-phase={phase}
        onPointerDown={handlePointerDown}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
      >
        <canvas ref={canvasRef} className="steady-project-canvas" aria-hidden="true" />
        <div ref={domRef} className="steady-project-dom">
          {children}
        </div>
      </section>
    );
  },
);
