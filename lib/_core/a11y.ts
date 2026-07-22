/**
 * Accessibility policy helpers (Story 12.10, RDR-9).
 *
 * Complements `lib/_core/contrast.ts` (WCAG math) and `lib/_core/glass.ts`
 * (the glass/gradient AA guarantees, applied via `resolveOpaqueGlassFill` in
 * `GlassSurface` and `resolveGradientInk` in `GradientHero`) with the
 * remaining a11y-specific policy: how far numeric/amount text is allowed to
 * scale with OS dynamic type.
 */

/**
 * Cap applied via `maxFontSizeMultiplier` to numeric/amount text (balance
 * hero, StatCard, the add-transaction amount field) — the exact 200% dynamic
 * type ceiling AC5 requires the app to support, applied as a ceiling here so
 * a fixed-width currency figure scales with the OS setting without clipping
 * or wrapping past what its container can hold. Other text (labels, body
 * copy) scales without this cap.
 */
export const MAX_FONT_SCALE = 2;
