// Launch a real VS Code with the extension and run src/test/suite.ts inside it.
import { build } from "esbuild";
import { runTests } from "@vscode/test-electron";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
await build({
  entryPoints: [join(root, "src/test/suite.ts")],
  outfile: join(root, "dist-test/suite.js"),
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  logLevel: "warning",
});

// A fresh profile per run, so settings and state from earlier runs never leak in.
const profile = mkdtempSync(join(tmpdir(), "azkar-guard-test-"));
await runTests({
  version: process.env.VSCODE_TEST_VERSION ?? "stable",
  extensionDevelopmentPath: root,
  extensionTestsPath: join(root, "dist-test/suite.js"),
  launchArgs: ["--disable-extensions", `--user-data-dir=${join(profile, "user")}`, `--extensions-dir=${join(profile, "ext")}`],
});
