import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { Digest } from "./Digest.schema.ts";
import { readLatest } from "./readLatest.ts";

/** `GET /digest`: the newest digest. */
export const loadDigest = loader({ output: Digest }, async (_args, ctx) => ok(await readLatest(ctx)));
