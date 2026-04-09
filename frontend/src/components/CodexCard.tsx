import React from 'react';
import { motion } from 'motion/react';

interface CodexCardProps {
  title: string;
  subtitle: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  reverse?: boolean;
}

export function CodexCard({ title, subtitle, description, imageSrc, imageAlt, reverse = false }: CodexCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.8, ease: "easeOut" }}
      className={`flex flex-col ${reverse ? 'md:flex-row-reverse' : 'md:flex-row'} gap-8 items-center p-6 md:p-10 bg-surface-container-low/40 backdrop-blur-sm border border-primary/10 rounded-sm group hover:border-primary/30 transition-colors duration-500`}
    >
      <div className="w-full md:w-1/2 aspect-square md:aspect-[4/3] overflow-hidden rounded-sm relative">
        <div className="absolute inset-0 bg-primary/20 mix-blend-overlay z-10 group-hover:bg-transparent transition-colors duration-1000"></div>
        <img src={imageSrc} alt={imageAlt} className="w-full h-full object-cover filter sepia-[0.3] hue-rotate-180 group-hover:scale-105 transition-transform duration-1000" referrerPolicy="no-referrer" />
        <div className="absolute inset-0 border border-primary/20 m-4 z-20 pointer-events-none"></div>
      </div>
      <div className="w-full md:w-1/2 space-y-4">
        <span className="font-label text-secondary text-[10px] uppercase tracking-[0.3em]">{subtitle}</span>
        <h3 className="font-headline text-3xl md:text-4xl italic text-primary text-glow">{title}</h3>
        <p className="font-body text-on-surface-variant font-light leading-relaxed">{description}</p>
      </div>
    </motion.div>
  );
}
