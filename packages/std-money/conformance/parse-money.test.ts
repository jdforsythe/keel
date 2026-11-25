// std.money, clause "`parseMoney(text: string, currency: Currency, locale: Locale): Result<Money, ParseMoneyError>` reads typed text as `Money` in `currency`. Over 64 characters is `money.unreadable`. Otherwise the text is NFKC-normalized (fullwidth digits, separators and `￥` become their ASCII or `¥` forms), each `White_Space` character is read as a space, and the ends are trimmed. What is left must be, in order, an optional sign, an optional mark and spaces, an optional sign, the number, then optional spaces and a mark, with at most one sign and one mark:"
// std.money, clause "**Sign.** `-` or U+2212, before the mark or directly before the number (`-€12.50`, `€ -12,50`, `-12,50 €`). No `+`, no parentheses."
// std.money, clause "**Mark.** `currency`'s code, or the `currency` part of `Intl.NumberFormat(locale, { style: 'currency', currency })` with `currencyDisplay` `symbol` or `narrowSymbol` (`€`, `US$`, `$`, `$US`, `JP¥`, `¥`), NFKC-normalized, matched in any case. Before or after the number, with any spacing or none."
// std.money, clause "**Number.** ASCII digits after normalization: an integer part, then optionally the locale's decimal separator and one or more fraction digits. The integer part is plain digits, or 1 to 3 digits then groups of a group separator and 3 digits. The separators are the `decimal` and `group` parts of `Intl.NumberFormat(locale)`, normalized as the text (`fr-FR`'s U+202F group is a space). No other separator, no leading separator, no exponent."
// std.money, clause "`parseMoney` errors, the first that applies: `money.unreadable` (`{}`) for text not of that form, a mark of no supported currency, or digits of another script; `money.currencyMismatch` (`{ left: currency, right }`) for a mark (code or symbol, as above) of another `Currency` in `locale`; `money.tooManyDecimals` (`{ currency, decimals }`, `decimals` the exponent) for more fraction digits than the exponent, trailing zeros included (`12.500` for USD, `1800,0` for JPY): never rounded; `money.overflow` (`{ amount }`, the read amount as a number) outside the `Money` bounds. Fewer fraction digits are padded (`12,5` EUR in `de-DE` is 1250). A zero amount is `0`, never `-0`. `message` is English and holds no part of `text`. `ParseMoneyError` is that union; `money.currencyMismatch` and `money.overflow` keep `addMoney`'s data."
// std.money, clause "A form reads money as text: the form schema's field is a `s.string()` (with `Currency` beside it when the person picks one), and the action calls `parseMoney(input.amount, input.currency, params.locale)`, answering `err` as `keel.fields` for that field with text from the app's message set chosen by the error's `code` (k.forms Submit)."
// Spec: std.money, clause "`parseMoney` gives `ok` amount 1250 EUR for `12,50`, `12,5`, `12,50 €`, `12,50€`, `€12,50`, `eur 12,50`, ` 12,50 ` (U+00A0 ends) and `１２，５０` in `de-DE`, and for `1.250` 125000; `-12,50 €` and `€ -12,50` give -1250; `1 234,50 €` with U+202F, U+00A0 or a space gives 123450 in `fr-FR`; `100` and `￥100` give 100 JPY in `ja-JP`; `-0` gives `amount` `0` with `Object.is(amount, 0)`."
// Spec: std.money, clause "`money.unreadable` for `''`, `12,50` and `1,2,3` in `en-US`, `12.50` and `1.2` in `de-DE`, `+5`, `(5)`, `5-`, `.5`, `5.`, `1e3`, `--5`, `€5 €`, `CHF 5`, `٥` and 65 digits; `money.currencyMismatch` with `{ left: 'EUR', right: 'USD' }` for `$5` in `en-US`; `money.tooManyDecimals` with `{ currency: 'USD', decimals: 2 }` for `12.505` and `12.500` in `en-US`, and `{ currency: 'JPY', decimals: 0 }` for `1,5` in `de-DE`; `money.overflow` for `10000000000000.01` USD in `en-US`. No `err` `message` contains its `text`."
// Seed 1337
import { s } from "@keel/schema";
import { Currency, parseMoney } from "@keel/std-money";
import fc from "fast-check";
import { expect, test } from "vitest";

