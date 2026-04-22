import { useEffect, useRef } from 'react';
import { portfolioAsset } from '../portfolio/assets';

export function CadejoGuardian({ variant = 'white' }: { variant?: 'white' | 'black' }) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return undefined;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hoverFinePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (prefersReducedMotion || !hoverFinePointer) {
      element.classList.add('is-summoned');
      return undefined;
    }

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;
    let isVisible = false;
    let frame = 0;

    const eyes = element.querySelectorAll<HTMLElement>('.eye-socket');

    const animateGhost = () => {
      currentX += (targetX - currentX) * 0.12;
      currentY += (targetY - currentY) * 0.12;
      element.style.left = `${currentX}px`;
      element.style.top = `${currentY}px`;

      const dx = targetX - currentX;
      const dy = targetY - currentY;
      const angle = Math.atan2(dy, dx);
      const dist = Math.min(Math.sqrt(dx * dx + dy * dy) / 10, 3);
      const moveX = Math.cos(angle) * dist;
      const moveY = Math.sin(angle) * dist;

      eyes.forEach((eye) => {
        const pupil = eye.querySelector<HTMLElement>('.pupil');
        if (pupil) {
          pupil.style.transform = `translate(${moveX}px, ${moveY}px)`;
        }
      });

      frame = window.requestAnimationFrame(animateGhost);
    };

    const onMouseMove = (e: MouseEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
      if (!isVisible) {
        element.classList.add('is-summoned');
        isVisible = true;
      }
    };

    const onMouseLeave = () => {
      element.classList.remove('is-summoned');
      isVisible = false;
    };

    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    frame = window.requestAnimationFrame(animateGhost);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} className={`cadejo-guardian ${variant === 'black' ? 'cadejo-guardian-black' : ''}`} aria-hidden="true">
      <img
        src={portfolioAsset(variant === 'black' ? 'cadejo_negro.png' : 'cadejo_face.png')}
        alt=""
        className="cadejo-bg-img"
      />
      <div className="eye-socket eye-left">
        <div className="pupil" />
      </div>
      <div className="eye-socket eye-right">
        <div className="pupil" />
      </div>
    </div>
  );
}
