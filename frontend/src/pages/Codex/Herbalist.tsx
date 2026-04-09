import React from 'react';
import { CodexCard } from '../../components/CodexCard';

export function Herbalist() {
  return (
    <div className="space-y-16">
      <div className="mb-12">
        <p className="font-body text-on-surface-variant font-light">The healing power and sacred plants of the land.</p>
      </div>

      <div className="space-y-12">
        <CodexCard 
          title="Sacred Maize"
          subtitle="Zea mays"
          description="According to the Popol Vuh, the gods created the first true humans from maize dough. It is not just a crop; it is the foundation of life, culture, and spirituality in Mesoamerica. Every part of the plant is used, and its cultivation is tied to the cycles of the sun and rain."
          imageSrc="https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=800&auto=format&fit=crop"
          imageAlt="Corn stalks in a field"
        />
        
        <CodexCard 
          title="The Balsam of El Salvador"
          subtitle="Myroxylon balsamum"
          description="A unique, aromatic healing resin extracted from trees along the 'Balsam Coast'. Historically misnamed 'Balsam of Peru' because it was shipped through Callao, it is entirely Salvadoran. It has been exported for centuries for its powerful antiseptic and wound-healing properties."
          imageSrc="https://images.unsplash.com/photo-1611078449925-f6710b710153?q=80&w=800&auto=format&fit=crop"
          imageAlt="A close up of tree bark and resin"
          reverse
        />

        <CodexCard 
          title="The Izote Flower"
          subtitle="Yucca gigantea"
          description="The national flower of El Salvador. Beyond its striking, towering white blooms that decorate the landscape, it holds culinary secrets. The bitter petals are traditionally boiled and scrambled with eggs and tomatoes, a delicacy that bridges the gap between ornamental beauty and sustenance."
          imageSrc="https://images.unsplash.com/photo-1588600878108-578307a3cc9d?q=80&w=800&auto=format&fit=crop"
          imageAlt="White yucca flowers blooming"
        />
      </div>
    </div>
  );
}