const NB = " ";
const NNB = " ";
const ok = (amount: number, currency: "EUR" | "GBP" | "JPY" | "USD") => ({ ok: true, value: { amount, currency } });
const bad = (r: ReturnType<typeof parseMoney>) => (r.ok ? undefined : r.error);

test("`parseMoney(text: string, currency: Currency, locale: Locale): Result<Money, ParseMoneyError>` reads typed text as `Money` in `currency`. Over 64 characters is `money.unreadable`. Otherwise the text is NFKC-normalized (fullwidth digits, separators and `￥` become their ASCII or `¥` forms), each `White_Space` character is read as a space, and the ends are trimmed. What is left must be, in order, an optional sign, an optional mark and spaces, an optional sign, the number, then optional spaces and a mark, with at most one sign and one mark:", () => {
  // order: optional sign, optional mark and spaces, optional sign, number, optional spaces and mark
  expect(parseMoney("12.50", "USD", "en-US")).toEqual(ok(1250, "USD"));
  expect(parseMoney("-$12.50", "USD", "en-US")).toEqual(ok(-1250, "USD"));
  expect(parseMoney("$-12.50", "USD", "en-US")).toEqual(ok(-1250, "USD"));
  expect(parseMoney("$ 12.50", "USD", "en-US")).toEqual(ok(1250, "USD"));
  expect(parseMoney("12.50 $", "USD", "en-US")).toEqual(ok(1250, "USD"));
  // at most one sign and one mark
  for (const t of ["--5", "-$-5", "$5$", "$ 5 USD", "USD 5 $", "$$5", "-5-", "5 - $"]) {
    expect(bad(parseMoney(t, "USD", "en-US"))?.code).toBe("money.unreadable");
  }
  // NFKC: fullwidth digits, separators and `￥` become ASCII or `¥`
  expect(parseMoney("１２．５０", "USD", "en-US")).toEqual(ok(1250, "USD"));
  expect(parseMoney("￥１００", "JPY", "ja-JP")).toEqual(ok(100, "JPY"));
  // each White_Space character is a space; the ends are trimmed
  for (const sp of [" ", "\t", "\n", NB, NNB, " ", "　"]) {
    expect(parseMoney(`${sp}$${sp}12.50${sp}`, "USD", "en-US")).toEqual(ok(1250, "USD"));
    expect(parseMoney(`12.50${sp}USD${sp}`, "USD", "en-US")).toEqual(ok(1250, "USD"));
  }
  // over 64 characters is `money.unreadable`; 64 is read
  const long = (n: number) => `1${"0".repeat(n - 1)}`;
  expect(bad(parseMoney(long(65), "USD", "en-US"))?.code).toBe("money.unreadable");
  expect(bad(parseMoney(long(64), "USD", "en-US"))?.code).toBe("money.overflow");
  expect(bad(parseMoney(`${" ".repeat(60)}12.50${" ".repeat(60)}`, "USD", "en-US"))?.code).toBe("money.unreadable");
});

test("**Sign.** `-` or U+2212, before the mark or directly before the number (`-€12.50`, `€ -12,50`, `-12,50 €`). No `+`, no parentheses.", () => {
  for (const minus of ["-", "−"]) {
    expect(parseMoney(`${minus}€12.50`, "EUR", "en-US")).toEqual(ok(-1250, "EUR"));
    expect(parseMoney(`€ ${minus}12,50`, "EUR", "de-DE")).toEqual(ok(-1250, "EUR"));
    expect(parseMoney(`${minus}12,50 €`, "EUR", "de-DE")).toEqual(ok(-1250, "EUR"));
  }
  // no `+`, no parentheses
  for (const t of ["+5", "+€5", "€+5", "(5)", "(€5)", "€(5)", "-(5)"]) {
    expect(bad(parseMoney(t, "EUR", "en-US"))?.code).toBe("money.unreadable");
  }
  // a sign never follows the number
  expect(bad(parseMoney("5-", "EUR", "en-US"))?.code).toBe("money.unreadable");
  expect(bad(parseMoney("5 €-", "EUR", "en-US"))?.code).toBe("money.unreadable");
});

