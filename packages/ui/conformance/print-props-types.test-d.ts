// Spec: k.aria, clause "With `brandTokens`, `<Box p={{ base: '3', print: '0' }} direction=\"column\">` puts a rule declaring `padding:var(--k-space-0)` in an `@media print` block after the `@media (min-width: 1024px)` block; a `breakpoint` token `print` is one E1807; `<Box media=\"screen\">` has class `k-media-screen` and `keel.base` holds `@media print{.k-media-screen{display:none!important}}`, and with no `media` written the CSS holds no `k-media-`; `breakInside=\"avoid\"` compiles to `break-inside:avoid`, and `breakInside=\"page\"` is a type error."
// Type-level half of the clause: `tsc --noEmit` over `conformance/` (the package's `check` script) judges it; the file is never run and is imported by no file. No suppression comment: each claim is an `expectTypeOf` that fails to compile when the prop's type is wrong, so a missing prop fails too.
import type { Box, Text } from "@keel/ui";
import { expectTypeOf } from "vitest";

type BoxProps = Parameters<typeof Box>[0];
type TextProps = Parameters<typeof Text>[0];

export function conformancePrintTypes(): void {
  expectTypeOf<"avoid">().toMatchTypeOf<NonNullable<BoxProps["breakInside"]>>();
  expectTypeOf<"page">().not.toMatchTypeOf<NonNullable<BoxProps["breakInside"]>>();
  expectTypeOf<"page">().toMatchTypeOf<NonNullable<BoxProps["breakBefore"]>>();
  expectTypeOf<"avoid">().toMatchTypeOf<NonNullable<BoxProps["breakAfter"]>>();
  expectTypeOf<"left">().not.toMatchTypeOf<NonNullable<BoxProps["breakBefore"]>>();
  expectTypeOf<"screen">().toMatchTypeOf<NonNullable<BoxProps["media"]>>();
  expectTypeOf<"print">().toMatchTypeOf<NonNullable<TextProps["media"]>>();
  expectTypeOf<"all">().not.toMatchTypeOf<NonNullable<BoxProps["media"]>>();
  expectTypeOf<{ base: "3"; print: "0" }>().toMatchTypeOf<NonNullable<BoxProps["p"]>>();
}
