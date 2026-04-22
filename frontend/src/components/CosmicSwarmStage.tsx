import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  CosmicManifestEngine,
  type ManifestPhase,
  type ManifestVariant,
} from '../portfolio/effects/cosmicManifest';

export interface CosmicSwarmHandle {
  manifest: () => Promise<void>;
}

interface CosmicSwarmStageProps {
  autoStart?: boolean;
  children: ReactNode;
  className?: string;
  variant: ManifestVariant;
}

export const CosmicSwarmStage = forwardRef<CosmicSwarmHandle, CosmicSwarmStageProps>(
  function CosmicSwarmStage({ autoStart = false, children, className = '', variant }, ref) {
    const containerRef = useRef<HTMLElement>(null);
    const engineRef = useRef<CosmicManifestEngine | null>(null);
    const initializedRef = useRef(false);
    const manifestedRef = useRef(false);
    const [phase, setPhase] = useState<ManifestPhase>('measuring');
    const [reducedMotion, setReducedMotion] = useState(false);

    // Detect reduced motion preference
    useEffect(() => {
      if (typeof window === 'undefined') return;
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      const update = () => setReducedMotion(mq.matches);
      update();
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }, []);

    // Initialize engine and swarm
    useEffect(() => {
      const container = containerRef.current;
      if (!container || reducedMotion) {
        setPhase('locked');
        return;
      }

      initializedRef.current = false;
      manifestedRef.current = false;

      const engine = new CosmicManifestEngine({
        variant,
        onPhaseChange: setPhase,
      });
      engineRef.current = engine;

      // Use requestAnimationFrame to ensure DOM is painted before measuring
      const rafId = requestAnimationFrame(() => {
        void engine.initialize(container).then(() => {
          if (engineRef.current !== engine) return;
          initializedRef.current = true;
          engine.startBreathing();
        });
      });

      return () => {
        cancelAnimationFrame(rafId);
        engine.destroy();
        if (engineRef.current === engine) {
          engineRef.current = null;
        }
      };
    }, [variant, reducedMotion]);

    // Auto-start for projects variant: manifest on viewport entry
    useEffect(() => {
      const container = containerRef.current;
      if (!container || !autoStart || reducedMotion) return;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !manifestedRef.current) {
            manifestedRef.current = true;
            void engineRef.current?.manifest();
          }
        },
        { root: null, rootMargin: '-8% 0px -18% 0px', threshold: 0.16 },
      );

      observer.observe(container);
      return () => observer.disconnect();
    }, [autoStart, reducedMotion]);

    const doManifest = useCallback(async () => {
      if (manifestedRef.current || !initializedRef.current) return;
      manifestedRef.current = true;
      await engineRef.current?.manifest();
    }, []);

    useImperativeHandle(ref, () => ({ manifest: doManifest }));

    // Pointer interactions
    const handlePointerEnter = useCallback(() => {
      engineRef.current?.expandBreathing(1);
    }, []);

    const handlePointerLeave = useCallback(() => {
      engineRef.current?.expandBreathing(0);
    }, []);

    const handleClick = useCallback(() => {
      if (autoStart || reducedMotion) return;
      void doManifest();
    }, [autoStart, reducedMotion, doManifest]);

    const stageClassName = [
      'cosmic-swarm-stage',
      `is-${variant}`,
      `is-${phase}`,
      reducedMotion ? 'is-reduced-motion' : '',
      className,
    ].filter(Boolean).join(' ');

    return (
      <section
        ref={containerRef}
        className={stageClassName}
        data-manifest-phase={phase}
        onClick={handleClick}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {children}
      </section>
    );
  },
);
