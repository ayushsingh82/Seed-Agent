/**
 * Hackathon job detection.
 * High-budget or build-related jobs get the full pipeline (validation, retry, design system).
 */

import type { Job } from "../../types/index.js";
import type { AgentConfig } from "../../types/index.js";

const BUILD_KEYWORDS = [
  "build", "create", "make", "develop", "frontend", "front-end",
  "website", "app", "application", "dashboard", "landing", "page",
  "project", "code", "zip", "submit", "deliverable", "hackathon",
];

/**
 * Returns true if this job should be treated as a hackathon / build job:
 * - Budget >= hackathonMinBudget (e.g. $9k for the mystery prompt), or
 * - Prompt contains build-related keywords and budget is non-trivial.
 */
export function isHackathonJob(job: Job, config: AgentConfig): boolean {
  const effectiveBudget =
    job.jobType === "SWARM" && job.budgetPerAgent != null
      ? job.budgetPerAgent
      : job.budget;

  if (effectiveBudget >= config.hackathonMinBudget) {
    return true;
  }

  const lowerPrompt = job.prompt.toLowerCase();
  const hasBuildKeyword = BUILD_KEYWORDS.some((k) => lowerPrompt.includes(k));
  const nonTrivialBudget = effectiveBudget >= 1;

  return hasBuildKeyword && nonTrivialBudget;
}
