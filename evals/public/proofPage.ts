// The page the `prove` project gets before its checks: JSX with `If` and a `Form`, and `import.meta.env`. A kit whose
// `@keel/runtime-dom/jsx-runtime` types do not resolve fails `keel check` on the JSX (TS2875, TS2746 as E1751); one
// whose `@keel/compiler/client` types do not resolve fails it on `import.meta.env` (TS2339 as E1751).
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/** The `app` module's files, by name: a contract, two schemas, the page, its loader and action, the manifest. */
export const proofFiles: Readonly<Record<string, string>> = {
  "app.contract.ts": `import { contract } from "@keel/router/contract";

export const app = contract("app", { "app.note": { path: "/" } });
`,
  "Note.schema.ts": `import { s } from "@keel/schema";

export const Note = s.object({ city: s.string({ min: 1 }) });
`,
  "NoteData.schema.ts": `import { s } from "@keel/schema";

export const NoteData = s.object({ title: s.string(), city: s.string(), save: s.string(), saving: s.string() });
`,
  "NotePage.tsx": `import { form } from "@keel/forms";
import { Form } from "@keel/router";
import { If } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Box, Button, Heading, Input, Text } from "@keel/ui";
import { app } from "./app.contract.ts";
import { Note } from "./Note.schema.ts";
import { NoteData } from "./NoteData.schema.ts";

export const Props = s.object({ data: NoteData });

export default function NotePage(props: Infer<typeof Props>) {
  const f = form(Note, { initial: {} });
  return (
    <Box as="section" id="app.note">
      <Heading id="app.note.title" level={1}>
        {props.data.title}
      </Heading>
      <Form method="POST" action={app.href("app.note")} form={f}>
        <Input field={f.field("city")} label={props.data.city} />
        <If when={f.pending}>
          <Text id="app.note.saving">{props.data.saving}</Text>
        </If>
        <If when={() => import.meta.env.DEV}>
          <Text id="app.note.mode">{import.meta.env.MODE}</Text>
        </If>
        <Button id="app.note.save" type="submit">
          {props.data.save}
        </Button>
      </Form>
    </Box>
  );
}
`,
  "loadNote.server.ts": `import { loader } from "@keel/router";
import { ok } from "@keel/schema";
import { app } from "./app.contract.ts";
import { NoteData } from "./NoteData.schema.ts";

export const loadNote = loader(app, "app.note", { output: NoteData }, async () =>
  ok({ title: "Note", city: "City", save: "Save", saving: "Saving" }),
);
`,
  "saveNote.server.ts": `import { action } from "@keel/router";
import { ok } from "@keel/schema";
import { app } from "./app.contract.ts";
import { Note } from "./Note.schema.ts";

export const saveNote = action(app, "app.note", { input: Note }, async () => ok(null));
`,
  "routes.ts": `import { manifest } from "@keel/router";
import { app } from "./app.contract.ts";
import { loadNote } from "./loadNote.server.ts";
import NotePage from "./NotePage.tsx";
import { saveNote } from "./saveNote.server.ts";

export const routes = manifest(app, {
  "app.note": { component: NotePage, loader: loadNote, POST: saveNote, title: (p) => p.data.title },
});
`,
};

/** Writes `proofFiles` into `<project>/modules/app`, over the scaffold's empty contract and manifest. */
export async function writeProofPage(project: string): Promise<void> {
  for (const [name, text] of Object.entries(proofFiles)) await writeFile(join(project, "modules", "app", name), text);
}
