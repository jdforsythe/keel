import { ServerNode } from "./ServerNode.ts";

/** A server text node (`nodeType` 3). */
export class ServerText extends ServerNode {
  override nodeType = 3;
  data: string;

  constructor(doc: ConstructorParameters<typeof ServerNode>[0], data: string) {
    super(doc);
    this.data = data;
  }

  override get nodeValue(): string | null {
    return this.data;
  }

  override set nodeValue(value: string | null) {
    this.data = value ?? "";
  }

  override get textContent(): string | null {
    return this.data;
  }

  override set textContent(value: string | null) {
    this.data = value ?? "";
  }

  override cloneNode(_deep?: boolean): ServerText {
    return new ServerText(this.ownerDocument, this.data);
  }
}
