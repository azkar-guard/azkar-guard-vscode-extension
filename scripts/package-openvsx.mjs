// Packages the Open VSX build. The two stores use different publisher IDs
// (Marketplace: s403o, Open VSX: azkar-guard), and vsce has no flag to override
// the publisher, so package.json is patched for the build and always restored.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const OPEN_VSX_PUBLISHER = "azkar-guard";
const path = new URL("../package.json", import.meta.url);
const original = readFileSync(path, "utf8");
const pkg = JSON.parse(original);
const out = `openvsx-${pkg.name}-${pkg.version}.vsix`;

writeFileSync(path, JSON.stringify({ ...pkg, publisher: OPEN_VSX_PUBLISHER }, null, 2) + "\n");
try {
  execFileSync("npx", ["vsce", "package", "--no-dependencies", "-o", out], { stdio: "inherit" });
} finally {
  writeFileSync(path, original);
}
console.log(`Open VSX package: ${out} (${OPEN_VSX_PUBLISHER}.${pkg.name})`);
