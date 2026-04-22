import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { CitySystem } from '../portfolio/visual/modules/CitySystem.js';
import { SkySystem } from '../portfolio/visual/modules/SkySystem.js';

type PortfolioPageType = 'home' | 'about' | 'contact' | 'projects' | 'generic';

export interface PortfolioSceneLayerVisibility {
  sky?: boolean;
  ground?: boolean;
  sun?: boolean;
  mountains?: boolean;
}

interface PortfolioSceneBackgroundProps {
  homeLayers?: PortfolioSceneLayerVisibility;
}

function pageTypeFromPath(pathname: string): PortfolioPageType {
  if (pathname === '/') {
    return 'home';
  }
  if (pathname.startsWith('/about')) {
    return 'about';
  }
  if (pathname.startsWith('/contact')) {
    return 'contact';
  }
  if (pathname.startsWith('/projects')) {
    return 'projects';
  }
  return 'generic';
}

export function PortfolioSceneBackground({ homeLayers }: PortfolioSceneBackgroundProps = {}) {
  const { pathname } = useLocation();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const homeLayersRef = useRef<PortfolioSceneLayerVisibility | undefined>(homeLayers);
  const pageType = useMemo(() => pageTypeFromPath(pathname), [pathname]);

  useEffect(() => {
    homeLayersRef.current = homeLayers;
  }, [homeLayers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pageType === 'generic') {
      return undefined;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    const controller = new AbortController();
    const assetBasePath = `${import.meta.env.BASE_URL}portfolio-assets`;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hoverFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const sky = new SkySystem({ signal: controller.signal });
    const city = new CitySystem(pageType, { assetBasePath });

    let width = 0;
    let height = 0;
    let time = 0;
    let frame = 0;
    let animationFrame = 0;
    let mouseX = 0;
    let mouseY = 0;

    const readScrollPercent = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        document.body.offsetHeight,
        document.documentElement.offsetHeight,
        document.body.clientHeight,
        document.documentElement.clientHeight,
      ) - window.innerHeight;

      return docHeight <= 0 ? 0 : Math.max(0, Math.min(1, scrollTop / docHeight));
    };

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      city.resize(width, height);
    };

    const updateMouse = (clientX: number, clientY: number) => {
      if (!width || !height) {
        return;
      }
      mouseX = (clientX - width / 2) / (width / 2);
      mouseY = (clientY - height / 2) / (height / 2);
    };

    const pointerMove = (event: PointerEvent) => updateMouse(event.clientX, event.clientY);
    const touchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (touch) {
        updateMouse(touch.clientX, touch.clientY);
      }
    };

    const render = () => {
      const scrollPercent = readScrollPercent();
      if (!prefersReducedMotion || frame % 3 === 0) {
        time += prefersReducedMotion ? 0.2 : 1;
        context.clearRect(0, 0, width, height);

        const layerVisibility = pageType === 'home' ? homeLayersRef.current : undefined;

        if (layerVisibility) {
          if (layerVisibility.sky) {
            sky.drawBackground(context, width, height, time, scrollPercent);
            if (sky.magicMode) {
              if (sky.auroraAlpha < 1) sky.auroraAlpha += 0.005;
              sky.drawAurora(context, width, height, time);
            }
            sky.drawClouds(context, width, scrollPercent);
          }
          if (layerVisibility.sun) {
            sky.drawSun(context, width, height, scrollPercent);
          }
          if (layerVisibility.mountains) {
            city.renderLayer(context, width, height, time, scrollPercent, 0, 'mountains');
          }
          if (layerVisibility.ground) {
            city.renderLayer(context, width, height, time, scrollPercent, 0, 'ground');
          }
        } else {
          sky.render(context, width, height, time, scrollPercent);
          city.render(context, width, height, time, scrollPercent, 0);
        }
      }
      frame += 1;
      animationFrame = window.requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize, { signal: controller.signal });
    if (hoverFinePointer) {
      window.addEventListener('pointermove', pointerMove, { passive: true, signal: controller.signal });
    } else if (!prefersReducedMotion) {
      window.addEventListener('touchmove', touchMove, { passive: true, signal: controller.signal });
    }

    animationFrame = window.requestAnimationFrame(render);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      controller.abort();
    };
  }, [pageType]);

  if (pageType === 'generic') {
    return null;
  }

  return (
    <div className="portfolio-scene" aria-hidden="true">
      <canvas ref={canvasRef} className="portfolio-scene-canvas" />
      <div className="portfolio-scene-vignette" />
    </div>
  );
}
