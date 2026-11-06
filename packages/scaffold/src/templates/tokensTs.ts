/** `tokens.ts` (k.ui): the k.ui example token set, plus the `Register` augmentation that types style props by it. */
export function tokensTs(): string {
  return [
    "import { defineTokens } from '@keel/ui'",
    "",
    "export const tokens = defineTokens({",
    "  color: { fg: { light: '#111', dark: '#eee' }, bg: { light: '#fff', dark: '#111' }, accent: '#0a5' },",
    "  space: { 0: '0', 1: '4px', 2: '8px', 3: '16px' },",
    "  radius: { 1: '4px' },",
    "  font: { body: 'system-ui' },",
    "  fontSize: { sm: '14px', md: '16px', lg: '24px' },",
    "  breakpoint: { md: '768px' },",
    "  motion: { fast: '120ms' },",
    "})",
    "",
    "declare module '@keel/ui' {",
    "  interface Register {",
    "    tokens: typeof tokens",
    "  }",
    "}",
    "",
  ].join("\n");
}
