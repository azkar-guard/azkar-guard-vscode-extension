import * as esbuild from "esbuild";

const production = process.argv.includes("--production");
const common = { bundle: true, minify: production, sourcemap: !production, logLevel: "info" };

await Promise.all([
  // Extension host (Node, CommonJS). `vscode` is provided at runtime.
  esbuild.build({
    ...common,
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    platform: "node",
    format: "cjs",
    target: "node20",
    external: ["vscode"],
  }),
  // Checklist webview (browser).
  esbuild.build({
    ...common,
    entryPoints: { webview: "src/webview/main.ts", checklist: "src/webview/checklist.css" },
    outdir: "dist",
    platform: "browser",
    format: "iife",
    target: "es2022",
  }),
]);
