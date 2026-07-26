// Vercel serverless entrypoint. The [...path] catch-all filename maps every request
// under /* (with this project's Root Directory set to apps/api) to this one function,
// which just hands the request to the same Express app used by src/index.ts locally —
// server.ts has no side effects (no .listen(), no cron scheduling), so it's safe to import
// here without duplicating or starting anything. See ../src/index.ts for the traditional
// long-running-server entrypoint used in local dev / non-serverless hosting.
import { app } from "../src/server.js";

export default app;
