import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ReviewCockpitProvider } from "./webview-provider";
import { CrpClient, migrateKeysToSecretStorage } from "./mcp-client";
import {
  ChainReviewAuthProvider,
  AUTH_PROVIDER_ID,
} from "./auth-provider";
import {
  initAuthState,
  restoreAuthState,
  getAuthState,
  switchMode,
  onLoginSuccess,
  onLogout,
} from "./auth-state";

let crpClient: CrpClient | undefined;
let authProvider: ChainReviewAuthProvider | undefined;

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
  // Migrate any plain-text API keys from settings.json to VS Code SecretStorage
  await migrateKeysToSecretStorage(context.secrets).catch((err) => {
    console.warn("ChainReview: Key migration to SecretStorage failed:", err);
  });

  // ── Auth Provider Setup ──
  authProvider = new ChainReviewAuthProvider(context.secrets);
  initAuthState(authProvider);

  context.subscriptions.push(
    vscode.authentication.registerAuthenticationProvider(
      AUTH_PROVIDER_ID,
      "ChainReview",
      authProvider,
      { supportsMultipleAccounts: false }
    )
  );

  // URI handler for OAuth callback (vscode://chainreview.chainreview/callback)
  context.subscriptions.push(
    vscode.window.registerUriHandler({
      handleUri(uri: vscode.Uri) {
        if (uri.path === "/callback") {
          authProvider?.handleCallback(uri).then(() => {
            onLoginSuccess();
          }).catch((err) => {
            console.error("ChainReview: OAuth callback error:", err);
          });
        }
      },
    })
  );

  // Restore auth state from stored session
  await restoreAuthState().catch((err) => {
    console.warn("ChainReview: Auth state restore failed:", err);
  });

  // ── Auth Commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.login", async () => {
      try {
        await vscode.authentication.getSession(AUTH_PROVIDER_ID, ["profile", "email"], {
          createIfNone: true,
        });
        await onLoginSuccess();
        await switchMode("managed");
      } catch (err: any) {
        if (err.message !== "User did not consent to login.") {
          vscode.window.showErrorMessage(`ChainReview: Login failed — ${err.message}`);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.logout", async () => {
      if (authProvider) {
        const sessions = await authProvider.getSessions();
        for (const session of sessions) {
          await authProvider.removeSession(session.id);
        }
        onLogout();
        vscode.window.showInformationMessage("ChainReview: Signed out");
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.switchMode", async () => {
      const current = getAuthState();
      const items = [
        {
          label: "BYOK (Bring Your Own Key)",
          description: current.mode === "byok" ? "(current)" : "",
          mode: "byok" as const,
        },
        {
          label: "Managed (ChainReview Cloud)",
          description: current.mode === "managed" ? "(current)" : "",
          mode: "managed" as const,
        },
      ];
      const picked = await vscode.window.showQuickPick(items, {
        placeHolder: "Select authentication mode",
      });
      if (picked) {
        await switchMode(picked.mode);
        vscode.window.showInformationMessage(
          `ChainReview: Switched to ${picked.mode === "byok" ? "BYOK" : "Managed"} mode`
        );
      }
    })
  );

  // ── CRP Server ──
  try {
    crpClient = await startCrpServer(context.extensionPath);

    // After successful connect, check if API key was found from any source
    // (only relevant in BYOK mode — managed mode uses JWT)
    const authState = getAuthState();
    if (authState.mode === "byok") {
      const config = vscode.workspace.getConfiguration("chainreview");
      const hasSettingKey = !!config.get<string>("anthropicApiKey")?.trim();
      const hasEnvKey = !!process.env.ANTHROPIC_API_KEY;
      const hasSecretKey = !!(await context.secrets.get("chainreview.ANTHROPIC_API_KEY"));
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

      if (!hasSettingKey && !hasEnvKey && !hasSecretKey && !hasKeyFile && !hasEnvFile) {
        vscode.window.showWarningMessage(
          "ChainReview: No Anthropic API key found. Set it in Settings, a .env file, ~/.anthropic/api_key, or sign in for managed mode.",
          "Open Settings",
          "Sign In"
        ).then((choice) => {
          if (choice === "Open Settings") {
            vscode.commands.executeCommand(
              "workbench.action.openSettings",
              "chainreview.anthropicApiKey"
            );
          } else if (choice === "Sign In") {
            vscode.commands.executeCommand("chainreview.login");
          }
        });
      }
    }
  } catch (err: any) {
    console.error("ChainReview: Failed to start CRP server:", err.message);
    vscode.window.showErrorMessage(
      `ChainReview: Failed to start backend server — ${err.message}`
    );
    // Create a disconnected client so the provider still initializes
    crpClient = new CrpClient();
  }

  const provider = new ReviewCockpitProvider(context.extensionUri, crpClient, context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ReviewCockpitProvider.viewType,
      provider
    )
  );

  // ── Azure DevOps Commands ──
  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.azure.setPAT", async () => {
      await provider.promptAndSaveAzurePAT();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("chainreview.azure.reviewPR", async () => {
      vscode.commands.executeCommand("chainreview.reviewCockpit.focus");
      // Small delay to let panel focus
      await new Promise((r) => setTimeout(r, 300));
      // Trigger Azure PR review directly
      await (provider as any)._startAzurePRReview?.();
    })
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
      authProvider?.dispose();
      crpClient?.stop().catch(() => {});
    },
  });
}

export async function deactivate() {
  if (crpClient) {
    await crpClient.stop().catch(() => {});
    crpClient = undefined;
  }
  authProvider?.dispose();
  authProvider = undefined;
}
