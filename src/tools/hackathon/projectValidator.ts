/**
 * Validate a built project before submission.
 * Ensures entry point, README, minimum files, no empty files.
 * Can create a fallback index.html if no entry point exists.
 */

import { readFileSync, existsSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { logger } from "../../utils/logger.js";

const ENTRY_POINTS = [
  "index.html",
  "index.js",
  "main.js",
  "app.js",
  "server.js",
  "app.py",
  "main.py",
  "server.py",
  "cli.js",
  "index.py",
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  critical: boolean;
  fallbackApplied?: boolean;
}

function hasEntryPoint(files: string[]): boolean {
  return files.some((f) => {
    const name = f.split("/").pop()?.toLowerCase() ?? "";
    return ENTRY_POINTS.includes(name);
  });
}

function hasReadme(files: string[]): boolean {
  return files.some((f) => {
    const name = f.split("/").pop()?.toLowerCase() ?? "";
    return name === "readme.md" || name === "readme";
  });
}

/**
 * Create a minimal fallback index.html so the project can be opened.
 */
export function createFallbackEntryFile(projectDir: string): string {
  const filePath = join(projectDir, "index.html");
  const content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Project</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; line-height: 1.6; }
    h1 { color: #333; }
    .info { background: #f0f0f0; padding: 15px; border-radius: 5px; }
  </style>
</head>
<body>
  <h1>Project</h1>
  <div class="info">
    <p>Entry point. See README.md for how to run.</p>
  </div>
</body>
</html>`;
  writeFileSync(filePath, content, "utf-8");
  logger.info("[Validator] Created fallback index.html");
  return "index.html";
}

const MIN_FILES = 2;
const MIN_README_LENGTH = 50;

/**
 * Validate project directory and file list.
 * Returns errors/warnings and whether a fallback entry was applied.
 */
export function validateProject(
  projectDir: string,
  files: string[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let critical = false;
  let fallbackApplied = false;

  if (files.length < MIN_FILES) {
    errors.push(`Project has ${files.length} file(s); need at least ${MIN_FILES}.`);
    critical = true;
  }

  if (!hasReadme(files)) {
    errors.push("README.md (or README) is missing. Every submission must include a README with what was built and how to run.");
    critical = true;
  } else {
    const readmePath = files.find((f) => {
      const n = f.split("/").pop()?.toLowerCase() ?? "";
      return n === "readme.md" || n === "readme";
    });
    if (readmePath) {
      const fullPath = join(projectDir, readmePath);
      if (existsSync(fullPath)) {
        const content = readFileSync(fullPath, "utf-8");
        if (content.length < MIN_README_LENGTH) {
          warnings.push("README is very short; add 'What was built' and 'How to run' (3 steps or fewer).");
        }
      }
    }
  }

  if (!hasEntryPoint(files)) {
    errors.push("No entry point found (e.g. index.html, index.js, main.js, app.js).");
    critical = true;
  }

  for (const f of files) {
    const fullPath = join(projectDir, f);
    if (existsSync(fullPath)) {
      try {
        const stat = statSync(fullPath);
        if (stat.size === 0) {
          errors.push(`File is empty: ${f}`);
        }
      } catch {
        warnings.push(`Could not stat: ${f}`);
      }
    }
  }

  const valid = errors.length === 0;
  return {
    valid,
    errors,
    warnings,
    critical,
    fallbackApplied,
  };
}

/**
 * Validate and optionally fix: if no entry point, create fallback index.html.
 * Returns updated validation result and list of files (including new one if added).
 */
export function validateAndFix(
  projectDir: string,
  files: string[]
): { result: ValidationResult; files: string[] } {
  const result = validateProject(projectDir, files);
  let updatedFiles = [...files];

  if (!result.valid && !hasEntryPoint(files)) {
    createFallbackEntryFile(projectDir);
    updatedFiles = ["index.html", ...files];
    return {
      result: {
        ...result,
        valid: result.errors.length <= 1 && result.warnings.length === 0,
        errors: result.errors.filter((e) => !e.includes("entry point")),
        fallbackApplied: true,
      },
      files: updatedFiles,
    };
  }

  return { result, files: updatedFiles };
}
