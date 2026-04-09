import React from 'react';
import { CodexCard } from '../../components/CodexCard';

export function FieldGuide() {
  return (
    <div className="space-y-16">
      <div className="mb-12">
        <p className="font-body text-on-surface-variant font-light">The biodiversity and living treasures of the land of volcanoes.</p>
      </div>

      <div className="space-y-12">
        <CodexCard 
          title="The Torogoz"
          subtitle="Eumomota superciliosa"
          description="Our national bird. It cannot survive in captivity, symbolizing the Salvadoran spirit of freedom. Its plumage is a striking mix of turquoise, green, and rust, and its tail features two long feathers ending in distinctive racket-like tips."
          imageSrc="https://images.unsplash.com/photo-1552728089-57168a145833?q=80&w=800&auto=format&fit=crop"
          imageAlt="A colorful tropical bird"
        />
        
        <CodexCard 
          title="The Sea Turtle"
          subtitle="Chelonioidea"
          description="The nesting sanctuaries of Jiquilisco Bay and the Pacific coast are vital for the survival of several endangered sea turtle species, including the Hawksbill and Olive Ridley. They return to the exact beaches of their birth to lay their eggs under the moonlight."
          imageSrc="https://images.unsplash.com/photo-1437622368342-7a3d73a34c8f?q=80&w=800&auto=format&fit=crop"
          imageAlt="A sea turtle swimming in deep water"
          reverse
        />

        <CodexCard 
          title="The Ocelot"
          subtitle="Leopardus pardalis"
          description="The mysterious feline of El Imposible National Park. A solitary and nocturnal hunter, its beautiful rosette-patterned coat provides perfect camouflage in the dense tropical forests. It is a symbol of the untamed wilderness that still exists in the country's protected reserves."
          imageSrc="https://images.unsplash.com/photo-1562569633-622303bafef5?q=80&w=800&auto=format&fit=crop"
          imageAlt="A wild feline in the jungle"
        />

        <CodexCard 
          title="The Garrobo"
          subtitle="Ctenosaura similis"
          description="The iconic, spiny-tailed iguana of the Salvadoran landscape. Often seen basking on hot rocks or scurrying up trees, the garrobo is deeply ingrained in local culture and folklore, representing resilience in the harsh, dry seasons."
          imageSrc="https://images.unsplash.com/photo-1504450758481-7338eba7524a?q=80&w=800&auto=format&fit=crop"
          imageAlt="A large iguana on a rock"
          reverse
        />
      </div>
    </div>
  );
}
