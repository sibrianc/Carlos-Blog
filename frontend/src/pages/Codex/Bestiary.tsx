import React from 'react';
import { CodexCard } from '../../components/CodexCard';

export function Bestiary() {
  return (
    <div className="space-y-16">
      <div className="mb-12">
        <p className="font-body text-on-surface-variant font-light">A "biological" study of the supernatural entities that roam the night and guard the wild places.</p>
      </div>

      <div className="space-y-12">
        <CodexCard 
          title="The Cadejo"
          subtitle="Canis Spiritus"
          description="The eternal struggle manifested in canine form. The White Cadejo is a protector of travelers and drunks, a spirit of light. The Black Cadejo is a stalker, a manifestation of evil that seeks to steal the soul. They are bound together, unable to kill one another, maintaining the balance of the night."
          imageSrc="https://images.unsplash.com/photo-1574169208507-84376144848b?q=80&w=800&auto=format&fit=crop"
          imageAlt="A dark, mysterious wolf-like creature in the shadows"
        />
        
        <CodexCard 
          title="The Siguanaba"
          subtitle="Siren of the Rivers"
          description="A beautiful woman seen from behind, washing clothes in the rivers at midnight. She lures unfaithful men into the wilderness. When they approach, she turns to reveal the horrifying face of a dead horse, driving her victims mad with terror."
          imageSrc="https://images.unsplash.com/photo-1505909182942-e2f09aee3e89?q=80&w=800&auto=format&fit=crop"
          imageAlt="A misty, dark river at night"
          reverse
        />

        <CodexCard 
          title="The Cipitío"
          subtitle="The Eternal Child"
          description="Cursed to remain a boy forever, the Cipitío is the son of the Siguanaba. He has a large belly, wears a wide-brimmed hat, and his feet point backwards to confuse anyone trying to track him. He is mischievous, throwing pebbles at beautiful girls and eating ashes from rural kitchens."
          imageSrc="https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=800&auto=format&fit=crop"
          imageAlt="A mystical forest path"
        />

        <CodexCard 
          title="The Cuyancúa"
          subtitle="Harbinger of Rain"
          description="A massive, terrifying chimera—half serpent, half pig. It is said to appear before the heavy rains, bringing storms and floods. Its cry is a deafening screech that echoes through the valleys, warning the villagers to seek high ground."
          imageSrc="https://images.unsplash.com/photo-1605806616949-1e87b487cb2a?q=80&w=800&auto=format&fit=crop"
          imageAlt="A dark, stormy landscape with twisted roots"
          reverse
        />
      </div>
    </div>
  );
}
