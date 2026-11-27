/** A run's static host of one deployable's `dist/<name>/` (k.e2e serve). */
export type StaticHost = { readonly name: string; readonly origin: string; close(): Promise<void> };
