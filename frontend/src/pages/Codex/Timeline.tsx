import React from 'react';
import { motion } from 'motion/react';

const events = [
  {
    era: "Pre-Columbian Era",
    title: "Pipil, Lenca, and Mayan Roots",
    description: "Before the conquest, the land was known as Kuskatan (Place of Precious Jewels). The Maya built Joya de Cerén, the 'Pompeii of the Americas', preserved in volcanic ash. The Pipil and Lenca peoples cultivated maize, cacao, and a deep spiritual connection to the earth.",
    icon: "volcano"
  },
  {
    era: "The Conquest & Colonial Period",
    title: "The Spanish Arrival & The Indigo Era",
    description: "In 1524, Pedro de Alvarado arrived. The indigenous resistance was fierce, led by figures like Atlacatl. Following the conquest, the land became a major producer of 'Añil' (Indigo), the blue gold that dyed the garments of European royalty.",
    icon: "sailing"
  },
  {
    era: "Independence & Modernity",
    title: "1821 Declaration & The Coffee Boom",
    description: "El Salvador declared independence from Spain in 1821. The late 19th and 20th centuries were defined by the 'Coffee Republic', where a few elite families controlled the wealth, leading to deep social inequalities and eventually the tragic civil war.",
    icon: "local_cafe"
  },
  {
    era: "The Digital Era",
    title: "Transformation & New Identity",
    description: "Emerging from a turbulent past, modern El Salvador is redefining itself. From adopting Bitcoin as legal tender to a massive reduction in crime, the nation is forging a new, resilient identity on the global stage.",
    icon: "memory"
  }
];

export function Timeline() {
  return (
    <div className="space-y-12">
      
      <div className="relative border-l border-primary/30 ml-6 md:ml-12 space-y-16 pb-12">
        {events.map((event, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6, delay: index * 0.2 }}
            className="relative pl-10 md:pl-16"
          >
            <div className="absolute -left-6 top-0 w-12 h-12 bg-background border border-primary rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(113,215,205,0.3)]">
              <span className="material-symbols-outlined text-primary">{event.icon}</span>
            </div>
            
            <div className="bg-surface-container-low/50 p-6 md:p-8 rounded-sm border border-white/5 hover:border-primary/30 transition-colors duration-300">
              <span className="font-label text-secondary text-[10px] uppercase tracking-[0.3em] block mb-2">{event.era}</span>
              <h3 className="font-headline text-2xl md:text-3xl italic text-on-surface mb-4">{event.title}</h3>
              <p className="font-body text-on-surface-variant font-light leading-relaxed">{event.description}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
