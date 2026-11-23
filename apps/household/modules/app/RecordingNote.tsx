import { type Ctx, observe } from "@keel/ctx";
import { owner, signal } from "@keel/reactive";
import { For } from "@keel/runtime-dom";
import { type Infer, s } from "@keel/schema";
import { Disclosure } from "@keel/std-headless";
import { record } from "@keel/std-sessions";
import { sessions } from "@keel/std-sessions/contract";
import { Box, Text } from "@keel/ui";
import { ShellText } from "../members/ShellText.schema.ts";
import { eventLine } from "./eventLine.ts";

export const Props = s.object({ text: ShellText });

/** How many of the newest recorded events the note lists. */
const SHOWN = 12;

/**
 * The frame's note on what the page records. In the browser it starts the page's session recorder (std.sessions),
 * which posts the session to this app's own `sessions.ingest` on the first error, and lists the newest events as the
 * recorder kept them: a name or a phone number typed into a marked field shows as `x` repeated, because that is what
 * the recording holds. The server render starts no recorder and lists nothing.
 */
export default function RecordingNote(props: Infer<typeof Props>, ctx: Ctx) {
  const origin = typeof location === "undefined" ? undefined : location.origin;
  const upload = origin === undefined ? null : URL.parse(sessions.entries["sessions.ingest"].path, origin);
  const recorder = origin === undefined ? undefined : record(ctx, upload === null ? {} : { upload });
  // The recorder's buffer is no signal: `seen` counts the events the ctx reported, so the list reads it again.
  const seen = signal(0);
  let reported = 0;
  if (recorder !== undefined) {
    const stop = observe(ctx, () => {
      reported += 1;
      const now = reported;
      void Promise.resolve().then(() => seen.set(now));
    });
    owner()?.onDispose(stop);
  }
  // Until the first report after the page resumes, the note shows what the server rendered: no event.
  const kept = () => (seen.get() === 0 ? [] : (recorder?.events() ?? []));
  const lines = () => {
    const all = kept();
    const from = Math.max(0, all.length - SHOWN);
    return all.slice(from).map((e, i) => ({ key: `e${from + i}`, text: eventLine(e) }));
  };
  return (
    <Box as="aside" id="app.recording" label={props.text.recording} direction="column" gap="2">
      <Box h="hairline" bg="divider" />
      <Disclosure
        id="app.recording.note"
        summary={() => <Text>{props.text.recording}</Text>}
        styles={{
          button: {
            font: "mono",
            fontSize: "sm",
            px: "0",
            py: "1",
            bg: "surface",
            fg: "text",
            border: "none",
            radius: "none",
            states: { hover: { fg: "textSecondary" } },
          },
          panel: { direction: "column", gap: "2", py: "2" },
        }}
      >
        <Text id="app.recording.body" fg="textSecondary">
          {props.text.recordingBody}
        </Text>
        <Text id="app.recording.count" role="status" font="mono" fontSize="xs" fg="textSecondary">
          {`${kept().length} ${props.text.recorded}`}
        </Text>
        <Box as="ol" id="app.recording.events" direction="column" gap="1" p="0" m="0">
          <For each={lines()} key="key">
            {(line) => (
              <Box as="li">
                <Text font="mono" fontSize="xs">
                  {line.text}
                </Text>
              </Box>
            )}
          </For>
        </Box>
      </Disclosure>
    </Box>
  );
}