test("**Mark.** `currency`'s code, or the `currency` part of `Intl.NumberFormat(locale, { style: 'currency', currency })` with `currencyDisplay` `symbol` or `narrowSymbol` (`€`, `US$`, `$`, `$US`, `JP¥`, `¥`), NFKC-normalized, matched in any case. Before or after the number, with any spacing or none.", () => {
  // the code, in any case, before or after, with any spacing or none
  for (const t of ["EUR 5", "eur 5", "Eur5", "5 EUR", "5eur", "5   eUr", "EUR5"]) {
    expect(parseMoney(t, "EUR", "en-US")).toEqual(ok(500, "EUR"));
  }
  // the `currency` part of `Intl.NumberFormat(locale, { style: 'currency', currency })`, symbol or narrowSymbol
  const cases = [
    ["EUR", "en-US"],
    ["EUR", "de-DE"],
    ["USD", "en-US"],
    ["USD", "de-DE"],
    ["USD", "en-GB"],
    ["USD", "fr-FR"],
    ["JPY", "en-US"],
    ["JPY", "ja-JP"],
    ["JPY", "de-DE"],
    ["GBP", "en-GB"],
    ["GBP", "en-US"],
  ] as const;
  for (const [currency, locale] of cases) {
    const marks = new Set<string>();
    for (const currencyDisplay of ["symbol", "narrowSymbol"] as const) {
      const part = new Intl.NumberFormat(locale, { style: "currency", currency, currencyDisplay })
        .formatToParts(1)
        .find((p) => p.type === "currency");
      if (part !== undefined) marks.add(part.value);
    }
    for (const mark of marks) {
      const e = currency === "JPY" ? 0 : 2;
      const want = ok(e === 0 ? 5 : 500, currency);
      expect(parseMoney(`${mark}5`, currency, locale)).toEqual(want);
      expect(parseMoney(`${mark} 5`, currency, locale)).toEqual(want);
      expect(parseMoney(`5${mark}`, currency, locale)).toEqual(want);
      expect(parseMoney(`5 ${mark}`, currency, locale)).toEqual(want);
      expect(parseMoney(`5${NB}${mark}`, currency, locale)).toEqual(want);
      expect(parseMoney(`${mark.toLowerCase()}5`, currency, locale)).toEqual(want);
    }
  }
  expect(parseMoney("US$5", "USD", "en-GB")).toEqual(ok(500, "USD"));
  expect(parseMoney("JP¥5", "JPY", "en-GB")).toEqual(ok(5, "JPY"));
  // a mark of no supported currency
  for (const t of ["CHF 5", "5 CHF", "kr5", "₹5", "R$5"]) {
    expect(bad(parseMoney(t, "USD", "en-US"))?.code).toBe("money.unreadable");
  }
  // one mark only
  expect(bad(parseMoney("€5 €", "EUR", "en-US"))?.code).toBe("money.unreadable");
});

