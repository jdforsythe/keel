// Code comments say what is: no RFC, backlog or decision ids (the git log holds them).
import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("`src/internal/buildCommand.ts` names no RFC, backlog or decision id", () => {
  const text = readFileSync(new URL("../src/internal/buildCommand.ts", import.meta.url), "utf8");
  expect(text.match(/\brfc:?\s?\d{4}\b|\bbacklog \d{4}\b|\(D\d+(?:-D\d+)?\)|, D\d+\)/gi) ?? []).toEqual([]);
});
