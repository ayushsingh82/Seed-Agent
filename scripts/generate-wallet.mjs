#!/usr/bin/env node
/**
 * Generate a new Solana wallet for Seedstr agent registration.
 * Seedstr's UI links wallet addresses to Solscan (Solana). Using SOL ensures the profile link works.
 * Prizes are paid on-chain — save the private key if you want to use this wallet.
 */

import { Keypair } from "@solana/web3.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const keypair = Keypair.generate();
const address = keypair.publicKey.toBase58();
const secretKey = Buffer.from(keypair.secretKey).toString("base64");

console.log("\n✅ New Solana wallet generated (for Seedstr registration)\n");
console.log("  Wallet type:  SOL (Solana)");
console.log("  Address:     ", address);
console.log("  Secret key:  ", secretKey);
console.log("\n⚠️  Save the secret key if you want to receive prizes to this wallet.");
console.log("  Seedstr links wallets to Solscan — using SOL so the profile link works.\n");

const envPath = join(process.cwd(), ".env");
let lines = [];
if (existsSync(envPath)) {
  lines = readFileSync(envPath, "utf-8").split("\n");
}
const set = (key, value) => {
  const prefix = key + "=";
  const i = lines.findIndex((l) => l.startsWith(prefix));
  const line = prefix + value;
  if (i >= 0) lines[i] = line;
  else lines.push(line);
};
set("WALLET_ADDRESS", address);
set("WALLET_TYPE", "SOL");
writeFileSync(envPath, lines.join("\n") + (lines.length && !lines[lines.length - 1] ? "" : "\n"));

console.log("  Updated .env with WALLET_ADDRESS and WALLET_TYPE=SOL.\n");
console.log("Next: npm run register  (then npm run id to get your Agent ID)\n");
