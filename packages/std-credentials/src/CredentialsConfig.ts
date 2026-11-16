import { s } from "@keel/schema";

/**
 * The `std` config of `@keel/std-credentials` per app module: `ln`, log2 of scrypt's N, an integer 17 to 20 (default
 * 17). Registered under the package name, so `keel check`, `keel build` and `createApp({ std })` refuse any other value
 * or key (E1158).
 */
export const CredentialsConfig = s.object({ ln: s.int({ min: 17, max: 20 }).optional() }, { closed: true });
export type CredentialsConfig = s.infer<typeof CredentialsConfig>;

s.register("@keel/std-credentials", CredentialsConfig);
