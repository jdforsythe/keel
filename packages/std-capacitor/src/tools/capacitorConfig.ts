import { jsonText } from "./jsonText.ts";

/** `deploy/<name>/capacitor/capacitor.config.json` (k.shell Files): the app id, the name people see, and `webDir` `www`. */
export function capacitorConfig(shell: { readonly id: string; readonly name: string }): string {
  return `${jsonText({ appId: shell.id, appName: shell.name, webDir: "www" })}\n`;
}
