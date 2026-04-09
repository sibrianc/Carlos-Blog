import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppSessionProvider } from './context/AppSessionContext';
import { AmbientParticles } from './components/AmbientParticles';
import { CustomCursor } from './components/CustomCursor';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
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
import { Register } from './pages/Register';

export default function App() {
  return (
    <BrowserRouter>
      <AppSessionProvider>
        <div className="min-h-screen bg-background text-on-surface font-body selection:bg-primary/30 selection:text-primary-container relative overflow-hidden">
          <CustomCursor />
          <div className="fixed inset-0 noise-overlay z-[100]"></div>
          <AmbientParticles />
          <Header />
          <Sidebar />
          <main className="md:pl-20 pt-32 pb-20 relative z-10">
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
          <Footer />
          <div className="fixed bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent pointer-events-none z-30"></div>
        </div>
      </AppSessionProvider>
    </BrowserRouter>
  );
}
