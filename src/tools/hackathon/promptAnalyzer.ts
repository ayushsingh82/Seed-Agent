/**
 * Analyze the job prompt to extract project type, features, and complexity.
 * Used to build a better system prompt for hackathon/build jobs.
 */

export interface PromptAnalysis {
  projectType: string;
  description: string;
  features: string[];
  complexity: "simple" | "moderate" | "complex";
}

export function analyzePrompt(prompt: string): PromptAnalysis {
  const lower = prompt.toLowerCase();

  let projectType = "web-application";
  if (
    /dashboard|analytics|charts|metrics/.test(lower) ||
    lower.includes("data viz")
  ) {
    projectType = "dashboard";
  } else if (
    /landing|marketing|website|portfolio|brochure/.test(lower)
  ) {
    projectType = "landing-page";
  } else if (/game|play|score|level/.test(lower)) {
    projectType = "game";
  } else if (
    /api|backend|service|endpoint|rest|server/.test(lower)
  ) {
    projectType = "api-service";
  } else if (
    /tool|calculator|converter|utility|cli|script/.test(lower)
  ) {
    projectType = "tool";
  } else if (/app|application|web app/.test(lower)) {
    projectType = "web-application";
  }

  const features: string[] = [];
  const featureMap: [RegExp | string, string][] = [
    [/auth|login|signup|user\s*management|session/i, "authentication"],
    [/database|storage|crud|data\s*persist|sql|json\s*store/i, "data/database"],
    [/search|filter|sort|query/i, "search/filter"],
    [/responsive|mobile|tablet|viewport/i, "responsive"],
    [/dark\s*mode|theme|styling|css/i, "theming"],
    [/chart|graph|visualization|analytics/i, "charts/analytics"],
    [/real-?time|websocket|live|stream/i, "realtime"],
    [/payment|checkout|stripe/i, "payments"],
    [/email|notification|alert/i, "notifications"],
    [/upload|download|file/i, "file handling"],
  ];
  for (const [pattern, name] of featureMap) {
    if (
      (typeof pattern === "string" && lower.includes(pattern)) ||
      (pattern instanceof RegExp && pattern.test(prompt))
    ) {
      if (!features.includes(name)) features.push(name);
    }
  }

  let complexity: PromptAnalysis["complexity"] = "moderate";
  const wordCount = prompt.split(/\s+/).length;
  if (wordCount > 150 || features.length > 4) complexity = "complex";
  else if (wordCount < 40 && features.length <= 1) complexity = "simple";

  return {
    projectType,
    description: prompt.slice(0, 200),
    features,
    complexity,
  };
}
