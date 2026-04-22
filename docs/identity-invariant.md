# Identity Invariant — The Steady Anchor

A hard rule for every typographic animation in this repo. The reference implementation lives in [frontend/src/portfolio/transmutation/SteadyAnchorEngine.ts](../frontend/src/portfolio/transmutation/SteadyAnchorEngine.ts).

## The rule

Every visible typographic unit (letter, glyph, particle, token) used in a multi-phase sequence must exist from the start as part of **one persistent source pool**, tracked through the entire simulation with a **stable ID**.

If a unit appears in the final composition, that exact unit must already exist in phase one and must be followable by its ID through every intermediate frame. The final composition emerges from continuity, not substitution.

## Allowed per-entity changes

- position
- velocity
- orientation
- scale
- shader-based deformation
- role reassignment (e.g. scaffold → content, content → border material, scaffold → scaffold with different target)

## Forbidden patterns

- fade out one set and fade in another
- hide one renderer (canvas/WebGL/DOM) and reveal matching clones in another before the final one-frame cut
- destroy source glyphs and respawn replacements at the same location
- duplicate entities to make the composition easier to author

The final composition must emerge from continuity, not substitution. The same simulated entities that disperse must be the ones that assemble, deform, and terminate.

## A single, explicit handoff *is* allowed

At the very end of a sequence, a strict one-frame cut from animated canvas to a DOM-owned final composition is permitted if:

- the DOM final composition is **not visually present** for any frame before the cut (`visibility: hidden`, not a crossfade),
- the canvas renders the animated pool up to and including the frame immediately before the cut,
- the cut happens inside a single rAF tick via `flushSync` so both the canvas-hide and the DOM-reveal land before the next browser paint,
- the pre-cut canvas pixel positions equal the post-cut DOM pixel positions for every corresponding content glyph (≤1px).

A fade is not a cut. A crossfade is not a cut. Any intermediate fractional opacity on the canvas during handoff is a violation.

## Checklist for new typographic stages

Before shipping any new animation that phases through typographic states, verify all of the following. If any answer is "no", fix it before merge.

- [ ] Does every visible glyph in every frame come from one persistent entity pool?
- [ ] Does each entity have a stable `id` assigned at allocation and never rewritten?
- [ ] Is the pool grow-only — never shrunk, never reallocated in a way that loses `id` values?
- [ ] On reconfigure/resize, are targets changed on existing entities (retarget), not replaced by fresh entities?
- [ ] Are non-content entities retained as scaffold (role reassignment), not destroyed mid-animation?
- [ ] Is the only place an entity can be deallocated the engine's `destroy()` at unmount?
- [ ] Is the handoff to any second renderer a single-frame cut, not a fade?
- [ ] Is the second renderer invisible (`visibility: hidden`) for every frame up to and including the frame immediately before the cut?
- [ ] Do dev-mode runtime assertions cover: `id` immutability, monotonic `particleCount`, no mid-animation `alive = 0`, and `canvasAlpha ∈ {0, 1}`?
- [ ] Are the pre-cut canvas positions pixel-equal to the post-cut DOM positions (≤1px) for every content glyph?

## Dev-mode runtime assertions

The reference engine enforces the invariant with assertions gated by `import.meta.env.DEV`:

- Any write to `id[i]` after its first assignment throws.
- Any decrease of `particleCount` throws.
- Any `alive[i] = 0` outside the engine's `destroy()` throws.
- Any `canvasAlpha` write to a value not in `{0, 1}` throws.
- Pool growth that would shift existing `id[i]` values throws.

These assertions are the project-wide guardrail. Any new engine that implements the invariant should inherit them (either by reusing the `SteadyAnchorEngine` base utilities or by replicating the same five checks).

## Related docs

- [docs/pretext-constraints.md](pretext-constraints.md) — what the layout library does and does not do; why per-glyph target derivation lives in our planner.
- [docs/vendor/pretext/SOURCE.md](vendor/pretext/SOURCE.md) — provenance of the vendored Pretext docs.
