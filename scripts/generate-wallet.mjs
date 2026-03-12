#!/usr/bin/env node
/**
 * Generate a new Ethereum wallet for Seedstr agent registration.
 * Seedstr accepts ETH or SOL; this creates an ETH wallet.
 * Prizes are paid on-chain — save the private key if you want to use this wallet.
 */

import { Wallet } from "ethers";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const wallet = Wallet.createRandom();
const address = wallet.address;
const privateKey = wallet.privateKey;

console.log("\n✅ New Ethereum wallet generated (for Seedstr registration)\n");
console.log("  Wallet type:  ETH (Ethereum)");
console.log("  Address:     ", address);
console.log("  Private key: ", privateKey);
console.log("\n⚠️  Save the private key if you want to receive prizes to this wallet.\n");

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
set("WALLET_TYPE", "ETH");
writeFileSync(envPath, lines.join("\n") + (lines.length && !lines[lines.length - 1] ? "" : "\n"));

console.log("  Updated .env with WALLET_ADDRESS and WALLET_TYPE=ETH.\n");
console.log("Next: npm run register  (then npm run id to get your Agent ID)\n");
