import React from 'react';
import { CodexCard } from '../../components/CodexCard';

export function Gastronomicon() {
  return (
    <div className="space-y-16">
      <div className="mb-12">
        <p className="font-body text-on-surface-variant font-light">The flavors that define a nation, forged in clay and fire.</p>
      </div>

      <div className="space-y-12">
        <CodexCard 
          title="The Art of the Pupusa"
          subtitle="The National Dish"
          description="More than food, it is an institution. Thick, handmade corn or rice tortillas stuffed with savory fillings like cheese, beans, and chicharrón. They are cooked on a traditional comal and MUST be eaten by hand, accompanied by the 'sacred' curtido (fermented cabbage slaw) and mild tomato salsa."
          imageSrc="https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=800&auto=format&fit=crop"
          imageAlt="Traditional Latin American food"
        />
        
        <CodexCard 
          title="Ancient Spirits"
          subtitle="Elixirs of the Earth"
          description="The beverages of the ancestors. Atol Chuco (a fermented, sour purple corn drink served in a morro gourd), Chilate (a simple, unspiced toasted corn drink meant to balance sweet preserves), and Horchata de Morro (a rich, spiced drink made from ground morro seeds, cocoa, and cinnamon)."
          imageSrc="https://images.unsplash.com/photo-1544145945-f90425340c7e?q=80&w=800&auto=format&fit=crop"
          imageAlt="A traditional clay cup with a dark beverage"
          reverse
        />
      </div>
    </div>
  );
}
