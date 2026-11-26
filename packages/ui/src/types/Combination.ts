import type { Scheme } from "./Scheme.ts";
import type { Tokens } from "./Tokens.ts";

/**
 * One combination of an app's tokens (k.themes Combinations): its `name` (`light`, `dark+slate`, `print+slate+hc`)
 * and `tokens`, its values with no `themes` and no pair; `scheme` is the scheme it shows (`light` when printing),
 * `printing` whether it is the printed page, `contrast` whether the `contrast` theme is on, and `choice` the `choice`
 * theme on, if any.
 */
export type Combination = {
  readonly name: string;
  readonly tokens: Tokens;
  readonly scheme: Scheme;
  readonly printing: boolean;
  readonly contrast: boolean;
  readonly choice: string | undefined;
};
