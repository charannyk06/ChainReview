import { danger, warn, fail, message } from "danger";

// ── PR Title Conventions ──
// Enforces conventional commit format for PR titles:
//   type(scope): description
//
// Valid types: feat, fix, refactor, docs, style, test, chore, ci, perf, build
// Scope is optional but encouraged.

const PR_TITLE_REGEX =
  /^(feat|fix|refactor|docs|style|test|chore|ci|perf|build)(\(.+\))?:\s.{3,}/;

const title = danger.github.pr.title;

if (!PR_TITLE_REGEX.test(title)) {
  fail(
    `**PR title does not follow conventional commit format.**\n\n` +
      `Expected: \`type(scope): description\`\n\n` +
      `Valid types: \`feat\`, \`fix\`, \`refactor\`, \`docs\`, \`style\`, \`test\`, \`chore\`, \`ci\`, \`perf\`, \`build\`\n\n` +
      `Examples:\n` +
      `- \`feat(review): add multi-agent orchestration\`\n` +
      `- \`fix(webview): resolve streaming stuck state\`\n` +
      `- \`chore: update dependencies\`\n\n` +
      `Your title: **${title}**`
  );
} else {
  message(`✅ PR title follows conventional commit format.`);
}

// ── PR Description Check ──
if (!danger.github.pr.body || danger.github.pr.body.trim().length < 10) {
  warn(
    "PR description is empty or too short. Please provide context about the changes."
  );
}

// ── Large PR Warning ──
const diffSize =
  (danger.github.pr.additions || 0) + (danger.github.pr.deletions || 0);
if (diffSize > 1000) {
  warn(
    `This PR has **${diffSize}** lines of changes. Consider breaking it into smaller PRs for easier review.`
  );
}

// ── Modified File Warnings ──
const modifiedFiles = danger.git.modified_files;

if (modifiedFiles.includes("package.json") && !modifiedFiles.includes("package-lock.json")) {
  warn(
    "`package.json` was modified but `package-lock.json` was not. Did you forget to run `npm install`?"
  );
}
