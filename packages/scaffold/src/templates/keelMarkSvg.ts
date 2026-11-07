/** `public/keel-mark.svg`: the Keel mark, identical to `docs/brand/keel-mark.svg`. */
export function keelMarkSvg(): string {
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">`,
    "  <!-- Parchment Base -->",
    `  <rect width="64" height="64" fill="#F9F9F9"/>`,
    "  <!-- Outer Structural Framing Square -->",
    `  <rect x="8" y="8" width="48" height="48" fill="none" stroke="#18181B" stroke-width="2"/>`,
    "  <!-- Vertical Load-Bearing Keel Spine (ISO Ochre) -->",
    `  <rect x="30" y="4" width="4" height="56" fill="#C2410C"/>`,
    "  <!-- Horizontal Centerline / Transverse Beam -->",
    `  <rect x="12" y="30" width="40" height="4" fill="#18181B"/>`,
    "  <!-- Inner Precision Brackets -->",
    `  <path d="M 22 20 L 42 20 L 42 44 L 22 44 Z" fill="none" stroke="#18181B" stroke-width="2"/>`,
    "</svg>",
    "",
  ].join("\n");
}
