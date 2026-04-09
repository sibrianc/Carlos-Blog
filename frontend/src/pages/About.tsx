import { motion } from 'motion/react';

export function About() {
  return (
    <div className="container mx-auto px-6 md:px-8 max-w-5xl space-y-16">
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div className="space-y-6">
          <h1 className="font-headline text-5xl md:text-7xl italic text-glow text-primary">About Me</h1>
          <p className="font-body text-on-surface-variant font-light leading-relaxed text-lg">Hey there! Welcome to my little corner of the internet. I am here to share thoughts, ideas, and a few random musings without losing the personal archive that already exists inside this blog.</p>
          <p className="font-body text-on-surface-variant font-light leading-relaxed">Whether you are into tech, gaming, or just looking for something new to read, this space keeps the same published stories and account system while moving everything into the new manuscript aesthetic.</p>
          <p className="font-body text-on-surface-variant font-light leading-relaxed">Grab a coffee, dive into the chronicle archive, and wander through the codex. The content remains yours; only the vessel has changed.</p>
        </div>
        <div className="relative rounded-sm overflow-hidden border border-primary/20 bg-surface-container-low/60">
          <img src="/static/assets/img/about-bg.jpg" alt="About background" className="w-full h-full object-cover opacity-70 min-h-[420px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        </div>
      </motion.section>
    </div>
  );
}
