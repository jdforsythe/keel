/** A key press as `Part`'s `onKey` sees it: the DOM `key`, and `mod` for Ctrl or Meta. */
export type KeyInput = {
  readonly key: string;
  readonly shift: boolean;
  readonly alt: boolean;
  readonly mod: boolean;
};
