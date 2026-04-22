import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const locations = [
  {
    id: "santa-ana",
    name: "Santa Ana Volcano",
    x: "28%",
    y: "40%",
    description: "The towering Ilamatepec (Santa Ana) is the highest volcano in the country, featuring a stunning turquoise sulfur crater lake at its summit."
  },
  {
    id: "coatepeque",
    name: "Lake Coatepeque",
    x: "32%",
    y: "45%",
    description: "A large crater lake surrounded by wooded hills. Known for its deep blue waters that occasionally turn a striking turquoise color."
  },
  {
    id: "joya-ceren",
    name: "Joya de Cerén",
    x: "40%",
    y: "42%",
    description: "The 'Pompeii of the Americas'. A pre-Columbian Maya farming village preserved under layers of volcanic ash, offering a rare glimpse into everyday life."
  },
  {
    id: "tunco",
    name: "El Tunco Beach",
    x: "38%",
    y: "65%",
    description: "A world-renowned surf spot named after its iconic pig-shaped rock formation. The heart of Surf City, bustling with energy and waves."
  },
  {
    id: "suchitoto",
    name: "Suchitoto",
    x: "52%",
    y: "35%",
    description: "A beautifully preserved colonial town overlooking Lake Suchitlán. Known for its cobblestone streets, indigo (añil) workshops, and vibrant arts scene."
  },
  {
    id: "cuco",
    name: "El Cuco & Maculis",
    x: "75%",
    y: "68%",
    description: "The wilder, warmer beaches of the east. Known for long stretches of dark volcanic sand, gentle waves, and incredible seafood."
  },
  {
    id: "golfo",
    name: "Gulf of Fonseca",
    x: "85%",
    y: "75%",
    description: "A stunning archipelago shared with Honduras and Nicaragua. Features volcanic islands, hidden beaches, and rich marine biodiversity."
  }
];

export function Atlas() {
  const [activeLocation, setActiveLocation] = useState(locations[0]);

  return (
    <div className="space-y-12">
      <div className="mb-8">
        <p className="font-body text-on-surface-variant font-light">Where the land meets the soul.</p>
      </div>

      <div className="relative w-full aspect-[4/3] md:aspect-[16/9] bg-surface-container-lowest border border-primary/20 rounded-sm overflow-hidden flex items-center justify-center">
        {/* Stylized Map Background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none flex items-center justify-center">
          <svg viewBox="0 0 800 400" className="w-full h-full drop-shadow-[0_0_15px_rgba(216,196,145,0.5)]">
            <path 
              d="M 100 150 Q 150 100 250 120 T 400 100 T 550 130 T 700 200 Q 750 250 650 300 T 450 350 T 250 320 T 100 250 Z" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2" 
              className="text-primary"
            />
            {/* Topographic lines */}
            <path d="M 150 170 Q 200 130 280 140 T 420 130 T 520 160 T 650 220" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-secondary/50" />
            <path d="M 200 200 Q 250 170 320 180 T 450 170 T 500 200 T 600 250" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-secondary/50" />
          </svg>
        </div>

        {/* Map Points */}
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => setActiveLocation(loc)}
            className="absolute w-6 h-6 -ml-3 -mt-3 group z-10"
            style={{ left: loc.x, top: loc.y }}
          >
            <span className={`absolute inset-0 rounded-full animate-ping opacity-75 ${activeLocation.id === loc.id ? 'bg-secondary' : 'bg-primary'}`}></span>
            <span className={`relative flex rounded-full w-full h-full border-2 ${activeLocation.id === loc.id ? 'bg-secondary border-white' : 'bg-primary border-primary/50'}`}></span>
            <span className="absolute top-8 left-1/2 -translate-x-1/2 whitespace-nowrap font-label text-[10px] uppercase tracking-widest text-on-surface opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 px-2 py-1 rounded backdrop-blur-sm border border-primary/20">
              {loc.name}
            </span>
          </button>
        ))}

        {/* Info Panel */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeLocation.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-background/80 backdrop-blur-md border border-primary/30 p-6 rounded-sm shadow-[0_0_30px_rgba(0,0,0,0.5)] z-20"
          >
            <h3 className="font-headline text-2xl italic text-primary mb-2">{activeLocation.name}</h3>
            <p className="font-body text-sm text-on-surface-variant font-light leading-relaxed">{activeLocation.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
