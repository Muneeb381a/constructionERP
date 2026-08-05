import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { authenticator } from "otplib";
import { createPlatformAdminAccount } from "../modules/platformAdmin/auth/platformAdmin.auth.service.js";
import { pgErrorCode } from "../lib/pgError.js";

// The ONLY way a platform-admin account is ever created — there is no HTTP route for it.
// Run manually, once per admin: `pnpm --filter @construction-erp/api exec tsx src/scripts/create-platform-admin.ts`
// Reads name/email/password from an interactive prompt (not CLI args) so nothing sensitive
// lands in shell history.

function generateRecoveryCodes(count: number): string[] {
  return Array.from({ length: count }, () => randomBytes(5).toString("hex")); // 10 hex chars each
}

async function main() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  console.log("── Create Platform Admin ──────────────────────────────");
  console.log("This is the single most powerful login in the system — it can see and");
  console.log("suspend/close every client shop. Only create this for yourself.\n");

  const name = (await rl.question("Full name: ")).trim();
  const email = (await rl.question("Email: ")).trim().toLowerCase();
  const password = (await rl.question("Password (min 12 characters): ")).trim();
  const confirm = (await rl.question("Confirm password: ")).trim();
  rl.close();

  if (!name || !email) {
    console.error("Name and email are required.");
    process.exit(1);
  }
  if (password.length < 12) {
    console.error("Password must be at least 12 characters.");
    process.exit(1);
  }
  if (password !== confirm) {
    console.error("Passwords do not match.");
    process.exit(1);
  }

  const totpSecret = authenticator.generateSecret();
  const otpauthUri = authenticator.keyuri(email, "Construction ERP Platform Admin", totpSecret);
  const recoveryCodes = generateRecoveryCodes(10);

  try {
    const admin = await createPlatformAdminAccount({ name, email, password, totpSecret, recoveryCodes });

    console.log("\n✔ Platform admin created:", admin.email);
    console.log("\n── Scan this into your authenticator app ──────────────");
    console.log("otpauth URI:", otpauthUri);
    console.log("Manual entry secret (if your app doesn't accept a URI):", totpSecret);
    console.log("\n── Recovery codes (save these somewhere safe now — shown once) ──");
    recoveryCodes.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    console.log("\nEach recovery code can be used once, in place of a TOTP code, if you lose your authenticator device.");
  } catch (err) {
    if (pgErrorCode(err) === "23505") {
      console.error(`\nA platform admin with email "${email}" already exists.`);
      process.exit(1);
    }
    throw err;
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
