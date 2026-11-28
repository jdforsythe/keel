import { computed, signal } from "@keel/reactive";
import { type Infer, s } from "@keel/schema";
import { Part } from "@keel/ui/aria";

export const Props = s.object({
  id: s.string(),
  label: s.string({ min: 1 }),
  items: s.array(s.object({ key: s.string({ min: 1 }), text: s.string({ min: 1 }), disabled: s.boolean() })),
});

/**
 * A toolbar: one tab stop moved with ArrowRight and ArrowLeft, Home and End. A disabled item keeps its place, takes
 * focus and reads as disabled, and choosing it does nothing.
 */
export default function Toolbar(props: Infer<typeof Props> & { readonly onChoose: (key: string) => void }) {
  const active = signal(0);
  const count = (): number => props.items.length;
  return (
    <Part
      id={`${props.id}.toolbar`}
      role="toolbar"
      label={props.label}
      look="acme.toolbar"
      onKey={(k) => {
        const at = active.get();
        if (k.key === "ArrowRight") active.set((at + 1) % count());
        else if (k.key === "ArrowLeft") active.set((at + count() - 1) % count());
        else if (k.key === "Home") active.set(0);
        else if (k.key === "End") active.set(count() - 1);
        else return false;
        return true;
      }}
      // biome-ignore lint/correctness/noChildrenProp: a Keel slot is a function prop (k.component)
      children={() =>
        props.items.map((item, i) => (
          <Part
            id={`${props.id}.${item.key}`}
            role="button"
            tabIndex={computed(() => (active.get() === i ? 0 : -1))}
            focus={computed(() => active.get() === i)}
            disabled={item.disabled}
            onClick={() => props.onChoose(item.key)}
            look="acme.tool"
            // biome-ignore lint/correctness/noChildrenProp: a Keel slot is a function prop (k.component)
            children={() => item.text}
          />
        ))
      }
    />
  );
}
