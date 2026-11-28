import { type Secret, reveal } from "@keel/schema";

/** The text of a minted token the tests read back: the tests' one `reveal`, in a `*.server.ts` file as k.privacy requires. */
export function revealed(secret: Secret<string>): string {
  return reveal(secret);
}
