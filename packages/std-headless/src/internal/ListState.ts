import type { Computed } from "@keel/reactive";
import type { KeyInput } from "@keel/ui/aria";
import type { Option } from "../Option.ts";

/** A list widget's interaction state (`listChart`): the checked list, the active option, and the chart's events. */
export type ListState<O extends Option> = {
  readonly list: Computed<readonly O[]>;
  readonly open: Computed<boolean>;
  readonly index: Computed<number>;
  readonly activeId: Computed<string>;
  /** One object per key, kept while the key is in the list (`stableRows`). */
  readonly rows: Computed<readonly { readonly key: O["key"] }[]>;
  /** The option with this key in the current list. Reactive. */
  current(key: string): O | undefined;
  partId(key: string): string;
  back(): boolean;
  activeOption(): O | undefined;
  indexOf(key: string): number;
  opened(at: number): void;
  close(back: boolean): void;
  choose(): void;
  move(by: "next" | "prev" | "first" | "last", wrap: boolean): void;
  jump(to: number): void;
  typeahead(k: KeyInput): boolean;
};
