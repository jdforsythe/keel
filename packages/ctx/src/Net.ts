/** Network capability with the platform fetch shape and a connectivity state. */
export interface Net {
  fetch(req: Request): Promise<Response>;
  /** Whether the network is reachable: real and shell read `navigator.onLine` (true without a `navigator`); sim is true until `setOnline(false)`. */
  online(): boolean;
}
