// The values a redaction remembers to scrub from later errors are bounded (newest 256).
import { describe, expect, test } from "vitest";
import { redactionOf } from "../src/internal/redactionOf.ts";

describe("redactionOf: bounded scrub memory", () => {
  const typed = (r: ReturnType<typeof redactionOf>, value: string) =>
    r.fire({ at: 0, kind: "fire", id: "pay.card", event: { type: "input", value } });
  const message = (r: ReturnType<typeof redactionOf>, text: string) =>
    r.error({ code: "pay.failed", message: text, data: null }).message;

  test("a recent matched value is scrubbed from an error message", () => {
    const r = redactionOf(["el:pay.card#value"], 1337);
    typed(r, "4111-0001");
    expect(message(r, "declined 4111-0001")).toBe("declined xxxxxxxxx");
  });

  test("after 300 distinct values only the newest 256 are remembered; touching one keeps it", () => {
    const r = redactionOf(["el:pay.card#value"], 1337);
    const v = (i: number) => `card-${String(i).padStart(4, "0")}`;
    for (let i = 0; i < 300; i++) {
      typed(r, v(i));
      if (i % 10 === 0) typed(r, v(0));
    }
    expect(message(r, v(299))).toBe("x".repeat(9));
    expect(message(r, v(45))).toBe("x".repeat(9));
    expect(message(r, v(0))).toBe("x".repeat(9));
    expect(message(r, v(44))).toBe(v(44));
    expect(message(r, v(1))).toBe(v(1));
  });
});