test("**Number.** ASCII digits after normalization: an integer part, then optionally the locale's decimal separator and one or more fraction digits. The integer part is plain digits, or 1 to 3 digits then groups of a group separator and 3 digits. The separators are the `decimal` and `group` parts of `Intl.NumberFormat(locale)`, normalized as the text (`fr-FR`'s U+202F group is a space). No other separator, no leading separator, no exponent.", () => {
  expect(parseMoney("1234.50", "USD", "en-US")).toEqual(ok(123450, "USD"));
  expect(parseMoney("1,234.50", "USD", "en-US")).toEqual(ok(123450, "USD"));
  expect(parseMoney("1,234,567.89", "USD", "en-US")).toEqual(ok(123456789, "USD"));
  expect(parseMoney("123,456", "USD", "en-US")).toEqual(ok(12345600, "USD"));
  expect(parseMoney("1.234,50", "EUR", "de-DE")).toEqual(ok(123450, "EUR"));
  expect(parseMoney("1234,5", "EUR", "de-DE")).toEqual(ok(123450, "EUR"));
  expect(parseMoney("1.250", "EUR", "de-DE")).toEqual(ok(125000, "EUR"));
  // `fr-FR`'s group separator is U+202F, normalized as the text: a space
  for (const sp of [NNB, NB, " "]) {
    expect(parseMoney(`1${sp}234,50${sp}€`, "EUR", "fr-FR")).toEqual(ok(123450, "EUR"));
  }
  // the separators are the locale's: the other locale's decimal point is no separator here
  for (const [t, l] of [
    ["12.50", "de-DE"],
    ["1.2", "de-DE"],
    ["12,50", "en-US"],
    ["1,2,3", "en-US"],
    ["1,23", "en-US"],
    ["1234,567", "en-US"],
    ["1,2345", "en-US"],
    ["12,345,67", "en-US"],
    ["1.23.456", "de-DE"],
  ] as const) {
    expect(bad(parseMoney(t, "EUR", l))?.code).toBe("money.unreadable");
  }
  // no leading separator, no trailing separator, no exponent, no other script
  for (const t of [".5", ",5", "5.", "5,", "1e3", "1E3", "1e+3", "٥", "५", "１٢"]) {
    expect(bad(parseMoney(t, "USD", "en-US"))?.code).toBe("money.unreadable");
  }
  // a plain-digit integer part with no group separator, any length within bounds
  fc.assert(
    fc.property(fc.integer({ min: 0, max: 9_999_999_999_999 }), fc.integer({ min: 0, max: 99 }), (i, f) => {
      const text = `${i}.${String(f).padStart(2, "0")}`;
      expect(parseMoney(text, "USD", "en-US")).toEqual(ok(i * 100 + f, "USD"));
      const grouped = String(i).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      expect(parseMoney(`${grouped}.${String(f).padStart(2, "0")}`, "USD", "en-US")).toEqual(ok(i * 100 + f, "USD"));
    }),
    { seed: 1337, numRuns: 200 },
  );
});

test("`parseMoney` errors, the first that applies: `money.unreadable` (`{}`) for text not of that form, a mark of no supported currency, or digits of another script; `money.currencyMismatch` (`{ left: currency, right }`) for a mark (code or symbol, as above) of another `Currency` in `locale`; `money.tooManyDecimals` (`{ currency, decimals }`, `decimals` the exponent) for more fraction digits than the exponent, trailing zeros included (`12.500` for USD, `1800,0` for JPY): never rounded; `money.overflow` (`{ amount }`, the read amount as a number) outside the `Money` bounds. Fewer fraction digits are padded (`12,5` EUR in `de-DE` is 1250). A zero amount is `0`, never `-0`. `message` is English and holds no part of `text`. `ParseMoneyError` is that union; `money.currencyMismatch` and `money.overflow` keep `addMoney`'s data.", () => {
  // unreadable `{}`
  const u = bad(parseMoney("nope", "EUR", "de-DE"));
  expect(u?.code).toBe("money.unreadable");
  expect(u?.data).toEqual({});
  expect(bad(parseMoney("12,5€x", "EUR", "de-DE"))?.code).toBe("money.unreadable");
  // currencyMismatch `{ left: currency, right }`, a mark by code or symbol
  for (const [text, currency, right] of [
    ["$5", "EUR", "USD"],
    ["USD 5", "EUR", "USD"],
    ["gbp 5", "USD", "GBP"],
    ["£5", "USD", "GBP"],
    ["5 €", "GBP", "EUR"],
    ["JPY 5", "USD", "JPY"],
  ] as const) {
    const e = bad(parseMoney(text, currency, "en-US"));
    expect(e?.code).toBe("money.currencyMismatch");
    expect(e?.data).toEqual({ left: currency, right });
  }
  // tooManyDecimals `{ currency, decimals }`, trailing zeros included, never rounded
  for (const [text, currency, locale, decimals] of [
    ["12.505", "USD", "en-US", 2],
    ["12.500", "USD", "en-US", 2],
    ["1800,0", "JPY", "de-DE", 0],
    ["1,5", "JPY", "de-DE", 0],
    ["0,001", "EUR", "de-DE", 2],
  ] as const) {
    const e = bad(parseMoney(text, currency, locale));
    expect(e?.code).toBe("money.tooManyDecimals");
    expect(e?.data).toEqual({ currency, decimals });
  }
  // overflow `{ amount }`, the read amount as a number, outside the Money bounds
  const o = bad(parseMoney("10000000000000.01", "USD", "en-US"));
  expect(o?.code).toBe("money.overflow");
  expect(o?.data).toEqual({ amount: 1000000000000001 });
  expect(bad(parseMoney("-10000000000000.01", "USD", "en-US"))?.data).toEqual({ amount: -1000000000000001 });
  expect(parseMoney("10000000000000.00", "USD", "en-US")).toEqual(ok(1e15, "USD"));
  expect(parseMoney("-10000000000000.00", "USD", "en-US")).toEqual(ok(-1e15, "USD"));
  expect(bad(parseMoney("1000000000000001", "JPY", "en-US"))?.code).toBe("money.overflow");
  // the first that applies
  expect(bad(parseMoney("$5.005 $", "EUR", "en-US"))?.code).toBe("money.unreadable");
  expect(bad(parseMoney("$5.005", "EUR", "en-US"))?.code).toBe("money.currencyMismatch");
  expect(bad(parseMoney("99999999999999999.123", "USD", "en-US"))?.code).toBe("money.tooManyDecimals");
  // fewer fraction digits are padded
  expect(parseMoney("12,5", "EUR", "de-DE")).toEqual(ok(1250, "EUR"));
  expect(parseMoney("12", "USD", "en-US")).toEqual(ok(1200, "USD"));
  // a zero amount is `0`, never `-0`
  for (const t of ["-0", "-0.00", "−0", "-$0", "0"]) {
    const r = parseMoney(t, "USD", "en-US");
    expect(r.ok).toBe(true);
    if (r.ok) expect(Object.is(r.value.amount, 0)).toBe(true);
  }
  // `message` is English and holds no part of `text`
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{6,20}$/), (text) => {
      const e = bad(parseMoney(text, "USD", "en-US"));
      expect(e?.code).toBe("money.unreadable");
      expect(typeof e?.message).toBe("string");
      expect(e?.message.length).toBeGreaterThan(0);
      expect(e?.message).not.toContain(text);
    }),
    { seed: 1337, numRuns: 100 },
  );
  expect(bad(parseMoney("12.505", "USD", "en-US"))?.message).not.toContain("12.505");
});

