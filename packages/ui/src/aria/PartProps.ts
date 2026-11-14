import type { Computed } from "@keel/reactive";
import type { Children } from "../types/Children.ts";
import type { KeyInput } from "./KeyInput.ts";
import type { PartStyle } from "./PartStyle.ts";

/** A value, a signal or a computed. */
type V<T> = T | Computed<T>;

type Common = PartStyle & {
  readonly id: string;
  readonly lang?: string;
  readonly hidden?: V<boolean>;
  /** Never positive. */
  readonly tabIndex?: 0 | -1;
  /** Focuses the element when it turns from false to true; never at the first render or at resume. */
  readonly focus?: V<boolean>;
  /** Runs on `keydown`; returning true prevents the default. */
  readonly onKey?: (key: KeyInput) => boolean;
  readonly onClick?: () => void;
  readonly onFocus?: () => void;
  readonly onBlur?: () => void;
};
type Kids = { readonly children?: Children };
/** Exactly one of `label` (written as `aria-label`) and `labelledBy` (an element id). */
type Named =
  | { readonly label: V<string>; readonly labelledBy?: never }
  | { readonly labelledBy: V<string>; readonly label?: never };
type Off = { readonly disabled?: V<boolean> };
type Orient = { readonly orientation?: V<"horizontal" | "vertical"> };
type Active = { readonly activeDescendant?: V<string> };
type Dialog = { readonly labelledBy: V<string>; readonly open: V<boolean>; readonly onDismiss?: () => void };
type R<Role extends string, P = unknown> = Common & { readonly role: Role } & P;

/** `Part`'s props: a union discriminated by `role`, which fixes the tag and the ARIA props it accepts (k.aria Roles). */
export type PartProps =
  | R<"listbox", Kids & Named & Orient & Active & { readonly multiselectable?: V<boolean> }>
  | R<"menu", Kids & Named & Orient & Active>
  | R<"option", Kids & Off & { readonly selected: V<boolean> }>
  | R<"menuitem", Kids & Off>
  | R<"menuitemcheckbox", Kids & Off & { readonly checked: V<boolean> }>
  | R<
      "combobox",
      Named &
        Active & {
          readonly expanded: V<boolean>;
          readonly controls: V<string>;
          readonly value?: V<string>;
          readonly onInput?: (value: string) => void;
        }
    >
  | R<
      "button",
      Kids &
        Off & {
          readonly controls: V<string>;
          readonly hasPopup?: V<"menu" | "listbox" | "dialog">;
          readonly expanded?: V<boolean>;
        }
    >
  | R<"checkbox", Named & { readonly checked: V<boolean | "mixed"> }>
  | R<"tablist", Kids & Named & Orient>
  | R<"tab", Kids & { readonly selected: V<boolean>; readonly controls: V<string> }>
  | R<"tabpanel", Kids & { readonly labelledBy: V<string> }>
  | R<"dialog", Kids & Dialog & { readonly describedBy?: V<string> }>
  | R<"alertdialog", Kids & Dialog & { readonly describedBy: V<string> }>
  | R<"status", Kids>
  | R<"alert", Kids>
  | R<"generic", Kids>
  | R<"navigation", Kids & Named>
  | R<"group", Kids & Named>
  | R<"table", Kids & Named & { readonly rowCount?: V<number> }>
  | R<"rowgroup", Kids & { readonly head?: boolean }>
  | R<"row", Kids & { readonly rowIndex?: V<number> }>
  | R<"columnheader", Kids & { readonly sort?: V<"ascending" | "descending" | undefined> }>
  | R<"rowheader", Kids>
  | R<"cell", Kids & { readonly colSpan?: V<number> }>;
