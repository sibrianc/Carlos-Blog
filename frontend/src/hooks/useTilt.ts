import { useEffect, useRef } from 'react';

/**
 * Ports Carlos Dev's init3DTiltCards — perspective(1000px) rotateX/Y ±8deg on mousemove.
 * Only active on hover+fine-pointer devices without reduced-motion preference.
 */
export function useTilt<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    const hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!hoverFine || reducedMotion) return undefined;

    const handleTilt = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const rotateX = ((y - centerY) / centerY) * -8;
      const rotateY = ((x - centerX) / centerX) * 8;
      el.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-4px)`;
    };

    const resetTilt = () => {
      el.style.transform = '';
    };

    el.addEventListener('mousemove', handleTilt, { passive: true });
    el.addEventListener('mouseleave', resetTilt);

    return () => {
      el.removeEventListener('mousemove', handleTilt);
      el.removeEventListener('mouseleave', resetTilt);
    };
  }, []);

  return ref;
}
