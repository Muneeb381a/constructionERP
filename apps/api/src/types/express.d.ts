import type { AccessTokenPayload } from "../lib/jwt.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenPayload;
      // Set only by authenticatePlatformAdmin — never by the tenant `authenticate`
      // middleware. A route should never read both `auth` and `platformAuth`.
      platformAuth?: { id: string; email: string; name: string };
    }
  }
}

export {};
