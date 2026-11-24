import { jsonText } from "./jsonText.ts";

/**
 * A shell build's `capacitor.config.json` (std.capacitor Build): `config`, the generated file's text, with
 * `plugins.KeelHttp.allow` set to `origin` (when the build has one) then `connect`, `[]` when both are empty, the origins the native plugin sends to (k.shell Origins).
 * Text that is not a JSON object is replaced by one holding only that.
 */
export function allowConfig(config: string, origin: string | undefined, connect: readonly string[]): string {
  let value: unknown;
  try {
    value = JSON.parse(config);
  } catch {
    value = undefined;
  }
  const held: object = typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
  const plugins: unknown = Reflect.get(held, "plugins");
  const allow = [...(origin === undefined ? [] : [origin]), ...connect.filter((o) => o !== origin)];
  return `${jsonText({
    ...held,
    plugins: { ...(typeof plugins === "object" ? plugins : {}), KeelHttp: { allow } },
  })}\n`;
}
