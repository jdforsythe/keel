import type { Ctx } from "@keel/ctx";
import { Form } from "@keel/router";
import type { Slots } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { tx } from "@keel/store";
import { Box, Button, Input, Text } from "@keel/ui";
import { notes } from "./notes.ts";
import { routes } from "./routes.ts";
import { setDraft } from "./setDraft.ts";
import { setPeek } from "./setPeek.ts";

export const Props = s.object({});

/**
 * Route `notes.home`: the draft, a Form whose Save posts it, and Peek, which reads the server feed's first chunk and
 * cancels the rest.
 */
export default function NotesPage(_props: Infer<typeof Props>, _slots?: Slots, ctx?: Ctx) {
  const peek = async (): Promise<void> => {
    if (ctx === undefined) return;
    const res = await ctx.net.fetch(new Request(`${location.origin}/api/feed`));
    const reader = res.body?.getReader();
    const first = await reader?.read();
    await reader?.cancel();
    await tx(setPeek, { peek: first === undefined || first.done ? "" : new TextDecoder().decode(first.value) });
  };
  const children = (): Node => {
    const submit = (
      <Button id="notes.save" type="submit">
        Save
      </Button>
    );
    return Form({ method: "POST", action: routes.href("notes.home"), children: [submit] });
  };
  return (
    <Box as="main" id="notes.page" direction="column">
      <Input id="notes.draft" label="Note" onInput={(v) => void tx(setDraft, { draft: v })} />
      {children()}
      <Button id="notes.peek" onClick={() => void peek()}>
        Peek
      </Button>
      <Text id="notes.peeked">{notes.get("peek")}</Text>
    </Box>
  );
}
