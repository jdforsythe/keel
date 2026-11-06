import { anchored } from "../internal/anchored.ts";
import { list } from "../ops/list.ts";

/** `<For each={xs} key="id">` (k.component). Compiler intrinsic; at runtime the `list` op wrapper. */
export function For<T extends object>(props: {
  readonly each: readonly T[];
  readonly key: keyof T & string;
  readonly children: (item: () => T, index: () => number) => Node;
}): Node {
  const key = props.key;
  return anchored((a) =>
    list(
      a,
      () => props.each,
      (item) => Reflect.get(item, key),
      props.children,
    ),
  );
}
