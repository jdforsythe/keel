import type { ShellApp, ShellJob } from "@keel/cli";

/** A GitHub Actions expression. */
const expr = (e: string): string => `\${{ ${e} }}`;

/**
 * The Capacitor CI jobs (std.capacitor CI): `android` on `ubuntu-24.04` with JDK 21, uploading the debug APK; `ios` on
 * `macos-15` with Xcode 26, `manual`.
 */
export function capacitorJobs(app: ShellApp): readonly ShellJob[] {
  return [
    {
      job: "android",
      runsOn: "ubuntu-24.04",
      platform: "android",
      manual: false,
      steps: [],
      env: { JAVA_HOME: expr("env.JAVA_HOME_21_X64") },
      artifact: `dist/${app.deployable}/capacitor/android/app/build/outputs/apk/debug/app-debug.apk`,
    },
    {
      job: "ios",
      runsOn: "macos-15",
      platform: "ios",
      manual: true,
      steps: [],
      env: { DEVELOPER_DIR: "/Applications/Xcode_26.app/Contents/Developer" },
    },
  ];
}
