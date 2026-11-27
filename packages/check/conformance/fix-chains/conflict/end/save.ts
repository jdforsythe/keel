import { attempt } from "@keel/schema";
import type { KeelError, Result } from "@keel/schema";
const conflict: KeelError<"keel.conflict", Record<string, never>> = {
  code: "keel.conflict",
  message: "keel.conflict",
  data: {},
};
export async function save(tx: () => Promise<number>, tries: number): Promise<Result<number, typeof conflict>> {
  for (let i = 0; ; i++) {
    const r = await attempt(tx, (x) => (x instanceof Error && x.name === "ConflictError" ? conflict : undefined));
    if (r.ok || r.error.code !== "keel.conflict" || i === tries - 1) return r;
  }
}
