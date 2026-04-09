import React from 'react';
import { motion } from 'motion/react';

const words = [
  {
    term: "Chero / Bicho",
    pronunciation: "[ˈtʃe.ɾo / ˈbi.tʃo]",
    definition: "How we call our friends and children. 'Chero' refers to a buddy or close friend, derived from the indigenous word for boy. 'Bicho' or 'Bicha' is an affectionate (though sometimes scolding) term for kids or teenagers."
  },
  {
    term: "Púchica",
    pronunciation: "[ˈpu.tʃi.ka]",
    definition: "The most versatile expression in the country. It can denote surprise, anger, admiration, or frustration depending entirely on the tone and context. A polite substitute for stronger expletives."
  },
  {
    term: "Yeyo / Mosh",
    pronunciation: "[ˈʝe.ʝo / moʃ]",
    definition: "Local ways to describe feeling sick or confused. To 'give someone a yeyo' means they fainted or had a sudden health scare. 'Mosh' implies a state of confusion, being overwhelmed, or a chaotic situation."
  }
];

export function Lexicon() {
  return (
    <div className="space-y-12">
      <div className="mb-12">
        <p className="font-body text-on-surface-variant font-light">A survival guide to local slang, the "Guanaco" dictionary.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {words.map((word, index) => (
          <motion.div 
            key={index}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="p-8 bg-surface-container-low/30 backdrop-blur-sm border border-primary/10 rounded-sm hover:border-primary/40 transition-colors duration-300"
          >
            <h3 className="font-headline text-3xl text-primary mb-1">{word.term}</h3>
            <span className="font-mono text-secondary/80 text-sm mb-6 block">{word.pronunciation}</span>
            <p className="font-body text-on-surface-variant font-light leading-relaxed">{word.definition}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
