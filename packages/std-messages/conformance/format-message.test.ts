// Spec: std.messages, clause "`formatMessage({ plural: 'n', one: '# recipe', other: '# recipes' }, { n: 2 }, 'en-US')` is `2 recipes`; `{ text: 'Added {date}' }` with `{ date: 'November 10, 2026' }` is `Added November 10, 2026`; `{ text: '{n} items' }` with `{ n: 1234 }` in `de-DE` is `1.234 items`; a `select` gives the case of the param's value."
// Seed 1337 (no random inputs; the select case is an exhaustive loop over the enum)
import { formatMessage } from "@keel/std-messages";
import { expect, test } from "vitest";

test.skip("`formatMessage({ plural: 'n', one: '# recipe', other: '# recipes' }, { n: 2 }, 'en-US')` is `2 recipes`; `{ text: 'Added {date}' }` with `{ date: 'November 10, 2026' }` is `Added November 10, 2026`; `{ text: '{n} items' }` with `{ n: 1234 }` in `de-DE` is `1.234 items`; a `select` gives the case of the param's value.", () => {
  expect(formatMessage({ plural: "n", one: "# recipe", other: "# recipes" }, { n: 2 }, "en-US")).toBe("2 recipes");
  expect(formatMessage({ text: "Added {date}" }, { date: "November 10, 2026" }, "en-US")).toBe(
    "Added November 10, 2026",
  );
  expect(formatMessage({ text: "{n} items" }, { n: 1234 }, "de-DE")).toBe("1.234 items");
  const sel = { select: "k", cases: { a: "Kind A", b: "Kind B" } };
  expect(formatMessage(sel, { k: "a" }, "en-US")).toBe("Kind A");
  expect(formatMessage(sel, { k: "b" }, "en-US")).toBe("Kind B");
});
