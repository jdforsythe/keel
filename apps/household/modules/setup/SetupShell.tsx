import { type Infer, s } from "@keel/schema";
import Frame from "../members/Frame.tsx";
import { ShellData } from "../members/ShellData.schema.ts";

export const Props = s.object({ data: ShellData });

/** Layout `setup.shell`: the frame around the setup pages. */
export default function SetupShell(props: Infer<typeof Props> & { readonly children: () => Node }) {
  return <Frame data={props.data}>{props.children()}</Frame>;
}
