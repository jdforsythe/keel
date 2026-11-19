/**
 * A shell build after its checks pass (k.shell Build 3-4): the shell, the Capacitor platform, `release`, the build's
 * `KEEL_ORIGIN` origin, and per `client` deployable declaring the shell its name and the Tauri crate name.
 */
export type ShellPlan = {
  readonly target: "capacitor" | "tauri";
  readonly platform: "android" | "ios" | undefined;
  readonly release: boolean;
  readonly origin: string;
  readonly deployables: readonly string[];
  readonly crate: string;
};
