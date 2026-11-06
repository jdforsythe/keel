declare function unsafe(reason: string, fn: () => void): void;
export function danger(reason: string): void {
  unsafe(reason, () => {});
}
