import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAppSession } from '../context/AppSessionContext';

export function Sidebar() {
  const { authenticated, logout, user } = useAppSession();
  const navigate = useNavigate();
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setWorking(false);
  }, [authenticated]);

  const handleLogout = async () => {
    setWorking(true);
    try {
      await logout();
      navigate('/');
    } finally {
      setWorking(false);
    }
  };

  return (
    <motion.aside initial={{ x: -100 }} animate={{ x: 0 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }} className="hidden md:flex fixed left-0 top-0 h-full z-40 flex-col py-10 bg-background/90 backdrop-blur-xl border-r border-primary/10 group w-20 hover:w-64 transition-all duration-500 overflow-hidden">
      <div className="flex flex-col items-center group-hover:items-start px-6 gap-2 mb-12 mt-16">
        <div className="w-10 h-10 rounded-full border border-primary/30 flex items-center justify-center bg-surface-container-high overflow-hidden shadow-[0_0_15px_rgba(113,215,205,0.2)] group-hover:shadow-[0_0_20px_rgba(113,215,205,0.4)] transition-shadow duration-500 shrink-0">
          <img alt={user?.name || 'Mystical Seal'} className="w-full h-full object-cover opacity-80" src={user?.avatarUrl || 'https://lh3.googleusercontent.com/aida-public/AB6AXuCaX82RdS6zopHkF9LGN1K2I1OaGMn2LYW-HlDD4C9_ql_YrsaWFvWcjoTncOphvYrSCYDm-Ry0BXPZxMn0MMGROpQ60hghXp13ILRxClNfXF-JPh2y8TKbD4vd2ppxlNnnwt4IcjtSL532VZV-0i_zHisG3_lU-kd3zrfcHCq7GERzeVZoFBPZDnerg6gdlgDuOMCjwe3FeMdCb28M27QmagGb9HAJKfvyEa6W7TrbHZw_a7xByEc5NwCE1z_7Ccmhq14YrcAuPzs'} />
        </div>
        <div className="hidden group-hover:block transition-opacity duration-500 opacity-0 group-hover:opacity-100 whitespace-nowrap">
          <h3 className="font-headline text-lg italic text-secondary text-glow-secondary">The Manuscript</h3>
          <p className="font-label text-[10px] uppercase tracking-tighter text-on-surface-variant">Inscribed Thoughts</p>
        </div>
      </div>
      <nav className="flex-1 flex flex-col gap-8 px-6">
        <SidebarLink to="/" icon="blur_on" label="Fragments" color="primary" />
        <SidebarLink to="/chronicles" icon="library_books" label="Chronicles" color="secondary" />
        <SidebarLink to="/codex" icon="menu_book" label="Codex" color="secondary" />
        {user?.isAdmin && <SidebarLink to="/create-fragment" icon="edit_document" label="Inscribe" color="secondary" />}
      </nav>
      <div className="px-4 space-y-4">
        {authenticated && user ? (
          <div className="flex flex-col gap-4">
            <div className="hidden group-hover:flex items-center gap-3 px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <img src={user.avatarUrl} alt={user.name} className="w-8 h-8 rounded-full border border-primary/30" />
              <span className="font-label text-xs uppercase tracking-widest text-on-surface truncate">{user.name.split(' ')[0]}</span>
            </div>
            <button onClick={() => void handleLogout()} className="w-full py-4 bg-red-900/20 hover:bg-red-900/40 text-red-400 font-label text-[10px] uppercase tracking-[0.2em] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-500 border border-red-500/20 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-80" disabled={working} type="button">{working ? 'Signing Out' : 'Sign Out'}</button>
          </div>
        ) : (
          <button onClick={() => navigate('/login')} className="w-full py-4 bg-primary-container/50 hover:bg-primary-container text-primary font-label text-[10px] uppercase tracking-[0.2em] rounded-md opacity-0 group-hover:opacity-100 transition-all duration-500 shadow-[inset_0_0_12px_rgba(113,215,205,0.1)] hover:shadow-[inset_0_0_20px_rgba(113,215,205,0.3)] border border-primary/20 whitespace-nowrap" type="button">Enter the Void</button>
        )}
      </div>
    </motion.aside>
  );
}

function SidebarLink({ icon, label, to, color }: { icon: string; label: string; to: string; color: 'primary' | 'secondary' }) {
  const colorClass = color === 'primary' ? 'text-primary' : 'text-secondary';
  const inactiveClass = color === 'primary' ? 'text-primary/40 hover:text-primary' : 'text-secondary/40 hover:text-secondary';
  const borderColor = color === 'primary' ? 'border-primary' : 'border-secondary';
  const gradient = color === 'primary' ? 'from-primary/10' : 'from-secondary/10';

  return (
    <NavLink to={to} className={({ isActive }) => `flex items-center gap-4 py-2 transition-all duration-300 relative ${isActive ? colorClass : inactiveClass}`}>
      {({ isActive }) => (
        <>
          {isActive && <motion.div layoutId="sidebar-active" className={`absolute inset-0 border-r-2 ${borderColor} bg-gradient-to-r ${gradient} to-transparent -ml-6 pl-6`} initial={false} transition={{ type: 'spring', stiffness: 300, damping: 30 }} />}
          <span className={`material-symbols-outlined relative z-10 ${isActive ? `drop-shadow-[0_0_8px_rgba(${color === 'primary' ? '113,215,205' : '225,193,152'},0.8)]` : ''}`}>{icon}</span>
          <span className="hidden group-hover:block font-label tracking-widest text-xs uppercase relative z-10 whitespace-nowrap">{label}</span>
        </>
      )}
    </NavLink>
  );
}
