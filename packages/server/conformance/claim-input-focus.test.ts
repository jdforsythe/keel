// @vitest-environment happy-dom
// Spec: k.claim, clause "A focused `Input` keeps focus, typed value and caret across resume."
// Seed: 1337 (no generated inputs). Real compiled TSX, real createApp, real resume.
import { manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { afterEach, expect, it } from "vitest";
import { compilePage } from "./claim-support.ts";
import { install, q, resumeBody, settle } from "./resume-app.ts";
import { serveRoutes } from "./resume-graph-app.ts";

afterEach(() => {
  document.body.innerHTML = "";
});

const SOURCE = `import { signal } from "@keel/reactive";
import { Input } from "@keel/ui";
export default function Page() {
  const typed = signal("");
  return <div id="fi.root">
    <Input id="fi.input" label="Name" onInput={(v) => typed.set(v)} />
    <span id="fi.out">{typed.get()}</span>
  </div>
}
`;

it("A focused `Input` keeps focus, typed value and caret across resume.", async () => {
  const page = compilePage("fi.page", SOURCE);
  const fiContract = contract("fi", {
    "fi.page": { path: "/fi" },
  });

  const routes = manifest(fiContract, {
    "fi.page": { component: page },
  });
  install(await serveRoutes(routes, ["fi"], "/fi"));
  const input = q("fi.input");
  if (!(input instanceof HTMLInputElement)) throw new Error("fixture: fi.input is not an input");
  input.focus();
  input.value = "hello";
  input.setSelectionRange(2, 2);
  expect(document.activeElement).toBe(input);

  const { warnings } = resumeBody({ "fi.page": page });
  await settle();

  expect(warnings).toEqual([]);
  expect(q("fi.input")).toBe(input);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("hello");
  expect(input.selectionStart).toBe(2);
  expect(input.selectionEnd).toBe(2);
});
