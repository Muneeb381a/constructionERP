// Vercel serverless entrypoint. The [...path] catch-all filename maps every request
// under /* (with this project's Root Directory set to apps/api) to this one function,
// which hands the request to the same Express app used by src/index.ts locally —
// server.ts has no side effects (no .listen(), no cron scheduling), so it's safe to import
// here without duplicating or starting anything. See ../src/index.ts for the traditional
// long-running-server entrypoint used in local dev / non-serverless hosting.
//
// Deliberately NOT `export default app` — a bare re-export of an imported binding left
// Vercel's function builder resolving the wrong module (it reported the export-shape error
// against src/server.js instead of this file). A handler defined in this file, right here,
// removes any ambiguity about which module is the actual entrypoint.
import type { IncomingMessage, ServerResponse } from "node:http";
import { app } from "../src/server.js";

export default function handler(req: IncomingMessage, res: ServerResponse) {
  app(req, res);
}
