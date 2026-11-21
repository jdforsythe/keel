import { portProbe } from "./portProbe.ts";

/** True when `port` cannot be bound right now on any of the IPv4 and IPv6 loopback and unspecified addresses. */
export async function portBusy(port: number): Promise<boolean> {
  return (await portProbe(port)) !== undefined;
}
