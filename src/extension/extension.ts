import * as vscode from "vscode";
import { ReviewCockpitProvider } from "./webview-provider";
import { CrpClient } from "./mcp-client";

let crpClient: CrpClient | undefined;

export async function activate(context: vscode.ExtensionContext) {
  // Initialize CRP MCP client
  crpClient = new CrpClient();

  try {
    await crpClient.start(context.extensionPath);
  } catch (err: any) {
    console.error("ChainReview: Failed to start CRP server:", err.message);
    vscode.window.showErrorMessage(
      `ChainReview: Failed to start backend server — ${err.message}`
    );
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
