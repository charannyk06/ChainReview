import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ReviewCockpitProvider } from "./webview-provider";
import { CrpClient } from "./mcp-client";

let crpClient: CrpClient | undefined;

async function startCrpServer(extensionPath: string, attempt = 1): Promise<CrpClient> {
  const client = new CrpClient();
  const serverPath = path.join(extensionPath, "dist", "server", "server.js");

  // Check the server binary actually exists
  if (!fs.existsSync(serverPath)) {
    throw new Error(
      `Server binary not found at ${serverPath}. Run 'npm run build' first.`
    );
  }

  try {
    await client.start(extensionPath);
    console.log(`ChainReview: CRP server connected (attempt ${attempt})`);
    return client;
  } catch (err: any) {
    if (attempt < 3) {
      console.error(`ChainReview: Server start failed (attempt ${attempt}): ${err.message}. Retrying...`);
      // Wait before retry (500ms, 1s, 1.5s)
      await new Promise((r) => setTimeout(r, 500 * attempt));
      return startCrpServer(extensionPath, attempt + 1);
    }
    throw err;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  // Initialize CRP MCP client with retry
  try {
    crpClient = await startCrpServer(context.extensionPath);
  } catch (err: any) {
    console.error("ChainReview: Failed to start CRP server:", err.message);
    vscode.window.showErrorMessage(
      `ChainReview: Failed to start backend server — ${err.message}`
    );
    // Create a disconnected client so the provider still initializes
    crpClient = new CrpClient();
  }

  const provider = new ReviewCockpitProvider(context.extensionUri, crpClient);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ReviewCockpitProvider.viewType,
      provider
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.startRepoReview", async () => {
      // Focus the Review Cockpit panel so the user sees output
      await vscode.commands.executeCommand("chainreview.reviewCockpit.focus");
      provider.triggerReview("repo");
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.startDiffReview", async () => {
      await vscode.commands.executeCommand("chainreview.reviewCockpit.focus");
      provider.triggerReview("diff");
    })
  );

  // Cleanup on deactivation
  context.subscriptions.push({
    dispose: () => {
      crpClient?.stop().catch(() => {});
    },
  });
}

export async function deactivate() {
  if (crpClient) {
    await crpClient.stop().catch(() => {});
    crpClient = undefined;
  }
}
