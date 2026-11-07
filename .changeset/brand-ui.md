---
"@keel/ui": patch
"@keel/compiler": patch
---

Brand (docs/BRAND.md): `@keel/ui/brand` exports `brandTokens`; `@keel/ui/fonts` self-hosts Source Serif 4 and JetBrains Mono (variable woff2, OFL). New `border` token group and `border` style prop (k.ui). Fix: base elements apply the atomic classes the compiler lowers static style props to (dropped in rfc:0043, so compiled apps rendered unstyled).
