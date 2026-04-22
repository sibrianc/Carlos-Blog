export const ROLE_TITLE = 0 as const;
export const ROLE_META = 1 as const;
export const ROLE_BODY = 2 as const;
export const ROLE_SCAFFOLD = 3 as const;

export type Role = typeof ROLE_TITLE | typeof ROLE_META | typeof ROLE_BODY | typeof ROLE_SCAFFOLD;

export type TransmutationPhase =
  | 'dormant'
  | 'idleSphere'
  | 'shatter'
  | 'shatterToFog'
  | 'returnToSphere'
  | 'summoning'
  | 'compression'
  | 'fracture'
  | 'release'
  | 'homeSky'
  | 'homeGround'
  | 'homeSun'
  | 'homeMountains'
  | 'homeHeader'
  | 'homeFooterDock'
  | 'homeFooterReal'
  | 'homeHero'
  | 'homeFeatured'
  | 'formationTitle'
  | 'formationMeta'
  | 'formationBody'
  | 'settle'
  | 'cutPending'
  | 'handoffComplete';

export interface Viewport {
  width: number;
  height: number;
  dpr: number;
}

export interface FontBucket {
  id: number;
  family: string;
  size: number;
  weight: number;
  style: 'normal' | 'italic';
  letterSpacing: number;
  color: string;
  ascent: number;
  descent: number;
}

export interface TextBlockInput {
  id: string;
  text: string;
  role: Role;
  fontBucketId: number;
  originX: number;
  originY: number;
  maxWidth: number;
  lineHeight: number;
  align: 'left' | 'center' | 'right';
}

export interface LinePlan {
  blockId: string;
  role: Role;
  fontBucketId: number;
  lineIndex: number;
  text: string;
  width: number;
  measuredWidth: number;
  startX: number;
  baselineY: number;
}

export interface GlyphTarget {
  glyph: string;
  x: number;
  y: number;
  role: Role;
  fontBucketId: number;
  blockId: string;
  glyphIndex: number;
}

export interface AmbientPlan {
  centroidX: number;
  centroidY: number;
  innerRadius: number;
  outerRadius: number;
  count: number;
}

export interface CanvasSurfacePlan {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  mediaX: number;
  mediaY: number;
  mediaWidth: number;
  mediaHeight: number;
}

export interface HomeSceneManifestPlan {
  enabled: true;
}

export interface DomMirrorSpan {
  glyph: string;
  glyphIndex: number;
  lineIndex: number;
  x: number;
  y: number;
  width: number;
}

export interface DomMirrorBlock {
  id: string;
  role: Role;
  fontBucketId: number;
  align: 'left' | 'center' | 'right';
  originX: number;
  originY: number;
  width: number;
  height: number;
  lineHeight: number;
  lineCount: number;
  naturalWidth: number;
  maxLineWidth: number;
  spans: DomMirrorSpan[];
}

export interface DomMirrorPlan {
  width: number;
  height: number;
  blocks: DomMirrorBlock[];
}

export interface LayoutPlan {
  viewport: Viewport;
  fontBuckets: FontBucket[];
  blocks: TextBlockInput[];
  surfaces: CanvasSurfacePlan[];
  homeScene?: HomeSceneManifestPlan;
  lines: LinePlan[];
  targets: GlyphTarget[];
  contentGlyphCount: number;
  totalParticleCount: number;
  ambient: AmbientPlan;
  domMirror: DomMirrorPlan;
  measurementSignature: string;
  signature: string;
}

export interface EngineOptions {
  onPhaseChange?: (phase: TransmutationPhase) => void;
}

export interface SteadyAnchorHandle {
  beginManifestation: () => Promise<void>;
  shatterToFog: () => Promise<void>;
  setHoverExpansion: (factor: number) => void;
  destroy: () => void;
}
