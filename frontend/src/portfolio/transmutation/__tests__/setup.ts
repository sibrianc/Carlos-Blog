const originalGetContext = HTMLCanvasElement.prototype.getContext;

interface StubCtxState {
  font: string;
  textBaseline: string;
  fillStyle: string;
  globalAlpha: number;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
}

function createCtxStub(): unknown {
  const state: StubCtxState = {
    font: '16px sans-serif',
    textBaseline: 'alphabetic',
    fillStyle: '#000',
    globalAlpha: 1,
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  const stub = {
    get font() { return state.font; },
    set font(v: string) { state.font = v; },
    get textBaseline() { return state.textBaseline; },
    set textBaseline(v: string) { state.textBaseline = v; },
    get fillStyle() { return state.fillStyle; },
    set fillStyle(v: string) { state.fillStyle = v; },
    get globalAlpha() { return state.globalAlpha; },
    set globalAlpha(v: number) { state.globalAlpha = v; },
    get shadowColor() { return state.shadowColor; },
    set shadowColor(v: string) { state.shadowColor = v; },
    get shadowBlur() { return state.shadowBlur; },
    set shadowBlur(v: number) { state.shadowBlur = v; },
    get shadowOffsetX() { return state.shadowOffsetX; },
    set shadowOffsetX(v: number) { state.shadowOffsetX = v; },
    get shadowOffsetY() { return state.shadowOffsetY; },
    set shadowOffsetY(v: number) { state.shadowOffsetY = v; },
    setTransform: () => {},
    clearRect: () => {},
    fillText: () => {},
    measureText: (text: string) => {
      const sizeMatch = /([0-9.]+)px/.exec(state.font);
      const size = sizeMatch ? parseFloat(sizeMatch[1]) : 16;
      return { width: text.length * size * 0.58 };
    },
    save: () => {},
    restore: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => {},
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    arc: () => {},
    fill: () => {},
    stroke: () => {},
  };
  return stub;
}

HTMLCanvasElement.prototype.getContext = function patchedGetContext(
  this: HTMLCanvasElement,
  contextId: string,
  ...rest: unknown[]
): unknown {
  if (contextId === '2d') return createCtxStub();
  return originalGetContext.apply(this, [contextId, ...rest] as Parameters<typeof originalGetContext>);
} as typeof HTMLCanvasElement.prototype.getContext;

if (typeof (globalThis as { performance?: Performance }).performance === 'undefined') {
  (globalThis as unknown as { performance: { now: () => number } }).performance = { now: () => Date.now() };
}
