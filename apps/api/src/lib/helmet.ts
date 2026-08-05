import { createRequire } from "node:module";
import type { RequestHandler } from "express";

// helmet ships an "exports" map with no explicit "types" condition for its ESM entry
// (only a top-level "types" pointing at the CJS declaration file). Under
// moduleResolution: NodeNext this resolves inconsistently across platforms — it
// typechecks fine on Windows but fails ("not callable") on Vercel's Linux build with
// the exact same package/TypeScript versions. Loading via createRequire always hits the
// unambiguous "require" condition instead, so behavior is identical on every OS; the
// return type is asserted by hand since we no longer rely on the package's own (broken
// for this case) type resolution.
const require = createRequire(import.meta.url);
const helmet = require("helmet") as (options?: Record<string, unknown>) => RequestHandler;

export default helmet;
