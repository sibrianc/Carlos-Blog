# Pretext Constraints Memo

Grounding document for the home transmutation pipeline. Written from the vendored snapshot at `docs/vendor/pretext/` (upstream commit `7aacd78e01af57854713422686f0582a1385121a`). All claims below are traceable to a specific vendored file and section — refresh this memo whenever `SOURCE.md` is updated.

## 1. What Pretext does reliably

- **DOM-free multiline measurement.** `prepare(text, font)` + `layout(prepared, maxWidth, lineHeight)` returns `{ height, lineCount }` without triggering reflow. Canvas `measureText` is the ground-truth oracle; results are cached as segment widths. (`README.md` §API 1; `RESEARCH.md` §"Approach 1: Canvas measureText + word-width caching")
- **Line breaking with cursor ranges.** `prepareWithSegments` + `layoutWithLines` returns `lines: LayoutLine[]`, each with `text`, `width`, `start` and `end` cursors (`{ segmentIndex, graphemeIndex }`). This is the line-level geometry our planner consumes. (`README.md` §API 2; API Glossary)
- **Variable-width line iteration.** `layoutNextLineRange` + `materializeLineRange` lets us flow text around obstacles by advancing a cursor at a width that changes per line. (`README.md` §"Lay out the paragraph lines manually yourself")
- **Non-materializing stats.** `measureLineStats(prepared, maxWidth)` returns `{ lineCount, maxLineWidth }` without allocating line strings — cheap for shrinkwrap / fit-check loops. (`README.md` API Glossary)
- **Natural-width inquiry.** `measureNaturalWidth` returns the widest forced line (hard breaks still count) so we can compute "how wide must the container be to fit without wrapping". (`README.md` API Glossary)
- **White-space + word-break modes.** `{ whiteSpace: 'normal' | 'pre-wrap' }` and `{ wordBreak: 'normal' | 'keep-all' }` are supported; CJK/Hangul boundary behavior is tested. (`README.md` §Caveats; `CHANGELOG.md` 0.0.5, 0.0.2)
- **Multi-script segmentation.** Bidi-aware segmentation covers the scripts listed as canaries (Japanese, Chinese, Myanmar, Urdu/Arabic narrow cases). (`RESEARCH.md` §"Current steering summary")
- **Rich inline flow helper.** `@chenglou/pretext/rich-inline` handles per-item fonts, atomic items (`break: 'never'`), and caller-owned chrome width (`extraWidth`) for chip/mention patterns. (`README.md` §"if your manual layout needs a small helper for rich-text inline flow")
- **Deterministic caching.** Calling `prepare`/`prepareWithSegments` with the same `(text, font, options)` hits the internal cache; `clearCache()` is the escape hatch when font sets change. Setting a new locale via `setLocale()` internally calls `clearCache()` but does not mutate existing prepared handles. (`README.md` "Other helpers")

## 2. What Pretext does not do

- **No per-glyph (x, y) coordinates.** `README.md` §API Glossary, "Notes" bullet: *"Segment widths are browser-canvas widths for line breaking, not exact glyph-position data for custom Arabic or mixed-direction x-coordinate reconstruction."* Our engine is solely responsible for turning line geometry into per-glyph targets.
- **No rendering.** Pretext computes layout; the caller draws to DOM / Canvas / SVG / WebGL. (`README.md` §opening)
- **No vertical layout beyond `lineHeight × lineCount`.** `prepare()` and `prepareWithSegments()` do horizontal-only work. `lineHeight` is a layout-time input. (`README.md` §API Glossary, "Notes" bullet)
- **No `system-ui` accuracy on macOS.** Canvas and DOM resolve `system-ui` to different SF Pro variants at certain sizes. Documented as unsafe; a named font is required. (`README.md` §Caveats; `RESEARCH.md` §"Discovery: system-ui font resolution mismatch")
- **No bidi x-coordinate reconstruction.** `segLevels` metadata is present on the rich handle but the line-breaking APIs do not read it; any bidi-correct horizontal placement is on the caller. (`README.md` §API Glossary, "Notes")
- **No empty-string line height.** `layout('')` returns `{ lineCount: 0, height: 0 }`. Browsers render an empty block at one `line-height`; callers who need that must `Math.max(1, lineCount) * lineHeight`. (`README.md` §API Glossary, "Notes")
- **No font-readiness guard.** The caller must `await document.fonts.ready` before measuring or the measurements will be taken against fallback fonts.
- **No animation or identity tracking.** Pretext is stateless with respect to animation phases; there is no concept of "entity", "particle", or "phase" — that's entirely our engine's responsibility.
- **No resize-time glyph-target delta.** Pretext can re-run `layout()` cheaply on a new width, but it does not tell us *which old glyph corresponds to which new target position*. The matching algorithm is ours.
- **No CSS-level text features that affect horizontal geometry beyond the supported modes.** `letter-spacing`, `text-indent`, `tab-size` other than the default 8, and non-`break-word`/`keep-all` `word-break` values are unsupported; any reliance on these must be reproduced in our planner.
- **Soft-hyphen artifacts.** If a soft hyphen wins a break, the materialized line text includes a visible trailing `-`. (`README.md` §API Glossary, "Notes") Our planner must handle that grapheme explicitly when mapping to targets.

