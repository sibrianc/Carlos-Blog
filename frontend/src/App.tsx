import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppSessionProvider } from './context/AppSessionContext';
import { AmbientParticles } from './components/AmbientParticles';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { PortfolioSceneBackground } from './components/PortfolioSceneBackground';
import { Sidebar } from './components/Sidebar';
import { About } from './pages/About';
import { ChronicleDetail } from './pages/ChronicleDetail';
import { Chronicles } from './pages/Chronicles';
import { CodexLayout } from './pages/CodexLayout';
import { Atlas } from './pages/Codex/Atlas';
import { Bestiary } from './pages/Codex/Bestiary';
import { FieldGuide } from './pages/Codex/FieldGuide';
import { Gastronomicon } from './pages/Codex/Gastronomicon';
import { Herbalist } from './pages/Codex/Herbalist';
import { Lexicon } from './pages/Codex/Lexicon';
import { Timeline } from './pages/Codex/Timeline';
import { Contact } from './pages/Contact';
import { CreateFragment } from './pages/CreateFragment';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { ProjectDetail } from './pages/ProjectDetail';
import { Projects } from './pages/Projects';
import { Register } from './pages/Register';

interface HomeRevealState {
  started: boolean;
  sky: boolean;
  ground: boolean;
  sun: boolean;
  mountains: boolean;
  header: boolean;
  footerDock: boolean;
  footerReal: boolean;
  hero: boolean;
  featured: boolean;
  complete: boolean;
}

const HOME_REVEAL_CLOSED: HomeRevealState = {
  started: false,
  sky: false,
  ground: false,
  sun: false,
  mountains: false,
  header: false,
  footerDock: false,
  footerReal: false,
  hero: false,
  featured: false,
  complete: false,
};

const HOME_REVEAL_ALL: HomeRevealState = {
  started: true,
  sky: true,
  ground: true,
  sun: true,
  mountains: true,
  header: true,
  footerDock: true,
  footerReal: true,
  hero: true,
  featured: true,
  complete: true,
};

export default function App() {
  return (
    <BrowserRouter>
      <AppSessionProvider>
        <AppShell />
      </AppSessionProvider>
    </BrowserRouter>
  );
}

function AppShell() {
  const { pathname } = useLocation();
  const homeReveals = useHomeManifestationState();
  const isHome = pathname === '/';
  const homeInitialClosed = isHome && !homeReveals.started && !homeReveals.complete;
  const homeComplete = !isHome || homeReveals.complete;
  const showScene = !isHome || homeComplete || homeReveals.sky || homeReveals.ground || homeReveals.sun || homeReveals.mountains;
  const showHeader = !isHome || homeComplete || homeReveals.header;
  const showSidebar = !isHome || homeComplete;
  const showAmbient = !isHome || homeComplete;
  const showFooter = !isHome || homeComplete || homeReveals.footerReal;
  const showFooterDock = !isHome || homeComplete || homeReveals.footerDock;
  const instantHomeChrome = isHome;

  return (
    <div
      className={[
        'min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 selection:text-primary-container relative overflow-hidden',
        homeInitialClosed ? 'home-manifestation-closed' : '',
      ].filter(Boolean).join(' ')}
    >
      <ScrollToTop />
      {homeInitialClosed ? null : <div className="fixed inset-0 noise-overlay z-[100]"></div>}
      {showScene ? (
        <PortfolioSceneBackground
          homeLayers={isHome && !homeComplete ? {
            sky: homeReveals.sky,
            ground: homeReveals.ground,
            sun: homeReveals.sun,
            mountains: homeReveals.mountains,
          } : undefined}
        />
      ) : null}
      {showAmbient ? <AmbientParticles /> : null}
      {showHeader ? <Header instant={instantHomeChrome} /> : null}
      {showSidebar ? <Sidebar instant={instantHomeChrome} /> : null}
      <main className={`layout-shell relative z-10 ${isHome ? 'layout-shell-home-gate' : ''}`.trim()}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/chronicles" element={<Chronicles />} />
          <Route path="/chronicle/:id" element={<ChronicleDetail />} />
          <Route path="/create-fragment" element={<CreateFragment />} />
          <Route path="/create-fragment/:id/edit" element={<CreateFragment />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:slug" element={<ProjectDetail />} />
          <Route path="/codex" element={<CodexLayout />}>
            <Route index element={<Navigate to="timeline" replace />} />
            <Route path="timeline" element={<Timeline />} />
            <Route path="bestiary" element={<Bestiary />} />
            <Route path="field-guide" element={<FieldGuide />} />
            <Route path="herbalist" element={<Herbalist />} />
            <Route path="gastronomicon" element={<Gastronomicon />} />
            <Route path="lexicon" element={<Lexicon />} />
            <Route path="atlas" element={<Atlas />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      {showFooter ? <Footer /> : null}
      {showFooterDock ? (
        <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-30"></div>
      ) : null}
    </div>
  );
}

function useHomeManifestationState() {
  const { pathname } = useLocation();
  const [reveals, setReveals] = useState<HomeRevealState>(pathname === '/' ? HOME_REVEAL_CLOSED : HOME_REVEAL_ALL);

  useEffect(() => {
    setReveals(pathname === '/' ? HOME_REVEAL_CLOSED : HOME_REVEAL_ALL);
  }, [pathname]);

  useEffect(() => {
    const handleState = (event: Event) => {
      const detail = (event as CustomEvent<{ revealed?: boolean; reveals?: Partial<HomeRevealState> }>).detail;
      if (detail?.reveals) {
        setReveals((current) => ({ ...current, ...detail.reveals }));
        return;
      }
      if (detail?.revealed) {
        setReveals(HOME_REVEAL_ALL);
      }
    };

    window.addEventListener('home-transmutation-state', handleState);
    return () => window.removeEventListener('home-transmutation-state', handleState);
  }, []);

  return pathname === '/' ? reveals : HOME_REVEAL_ALL;
}

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);

  return null;
}
