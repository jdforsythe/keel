---
"@keel/ui": minor
"@keel/check": minor
"@keel/compiler": minor
"@keel/cli": minor
"@keel/server": minor
"@keel/runtime-dom": minor
"@keel/testing": minor
---

Themes: `themes` in `tokens.ts` with `choice`, `contrast` and `print`, compiled to cascade layers and judged per combination (7:1 for text under the contrast theme); `ThemeSelect`, `appearance(ctx)`, `data-k-theme` and the `keel-theme` cookie on the first paint. Colors in six opaque forms with exact luminance, `overlay` tokens with their backdrops (E1817), alpha in `shadow`. Print: a `print` key on responsive props, `media`, `breakBefore`, `breakAfter`, `breakInside`; `Box scheme` for a subtree. A library ships `themes.contrast` and `themes.print`. `keel tokens import` and `keel tokens set`. `defineTokens` and `TokenSchema` are imported from `@keel/ui/tokens` and `contrastTable` from `@keel/ui/css`; the main `@keel/ui` entry holds what components import, and `brandTokens` (`@keel/ui/brand`) is plain data a component may read without carrying the token grammar; `keel check` refuses `@keel/ui/tokens` and `@keel/ui/css` in client code (E1818). E1807 points at the key that is wrong and says why. A color outside sRGB ships in two forms Keel computes, an `rgb()` sRGB form and, under `(color-gamut: p3)`, a P3 form, and E1804 and `base.focus` judge each, at check and at render, the lower ratio standing and named (`(sRGB)`, `(P3)`); an overlay is composited within each form (`composite(alpha, backdrop, form)`, `formsOf`). The Vite plugin minifies CSS with esbuild, which keeps each color as compiled; a project `cssMinify` or `css.transformer` that rewrites colors fails the build (E1007 `css config`). A build ships no code for the break props, `media` or `Box scheme` when the app writes none. `keel mcp` states the shared flags once in `initialize`'s `instructions` instead of in each tool's schema.
