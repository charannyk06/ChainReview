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

    // After successful connect, check if API key was found
    // (the client logs a warning to stderr, but also surface it to the user)
    const config = vscode.workspace.getConfiguration("chainreview");
    const hasSettingKey = !!config.get<string>("anthropicApiKey")?.trim();
    const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;
    const hasKeyFile = (() => {
      try {
        const home = process.env.HOME || process.env.USERPROFILE || "";
        return fs.existsSync(path.join(home, ".anthropic", "api_key"));
      } catch { return false; }
    })();
    const hasEnvFile = (() => {
      try {
        const root = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!root) return false;
        const envPath = path.join(root, ".env");
        if (!fs.existsSync(envPath)) return false;
        const content = fs.readFileSync(envPath, "utf-8");
        return /^ANTHROPIC_API_KEY=.+$/m.test(content);
      } catch { return false; }
    })();

    if (!hasSettingKey && !hasEnvKey && !hasKeyFile && !hasEnvFile) {
      vscode.window.showWarningMessage(
        "ChainReview: No Anthropic API key found. Set it in Settings → chainreview.anthropicApiKey, or in a .env file, or in ~/.anthropic/api_key. LLM features won't work without it.",
        "Open Settings"
      ).then((choice) => {
        if (choice === "Open Settings") {
          vscode.commands.executeCommand(
            "workbench.action.openSettings",
            "chainreview.anthropicApiKey"
          );
        }
      });
    }
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
