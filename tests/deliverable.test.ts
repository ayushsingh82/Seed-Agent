import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import {
  isHackathonJob,
  analyzePrompt,
  validateProject,
  validateAndFix,
  createFallbackEntryFile,
} from "../src/tools/hackathon/index.js";
import { getSystemPrompt } from "../src/config/systemPrompt.js";
import type { Job } from "../src/types/index.js";
import type { AgentConfig } from "../src/types/index.js";

describe("Full-pipeline gate (isHackathonJob)", () => {
  const baseConfig: AgentConfig = {
    hackathonMinBudget: 9000,
  } as AgentConfig;

  it("returns true when budget >= hackathonMinBudget", () => {
    const job: Job = {
      id: "1",
      prompt: "anything",
      budget: 10000,
      status: "OPEN",
      expiresAt: "",
      createdAt: "",
      responseCount: 0,
    };
    expect(isHackathonJob(job, baseConfig)).toBe(true);
  });

  it("returns true when budget equals hackathonMinBudget", () => {
    const job: Job = {
      id: "1",
      prompt: "task",
      budget: 9000,
      status: "OPEN",
      expiresAt: "",
      createdAt: "",
      responseCount: 0,
    };
    expect(isHackathonJob(job, baseConfig)).toBe(true);
  });

  it("returns false when budget below threshold and no artifact wording", () => {
    const job: Job = {
      id: "1",
      prompt: "write me an essay",
      budget: 100,
      status: "OPEN",
      expiresAt: "",
      createdAt: "",
      responseCount: 0,
    };
    expect(isHackathonJob(job, baseConfig)).toBe(false);
  });

  it("returns true when prompt mentions build and budget >= 1", () => {
    const job: Job = {
      id: "1",
      prompt: "Build me a landing page for a coffee shop",
      budget: 5,
      status: "OPEN",
      expiresAt: "",
      createdAt: "",
      responseCount: 0,
    };
    expect(isHackathonJob(job, baseConfig)).toBe(true);
  });

  it("returns false when prompt mentions build but budget < 1", () => {
    const job: Job = {
      id: "1",
      prompt: "build a website",
      budget: 0.5,
      status: "OPEN",
      expiresAt: "",
      createdAt: "",
      responseCount: 0,
    };
    expect(isHackathonJob(job, baseConfig)).toBe(false);
  });
});

describe("Request brief (analyzePrompt)", () => {
  it("classifies dashboard-style requests", () => {
    const out = analyzePrompt("I need a dashboard with analytics and charts");
    expect(out.projectType).toBe("dashboard");
    expect(out.complexity).toBeDefined();
  });

  it("classifies landing page requests", () => {
    const out = analyzePrompt("Create a landing page for my portfolio");
    expect(out.projectType).toBe("landing-page");
  });

  it("picks up feature areas from text", () => {
    const out = analyzePrompt("App with login, database, and dark mode");
    expect(out.features).toContain("authentication");
    expect(out.features).toContain("data/database");
    expect(out.features).toContain("theming");
  });

  it("sets complexity from length and features", () => {
    const short = analyzePrompt("Simple todo list");
    expect(["simple", "moderate"]).toContain(short.complexity);
    const long = analyzePrompt(
      "A full platform with auth, database, search, filter, charts, real-time updates, payments, notifications, and file upload. " +
        "Plus detailed requirements here and more text to make it long."
    );
    expect(long.complexity).toBe("complex");
  });
});

describe("Submission checks (validateProject, validateAndFix)", () => {
  let dir: string;

  beforeEach(() => {
    dir = join(tmpdir(), `seed-agent-test-${randomUUID()}`);
    mkdirSync(dir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it("fails when too few files", () => {
    writeFileSync(join(dir, "index.html"), "<h1>Hi</h1>", "utf-8");
    const r = validateProject(dir, ["index.html"]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("at least"))).toBe(true);
  });

  it("fails when no README", () => {
    writeFileSync(join(dir, "index.html"), "<h1>Hi</h1>", "utf-8");
    writeFileSync(join(dir, "style.css"), "body{}", "utf-8");
    const r = validateProject(dir, ["index.html", "style.css"]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("readme"))).toBe(true);
  });

  it("fails when no entry point", () => {
    writeFileSync(join(dir, "README.md"), "Project. Run with npm start.", "utf-8");
    writeFileSync(join(dir, "other.js"), "console.log(1);", "utf-8");
    const r = validateProject(dir, ["README.md", "other.js"]);
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.toLowerCase().includes("entry"))).toBe(true);
  });

  it("passes when README and entry exist and enough files", () => {
    writeFileSync(join(dir, "README.md"), "What: A demo. Run: open index.html. Stack: HTML.", "utf-8");
    writeFileSync(join(dir, "index.html"), "<!DOCTYPE html><html><body>Hi</body></html>", "utf-8");
    writeFileSync(join(dir, "style.css"), "body{}", "utf-8");
    const r = validateProject(dir, ["README.md", "index.html", "style.css"]);
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it("validateAndFix injects index.html when missing entry", () => {
    writeFileSync(join(dir, "README.md"), "Run: open index.html.", "utf-8");
    writeFileSync(join(dir, "styles.css"), "body {}", "utf-8");
    const { result, files } = validateAndFix(dir, ["README.md", "styles.css"]);
    expect(files).toContain("index.html");
    expect(existsSync(join(dir, "index.html"))).toBe(true);
    expect(result.fallbackApplied).toBe(true);
  });

  it("createFallbackEntryFile writes runnable index.html", () => {
    const path = createFallbackEntryFile(dir);
    expect(path).toBe("index.html");
    expect(existsSync(join(dir, "index.html"))).toBe(true);
    const content = readFileSync(join(dir, "index.html"), "utf-8");
    expect(content).toContain("<!DOCTYPE html");
    expect(content).toContain("README");
  });
});

describe("System prompt (getSystemPrompt)", () => {
  const job: Job = {
    id: "j1",
    prompt: "Build a todo app",
    budget: 100,
    status: "OPEN",
    expiresAt: "",
    createdAt: "",
    responseCount: 0,
  };

  it("includes budget in prompt", () => {
    const out = getSystemPrompt({ job, isHackathon: false });
    expect(out).toContain("100.00");
    expect(out).toContain("USD");
  });

  it("includes scoring context when isHackathon", () => {
    const out = getSystemPrompt({ job, isHackathon: true });
    expect(out).toContain("Functionality");
    expect(out).toContain("Design");
    expect(out).toContain("Speed");
  });

  it("includes request context when promptAnalysis provided", () => {
    const out = getSystemPrompt({
      job,
      isHackathon: true,
      promptAnalysis: {
        projectType: "web-application",
        description: "todo",
        features: ["theming"],
        complexity: "simple",
      },
    });
    expect(out).toContain("web-application");
    expect(out).toContain("simple");
    expect(out).toContain("theming");
  });

  it("includes validation errors when provided", () => {
    const out = getSystemPrompt({
      job,
      isHackathon: true,
      validationErrors: ["Missing README", "No entry point"],
    });
    expect(out).toContain("Missing README");
    expect(out).toContain("No entry point");
    expect(out).toContain("Corrections");
  });
});
