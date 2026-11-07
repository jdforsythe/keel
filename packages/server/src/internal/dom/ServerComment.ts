import { ServerText } from "./ServerText.ts";

/** A server comment node (`nodeType` 8); its text is `data`. */
export class ServerComment extends ServerText {
  override nodeType = 8;

  override cloneNode(_deep?: boolean): ServerComment {
    return new ServerComment(this.ownerDocument, this.data);
  }
}
