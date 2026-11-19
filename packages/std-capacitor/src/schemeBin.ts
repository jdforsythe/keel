#!/usr/bin/env node
// `keel-capacitor-scheme <android|ios>`: run by `keel build --target capacitor` in the shell build's folder after
// `cap sync`. It registers the shell's `id` (`capacitor.config.json`'s `appId`) as a URI scheme in the platform
// project (`returnScheme`, k.return). It prints nothing; a missing file is one `error:` line and exit code 1.
import { readFileSync, writeFileSync } from "node:fs";
import { returnScheme } from "./returnScheme.ts";

const FILES: Readonly<Record<string, string>> = {
  android: "android/app/src/main/AndroidManifest.xml",
  ios: "ios/App/App/Info.plist",
};

try {
  const file = FILES[process.argv[2] ?? ""];
  const config: unknown = JSON.parse(readFileSync("capacitor.config.json", "utf8"));
  const id: unknown = typeof config === "object" && config !== null ? Reflect.get(config, "appId") : undefined;
  if (file === undefined || typeof id !== "string") throw new Error("no platform or appId");
  writeFileSync(file, returnScheme(readFileSync(file, "utf8"), id));
} catch {
  process.stderr.write("error: keel-capacitor-scheme found no capacitor.config.json appId or platform file\n");
  process.exitCode = 1;
}
