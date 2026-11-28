---
"@keel/server": patch
"@keel/ui": patch
---

Server DOM hardening (red-team 0123, 0140, 0141). `createElement`, `createElementNS` and `setAttribute` throw `InvalidCharacterError` on a name outside the ASCII XML-name subset (element: a letter, then letters, digits, `-`, `_`, `.`, `:`; attribute: may also start with `_` or `:`), so no name can open a tag or attribute of its own. Comment data is escaped (`--` to `- -`, a leading `>`/`->` and a trailing `-` get a space). `<script>` text writes `</script` as `<\/script` and `<!--` as `<\!--`; `<style>` text containing `</style` throws; adjacent text children are joined before these rules apply. Comments inside a text-only element (`script`, `style`, `textarea`, `title`, `xmp`, `iframe`, `noembed`, `noframes`, `noscript`, `plaintext`) are dropped, and content that would end such an element throws. Under `svg` or `math` the text of `style`/`script` is escaped (`&lt;`) like any text. `@keel/ui` `Box` and `Text` check `as`, and `Heading` checks `level` (1-6), at runtime and throw on any other value.
