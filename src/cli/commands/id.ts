import chalk from "chalk";
import { getStoredAgent, isRegistered } from "../../config/index.js";

/**
 * Print the Agent ID for use on the hackathon platform (e.g. DoraHacks).
 * The platform asks: "Please provide your Agent's ID here."
 */
export async function idCommand(): Promise<void> {
  if (!isRegistered()) {
    console.log(chalk.red("Agent is not registered."));
    console.log(chalk.gray("Run: npm run register"));
    process.exit(1);
  }

  const stored = getStoredAgent();
  const agentId = stored.agentId;

  if (!agentId) {
    console.log(chalk.red("Agent ID not found in config."));
    console.log(chalk.gray("Run: npm run register"));
    process.exit(1);
  }

  console.log(chalk.cyan("\nAgent ID (copy for hackathon platform):\n"));
  console.log(chalk.white(agentId));
  console.log(chalk.gray("\nPaste this ID where the platform asks for your Agent's ID.\n"));
}
