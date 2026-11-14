/** The first `major.minor` (or bare major) number in `text`, as `[major, minor]`. */
export function versionOf(text: string): readonly [number, number] | undefined {
  const m = /(\d+)(?:\.(\d+))?/.exec(text);
  return m === null ? undefined : [Number(m[1]), Number(m[2] ?? "0")];
}
