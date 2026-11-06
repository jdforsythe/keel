/**
 * The history the router drives: `push`/`replace` a URL, read the `current` one, and hear URL changes it did
 * not make (back, forward) through `onPop`. `onPop` may return an unsubscribe function.
 */
export type RouterHistory = {
  push(url: string): void;
  replace(url: string): void;
  current(): string;
  onPop(fn: (url: string) => void): unknown;
};
