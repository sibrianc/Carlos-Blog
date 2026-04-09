import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../lib/api';
import type { ChronicleSummary } from '../types';
import { FragmentSection } from '../components/FragmentSection';

export function Chronicles() {
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
      } catch (err) {
        if (!active) {
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load the chronicle archive.');
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
    <div className="container mx-auto px-6 md:px-8 max-w-6xl space-y-16">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="border-b border-primary/20 pb-8">
        <h1 className="font-headline text-5xl md:text-7xl italic text-glow text-primary mb-4">The Chronicles</h1>
        <p className="font-body text-on-surface-variant font-light max-w-2xl">Every published inscription from the living archive, ordered by the latest imprint and preserved without losing your historical posts.</p>
      </motion.div>
      {loading ? (
        <div className="flex justify-center items-center py-24"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>
      ) : error ? (
        <div className="text-center py-24"><p className="font-body text-red-300 font-light italic">{error}</p></div>
      ) : chronicles.length === 0 ? (
        <div className="text-center py-24"><p className="font-body text-on-surface-variant font-light italic">No chronicle has been inscribed yet.</p></div>
      ) : (
        <div className="space-y-40 pb-16">
          {chronicles.map((chronicle, index) => (
            <FragmentSection key={chronicle.id} id={chronicle.id} title={chronicle.title} description={chronicle.description} loreText={chronicle.subtitle} imageSrc={chronicle.imageSrc} imageAlt={chronicle.imageAlt} actionText="Read Chronicle" color={index % 2 === 0 ? 'primary' : 'tertiary'} align={index % 2 === 0 ? 'left' : 'right'} />
          ))}
        </div>
      )}
    </div>
  );
}
