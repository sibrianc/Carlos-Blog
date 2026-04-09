import { useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';

const links = [
  { to: '/codex/timeline', label: 'Chronicle of Cuscatl\u00e1n' },
  { to: '/codex/bestiary', label: 'The Bestiary' },
  { to: '/codex/field-guide', label: 'Field Guide' },
  { to: '/codex/herbalist', label: "Herbalist's Codex" },
  { to: '/codex/gastronomicon', label: 'Gastronomicon' },
  { to: '/codex/lexicon', label: 'Salvadoran Lexicon' },
  { to: '/codex/atlas', label: 'Atlas & Rituals' },
];

export function CodexLayout() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const activeLink = useMemo(
    () => links.find((link) => location.pathname === link.to) ?? links[0],
    [location.pathname],
  );

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onPointerDown = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onEscape);
    };
  }, [isOpen]);

  return (
    <div className="container mx-auto px-6 md:px-8 max-w-6xl">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-12 border-b border-primary/20 pb-8">
        <h1 className="font-headline text-5xl md:text-7xl italic text-glow text-primary mb-4">The Codex</h1>
        <p className="font-body text-on-surface-variant font-light max-w-2xl">A living repository of the land, its myths, its flavors, and its people. Navigate the chapters to uncover the soul of Cuscatl\u00e1n.</p>
      </motion.div>

      <div className="mb-12 relative max-w-xl" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen((current) => !current)}
          className="w-full flex items-center justify-between gap-6 px-6 py-4 border border-primary/20 bg-surface-container-low/60 backdrop-blur-md rounded-sm text-left shadow-[0_0_24px_rgba(113,215,205,0.06)] hover:border-primary/35 transition-all duration-300"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
        >
          <span className="font-headline italic text-2xl md:text-3xl text-secondary text-glow-secondary">{activeLink.label}</span>
          <span className={`material-symbols-outlined text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>expand_more</span>
        </button>
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="absolute left-0 right-0 mt-3 p-3 border border-primary/15 bg-background/95 backdrop-blur-xl rounded-sm shadow-[0_0_36px_rgba(113,215,205,0.08)] z-20"
              role="listbox"
            >
              <div className="flex flex-col gap-2">
                {links.map((link) => {
                  const isActive = link.to === activeLink.to;
                  return (
                    <button
                      key={link.to}
                      type="button"
                      onClick={() => {
                        navigate(link.to);
                        setIsOpen(false);
                      }}
                      className={`w-full text-left px-4 py-3 rounded-sm transition-all duration-300 font-label text-xs tracking-[0.08em] ${isActive ? 'text-primary bg-primary/10 border border-primary/20 drop-shadow-[0_0_5px_rgba(113,215,205,0.5)]' : 'text-on-surface-variant hover:text-primary hover:bg-primary/5'}`}
                    >
                      {link.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main className="min-h-[60vh]">
        <Outlet />
      </main>
    </div>
  );
}

