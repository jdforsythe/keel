import { err, s } from "@keel/schema";
import type { Schema } from "@keel/schema";
import { focusProblem } from "./internal/focusProblem.ts";
import type { Tokens } from "./types/Tokens.ts";

const scale = s.record(s.string()).optional();
const pair = s.object({ light: s.string(), dark: s.string() }, { closed: true });
const value = s.union([s.string(), s.record(s.string())]).optional();
const values = {
  p: value,
  px: value,
  py: value,
  m: value,
  mx: value,
  my: value,
  gap: value,
  w: value,
  h: value,
  bg: value,
  fg: value,
  radius: value,
  font: value,
  fontSize: value,
  weight: value,
  shadow: value,
  border: value,
  direction: value,
  align: value,
  justify: value,
  wrap: value,
};
const stateSet = s.object(values, { closed: true }).optional();
const styleSet = s.object(
  {
    ...values,
    states: s
      .object(
        {
          selected: stateSet,
          checked: stateSet,
          expanded: stateSet,
          highlighted: stateSet,
          hover: stateSet,
          focusVisible: stateSet,
          active: stateSet,
          disabled: stateSet,
        },
        { closed: true },
      )
      .optional(),
  },
  { closed: true },
);
const set = styleSet.optional();

/** The three scheme lists `schemes` may be (k.schemes). */
const SCHEMES = ["light", "dark", "light,dark"];

const shape = s.object(
  {
    color: s.record(s.union([s.string(), pair])).optional(),
    space: scale,
    size: scale,
    radius: scale,
    font: scale,
    fontSize: scale,
    weight: scale,
    shadow: scale,
    border: scale,
    breakpoint: scale,
    motion: scale,
    base: s
      .object(
        {
          page: set,
          heading: set,
          link: set,
          button: set,
          control: set,
          label: set,
          fieldError: set,
          summary: set,
          focus: s.string().optional(),
        },
        { closed: true },
      )
      .optional(),
    look: s.record(styleSet).optional(),
    schemes: s.array(s.string()).optional(),
  },
  { closed: true },
);

/**
 * Validates `tokens.ts` (E1807): only the closed groups (an unknown group fails with rule `unknown-key`),
 * string token values, colors a string or a closed `{ light, dark }` pair, `base` the closed role sets and
 * `focus`, `look` named style sets, `schemes` one of `["light"]`, `["dark"]`, `["light", "dark"]` (rule `format`), and a `base.focus` color at 3:1 or more against `base.page`'s `bg` in each scheme
 * (rule `format` at `base.focus`).
 */
export const TokenSchema: Schema<Tokens> = {
  ...shape,
  parse: (input) => {
    const r = shape.parse(input);
    if (!r.ok) return r;
    const schemes = r.value.schemes?.join();
    if (schemes !== undefined && !SCHEMES.includes(schemes)) {
      const issues = [{ path: ["schemes"], rule: "format" as const }];
      return err({ code: "schema.invalid", message: "format at schemes", data: { issues } });
    }
    if (focusProblem(r.value) === null) return r;
    const issues = [{ path: ["base", "focus"], rule: "format" as const }];
    return err({ code: "schema.invalid", message: "format at base.focus", data: { issues } });
  },
};
