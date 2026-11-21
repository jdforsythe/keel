import type { ShellApp } from "@keel/cli";
import { capacitorConfig } from "./capacitorConfig.ts";

/** The Capacitor shell files under `deploy/<name>/capacitor/` (std.capacitor Files): `capacitor.config.json`. */
export function capacitorFiles(app: ShellApp): Readonly<Record<string, string>> {
  return { "capacitor.config.json": capacitorConfig(app) };
}
