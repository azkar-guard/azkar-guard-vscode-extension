import * as vscode from "vscode";
import { t } from "./lib/i18n";
import type { Lang } from "./lib/types";
import type { FromWebview, ToWebview } from "./protocol";

/** The single checklist webview panel ("Azkar break"). */
export class ChecklistPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onMessage: (message: FromWebview) => void,
  ) {}

  /** True while the checklist is the focused editor tab (break prompts must not interrupt it). */
  get active(): boolean {
    return this.panel?.active ?? false;
  }

  get visible(): boolean {
    return this.panel?.visible ?? false;
  }

  show(lang: Lang): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.Active);
      return;
    }
    const media = vscode.Uri.joinPath(this.extensionUri, "media");
    const dist = vscode.Uri.joinPath(this.extensionUri, "dist");
    this.panel = vscode.window.createWebviewPanel("azkarGuard.checklist", t(lang, "brand.name"), vscode.ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [media, dist],
    });
    this.panel.iconPath = vscode.Uri.joinPath(media, "icon.png");
    this.panel.webview.html = this.html(this.panel.webview, lang);
    this.panel.webview.onDidReceiveMessage((m: FromWebview) => this.onMessage(m), null, this.disposables);
    this.panel.onDidDispose(() => (this.panel = undefined), null, this.disposables);
  }

  post(message: ToWebview): void {
    void this.panel?.webview.postMessage(message);
  }

  setTitle(title: string): void {
    if (this.panel) this.panel.title = title;
  }

  dispose(): void {
    this.panel?.dispose();
    for (const d of this.disposables) d.dispose();
  }

  private html(webview: vscode.Webview, lang: Lang): string {
    const nonce = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, "0")).join("");
    const asset = (...path: string[]) => webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, ...path));
    const csp = [
      "default-src 'none'",
      `img-src ${webview.cspSource}`,
      `style-src ${webview.cspSource}`,
      `font-src ${webview.cspSource}`,
      `script-src 'nonce-${nonce}'`,
    ].join("; ");
    return `<!doctype html>
<html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}">
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="${asset("dist", "checklist.css")}">
</head>
<body>
  <div class="page">
    <nav><span class="brand"><img src="${asset("media", "icon-32.png")}" alt="" width="22" height="22"><span id="brand-name"></span></span></nav>
    <main id="app"></main>
  </div>
  <script nonce="${nonce}" src="${asset("dist", "webview.js")}"></script>
</body>
</html>`;
  }
}
