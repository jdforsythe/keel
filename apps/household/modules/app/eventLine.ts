import type { SessionEvent } from "@keel/std-sessions";

/** One recorded event as the line the frame's note shows: its kind, what it touched, and the value as it was kept. */
export function eventLine(e: SessionEvent): string {
  switch (e.kind) {
    case "nav":
      return `nav ${e.href}`;
    case "fire":
      return e.event.type === "input"
        ? `input ${e.id} ${JSON.stringify(e.event.value)}`
        : e.event.type === "keydown"
          ? `keydown ${e.id} ${JSON.stringify(e.event.key)}`
          : `${e.event.type} ${e.id}`;
    case "tx":
      return `tx ${e.name} ${JSON.stringify(e.payload)}`;
    case "resource":
      return `resource ${e.id} ${e.state}`;
    case "error":
      return `error ${e.error.code}`;
    case "net":
      return e.online ? "net online" : "net offline";
  }
}
