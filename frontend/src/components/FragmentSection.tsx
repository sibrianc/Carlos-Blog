import React, { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { useNavigate } from 'react-router-dom';

interface FragmentProps {
  id: string;
  title: string;
  description: string;
  loreText: string;
  imageSrc: string;
  imageAlt: string;
  actionText: string;
  color: 'primary' | 'tertiary';
  align: 'left' | 'right';
}

export function FragmentSection({ id, title, description, loreText, imageSrc, imageAlt, actionText, color, align }: FragmentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  });

  const yImage = useTransform(scrollYProgress, [0, 1], [50, -50]);
  const scaleImage = useTransform(scrollYProgress, [0, 0.5, 1], [1.1, 1, 1.1]);
  const opacityText = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [0, 1, 1, 0]);
  const yText = useTransform(scrollYProgress, [0, 0.3, 0.7, 1], [50, 0, 0, -50]);

  const isLeft = align === 'left';
  const colorClass = color === 'primary' ? 'text-primary' : 'text-tertiary';
  const borderColorClass = color === 'primary' ? 'border-primary/30 hover:border-primary' : 'border-tertiary/30 hover:border-tertiary';
  const glowClass = color === 'primary' ? 'text-glow' : '';
  const overlayGradientClass = isLeft ? 'bg-gradient-to-t' : 'bg-gradient-to-b';
  const underlineClass = color === 'primary' ? 'bg-primary' : 'bg-tertiary';

  return (
    <div ref={containerRef} className={`relative flex flex-col ${isLeft ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-12 group`}>
      <motion.div style={{ y: yImage }} className={`w-full md:w-3/5 aspect-[4/5] md:aspect-video rounded-sm overflow-hidden bg-surface-container-low shadow-2xl relative ${!isLeft ? 'md:-translate-x-12' : ''}`}>
        <div className={`absolute inset-0 ${overlayGradientClass} from-background via-transparent to-transparent z-10 pointer-events-none`}></div>
        <motion.img style={{ scale: scaleImage }} alt={imageAlt} className="w-full h-full object-cover" src={imageSrc} />
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 z-20 pointer-events-none mix-blend-overlay"></div>
      </motion.div>

      <motion.div style={{ opacity: opacityText, y: yText }} className={`${isLeft ? 'md:absolute md:right-0 md:top-1/2 md:-translate-y-1/2 md:w-1/2 bg-surface-container-low/60 backdrop-blur-xl border border-white/5 p-8 md:p-12' : 'md:absolute md:left-0 md:top-1/2 md:-translate-y-1/2 md:w-2/5 p-8 md:p-12'} z-20 space-y-6 rounded-sm`}>
        <span className={`font-label ${colorClass} text-[10px] uppercase tracking-[0.4em] drop-shadow-[0_0_5px_currentColor]`}>FRAGMENT {id.slice(0, 5)}</span>
        <h2 className={`font-headline text-4xl md:text-6xl italic text-on-surface ${glowClass}`}>{title}</h2>
        <p className="font-body text-on-surface-variant font-light leading-relaxed">{description}</p>

        <button onClick={() => navigate(`/chronicle/${id}`)} className={`inline-block font-label ${colorClass} text-xs uppercase tracking-[0.2em] border-b ${borderColorClass} pb-2 transition-all duration-300 relative overflow-hidden group/link mt-4`} type="button">
          <span className="relative z-10">{actionText}</span>
          <span className={`absolute bottom-0 left-0 w-full h-[1px] ${underlineClass} transform scale-x-0 group-hover/link:scale-x-100 origin-left transition-transform duration-300 shadow-[0_0_8px_currentColor]`}></span>
        </button>
      </motion.div>
    </div>
  );
}
