import { layoutWithLines, prepareWithSegments } from '@chenglou/pretext';

// ─── Types ───────────────────────────────────────────────────────────

export type ManifestPhase = 'measuring' | 'idle' | 'breathing' | 'manifesting' | 'locked';
export type ManifestVariant = 'home' | 'projects';
export type ManifestEntryType = 'glyph' | 'media' | 'panel' | 'noise';
export type ManifestRole = 'title' | 'meta' | 'body' | 'media' | 'decoration';

export interface ManifestEntry {
  id: string;
  type: ManifestEntryType;
  role: ManifestRole;
  element: HTMLElement;
  layoutRect: DOMRect;
  swarmX: number;
  swarmY: number;
  swarmZ: number;
  swarmRotate: number;
  swarmScale: number;
  swarmOpacity: number;
  settleDelay: number;
  settled: boolean;
}

export interface CosmicManifestOptions {
  onPhaseChange?: (phase: ManifestPhase) => void;
  variant: ManifestVariant;
}

// ─── Constants ───────────────────────────────────────────────────────

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const IDLE_FPS_INTERVAL = 1000 / 30; // 30fps cap for idle breathing
const BREATHING_AMPLITUDE = 0.06;
const BREATHING_SPEED = 0.0008;

const SETTLE_STAGGER: Record<ManifestRole, { base: number; spread: number }> = {
  title:      { base: 0,   spread: 300 },
  meta:       { base: 100, spread: 350 },
  body:       { base: 200, spread: 400 },
  media:      { base: 50,  spread: 500 },
  decoration: { base: 0,   spread: 600 },
};

const MANIFEST_DURATION: Record<ManifestRole, number> = {
  title: 700,
  meta: 750,
  body: 800,
  media: 900,
  decoration: 600,
};

const EASE_MANIFEST = 'cubic-bezier(0.22, 1, 0.36, 1)';

// ─── Deterministic hash ──────────────────────────────────────────────

