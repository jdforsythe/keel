// The Capacitor page's policy: a meta tag first in `head`, without the directives a meta tag ignores.
import { expect, test } from "vitest";
import { metaPolicy } from "../src/tools/metaPolicy.ts";

test("the meta tag is first in head and drops the directives a meta tag ignores", () => {
  const policy =
    "default-src 'none'; script-src 'self'; connect-src 'self' https://api.example; frame-ancestors 'none'; report-uri /r; sandbox";
  const html = metaPolicy('<!doctype html><html><head lang="en"><title>x</title></head></html>', policy);
  expect(html).toContain(
    `<head lang="en">\n    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self'; connect-src 'self' https://api.example">`,
  );
  expect(html.indexOf("Content-Security-Policy")).toBeLessThan(html.indexOf("<title>"));
  expect(html).not.toContain("frame-ancestors");
});