test("A form reads money as text: the form schema's field is a `s.string()` (with `Currency` beside it when the person picks one), and the action calls `parseMoney(input.amount, input.currency, params.locale)`, answering `err` as `keel.fields` for that field with text from the app's message set chosen by the error's `code` (k.forms Submit).", () => {
  // The form's action calls `parseMoney(input.amount, input.currency, params.locale)`: the form schema field is a `s.string()` beside `Currency`.
  // The routing of `err` to `keel.fields` is k.forms, untestable here; this checks the shape the action relies on.
  const Form = s.object({ amount: s.string(), currency: Currency }, { closed: true });
  const input = Form.parse({ amount: "12,50 €", currency: "EUR" });
  expect(input.ok).toBe(true);
  if (!input.ok) return;
  expect(parseMoney(input.value.amount, input.value.currency, "de-DE")).toEqual(ok(1250, "EUR"));
  const codes = new Set<string>();
  for (const amount of ["x", "$5", "12,505", "99999999999999999"]) {
    const e = bad(parseMoney(amount, input.value.currency, "de-DE"));
    expect(typeof e?.code).toBe("string");
    if (e !== undefined) codes.add(e.code);
  }
  expect([...codes].sort()).toEqual([
    "money.currencyMismatch",
    "money.overflow",
    "money.tooManyDecimals",
    "money.unreadable",
  ]);
});

