// The routes of the E1257 suite (not a test file): plain `.ts` components that make an element before the op that places it
// starts, each with a twin that makes the element inside the thunk. `routesOf("thunk")` and `routesOf("eager")` use the same route ids and paths,
// so their documents are comparable.
import { Form, manifest } from "@keel/router";
import { Box, Button, Text } from "@keel/ui";

const targets = manifest({ "x0.target": { path: "/x0/target", component: () => document.createElement("main") } });
const action = targets.href("x0.target");

const go = (): void => undefined;

/** A `Form` whose child element is made before the call. */
function eagerForm(): Node {
  const btn = Button({ id: "x1.btn", onClick: go, children: "go" });
  return Form({ method: "POST", action, children: () => [btn] });
}

function thunkForm(): Node {
  return Form({ method: "POST", action, children: () => [Button({ id: "x1.btn", onClick: go, children: "go" })] });
}

/** A base element given an eager child reached through a member. */
function eagerMember(): Node {
  const o = { el: Text({ id: "x2.text", children: "text" }) };
  return Box({ id: "x2.root", children: o.el });
}

function thunkMember(): Node {
  return Box({ id: "x2.root", children: () => Text({ id: "x2.text", children: "text" }) });
}

type CardProps = { readonly icon: Node };

/** A component that reads its element-valued prop before it makes its own element. */
function eagerCard(props: CardProps): Node {
  const icon = props.icon;
  return Box({ id: "x3.card", children: () => [icon] });
}

function thunkCard(props: CardProps): Node {
  return Box({ id: "x3.card", children: () => [props.icon] });
}

const icon = (): Node => Text({ id: "x3.icon", children: "icon" });

const eagerCardPage = (): Node =>
  eagerCard({
    get icon() {
      return icon();
    },
  });

const thunkCardPage = (): Node =>
  thunkCard({
    get icon() {
      return icon();
    },
  });

export function routesOf(variant: "eager" | "thunk") {
  const eager = variant === "eager";
  return manifest({
    "x1.page": { path: "/x1", component: eager ? eagerForm : thunkForm },
    "x2.page": { path: "/x2", component: eager ? eagerMember : thunkMember },
    "x3.page": { path: "/x3", component: eager ? eagerCardPage : thunkCardPage },
  });
}

export const MODULES = ["x1", "x2", "x3"];
