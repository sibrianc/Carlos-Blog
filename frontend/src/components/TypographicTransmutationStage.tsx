import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  buildProjectSourceText,
  TransmutationEngine,
  type TransmutationPhase,
  type TransmutationProject,
  type TransmutationVariant,
} from '../portfolio/effects/transmutedTextFog';

export interface TypographicTransmutationHandle {
  beginManifestation: () => Promise<void>;
  shatterToFog: () => Promise<void>;
}

interface TypographicTransmutationStageProps {
  autoStart?: boolean;
  children: ReactNode;
  className?: string;
  projects: TransmutationProject[];
  variant: TransmutationVariant;
}

export const TypographicTransmutationStage = forwardRef<
  TypographicTransmutationHandle,
  TypographicTransmutationStageProps
>(function TypographicTransmutationStage(
  {
    autoStart = true,
    children,
    className = '',
    projects,
    variant,
  },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const domLayerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const engineRef = useRef<TransmutationEngine | null>(null);
  const engineReadyRef = useRef(false);
  const hasManifestedRef = useRef(false);
  const pendingManifestationRef = useRef(false);
  const [phase, setPhase] = useState<TransmutationPhase>('dormant');
  const [stageWidth, setStageWidth] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  const projectSignature = useMemo(
    () => projects.map((project) => `${project.id}:${project.slug}:${project.title}`).join('|'),
    [projects],
  );

  const beginWhenReady = () => {
    if (hasManifestedRef.current) return Promise.resolve();
    if (!engineRef.current || !engineReadyRef.current) {
      pendingManifestationRef.current = true;
      return Promise.resolve();
    }

    pendingManifestationRef.current = false;
    hasManifestedRef.current = true;
    return engineRef.current.beginManifestation();
  };

  useImperativeHandle(ref, () => ({
    beginManifestation: beginWhenReady,
    shatterToFog: () => engineRef.current?.shatterToFog() ?? Promise.resolve(),
  }));

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width || 0;
      setStageWidth(Math.max(0, Math.floor(width)));
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    hasManifestedRef.current = false;
    pendingManifestationRef.current = false;
    engineReadyRef.current = false;
  }, [projectSignature, variant]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || reducedMotion) {
      engineRef.current?.destroy();
      engineRef.current = null;
      engineReadyRef.current = false;
      setPhase('handoffComplete');
      return;
    }

    const engine = new TransmutationEngine(canvas, {
      onPhaseChange: setPhase,
    });
    engineRef.current = engine;
    return () => {
      engine.destroy();
      if (engineRef.current === engine) {
        engineRef.current = null;
      }
    };
  }, [reducedMotion]);

  useEffect(() => {
    const engine = engineRef.current;
    const domLayer = domLayerRef.current;
    if (!engine || !domLayer || reducedMotion || !stageWidth || !projects.length) return;

    const configure = () => {
      const sourceText = buildProjectSourceText(projects, domLayer.textContent || '');
      engine.configure({
        projects,
        sourceText,
        variant,
        viewport: {
          width: stageWidth,
          height: window.innerHeight || 720,
          dpr: window.devicePixelRatio || 1,
        },
      });
      engineReadyRef.current = true;
      if (pendingManifestationRef.current) {
        void beginWhenReady();
      }
    };

    engineReadyRef.current = false;
    configure();
    window.addEventListener('resize', configure);
    return () => window.removeEventListener('resize', configure);
  }, [projectSignature, projects, reducedMotion, stageWidth, variant]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !autoStart || reducedMotion || !projects.length) return;

    const beginOnce = () => {
      void beginWhenReady();
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) beginOnce();
      },
      {
        root: null,
        rootMargin: variant === 'home' ? '-4% 0px -16% 0px' : '-8% 0px -18% 0px',
        threshold: variant === 'home' ? 0.24 : 0.16,
      },
    );

    observer.observe(stage);
    return () => observer.disconnect();
  }, [autoStart, projectSignature, projects.length, reducedMotion, variant]);

  const canvasActive = !reducedMotion && phase !== 'dormant' && phase !== 'handoffComplete';
  const stageClassName = [
    'typographic-transmutation-stage',
    `is-${variant}`,
    `is-${phase}`,
    canvasActive ? 'is-canvas-active' : 'is-dom-visible',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section
      ref={stageRef}
      className={stageClassName}
      data-transmutation-phase={phase}
      onPointerDown={() => {
        if (!autoStart || reducedMotion) return;
        void beginWhenReady();
      }}
    >
      <canvas ref={canvasRef} className="typographic-transmutation-canvas" aria-hidden="true" />
      <div ref={domLayerRef} className="typographic-transmutation-dom-layer">
        {children}
      </div>
    </section>
  );
});