## 3. Which Pretext APIs we will use

Core (imported from `@chenglou/pretext`):

- `prepareWithSegments(text, font, options?)` — one call per distinct content block (project title, meta line, body paragraph) on first `configure`. Cached by Pretext across identical inputs.
- `layoutWithLines(prepared, maxWidth, lineHeight)` — primary line-geometry source for fixed-width blocks. Returns full `LayoutLine[]` we feed into per-glyph target derivation.
- `measureLineStats(prepared, maxWidth)` — used pre-flight in the planner to decide block heights before committing to a layout (e.g. "does this body fit in the column at this width?").
- `measureNaturalWidth(prepared)` — used when we want a shrink-to-fit block (e.g. project title without wrapping).
- `clearCache()` — called from the engine's `destroy()` when we know no other transmutation stage will reuse the same prepared text.

Possible (guarded by a concrete need):

- `layoutNextLineRange` + `materializeLineRange` — only if we introduce flow-around-chrome layouts (not a V1 requirement).
- `@chenglou/pretext/rich-inline` (`prepareRichInline`, `walkRichInlineLineRanges`, `materializeRichInlineLineRange`) — only if a single line mixes fonts (e.g. role label with a differently-sized year chip). If we never mix fonts on a line, we stay on the core API.

Deliberately unused:

- `prepare` + `layout` (non-segment variants). We always need per-line cursors in the planner, so we use the `WithSegments` variants exclusively.
- `setLocale`. Default locale is acceptable for the current Spanish/English portfolio content.

## 4. Which gaps our engine must solve itself

These are the responsibilities Pretext will not cover; each is a line item in the `SteadyAnchorEngine` + `layoutPlanner` design.

1. **Per-glyph target `(x, y)` derivation.** Walk each `LayoutLine` grapheme by grapheme; accumulate x using canvas `ctx.measureText` on substrings of the line's `text` (same measurement path Pretext uses internally, so widths match within floating-point tolerance). y is `lineIndex * lineHeight + baselineOffset`. Emit a `GlyphTarget` per grapheme with a stable index that matches the DOM mirror's `<span>` ordering.
2. **Line alignment.** Apply horizontal alignment (`left | center | right`) at the planner level by offsetting each line's starting x. Pretext returns left-aligned widths; centering math is ours.
3. **Font/CSS sync.** Read `getComputedStyle` on a dedicated hidden probe element (one per role: title/meta/body) to construct the canvas `font` shorthand. Enforce that the resolved `font-family` contains no `system-ui` token; throw in dev if it does. Use the same computed values to set canvas `ctx.font` so Pretext's measurements and the eventual `fillText` calls agree.
4. **Font-ready gating.** `await document.fonts.ready` before the first `configure` call. Re-await on visibility changes that could have invalidated font resolution.
5. **DPR handling + pixel snapping.** Pretext numbers are CSS pixels. The engine scales the canvas backing store by `devicePixelRatio` and floor-snaps final resting positions to integer device pixels on the pre-cut frame (matching DOM `getBoundingClientRect` integer rounding within ≤1px).
6. **Per-glyph identity & role.** Stable `Uint32Array id[i]` assigned at first allocation, never rewritten. Role is first-class (`TITLE | META | BODY | SCAFFOLD`), allowed to be reassigned on retarget (promote/demote) but never destroyed.
7. **Retarget matching.** On resize or content change, Pretext re-runs cheaply; our planner rebuilds targets; our engine's assignment algorithm (nearest-neighbor with role preference, scaffold promotion) maps existing entities to new targets without reallocation.
8. **Soft-hyphen grapheme.** When a line's materialized text ends in a soft-hyphen-induced `-`, the planner emits that glyph as a target and the engine treats it like any other entity (it occupies a slot in the pool with `role = TITLE/META/BODY` depending on parent block).
9. **Bidi x-placement.** Out of scope for V1 (content is Spanish/English). Documented as a future gap. If RTL content is added, inspect `prepared.segLevels` and re-derive grapheme x with a bidi-aware pass.
10. **Animation physics and phase machine.** Entirely our engine's responsibility. Pretext has no notion of "release", "settle", or "cut".
11. **Ambient/scaffold positioning.** Pretext does not describe what lies outside the text. The planner computes `AmbientPlan` (drift orbits around the composition centroid) for scaffold entities.
12. **Reduced-motion.** Not Pretext's concern. The component observes `prefers-reduced-motion` and skips the engine entirely, rendering the DOM mirror visibly from frame one.
13. **Canvas/DOM pixel equality at cut.** Pretext does not guarantee canvas-vs-DOM pixel agreement beyond the shared measurement oracle. The engine snaps to measured DOM rects on the pre-cut frame and asserts ≤1px delta in dev.
14. **Cache lifecycle.** Pretext's shared cache persists process-wide. The engine calls `clearCache()` only when it is the last consumer. If another stage ever shares the library, this becomes a coordinated concern — tracked as a follow-up if/when that happens.

## Change log for this memo

- 2026-04-19 — initial version from pinned Pretext snapshot `7aacd78`.
