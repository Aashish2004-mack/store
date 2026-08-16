// Usage: node scripts/hash-password.js "your-chosen-password"
// Prints a bcrypt hash to paste into server/.env as ADMIN_PASSWORD_HASH.
// The plaintext password you type here is never written to any file.

import bcrypt from "bcryptjs";

const pw = process.argv[2];

if (!pw || pw.length < 8) {
  console.error("Usage: node scripts/hash-password.js \"your-chosen-password\"");
  console.error("Choose a password that's at least 8 characters.");
  process.exit(1);
}

const hash = bcrypt.hashSync(pw, 12);

console.log("\nAdd this line to server/.env:\n");
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
console.log("Your plaintext password was not saved anywhere — remember it yourself.\n");
