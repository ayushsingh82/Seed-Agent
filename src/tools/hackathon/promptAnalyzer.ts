/**
 * Request brief: infer deliverable kind, areas to cover, and scope
 * from the job text. Used only to enrich the system prompt.
 */

export interface PromptAnalysis {
  projectType: string;
  description: string;
  features: string[];
  complexity: "simple" | "moderate" | "complex";
}

const KIND_HINTS: [RegExp, string][] = [
  [/dashboard|analytics|charts|metrics|data viz/i, "dashboard"],
  [/landing|marketing|website|portfolio|brochure/i, "landing-page"],
  [/game|play|score|level/i, "game"],
  [/api|backend|service|endpoint|rest|server/i, "api-service"],
  [/tool|calculator|converter|utility|cli|script/i, "tool"],
  [/app|application|web app/i, "web-application"],
];

const FEATURE_HINTS: [RegExp, string][] = [
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

export function analyzePrompt(prompt: string): PromptAnalysis {
  const lower = prompt.toLowerCase();
  let projectType = "web-application";
  for (const [re, value] of KIND_HINTS) {
    if (re.test(prompt)) {
      projectType = value;
      break;
    }
  }

  const features: string[] = [];
  for (const [re, name] of FEATURE_HINTS) {
    if (re.test(prompt) && !features.includes(name)) features.push(name);
  }

  const words = prompt.split(/\s+/).length;
  let complexity: PromptAnalysis["complexity"] = "moderate";
  if (words > 150 || features.length > 4) complexity = "complex";
  else if (words < 40 && features.length <= 1) complexity = "simple";

  return {
    projectType,
    description: prompt.slice(0, 200),
    features,
    complexity,
  };
}
