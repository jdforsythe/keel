/**
 * The edge cases of the k.values grammar, generated from its forms, for the Chromium test (`tooling/smoke/cssKept.mjs`):
 * each unit; each keyword; each math function at two, three and four arguments; nesting at four and at five; 32 and
 * 33 names; a family list at one and eight; inside and outside a string, each of `"`, `'`, `\`, each control
 * character (a form feed among them) and a lone surrogate. `accepted` cases are in their group's form, `refused` are
 * not. Never imported by a client: only tests and the smoke read it.
 */
export function valueEdges(): {
  readonly accepted: readonly (readonly [string, string])[];
  readonly refused: readonly (readonly [string, string])[];
} {
  const viewport = ["vw", "vh", "vi", "vb", "vmin", "vmax"].flatMap((u) => [u, `s${u}`, `l${u}`, `d${u}`]);
  const units = [
    ...["px", "cm", "mm", "q", "in", "pt", "pc"],
    ...["em", "rem", "ex", "rex", "cap", "rcap", "ch", "rch", "ic", "ric", "lh", "rlh"],
    ...viewport,
    ...["cqw", "cqh", "cqi", "cqb", "cqmin", "cqmax"],
  ];
  const nest = (n: number): string => {
    let v = "8px";
    for (let i = 0; i < n; i++) v = `calc(${v})`;
    return v;
  };
  const sum = (n: number): string => `calc(${Array.from({ length: n }, () => "1px").join(" + ")})`;
  const families = (n: number): string => Array.from({ length: n }, (_, i) => `f${i}`).join(", ");
  const words = (n: number): string =>
    Array.from({ length: n / 4 }, (_, i) => `a${i} b c d`).join(", ") + (n % 4 === 0 ? "" : " e");
  const controls = [
    ...Array.from({ length: 0x20 }, (_, i) => i),
    ...Array.from({ length: 0x21 }, (_, i) => 0x7f + i),
  ].map((c) => String.fromCharCode(c));
  const accepted: [string, string][] = [
    ...units.map((u): [string, string] => ["space", `2${u}`]),
    ...units.map((u): [string, string] => ["size", `3${u}`]),
    ["space", "12%"],
    ["size", "min-content"],
    ["size", "max-content"],
    ["size", "fit-content"],
    ["space", "env(safe-area-inset-top, 4px)"],
    ["space", "min(8px, 12px)"],
    ["space", "min(8px, 12px, 16px)"],
    ["space", "max(8px, 12px, 16px, 20px)"],
    ["space", "clamp(4px, 2vw + 4px, 24px)"],
    ["space", nest(4)],
    ["space", sum(31)],
    ["radius", "calc(2px * 3)"],
    ["fontSize", "clamp(1rem, 0.9rem + 0.5vw, 1.25rem)"],
    ["fontSize", "120%"],
    ["font", families(1)],
    ["font", families(8)],
    ["font", words(32)],
    ["font", '"Inter, var", sans-serif'],
    ["font", "'a\"b', serif"],
    ["font", '"a\'b", serif'],
    ["font", '"a😀b", serif'],
    ["weight", "650"],
    ["weight", "bold"],
    ["shadow", "inset 0 -1px 2px #000000"],
    ["shadow", "1px 2px 3px 4px currentColor, 0 0 2px #123456"],
    ["border", "1px solid currentColor"],
    ["border", "thick dashed #abcdef"],
    ["border", "medium double #abc"],
    ["color", "#1a2b3c"],
    ["breakpoint", "48em"],
    ["motion", "0.2s"],
  ];
  const refused: [string, string][] = [
    ["space", nest(5)],
    ["space", sum(33)],
    ["space", "min(8px)"],
    ["space", "max(1px, 2px, 3px, 4px, 5px)"],
    ["space", "clamp(1px, 2px)"],
    ["space", "-2rem"],
    ["space", "calc(1px+2px)"],
    ["space", "1fr"],
    ["size", "none"],
    ["size", "url(x.png)"],
    ["font", families(9)],
    ["font", words(33)],
    ["font", "3M Sans"],
    ["font", "inherit"],
    ["border", "10% solid #000000"],
    ["color", "red"],
    ["breakpoint", "0px"],
    ["motion", "120"],
    ["font", '"a"b"'],
    ["font", "'a'b'"],
    ["font", '"a\\b"'],
    ["space", '1px"'],
    ["space", "1px'"],
    ["space", "1px\\"],
    ...controls.flatMap((c): [string, string][] => [
      ["font", `"a${c}b"`],
      ["font", `Inter${c}`],
      ["space", `1px${c}`],
    ]),
    ...["\ud800", "\udfff"].flatMap((s): [string, string][] => [
      ["font", `"a${s}"`],
      ["font", `Inter${s}`],
    ]),
  ];
  return { accepted, refused };
}