test("`parseMoney` gives `ok` amount 1250 EUR for `12,50`, `12,5`, `12,50 €`, `12,50€`, `€12,50`, `eur 12,50`, ` 12,50 ` (U+00A0 ends) and `１２，５０` in `de-DE`, and for `1.250` 125000; `-12,50 €` and `€ -12,50` give -1250; `1 234,50 €` with U+202F, U+00A0 or a space gives 123450 in `fr-FR`; `100` and `￥100` give 100 JPY in `ja-JP`; `-0` gives `amount` `0` with `Object.is(amount, 0)`.", () => {
  for (const t of ["12,50", "12,5", "12,50 €", "12,50€", "€12,50", "eur 12,50", `${NB}12,50${NB}`, "１２，５０"]) {
    expect(parseMoney(t, "EUR", "de-DE")).toEqual(ok(1250, "EUR"));
  }
  expect(parseMoney("1.250", "EUR", "de-DE")).toEqual(ok(125000, "EUR"));
  expect(parseMoney("-12,50 €", "EUR", "de-DE")).toEqual(ok(-1250, "EUR"));
  expect(parseMoney("€ -12,50", "EUR", "de-DE")).toEqual(ok(-1250, "EUR"));
  for (const sp of [NNB, NB, " "]) {
    expect(parseMoney(`1${sp}234,50 €`, "EUR", "fr-FR")).toEqual(ok(123450, "EUR"));
  }
  expect(parseMoney("100", "JPY", "ja-JP")).toEqual(ok(100, "JPY"));
  expect(parseMoney("￥100", "JPY", "ja-JP")).toEqual(ok(100, "JPY"));
  const zero = parseMoney("-0", "EUR", "de-DE");
  expect(zero.ok).toBe(true);
  if (zero.ok) {
    expect(zero.value.amount).toBe(0);
    expect(Object.is(zero.value.amount, 0)).toBe(true);
  }
});

test("`money.unreadable` for `''`, `12,50` and `1,2,3` in `en-US`, `12.50` and `1.2` in `de-DE`, `+5`, `(5)`, `5-`, `.5`, `5.`, `1e3`, `--5`, `€5 €`, `CHF 5`, `٥` and 65 digits; `money.currencyMismatch` with `{ left: 'EUR', right: 'USD' }` for `$5` in `en-US`; `money.tooManyDecimals` with `{ currency: 'USD', decimals: 2 }` for `12.505` and `12.500` in `en-US`, and `{ currency: 'JPY', decimals: 0 }` for `1,5` in `de-DE`; `money.overflow` for `10000000000000.01` USD in `en-US`. No `err` `message` contains its `text`.", () => {
  const texts: [string, "EUR" | "GBP" | "JPY" | "USD", "en-US" | "de-DE"][] = [
    ["", "USD", "en-US"],
    ["12,50", "USD", "en-US"],
    ["1,2,3", "USD", "en-US"],
    ["12.50", "EUR", "de-DE"],
    ["1.2", "EUR", "de-DE"],
    ["+5", "USD", "en-US"],
    ["(5)", "USD", "en-US"],
    ["5-", "USD", "en-US"],
    [".5", "USD", "en-US"],
    ["5.", "USD", "en-US"],
    ["1e3", "USD", "en-US"],
    ["--5", "USD", "en-US"],
    ["€5 €", "EUR", "en-US"],
    ["CHF 5", "USD", "en-US"],
    ["٥", "USD", "en-US"],
    ["5".repeat(65), "USD", "en-US"],
  ];
  for (const [text, currency, locale] of texts) {
    const e = bad(parseMoney(text, currency, locale));
    expect(e?.code, JSON.stringify(text)).toBe("money.unreadable");
    expect(e?.data).toEqual({});
    if (text !== "") expect(e?.message).not.toContain(text);
  }
  const mm = bad(parseMoney("$5", "EUR", "en-US"));
  expect(mm?.code).toBe("money.currencyMismatch");
  expect(mm?.data).toEqual({ left: "EUR", right: "USD" });
  expect(mm?.message).not.toContain("$5");
  for (const text of ["12.505", "12.500"]) {
    const e = bad(parseMoney(text, "USD", "en-US"));
    expect(e?.code).toBe("money.tooManyDecimals");
    expect(e?.data).toEqual({ currency: "USD", decimals: 2 });
    expect(e?.message).not.toContain(text);
  }
  const j = bad(parseMoney("1,5", "JPY", "de-DE"));
  expect(j?.code).toBe("money.tooManyDecimals");
  expect(j?.data).toEqual({ currency: "JPY", decimals: 0 });
  expect(j?.message).not.toContain("1,5");
  const ov = bad(parseMoney("10000000000000.01", "USD", "en-US"));
  expect(ov?.code).toBe("money.overflow");
  expect(ov?.message).not.toContain("10000000000000.01");
});
