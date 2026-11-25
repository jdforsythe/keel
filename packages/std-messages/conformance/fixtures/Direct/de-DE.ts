import { Direct } from "../Direct.schema.ts";

// Fails the set (a brace in a text message) through `Direct.text`, so importing this file directly throws.
export default Direct.text({ title: "a{b" });
