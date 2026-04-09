import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { useAppSession } from '../context/AppSessionContext';

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => {
    if (typeof window === 'undefined') {
      return true;
    }
    return window.innerWidth < 768;
  });
  const { authenticated, logout, registrationEnabled, user } = useAppSession();
  const navigate = useNavigate();

  useEffect(() => {
    const syncViewport = () => {
      const nextIsMobile = window.innerWidth < 768;
      setIsMobileViewport(nextIsMobile);
      if (!nextIsMobile) {
        setIsMobileMenuOpen(false);
      }
    };

    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) {
      return;
    }

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener('keydown', onEscape);
    return () => {
      window.removeEventListener('keydown', onEscape);
    };
  }, [isMobileMenuOpen]);

  const handleLogout = async () => {
    await logout();
    setIsMobileMenuOpen(false);
    navigate('/');
  };

  return (
    <>
      <motion.header initial={{ y: -100, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} className="fixed top-0 w-full z-50 flex justify-between items-center px-6 md:px-8 py-6 bg-transparent backdrop-blur-md shadow-[0_0_48px_rgba(113,215,205,0.05)] border-b border-primary/5">
        <div className="flex items-center gap-4">
          {isMobileViewport ? (
            <button className="material-symbols-outlined text-primary hover:text-secondary transition-colors duration-300" onClick={() => setIsMobileMenuOpen(true)} type="button" aria-label="Open mobile navigation">menu</button>
          ) : null}
          <Link to="/" className="text-xl md:text-2xl font-headline tracking-widest text-primary italic text-glow">The Living Codex</Link>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <button type="button" onClick={() => navigate('/chronicles')} className="material-symbols-outlined text-primary hover:text-secondary transition-colors duration-300 hover:drop-shadow-[0_0_8px_rgba(225,193,152,0.8)]" aria-label="Open chronicles">auto_stories</button>
          <button type="button" onClick={() => navigate('/about')} className="material-symbols-outlined text-primary hover:text-secondary transition-colors duration-300 hover:drop-shadow-[0_0_8px_rgba(225,193,152,0.8)]" aria-label="Open about page">history_edu</button>
        </div>
      </motion.header>
      <AnimatePresence>
        {isMobileViewport && isMobileMenuOpen ? (
          <motion.div initial={{ opacity: 0, backdropFilter: 'blur(0px)' }} animate={{ opacity: 1, backdropFilter: 'blur(16px)' }} exit={{ opacity: 0, backdropFilter: 'blur(0px)' }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} className="fixed inset-0 z-[60] bg-background/95 flex flex-col items-center justify-center">
            <button className="absolute top-6 left-6 material-symbols-outlined text-primary text-3xl hover:text-secondary transition-colors" onClick={() => setIsMobileMenuOpen(false)} type="button" aria-label="Close mobile navigation">close</button>
            <div className="flex flex-col items-center gap-8 w-full px-8">
              {authenticated && user ? (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="flex flex-col items-center gap-4 mb-4">
                  <img src={user.avatarUrl} alt={user.name} className="w-20 h-20 rounded-full border border-primary/30 shadow-[0_0_20px_rgba(113,215,205,0.4)]" />
                  <span className="font-label text-sm uppercase tracking-widest text-on-surface">{user.name}</span>
                </motion.div>
              ) : (
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, duration: 0.5 }} className="w-20 h-20 rounded-full border border-primary/30 flex items-center justify-center bg-surface-container-high overflow-hidden shadow-[0_0_20px_rgba(113,215,205,0.4)] mb-4">
                  <img alt="Mystical Seal" className="w-full h-full object-cover opacity-80" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCaX82RdS6zopHkF9LGN1K2I1OaGMn2LYW-HlDD4C9_ql_YrsaWFvWcjoTncOphvYrSCYDm-Ry0BXPZxMn0MMGROpQ60hghXp13ILRxClNfXF-JPh2y8TKbD4vd2ppxlNnnwt4IcjtSL532VZV-0i_zHisG3_lU-kd3zrfcHCq7GERzeVZoFBPZDnerg6gdlgDuOMCjwe3FeMdCb28M27QmagGb9HAJKfvyEa6W7TrbHZw_a7xByEc5NwCE1z_7Ccmhq14YrcAuPzs" />
                </motion.div>
              )}
              <nav className="flex flex-col items-center gap-8 w-full">
                <MobileNavLink to="/" icon="blur_on" label="Fragments" onClick={() => setIsMobileMenuOpen(false)} delay={0.3} />
                <MobileNavLink to="/chronicles" icon="library_books" label="Chronicles" onClick={() => setIsMobileMenuOpen(false)} delay={0.4} />
                <MobileNavLink to="/codex" icon="menu_book" label="Codex" onClick={() => setIsMobileMenuOpen(false)} delay={0.5} />
                <MobileNavLink to="/about" icon="hotel_class" label="About" onClick={() => setIsMobileMenuOpen(false)} delay={0.6} />
                <MobileNavLink to="/contact" icon="mark_email_read" label="Contact" onClick={() => setIsMobileMenuOpen(false)} delay={0.7} />
                {user?.isAdmin && <MobileNavLink to="/create-fragment" icon="edit_document" label="Inscribe" onClick={() => setIsMobileMenuOpen(false)} delay={0.8} />}
              </nav>
              {authenticated ? (
                <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.9, duration: 0.5 }} onClick={() => void handleLogout()} className="mt-8 px-12 py-4 bg-red-900/20 hover:bg-red-900/40 text-red-400 font-label text-xs uppercase tracking-[0.2em] rounded-md transition-all duration-500 border border-red-500/20" type="button">Sign Out</motion.button>
              ) : (
                <div className="mt-8 flex flex-col gap-4 items-center">
                  <Link to="/login" onClick={() => setIsMobileMenuOpen(false)} className="px-12 py-4 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-xs uppercase tracking-[0.2em] rounded-md transition-all duration-500 shadow-[inset_0_0_12px_rgba(113,215,205,0.1)] hover:shadow-[inset_0_0_20px_rgba(113,215,205,0.3)] border border-primary/20">Enter the Void</Link>
                  {registrationEnabled && <Link to="/register" onClick={() => setIsMobileMenuOpen(false)} className="font-label text-[10px] uppercase tracking-[0.3em] text-secondary hover:text-primary transition-colors">Open the registration page</Link>}
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function MobileNavLink({ icon, label, to, onClick, delay }: { icon: string; label: string; to: string; onClick: () => void; delay: number }) {
  return (
    <NavLink to={to} onClick={onClick} className={({ isActive }) => `flex items-center gap-6 text-2xl transition-all duration-300 w-full max-w-xs ${isActive ? 'text-primary' : 'text-secondary/60 hover:text-primary'}`}>
      {({ isActive }) => (
        <motion.div initial={{ x: -20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay, duration: 0.5, ease: 'easeOut' }} className="flex items-center gap-6 w-full">
          <span className={`material-symbols-outlined text-3xl ${isActive ? 'drop-shadow-[0_0_12px_rgba(113,215,205,0.8)]' : ''}`}>{icon}</span>
          <span className="font-headline italic tracking-widest text-3xl">{label}</span>
        </motion.div>
      )}
    </NavLink>
  );
}
