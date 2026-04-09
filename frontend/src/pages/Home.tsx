import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { ChronicleSummary } from '../types';
import { Hero } from '../components/Hero';
import { FragmentSection } from '../components/FragmentSection';

export function Home() {
  const [chronicles, setChronicles] = useState<ChronicleSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    const loadChronicles = async () => {
      try {
        const payload = await api.fetchChronicles();
        if (!active) {
          return;
        }
        setChronicles(payload.chronicles);
        setError('');
      } catch (err) {
        if (!active) {
          return;
        }
        const message = err instanceof Error ? err.message : 'Unable to load the chronicle fragments.';
        setError(message);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadChronicles();

    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <Hero />
      <section className="container mx-auto px-8 space-y-64 mt-32">
        {loading ? (
          <div className="flex justify-center items-center py-32">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : error ? (
          <div className="text-center py-32">
            <p className="font-body text-red-300 font-light italic">{error}</p>
          </div>
        ) : chronicles.length === 0 ? (
          <div className="text-center py-32">
            <p className="font-body text-on-surface-variant font-light italic">The codex is empty. Be the first to inscribe a fragment.</p>
          </div>
        ) : (
          chronicles.map((chronicle, index) => (
            <FragmentSection
              key={chronicle.id}
              id={chronicle.id}
              title={chronicle.title}
              description={chronicle.description}
              loreText={chronicle.subtitle}
              imageSrc={chronicle.imageSrc}
              imageAlt={chronicle.imageAlt}
              actionText="Invoke Fragment"
              color={index % 2 === 0 ? 'primary' : 'tertiary'}
              align={index % 2 === 0 ? 'left' : 'right'}
            />
          ))
        )}
        <CentralPortal />
      </section>
    </>
  );
}

function CentralPortal() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 100 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center space-y-12 max-w-5xl mx-auto"
    >
      <div className="relative w-full aspect-video rounded-sm overflow-hidden p-[1px] bg-gradient-to-br from-primary/30 via-transparent to-secondary/30 group">
        <div className="w-full h-full bg-surface-container-lowest overflow-hidden relative">
          <motion.img whileHover={{ scale: 1.05 }} transition={{ duration: 10, ease: 'linear' }} alt="Celestial Scroll" className="w-full h-full object-cover opacity-60" src="https://lh3.googleusercontent.com/aida-public/AB6AXuAC9F0xxLokGdxu2Tomx4JoKYRH0UKNNHHHhydI9vQMybU0txgYNlWD34a_WNy0T0s_xYdks08rafBljE9SKxXayeQFlxpfR5SDzkp5G16opQB1TmG8fp8OcE8qJvqK-Xocwi3ndnPT0nduQ08MpdbXKiRnP3IKvhw7fh5D7G4gBcNoi_n5gRtVGziUZDtaV3E0A1kEo0rkgmnI3T44G0f-VAFFVmVDLyo1rT8spG1kdDVOrcx7uqV2j89A6wvCuxZa9Qx9I1uaQsA" />
          <div className="absolute inset-0 bg-background/20 mix-blend-overlay"></div>
        </div>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <motion.div animate={{ boxShadow: ['0 0 0px rgba(113,215,205,0)', '0 0 40px rgba(113,215,205,0.2)', '0 0 0px rgba(113,215,205,0)'] }} transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }} className="p-12 bg-background/40 backdrop-blur-md border border-white/10 rounded-full w-48 h-48 flex items-center justify-center">
            <motion.span animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} className="material-symbols-outlined text-primary text-6xl drop-shadow-[0_0_15px_rgba(113,215,205,0.8)]">flare</motion.span>
          </motion.div>
        </div>
      </div>
      <div className="space-y-4">
        <span className="font-label text-secondary text-[10px] uppercase tracking-[0.4em]">CENTRAL CORE</span>
        <h2 className="font-headline text-5xl italic text-glow-secondary">The Obsidian Codex</h2>
        <p className="font-body text-on-surface-variant max-w-2xl mx-auto font-light">The final repository of every whispered inscription. The living heart of this digital artifact.</p>
      </div>
    </motion.div>
  );
}
