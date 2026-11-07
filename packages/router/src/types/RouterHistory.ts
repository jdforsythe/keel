/**
 * The history the router drives (RFC 0041). `push`/`replace` a URL with the entry `key` the router minted (a history
 * keeps it with the entry), read the `current` URL, and hear entry changes the router did not make (back, forward)
 * through `onPop` with that entry's key (absent when the entry carries none). Scroll positions are kept per key.
 * `onPop` may return an unsubscribe function.
 */
export type RouterHistory = {
  push(url: string, key: string): void;
  replace(url: string, key: string): void;
  current(): string;
  onPop(fn: (url: string, key?: string) => void): unknown;
};