function hash01(seed: number): number {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ─── Pretext cache ───────────────────────────────────────────────────

const pretextCache = new Map<string, ReturnType<typeof prepareWithSegments>>();

function getPrepared(text: string, font: string) {
  const key = `${font}\n${text}`;
  const cached = pretextCache.get(key);
  if (cached) return cached;
  const prepared = prepareWithSegments(text, font, {
    whiteSpace: 'normal',
    wordBreak: 'normal',
  });
  pretextCache.set(key, prepared);
  if (pretextCache.size > 120) {
    const first = pretextCache.keys().next().value;
    if (first) pretextCache.delete(first);
  }
  return prepared;
}

// ─── Engine ──────────────────────────────────────────────────────────

export class CosmicManifestEngine {
  private entries: ManifestEntry[] = [];
  private phase: ManifestPhase = 'measuring';
  private variant: ManifestVariant;
  private onPhaseChange?: (phase: ManifestPhase) => void;
  private rafId = 0;
  private breathingStart = 0;
  private lastFrameTime = 0;
  private destroyed = false;
  private breathingFactor = 0;
  private containerRect: DOMRect | null = null;

  constructor(options: CosmicManifestOptions) {
    this.variant = options.variant;
    this.onPhaseChange = options.onPhaseChange;
  }

  // ─── Public API ──────────────────────────────────────────────────

  /**
   * Scan a container for all [data-manifest] elements,
   * measure their layout positions, compute swarm positions,
   * and apply inverse transforms so they appear as a swarm.
   */
  async initialize(container: HTMLElement): Promise<void> {
    if (this.destroyed) return;

    // Wait for web fonts before measuring
    await document.fonts.ready;

    this.setPhase('measuring');

    // Collect all manifest elements
    const elements = container.querySelectorAll<HTMLElement>('[data-manifest]');
    this.containerRect = container.getBoundingClientRect();
    this.entries = [];

    for (const el of elements) {
      const id = el.dataset.manifest!;
      const type = (el.dataset.manifestType || 'glyph') as ManifestEntryType;
      const role = (el.dataset.manifestRole || this.inferRole(type, el)) as ManifestRole;

      const rect = el.getBoundingClientRect();

      this.entries.push({
        id,
        type,
        role,
        element: el,
        layoutRect: rect,
        swarmX: 0,
        swarmY: 0,
        swarmZ: 0,
        swarmRotate: 0,
        swarmScale: 0,
        swarmOpacity: 0,
        settleDelay: 0,
        settled: false,
      });
    }

    if (this.entries.length === 0) {
      this.setPhase('locked');
      return;
    }

    // Compute stagger timing using Pretext for text elements
    this.computeStagger(container);

    // Generate swarm positions (Fibonacci sphere)
    this.generateSwarmPositions();

    // Apply CSS will-change for GPU compositing
    for (const entry of this.entries) {
      entry.element.style.willChange = 'transform, opacity';
    }

    // Apply inverse transforms (FLIP: Invert step)
    this.applySwarmTransforms();

    this.setPhase('idle');
  }

  /**
   * Start the breathing idle animation loop.
   */
  startBreathing(): void {
    if (this.destroyed || this.phase === 'locked' || this.phase === 'manifesting') return;
    this.setPhase('breathing');
    this.breathingStart = performance.now();
    this.lastFrameTime = this.breathingStart;
    this.tickBreathing();
  }

  /**
   * FLIP Play step: animate all entries from swarm positions to layout positions.
   * Returns a promise that resolves when all animations complete.
   */
  async manifest(): Promise<void> {
    if (this.destroyed || this.phase === 'locked') return;

    // Stop breathing loop
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }

    this.setPhase('manifesting');

    const animations: Animation[] = [];

    for (const entry of this.entries) {
      if (entry.type === 'noise') {
        // Noise elements fade out and die
        const anim = entry.element.animate(
          [
            { opacity: String(entry.swarmOpacity) },
            { opacity: '0' },
          ],
          {
            duration: MANIFEST_DURATION.decoration,
            delay: 200,
            easing: EASE_MANIFEST,
            fill: 'forwards',
          },
        );
        animations.push(anim);
      } else {
        // Content elements animate from swarm transform → identity
        const currentTransform = entry.element.style.transform;
        const currentOpacity = entry.element.style.opacity;

        const anim = entry.element.animate(
          [
            { transform: currentTransform, opacity: currentOpacity },
            { transform: 'none', opacity: '1' },
          ],
          {
            duration: MANIFEST_DURATION[entry.role],
            delay: entry.settleDelay,
            easing: EASE_MANIFEST,
            fill: 'forwards',
          },
        );
        animations.push(anim);
      }
    }

    // Wait for all animations to finish
    await Promise.all(animations.map((a) => a.finished.catch(() => {})));

    if (this.destroyed) return;

    // Clean up: remove inline transforms, will-change, commit animations
    for (const entry of this.entries) {
      entry.element.getAnimations().forEach((a) => a.cancel());

      if (entry.type === 'noise') {
        entry.element.style.opacity = '0';
        entry.element.style.pointerEvents = 'none';
      } else {
        entry.element.style.transform = '';
        entry.element.style.opacity = '';
      }

      entry.element.style.willChange = '';
      entry.settled = true;
    }

    this.setPhase('locked');
  }

  /**
   * Expand the swarm slightly on hover.
   */
  expandBreathing(factor: number): void {
    this.breathingFactor = factor;
  }

  /**
   * Clean up: cancel animations, remove inline styles.
   */
  destroy(): void {
    this.destroyed = true;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = 0;
    }
    for (const entry of this.entries) {
      entry.element.getAnimations().forEach((a) => a.cancel());
      entry.element.style.transform = '';
      entry.element.style.opacity = '';
      entry.element.style.willChange = '';
    }
    this.entries = [];
  }

  get currentPhase(): ManifestPhase {
    return this.phase;
  }

  // ─── Internals ───────────────────────────────────────────────────

  private inferRole(type: ManifestEntryType, el: HTMLElement): ManifestRole {
    if (type === 'noise') return 'decoration';
    if (type === 'media') return 'media';
    if (type === 'panel') return 'body';
    // For glyph, infer from tag or data attribute
    const tag = el.tagName.toLowerCase();
    if (tag === 'h1' || tag === 'h2' || tag === 'h3') return 'title';
    if (el.dataset.manifestRole) return el.dataset.manifestRole as ManifestRole;
    return 'body';
  }

  private computeStagger(container: HTMLElement) {
    // Use Pretext for headline text layout verification + stagger computation
    const headlines = this.entries.filter((e) => e.role === 'title' && e.type === 'glyph');
    const containerWidth = this.containerRect?.width || container.clientWidth;

    // Try to get the computed headline font
    let headlineFont = '32px "Newsreader", serif';
    if (headlines.length > 0) {
      const cs = getComputedStyle(headlines[0].element);
      headlineFont = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    }

    // Use Pretext to understand line breaks for stagger ordering
    const headlineText = headlines.map((e) => e.element.textContent || '').join(' ');
    if (headlineText.trim()) {
      try {
        const prepared = getPrepared(headlineText, headlineFont);
        const layout = layoutWithLines(prepared, containerWidth, parseFloat(headlineFont) * 1.3);
        // Use line count to stagger: words on earlier lines arrive first
        const lineCount = layout.lineCount || 1;
        let wordIndex = 0;
        for (const entry of headlines) {
          const linePosition = Math.min(wordIndex / Math.max(1, headlines.length), 1);
          const lineIndex = Math.floor(linePosition * lineCount);
          entry.settleDelay = SETTLE_STAGGER.title.base + (lineIndex / lineCount) * SETTLE_STAGGER.title.spread;
          wordIndex++;
        }
      } catch {
        // Fallback: linear stagger
        headlines.forEach((e, i) => {
          e.settleDelay = SETTLE_STAGGER.title.base + (i / Math.max(1, headlines.length)) * SETTLE_STAGGER.title.spread;
        });
      }
    }

    // Stagger non-headline entries by role
    const byRole = new Map<ManifestRole, ManifestEntry[]>();
    for (const entry of this.entries) {
      if (entry.role === 'title' && entry.type === 'glyph') continue; // already done
      const list = byRole.get(entry.role) || [];
      list.push(entry);
      byRole.set(entry.role, list);
    }

    for (const [role, entries] of byRole) {
      const stagger = SETTLE_STAGGER[role];
      entries.forEach((entry, i) => {
        entry.settleDelay = stagger.base + (i / Math.max(1, entries.length)) * stagger.spread;
      });
    }
  }

  private generateSwarmPositions() {
    const cr = this.containerRect;
    if (!cr) return;

    const centerX = cr.width / 2;
    const centerY = cr.height / 2;
    const radius = Math.max(120, Math.min(cr.width, cr.height) * (this.variant === 'home' ? 0.38 : 0.32));
    const count = Math.max(1, this.entries.length);

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      const t = (i + 0.5) / count;
      const y = 1 - 2 * t;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * GOLDEN_ANGLE + hash01(i * 0.41) * 0.22;
      const warp = 0.82 + hash01(i * 9.91) * 0.32;

      // Swarm positions relative to container center
      entry.swarmX = Math.cos(theta) * ring * radius * warp;
      entry.swarmY = y * radius * 0.82 + Math.sin(theta * 3.1) * 8;
      entry.swarmZ = Math.sin(theta) * ring * radius * 0.3; // flattened depth

      // Random rotation and scale
      entry.swarmRotate = (hash01(i * 7.13) - 0.5) * 60; // ±30deg
      entry.swarmScale = entry.type === 'noise'
        ? 0.3 + hash01(i * 3.7) * 0.3
        : 0.4 + hash01(i * 5.3) * 0.35;
      entry.swarmOpacity = entry.type === 'noise'
        ? 0.3 + hash01(i * 2.1) * 0.35
        : 0.6 + hash01(i * 1.9) * 0.4;

      // For panels and media, less extreme transforms
      if (entry.type === 'panel' || entry.type === 'media') {
        entry.swarmRotate *= 0.3;
        entry.swarmScale = 0.5 + hash01(i * 4.2) * 0.25;
        entry.swarmOpacity = 0.5 + hash01(i * 2.8) * 0.3;
      }

      // Translate swarm coords: we need the offset from the element's layout position
      // to the swarm position (centered in the container)
      const elCenterX = entry.layoutRect.left - (cr?.left || 0) + entry.layoutRect.width / 2;
      const elCenterY = entry.layoutRect.top - (cr?.top || 0) + entry.layoutRect.height / 2;

      // Store the delta from layout to swarm
      entry.swarmX = (centerX + entry.swarmX) - elCenterX;
      entry.swarmY = (centerY + entry.swarmY) - elCenterY;
    }
  }

  private applySwarmTransforms() {
    for (const entry of this.entries) {
      const transform = `translate3d(${entry.swarmX}px, ${entry.swarmY}px, ${entry.swarmZ}px) rotate(${entry.swarmRotate}deg) scale(${entry.swarmScale})`;
      entry.element.style.transform = transform;
      entry.element.style.opacity = String(entry.swarmOpacity);
    }
  }

  private tickBreathing = () => {
    if (this.destroyed || this.phase !== 'breathing') return;

    const now = performance.now();
    if (now - this.lastFrameTime < IDLE_FPS_INTERVAL) {
      this.rafId = requestAnimationFrame(this.tickBreathing);
      return;
    }
    this.lastFrameTime = now;

    const elapsed = now - this.breathingStart;
    const breathPhase = elapsed * BREATHING_SPEED;
    const expansionFactor = 1 + this.breathingFactor * 0.08;

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i];
      if (entry.settled) continue;

      // Sine-wave position offsets with per-element phase offset
      const phaseOffset = hash01(i * 3.17) * Math.PI * 2;
      const dx = Math.sin(breathPhase + phaseOffset) * BREATHING_AMPLITUDE * 20;
      const dy = Math.cos(breathPhase * 0.7 + phaseOffset) * BREATHING_AMPLITUDE * 15;

      const x = entry.swarmX * expansionFactor + dx;
      const y = entry.swarmY * expansionFactor + dy;

      entry.element.style.transform =
        `translate3d(${x}px, ${y}px, ${entry.swarmZ}px) rotate(${entry.swarmRotate}deg) scale(${entry.swarmScale})`;
    }

    this.rafId = requestAnimationFrame(this.tickBreathing);
  };

  private setPhase(phase: ManifestPhase) {
    if (this.phase === phase) return;
    this.phase = phase;
    this.onPhaseChange?.(phase);
  }
}
