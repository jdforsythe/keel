// Spec: k.cli Rules (E1052: a required flag or argument missing, named as written with a command line that passes it)
// and Command form (a `keel` already in a manager's form is left as it is).
import { type Op, scaffold } from "@keel/scaffold";
import { describe, expect, it } from "vitest";
import { missingInput } from "../src/internal/missingInput.ts";
import { runEngine } from "../src/internal/runEngine.ts";

const PNPM = { npm_config_user_agent: "pnpm/10.0.0 node/v22.15.0" };

describe("E1052 for a missing input", () => {
  it("names a flag with its value and an argument in angle brackets", () => {
    expect(missingInput("move", "to").message).toBe(
      "move needs --to <module>, as in keel codemod move OrderCard --to catalog",
    );
    expect(missingInput("library", "name").message).toBe(
      "library needs <name>, as in keel scaffold library @acme/charts",
    );
    expect(missingInput("route", "id").message).toBe("route needs <id>, as in keel scaffold route app.about");
  });

  it("forms a generator's line from the project's first module and its first store", () => {
    const files = new Map([
      ["modules/shop/module.ts", ""],
      ["modules/zed/module.ts", ""],
      ["modules/shop/todos.store.ts", ""],
    ]);
    expect(missingInput("route", "id", files).message).toBe("route needs <id>, as in keel scaffold route shop.about");
    expect(missingInput("store", "id", files).message).toBe("store needs <id>, as in keel scaffold store shop.cart");
    expect(missingInput("component", "id", files).message).toBe(
      "component needs <id>, as in keel scaffold component shop/OrderCard",
    );
    expect(missingInput("transaction", "id", files).message).toBe(
      "transaction needs <id>, as in keel scaffold transaction shop.todos.addItem",
    );
    expect(missingInput("service", "id", files).message).toBe(
      "service needs <id>: keel scaffold service shop --base https://a.test",
    );
  });

  it("names what the project lacks and the line that makes it, a need no line meets in words, and a name the project does not hold", () => {
    const fresh = scaffold("project", { name: "shop", adapter: "static" }, new Map());
    const files = fresh.ok ? fresh.value.files : new Map<string, string>();
    expect(missingInput("transaction", "id", files).message).toBe(
      "transaction needs a store first: keel scaffold store app.cart",
    );
    expect(missingInput("shell", "shell", files)).toEqual({
      message: "shell needs a client deployable, and this project has none",
      see: "k.topology",
    });
    const about = scaffold("route", { id: "app.about" }, files);
    const taken = about.ok ? about.value.files : files;
    expect(missingInput("route", "id", taken).message).toBe("route needs <id>, as in keel scaffold route app.about2");
  });

  it("each operation's required inputs fit docs/OUTPUT.md's bound in the longest manager form", () => {
    const required: readonly (readonly [Op, string])[] = [
      ["project", "name"],
      ["module", "id"],
      ["route", "id"],
      ["component", "id"],
      ["store", "id"],
      ["transaction", "id"],
      ["service", "id"],
      ["shell", "shell"],
      ["library", "name"],
      ["rename", "from"],
      ["rename", "to"],
      ["move", "name"],
      ["move", "to"],
      ["place", "module"],
      ["place", "to"],
      ["add-field", "schema"],
      ["add-field", "field"],
      ["add-field", "type"],
    ];
    for (const [op, field] of required)
      expect(missingInput(op, field).message.replace("keel ", "npx --no keel ").length).toBeLessThanOrEqual(89);
  });

  it("keel codemod move with no --to prints the flag and the line in pnpm's form, once", async () => {
    const e = await runEngine(["codemod", "move", "OrderCard"], { cwd: "/p", files: [], env: PNPM });
    expect(e.result.code).toBe(2);
    expect(e.result.stdout).toContain("move needs --to <module>, as in pnpm keel codemod move OrderCard --to catalog");
    expect(e.result.stdout).not.toContain("pnpm pnpm");
    expect(e.result.stdout).not.toContain("move:1:1");
  });
});
