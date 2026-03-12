/**
 * Full-pipeline gate: when to run strict submission checks and richer prompts.
 * Uses budget threshold and request wording (no external references).
 */

import type { Job } from "../../types/index.js";
import type { AgentConfig } from "../../types/index.js";

const ARTIFACT_TRIGGERS = [
  "build",
  "create",
  "make",
  "develop",
  "frontend",
  "website",
  "app",
  "application",
  "dashboard",
  "landing",
  "page",
  "project",
  "code",
  "zip",
  "submit",
  "deliverable",
];

export function isHackathonJob(job: Job, config: AgentConfig): boolean {
  const budget =
    job.jobType === "SWARM" && job.budgetPerAgent != null
      ? job.budgetPerAgent
      : job.budget;

  if (budget >= config.hackathonMinBudget) return true;

  const text = job.prompt.toLowerCase();
  const mentionsArtifact = ARTIFACT_TRIGGERS.some((t) => text.includes(t));
  return mentionsArtifact && budget >= 1;
}
