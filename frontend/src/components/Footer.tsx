import { Link } from 'react-router-dom';
import { motion } from 'motion/react';

const socialLinks = [
  {
    href: 'https://www.instagram.com/sibrianc/',
    label: 'Instagram',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]">
        <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.2" cy="6.8" r="0.9" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    href: 'https://github.com/sibrianc',
    label: 'GitHub',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" className="w-[18px] h-[18px]">
        <path d="M12 2.5a9.75 9.75 0 0 0-3.082 19c.487.09.665-.213.665-.47l-.014-1.84c-2.708.59-3.28-1.15-3.28-1.15-.443-1.11-1.082-1.405-1.082-1.405-.885-.594.067-.582.067-.582.978.068 1.492.99 1.492.99.87 1.474 2.284 1.048 2.84.8.089-.622.34-1.049.618-1.29-2.161-.243-4.435-1.067-4.435-4.75 0-1.05.381-1.91 1.006-2.584-.101-.243-.436-1.221.096-2.545 0 0 .82-.258 2.686.987A9.39 9.39 0 0 1 12 7.38a9.39 9.39 0 0 1 2.446.329c1.866-1.245 2.685-.987 2.685-.987.533 1.324.198 2.302.097 2.545.626.674 1.006 1.534 1.006 2.584 0 3.692-2.279 4.505-4.447 4.744.35.297.662.88.662 1.773l-.012 2.628c0 .259.176.565.671.469A9.75 9.75 0 0 0 12 2.5Z" />
      </svg>
    ),
  },
];

export function Footer() {
  return (
    <footer className="w-full flex flex-col items-center gap-8 mt-32 py-12 bg-transparent relative z-10 px-6">
      <div className="relative w-full flex items-center justify-center mb-8">
        <div className="absolute w-full h-[1px] bg-gradient-to-r from-transparent via-tertiary/20 to-transparent"></div>
        <motion.div whileHover={{ rotate: 135, scale: 1.2 }} transition={{ duration: 0.5 }} className="relative z-10 w-12 h-12 bg-background flex items-center justify-center transform rotate-45 border border-tertiary/30 shadow-[0_0_15px_rgba(179,206,167,0.1)] cursor-pointer">
          <span className="material-symbols-outlined text-tertiary -rotate-45 text-sm drop-shadow-[0_0_5px_rgba(179,206,167,0.5)]">filter_vintage</span>
        </motion.div>
      </div>
      <nav className="flex flex-wrap items-center justify-center gap-x-12 gap-y-4 font-label text-[10px] uppercase tracking-[0.2em] text-tertiary/50">
        <Link className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(216,196,145,0.8)] transition-all duration-300" to="/about">About</Link>
        <Link className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(216,196,145,0.8)] transition-all duration-300" to="/projects">Projects</Link>
        <Link className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(216,196,145,0.8)] transition-all duration-300" to="/contact">Contact</Link>
        <Link className="hover:text-primary hover:drop-shadow-[0_0_5px_rgba(216,196,145,0.8)] transition-all duration-300" to="/chronicles">The Source</Link>
      </nav>
      <div className="flex items-center justify-center gap-4">
        {socialLinks.map((link) => (
          <motion.a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noreferrer"
            aria-label={link.label}
            whileHover={{ y: -2, scale: 1.04 }}
            className="w-11 h-11 rounded-full border border-secondary/25 bg-surface-container-low/50 text-secondary flex items-center justify-center shadow-[0_0_18px_rgba(225,193,152,0.08)] hover:text-primary hover:border-primary/40 hover:shadow-[0_0_22px_rgba(216,196,145,0.22)] transition-all duration-300"
          >
            {link.icon}
          </motion.a>
        ))}
      </div>
      <div className="mt-2 text-center">
        <span className="font-headline italic text-secondary text-xl block mb-2 text-glow-secondary">The Living Codex</span>
        <p className="font-label text-[10px] uppercase tracking-[0.2em] font-light text-tertiary/70">Carlos' archive - An evolving digital artifact</p>
      </div>
    </footer>
  );
}
