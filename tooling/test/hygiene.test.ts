import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { homePaths, packageIssues, personal, quotations } from "../hygiene.mjs";

const mac = ["", "Users", "someone", "work", "keel"].join("/");
const linux = ["", "home", "someone", "keel"].join("/");
const homes = [
  ["", "Users", "someone"],
  ["", "home", "someone"],
].map((p) => p.join("/"));

describe("homePaths", () => {
  it("finds a macOS and a Linux home path", () => {
    expect(homePaths(`cd ${mac} and ${linux}`).map(([, p]) => p)).toEqual(homes);
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

const sha = (t: string) => createHash("sha256").update(t).digest("hex");
const refuse = { words: [sha("zebulon")], emails: [sha(["zeb", "example.org"].join("@"))] };

describe("personal", () => {
  it("finds a listed word in any case and a listed address", () => {
    expect(personal("by Zebulon Smith", refuse)).toEqual([[3, "a personal name"]]);
    expect(personal(`mail ${["Zeb", "example.org"].join("@")} now`, refuse)).toEqual([[5, "an email address"]]);
  });
  it("leaves other words and other addresses", () => {
    expect(personal("zebulonic ops@example.org", refuse)).toEqual([]);
  });
});

describe("packageIssues", () => {
  it("wants UNLICENSED at the root and no other licence anywhere", () => {
    expect(packageIssues("package.json", { license: "UNLICENSED" }, true)).toEqual([]);
    expect(packageIssues("package.json", {}, true).map(([c]) => c)).toEqual(["H0003"]);
    expect(packageIssues("apps/a/package.json", { license: "MIT" }, false).map(([c]) => c)).toEqual(["H0003"]);
    expect(packageIssues("apps/a/package.json", {}, false)).toEqual([]);
  });
  it("wants every package private", () => {
    expect(packageIssues("packages/x/package.json", { private: true }, false)).toEqual([]);
    expect(packageIssues("packages/x/package.json", {}, false).map(([c]) => c)).toEqual(["H0004"]);
    expect(packageIssues("packages/x/package.json", { private: "true" }, false).map(([c]) => c)).toEqual(["H0004"]);
  });
});
