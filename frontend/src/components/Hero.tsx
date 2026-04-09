import React from 'react';
import { motion } from 'motion/react';

export function Hero() {
  const words = 'Words breathe within the deep quiet of the digital void.'.split(' ');

  return (
    <section className="min-h-[85vh] flex flex-col items-center justify-center relative px-8">
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none overflow-hidden">
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }} className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary rounded-full blur-[160px]" />
        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 1 }} className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 max-w-4xl text-center space-y-8">
        <motion.p initial={{ opacity: 0, letterSpacing: '0em' }} animate={{ opacity: 1, letterSpacing: '0.5em' }} transition={{ duration: 2, ease: 'easeOut' }} className="font-label text-tertiary text-xs uppercase mb-4">
          Volume I: The Inscription
        </motion.p>

        <h1 className="font-headline text-5xl md:text-8xl leading-tight font-extralight italic text-glow flex flex-wrap justify-center gap-x-4 gap-y-2">
          {words.map((word, index) => (
            <motion.span key={index} initial={{ opacity: 0, y: 20, filter: 'blur(10px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ duration: 1.5, delay: index * 0.15 + 0.5, ease: [0.22, 1, 0.36, 1] }} className={word === 'within' ? 'text-secondary italic text-glow-secondary' : ''}>
              {word}
            </motion.span>
          ))}
        </h1>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.5, delay: 2, ease: 'easeOut' }} className="max-w-xl mx-auto py-12">
          <p className="font-body text-on-surface-variant text-lg leading-relaxed font-light">This is a living artifact. A repository of fragments, chronologies, and whispered truths etched into the ether. We do not publish; we inscribe.</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 0.5, scale: 1 }} transition={{ duration: 2, delay: 2.5 }} className="flex items-center justify-center gap-4">
          <motion.div initial={{ width: 0 }} animate={{ width: 128 }} transition={{ duration: 1.5, delay: 2.5, ease: 'easeInOut' }} className="h-[1px] bg-gradient-to-r from-transparent via-secondary to-transparent" />
          <motion.span animate={{ rotate: 360, scale: [0.75, 0.9, 0.75] }} transition={{ rotate: { duration: 10, repeat: Infinity, ease: 'linear' }, scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' } }} className="material-symbols-outlined text-secondary drop-shadow-[0_0_5px_rgba(225,193,152,0.8)]">
            circle
          </motion.span>
          <motion.div initial={{ width: 0 }} animate={{ width: 128 }} transition={{ duration: 1.5, delay: 2.5, ease: 'easeInOut' }} className="h-[1px] bg-gradient-to-l from-transparent via-secondary to-transparent" />
        </motion.div>
      </div>
    </section>
  );
}
