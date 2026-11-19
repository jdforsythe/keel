import { describe, expect, it } from "vitest";
import { homePaths, quotations } from "../hygiene.mjs";

const mac = ["", "Users", "someone", "work", "keel"].join("/");
const linux = ["", "home", "someone", "keel"].join("/");

describe("homePaths", () => {
  it("finds a macOS and a Linux home path", () => {
    expect(homePaths(`cd ${mac} and ${linux}`).map(([, p]) => p)).toEqual(["/Users/someone", "/home/someone"]);
  });
  it("allows a placeholder and CI's runner home", () => {
    expect(homePaths("strip `/Users/<name>` and /home/runner/work")).toEqual([]);
  });
});

describe("quotations", () => {
  it("catches a quotation after an attribution and a colon", () => {
    expect(quotations('D1 (user, 2026-11-12: "finish up with the files") done')).toHaveLength(1);
  });
  it("catches a quotation after a speech verb and after in their words", () => {
    expect(quotations('the operator said "agree with the decisions"')).toHaveLength(1);
    expect(quotations('the user allowed it, in their words: "put a timer on it please"')).toHaveLength(1);
  });
  it("leaves short quotes, code spans and quotes with no attribution", () => {
    expect(quotations('the user: "one read"')).toEqual([]);
    expect(quotations('the operator: `"agree with the decisions here"`')).toEqual([]);
    expect(quotations('the spec says "every entry not belongs to the owner"')).toEqual([]);
    expect(quotations('the user\'s writes. "One read at a time" holds')).toEqual([]);
  });
});
