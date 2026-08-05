import { createRequire } from "node:module";
import type { RequestHandler } from "express";

// Same cross-platform NodeNext resolution issue as lib/helmet.ts — express-rate-limit
// typechecks fine locally but fails ("not callable") on Vercel's Linux build with the
// identical package/TypeScript versions. createRequire sidesteps it by always resolving
// through the unambiguous CJS "require" condition.
const require = createRequire(import.meta.url);
const rateLimit = require("express-rate-limit") as (options: {
  windowMs: number;
  limit: number;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  message?: unknown;
}) => RequestHandler;

export default rateLimit;
