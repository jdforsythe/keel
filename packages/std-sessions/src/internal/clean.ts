// ANSI escape sequences (CSI and OSC), then the other C0/C1 control characters, newlines included.
// biome-ignore lint/suspicious/noControlCharactersInRegex: the pattern names the escape sequences it removes.
const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]|\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)?/g;
// biome-ignore lint/suspicious/noControlCharactersInRegex: the class names the control characters it removes.
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/g;

/**
 * `text` safe for one line of a run log or an issue title: ANSI escapes removed, every other control character
 * (newlines included) a space, cut to `max` characters with `...`.
 */
export function clean(text: string, max = 200): string {
  const flat = text.replace(ANSI, "").replace(CONTROL, " ");
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}
