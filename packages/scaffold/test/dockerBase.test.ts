import { describe, expect, it } from "vitest";
import { dockerfile } from "../src/templates/dockerfile.ts";

const PINNED = "node:22-slim@sha256:5ec23b7c622b00547753bc6ffd78085dd868a68aeb41c8e0a1418f033e13d96d";

describe("Dockerfile base image", () => {
  it("is node:22-slim pinned by the recorded digest, whose Node is 22.13 or newer", () => {
    for (const storage of ["file", "sqlite", "postgres"] as const) {
      const from = dockerfile("web", storage)
        .split("\n")
        .filter((l) => l.startsWith("FROM "));
      expect(from).toHaveLength(1);
      expect(from[0], "the base image is node:22-slim@sha256:<64 hex>").toMatch(
        /^FROM node:22-slim@sha256:[0-9a-f]{64}$/,
      );
      expect(
        from[0],
        `the base image digest changed: confirm the new image's Node is 22.13 or newer (storage 'sqlite' needs it) by running \`docker run --rm ${String(from[0]).slice(5)} node --version\`, then record the new digest in PINNED`,
      ).toBe(`FROM ${PINNED}`);
    }
  });
});
