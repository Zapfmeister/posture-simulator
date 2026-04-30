/**
 * Cleanup script for Posture Simulator.
 *
 * Removes all Cloudflare resources created by the setup script:
 * - Posture Check Rule ("Posture Simulator")
 * - Custom S2S Integration ("Posture Simulator")
 * - Access Application ("Posture Simulator")
 * - Access Service Token ("Posture Simulator")
 * - KV Namespace ("posture-simulator-POSTURE_KV" or "POSTURE_KV")
 * - Deployed Worker ("posture-simulator")
 *
 * Requires the same API token permissions as the setup script.
 *
 * Usage: npm run cleanup
 */

import { createInterface } from "node:readline/promises";
import { execSync } from "node:child_process";
import { stdin, stdout } from "node:process";
import {
  cfApi,
  loadEnv,
  maskToken,
  listServiceTokens,
  listAccessApps,
  listPostureIntegrations,
  listPostureRules,
  deleteServiceToken,
  deleteAccessApp,
  deletePostureIntegration,
  deletePostureRule,
  listReusablePolicies,
  deleteReusablePolicy,
} from "./cf-api";

const rl = createInterface({ input: stdin, output: stdout });
const APP_NAME = "Posture Simulator";

async function ask(question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function confirm(question: string): Promise<boolean> {
  const answer = await ask(`${question} (y/N): `);
  return answer.toLowerCase() === "y";
}

function run(cmd: string): string {
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

async function main() {
  console.log("\n  Posture Simulator - Cleanup\n");
  console.log("  This will delete all Cloudflare resources created by the setup script.");
  console.log("  Requires an API token with Edit permissions (same as setup).\n");

  let accountId: string;
  let apiToken: string;

  const saved = loadEnv();
  if (saved) {
    console.log("Found saved credentials in .env");
    console.log(`  Account ID:  ${saved.accountId}`);
    console.log(`  Edit Token:  ${maskToken(saved.editToken)}`);
    if (saved.readToken) {
      console.log(`  Read Token:  ${maskToken(saved.readToken)}`);
    }
    console.log("\n  Cleanup requires the Edit token.\n");

    const answer = await ask("Use saved Edit token? (Y/n): ");
    if (answer === "" || answer.toLowerCase() === "y") {
      accountId = saved.accountId;
      apiToken = saved.editToken;
    } else {
      accountId = await ask("Cloudflare Account ID: ");
      apiToken = await ask("API Token (with Edit permissions): ");
    }
  } else {
    accountId = await ask("Cloudflare Account ID: ");
    apiToken = await ask("API Token (with Edit permissions): ");
  }

  if (!accountId || !apiToken) {
    console.error("Account ID and API token are required.");
    process.exit(1);
  }

  console.log("\nVerifying token...");
  try {
    await cfApi("GET", "/user/tokens/verify", apiToken);
  } catch (err) {
    console.error("Token verification failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  let deletedCount = 0;

  // 1. Posture Check Rules
  console.log("\nLooking for Posture Check Rules...");
  try {
    const rules = await listPostureRules(accountId, apiToken);
    const matching = rules.filter((r) => r.name.startsWith(APP_NAME) && r.type === "custom_s2s");
    if (matching.length === 0) {
      console.log("  No Posture Check Rule found.");
    } else {
      for (const rule of matching) {
        console.log(`  Found: "${rule.name}" (${rule.id})`);
        if (await confirm(`  Delete this Posture Check Rule?`)) {
          try {
            await deletePostureRule(accountId, rule.id, apiToken);
            console.log("  Deleted.");
            deletedCount++;
          } catch (err) {
            console.error(`  Failed to delete: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  } catch {
    console.log("  Could not list posture rules.");
  }

  // 2. Custom S2S Integrations
  console.log("\nLooking for Custom S2S Integrations...");
  try {
    const integrations = await listPostureIntegrations(accountId, apiToken);
    const matching = integrations.filter((i) => i.name === APP_NAME && i.type === "custom_s2s");
    if (matching.length === 0) {
      console.log("  No Custom S2S Integration found.");
    } else {
      for (const integration of matching) {
        console.log(`  Found: "${integration.name}" (${integration.id})`);
        if (await confirm(`  Delete this Integration?`)) {
          try {
            await deletePostureIntegration(accountId, integration.id, apiToken);
            console.log("  Deleted.");
            deletedCount++;
          } catch (err) {
            console.error(`  Failed to delete: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  } catch {
    console.log("  Could not list posture integrations.");
  }

  // 3. Access Application
  console.log("\nLooking for Access Application...");
  const apps = await listAccessApps(accountId, apiToken);
  const matchingApps = apps.filter((a) => a.name === APP_NAME);

  if (matchingApps.length === 0) {
    console.log("  No Access Application found.");
  } else {
    for (const app of matchingApps) {
      console.log(`  Found: "${app.name}" (${app.domain}, AUD: ${app.aud.slice(0, 12)}...)`);
      if (await confirm(`  Delete this Access Application?`)) {
        try {
          await deleteAccessApp(accountId, app.id, apiToken);
          console.log("  Deleted.");
          deletedCount++;
        } catch (err) {
          console.error(`  Failed to delete: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  // 4. Reusable Access Policies
  console.log("\nLooking for reusable Access Policies...");
  try {
    const policies = await listReusablePolicies(accountId, apiToken);
    const matching = policies.filter(
      (p) => p.name.startsWith(APP_NAME),
    );
    if (matching.length === 0) {
      console.log("  No reusable policies found.");
    } else {
      for (const policy of matching) {
        console.log(`  Found: "${policy.name}" (${policy.id})`);
        if (await confirm(`  Delete this policy?`)) {
          try {
            await deleteReusablePolicy(accountId, policy.id, apiToken);
            console.log("  Deleted.");
            deletedCount++;
          } catch (err) {
            console.error(`  Failed to delete: ${err instanceof Error ? err.message : err}`);
          }
        }
      }
    }
  } catch {
    console.log("  Could not list reusable policies.");
  }

  // 5. Service Tokens
  console.log("\nLooking for Service Tokens...");
  const tokens = await listServiceTokens(accountId, apiToken);
  const matchingTokens = tokens.filter((t) => t.name === APP_NAME);

  if (matchingTokens.length === 0) {
    console.log("  No Service Token found.");
  } else {
    for (const token of matchingTokens) {
      console.log(`  Found: "${token.name}" (${token.client_id})`);
      if (await confirm(`  Delete this Service Token?`)) {
        try {
          await deleteServiceToken(accountId, token.id, apiToken);
          console.log("  Deleted.");
          deletedCount++;
        } catch (err) {
          console.error(`  Failed to delete: ${err instanceof Error ? err.message : err}`);
        }
      }
    }
  }

  // 6. KV Namespace
  console.log("\nLooking for KV Namespace...");
  try {
    const output = run("npx wrangler kv namespace list");
    interface KvNamespace {
      id: string;
      title: string;
    }
    const namespaces = JSON.parse(output) as KvNamespace[];
    const matching = namespaces.filter(
      (ns) =>
        ns.title === "posture-simulator-POSTURE_KV" ||
        ns.title === "POSTURE_KV",
    );

    if (matching.length === 0) {
      console.log("  No KV Namespace found.");
    } else {
      for (const ns of matching) {
        console.log(`  Found: "${ns.title}" (${ns.id})`);
        if (await confirm(`  Delete this KV Namespace?`)) {
          run(`npx wrangler kv namespace delete --namespace-id=${ns.id}`);
          console.log("  Deleted.");
          deletedCount++;
        }
      }
    }
  } catch {
    console.log("  Could not list KV namespaces.");
  }

  // 7. Worker
  console.log("\nLooking for deployed Worker...");
  if (await confirm("  Delete the 'posture-simulator' Worker?")) {
    try {
      run("npx wrangler delete --name posture-simulator");
      console.log("  Deleted.");
      deletedCount++;
    } catch {
      console.log("  Worker not found or could not be deleted.");
    }
  }

  // Summary
  console.log("\n" + "─".repeat(40));
  if (deletedCount > 0) {
    console.log(`  Cleanup complete. ${deletedCount} resource(s) deleted.`);
  } else {
    console.log("  No resources were deleted.");
  }
  console.log("─".repeat(40) + "\n");

  rl.close();
}

main().catch((err) => {
  console.error("\nCleanup failed:", err instanceof Error ? err.message : err);
  rl.close();
  process.exit(1);
});
