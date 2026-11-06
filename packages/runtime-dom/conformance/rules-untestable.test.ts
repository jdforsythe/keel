import { it } from "vitest";

// Untestable at runtime: E1251 (app code imports a runtime op) is a static check diagnostic (k.check).
it.todo("E1251 app code imports a runtime op");
// Untestable at runtime: E1252 (document/window/DOM APIs in app code) is a static check diagnostic (k.check).
it.todo("E1252 document, window, or DOM node APIs in app code outside the generated entry");
// Untestable at runtime: E1254 (island root prop not encodable) is a compile-time diagnostic (k.compiler).
it.todo("E1254 island root prop not encodable by its schema");
