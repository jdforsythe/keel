import { type Infer, s } from "@keel/schema";
import Frame from "./Frame.tsx";
import { ShellData } from "./ShellData.schema.ts";

export const Props = s.object({ data: ShellData });

/** Layout `members.shell`: the frame around the sign-in, sign-up and profile pages. */
export default function MembersShell(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return <Frame data={props.data}>{props.children()}</Frame>;
}
