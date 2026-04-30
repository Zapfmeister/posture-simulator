/**
 * Automated setup script for Posture Simulator.
 *
 * Idempotent: detects existing resources and offers to reuse or do a clean
 * reinstall. When recreating, resources are deleted in dependency order
 * (posture rules -> integration -> app -> policies -> service token) to
 * avoid "in use" errors.
 *
 * Credentials are persisted to .env (gitignored) so subsequent runs skip prompts.
 *
 * Requires an API token with:
 * - Account > Zero Trust > Edit               (for posture integration + rule)
 * - Account > Access: Apps and Policies > Edit (for creating the app + policies)
 * - Account > Access: Service Tokens > Edit    (for creating the service token)
 *
 * Usage: npm run setup
 */

import { createInterface } from "node:readline/promises";
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { stdin, stdout } from "node:process";
import {
  cfApi,
  loadEnv,
  saveEnv,
  maskToken,
  listServiceTokens,
  listAccessApps,
  listPostureIntegrations,
  listPostureRules,
  listReusablePolicies,
  deleteServiceToken,
  deleteAccessApp,
  deletePostureIntegration,
  deletePostureRule,
  deleteReusablePolicy,
} from "./cf-api";
import type {
  ServiceToken,
  AccessApp,
  AccessPolicy,
  IdpInfo,
  PostureIntegration,
  PostureRule,
} from "./cf-api";

const rl = createInterface({ input: stdin, output: stdout });

const SETUP_TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22access%22%2C%22type%22%3A%22edit%22%7D%5D&name=Posture+Simulator+Setup";

const APP_NAME = "Posture Simulator";
const WRANGLER_CONFIG = resolve(import.meta.dirname ?? ".", "../wrangler.jsonc");

// ── helpers ──────────────────────────────────────────────────────────

async function ask(question: string): Promise<string> {
  const answer = await rl.question(question);
  return answer.trim();
}

async function confirm(question: string, defaultYes = false): Promise<boolean> {
  const hint = defaultYes ? "(Y/n)" : "(y/N)";
  const answer = await ask(`${question} ${hint}: `);
  if (answer === "") return defaultYes;
  return answer.toLowerCase() === "y";
}

function run(cmd: string, opts?: { inherit?: boolean }): string {
  if (opts?.inherit) {
    execSync(cmd, { stdio: "inherit" });
    return "";
  }
  return execSync(cmd, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
}

function updateWranglerConfig(updates: {
  kvId: string;
  teamDomain: string;
  policyAud: string;
  accountId: string;
  customDomain?: string;
}): void {
  const raw = readFileSync(WRANGLER_CONFIG, "utf-8");
  const stripped = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const config = JSON.parse(stripped) as Record<string, unknown>;

  config["account_id"] = updates.accountId;

  const kvNamespaces = config["kv_namespaces"] as Array<{ binding: string; id: string }> | undefined;
  const kvEntry = kvNamespaces?.find((ns) => ns.binding === "POSTURE_KV");
  if (kvEntry) kvEntry.id = updates.kvId;

  const vars = config["vars"] as Record<string, string> | undefined;
  if (vars) {
    vars["TEAM_DOMAIN"] = updates.teamDomain;
    vars["POLICY_AUD"] = updates.policyAud;
    vars["CF_ACCOUNT_ID"] = updates.accountId;
  }

  if (updates.customDomain && !updates.customDomain.endsWith(".workers.dev")) {
    config["routes"] = [{ pattern: updates.customDomain, custom_domain: true }];
    config["workers_dev"] = false;
  }

  writeFileSync(WRANGLER_CONFIG, JSON.stringify(config, null, 2) + "\n");
}

function printCredentials(st: { client_id: string; client_secret: string }): void {
  console.error("\n  IMPORTANT: Save the service token credentials:");
  console.error(`  Client ID:     ${st.client_id}`);
  console.error(`  Client Secret: ${st.client_secret}`);
}

// ── main ─────────────────────────────────────────────────────────────

async function main() {
  console.log("\n  Posture Simulator - Setup\n");

  // ── Phase 1: Credentials ──────────────────────────────────────────

  try {
    run("npx wrangler whoami");
  } catch {
    console.error("Error: wrangler is not logged in. Run `npx wrangler login` first.");
    process.exit(1);
  }

  let accountId: string;
  let editToken: string;
  let readToken: string | undefined;

  const saved = loadEnv();
  if (saved) {
    console.log("Found saved credentials in .env");
    console.log(`  Account ID:  ${saved.accountId}`);
    console.log(`  Edit Token:  ${maskToken(saved.editToken)}`);
    if (saved.readToken) console.log(`  Read Token:  ${maskToken(saved.readToken)}`);
    console.log();

    if (await confirm("Use saved credentials?", true)) {
      accountId = saved.accountId;
      editToken = saved.editToken;
      readToken = saved.readToken;
    } else {
      accountId = await ask("Cloudflare Account ID: ");
      editToken = await askForToken();
    }
  } else {
    accountId = await ask("Cloudflare Account ID: ");
    if (!accountId) { console.error("Account ID is required."); process.exit(1); }
    editToken = await askForToken();
  }

  console.log("\nVerifying edit token...");
  try {
    await cfApi("GET", "/user/tokens/verify", editToken);
  } catch (err) {
    console.error("Token verification failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
  console.log("Token is valid.");
  saveEnv({ accountId, editToken, readToken });
  console.log("Credentials saved to .env");

  // ── Phase 2: Organization + IdP ───────────────────────────────────

  console.log("Fetching Zero Trust organization...");
  const org = await cfApi<{ auth_domain: string }>(
    "GET", `/accounts/${accountId}/access/organizations`, editToken,
  );
  const teamDomain = `https://${org.auth_domain}`;
  console.log(`Team domain: ${teamDomain}`);

  console.log("Fetching identity providers...\n");
  const idps = await cfApi<IdpInfo[]>(
    "GET", `/accounts/${accountId}/access/identity_providers`, editToken,
  );
  if (idps.length === 0) {
    console.error("No identity providers configured."); process.exit(1);
  }

  console.log("Available identity providers:");
  for (let i = 0; i < idps.length; i++) {
    const idp = idps[i]!;
    console.log(`  ${i + 1}. ${idp.name || idp.type} (${idp.type})`);
  }

  const idpInput = await ask("\nSelect identity providers for the admin UI (comma-separated): ");
  const selectedIdps = idpInput
    .split(",")
    .map((s) => parseInt(s.trim(), 10) - 1)
    .filter((i) => i >= 0 && i < idps.length)
    .map((i) => idps[i]!);

  if (selectedIdps.length === 0) { console.error("No valid IdP selected."); process.exit(1); }
  const autoRedirect = selectedIdps.length === 1;
  console.log(`\nSelected: ${selectedIdps.map((p) => p.name || p.type).join(", ")}${autoRedirect ? " (auto-redirect)" : ""}`);

  // ── Phase 3: User inputs ──────────────────────────────────────────

  const workerDomain = await ask("\nWorker domain (e.g., posture.example.com): ");
  if (!workerDomain) { console.error("Required."); process.exit(1); }

  const adminEmail = await ask("Admin email for Access Allow policy: ");
  if (!adminEmail) { console.error("Required."); process.exit(1); }

  // ── Phase 4: Detect existing resources ────────────────────────────

  console.log("\nChecking for existing resources...");

  const existingTokens = await listServiceTokens(accountId, editToken);
  const existingToken = existingTokens.find((t) => t.name === APP_NAME);

  const existingApps = await listAccessApps(accountId, editToken);
  const existingApp = existingApps.find((a) => a.name === APP_NAME || a.domain === workerDomain);

  const existingPolicies = await listReusablePolicies(accountId, editToken);
  const existingOurPolicies = existingPolicies.filter((p) => p.name.startsWith(APP_NAME));

  const existingIntegrations = await listPostureIntegrations(accountId, editToken);
  const existingIntegration = existingIntegrations.find((i) => i.name === APP_NAME && i.type === "custom_s2s");

  const existingRules = await listPostureRules(accountId, editToken);
  const existingOurRules = existingRules.filter((r) => r.name.startsWith(APP_NAME) && r.type === "custom_s2s");

  const hasExisting = !!(existingToken || existingApp || existingOurPolicies.length || existingIntegration || existingOurRules.length);

  if (hasExisting) {
    console.log("\nFound existing resources:");
    if (existingOurRules.length) console.log(`  Posture Rules:  ${existingOurRules.length}`);
    if (existingIntegration) console.log(`  Integration:    ${existingIntegration.name}`);
    if (existingApp) console.log(`  Access App:     ${existingApp.name} (${existingApp.domain})`);
    if (existingOurPolicies.length) console.log(`  Policies:       ${existingOurPolicies.length}`);
    if (existingToken) console.log(`  Service Token:  ${existingToken.client_id}`);
  }

  // ── Phase 5: Decide what to do ────────────────────────────────────

  let serviceToken: ServiceToken & { client_secret: string };
  let policyAud: string | undefined;
  let cleanInstall = false;

  if (hasExisting) {
    cleanInstall = await confirm("\nDelete all existing resources and do a clean install?");

    if (cleanInstall) {
      // Delete in dependency order: rules -> integration -> app -> policies -> token
      console.log("\nCleaning up existing resources...");

      for (const rule of existingOurRules) {
        try { await deletePostureRule(accountId, rule.id, editToken); console.log(`  Deleted posture rule: ${rule.name}`); }
        catch (err) { console.error(`  Failed: ${err instanceof Error ? err.message : err}`); }
      }
      if (existingIntegration) {
        try { await deletePostureIntegration(accountId, existingIntegration.id, editToken); console.log("  Deleted integration"); }
        catch (err) { console.error(`  Failed: ${err instanceof Error ? err.message : err}`); }
      }
      if (existingApp) {
        try { await deleteAccessApp(accountId, existingApp.id, editToken); console.log("  Deleted Access app"); }
        catch (err) { console.error(`  Failed: ${err instanceof Error ? err.message : err}`); }
      }
      for (const policy of existingOurPolicies) {
        try { await deleteReusablePolicy(accountId, policy.id, editToken); console.log(`  Deleted policy: ${policy.name}`); }
        catch (err) { console.error(`  Failed: ${err instanceof Error ? err.message : err}`); }
      }
      if (existingToken) {
        try { await deleteServiceToken(accountId, existingToken.id, editToken); console.log("  Deleted service token"); }
        catch (err) { console.error(`  Failed: ${err instanceof Error ? err.message : err}`); }
      }
      console.log("Cleanup done.");
    } else {
      // Reuse existing resources
      if (existingToken) {
        const secret = await ask("\nEnter the existing service token client secret: ");
        if (!secret) {
          console.error("Client secret is required to reuse the existing service token.");
          console.error("Run setup again and choose clean install to recreate it.");
          process.exit(1);
        }
        serviceToken = { ...existingToken, client_secret: secret };
      }
      if (existingApp) {
        policyAud = existingApp.aud;
        console.log(`Reusing Access App (AUD: ${policyAud.slice(0, 16)}...)`);
      }
    }
  }

  // ── Phase 6: Create missing resources ─────────────────────────────

  // Service Token
  if (!serviceToken!) {
    console.log("\nCreating Access Service Token...");
    try {
      serviceToken = await cfApi<ServiceToken & { client_secret: string }>(
        "POST", `/accounts/${accountId}/access/service_tokens`, editToken,
        { name: APP_NAME, duration: "8760h" },
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("\nFailed to create service token:", msg);
      if (msg.includes("Authentication")) console.error("Check: Access: Service Tokens > Edit");
      process.exit(1);
    }
    console.log(`Service token created: ${serviceToken.client_id}`);
  }

  // Policies + Access App
  if (!policyAud) {
    console.log("\nCreating reusable Access Policies...");
    let serviceAuthPolicyId: string;
    let allowPolicyId: string;

    try {
      const p = await cfApi<AccessPolicy>(
        "POST", `/accounts/${accountId}/access/policies`, editToken,
        { name: `${APP_NAME} - Service Auth`, decision: "non_identity", include: [{ service_token: { token_id: serviceToken.id } }] },
      );
      serviceAuthPolicyId = p.id;
      console.log(`  Service Auth policy: ${serviceAuthPolicyId}`);
    } catch (err) {
      console.error("Failed:", err instanceof Error ? err.message : err);
      printCredentials(serviceToken); process.exit(1);
    }

    try {
      const p = await cfApi<AccessPolicy>(
        "POST", `/accounts/${accountId}/access/policies`, editToken,
        { name: `${APP_NAME} - Allow Admin`, decision: "allow", include: [{ email: { email: adminEmail } }] },
      );
      allowPolicyId = p.id;
      console.log(`  Allow Admin policy: ${allowPolicyId}`);
    } catch (err) {
      console.error("Failed:", err instanceof Error ? err.message : err);
      printCredentials(serviceToken); process.exit(1);
    }

    console.log("Creating Access Application...");
    try {
      const app = await cfApi<AccessApp>(
        "POST", `/accounts/${accountId}/access/apps`, editToken,
        {
          name: APP_NAME, type: "self_hosted", domain: workerDomain,
          session_duration: "24h", auto_redirect_to_identity: autoRedirect,
          allowed_idps: selectedIdps.map((p) => p.id),
          policies: [{ id: serviceAuthPolicyId, precedence: 1 }, { id: allowPolicyId, precedence: 2 }],
        },
      );
      policyAud = app.aud;
      console.log(`Access Application created (AUD: ${policyAud.slice(0, 16)}...)`);
    } catch (err) {
      console.error("Failed:", err instanceof Error ? err.message : err);
      printCredentials(serviceToken); process.exit(1);
    }
  }

  if (!policyAud) { console.error("No AUD available."); process.exit(1); }

  // KV Namespace
  console.log("\nConfiguring KV namespace...");
  let kvId: string;
  try {
    const output = run("npx wrangler kv namespace list");
    interface KvNs { id: string; title: string; }
    const namespaces = JSON.parse(output) as KvNs[];
    const existing = namespaces.find((ns) => ns.title === "posture-simulator-POSTURE_KV" || ns.title === "POSTURE_KV");
    if (existing) {
      kvId = existing.id;
      console.log(`Reusing existing KV namespace: ${kvId}`);
    } else {
      const out = run("npx wrangler kv namespace create POSTURE_KV");
      const id = out.match(/"id"\s*:\s*"([^"]+)"/)?.[1] ?? out.match(/id\s*=\s*"([^"]+)"/)?.[1];
      if (!id) throw new Error("Could not parse KV namespace ID");
      kvId = id;
      console.log(`KV namespace created: ${kvId}`);
    }
  } catch (err) {
    console.error("KV namespace failed:", err instanceof Error ? err.message : err);
    printCredentials(serviceToken); process.exit(1);
  }

  // Update wrangler.jsonc
  console.log("Updating wrangler.jsonc...");
  updateWranglerConfig({ kvId, teamDomain, policyAud, accountId, customDomain: workerDomain });

  // Build and deploy
  console.log("\nBuilding and deploying...");
  try { run("npm run deploy", { inherit: true }); console.log("Worker deployed."); }
  catch { console.error("Deploy failed."); printCredentials(serviceToken); process.exit(1); }

  // Set Worker secret (prefer read-only token)
  const workerToken = readToken ?? editToken;
  console.log(`Setting CF_API_TOKEN secret (${readToken ? "read-only" : "edit"} token)...`);
  try {
    execSync(`echo "${workerToken}" | npx wrangler secret put CF_API_TOKEN`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
    console.log("CF_API_TOKEN secret set.");
  } catch { console.error("Could not set secret. Run: npx wrangler secret put CF_API_TOKEN"); }

  // ── Phase 7: DNS wait + Integration + Posture Rules ───────────────

  console.log("\nWaiting for DNS propagation...");
  for (let attempt = 1; attempt <= 12; attempt++) {
    try {
      const resp = await fetch(`https://${workerDomain}/api/health`);
      if (resp.ok || resp.status === 403) { console.log(`Worker reachable at https://${workerDomain}`); break; }
    } catch { /* DNS not ready */ }
    if (attempt === 12) { console.log("DNS not propagated yet. Integration may fail."); break; }
    process.stdout.write(`  Attempt ${attempt}/12, retrying in 5s...\r`);
    await new Promise((r) => setTimeout(r, 5000));
  }

  console.log("Creating Custom S2S Integration...");
  let integrationId: string;
  try {
    const i = await cfApi<PostureIntegration>(
      "POST", `/accounts/${accountId}/devices/posture/integration`, editToken,
      { name: APP_NAME, type: "custom_s2s", interval: "5m", config: { api_url: `https://${workerDomain}/api/posture`, access_client_id: serviceToken.client_id, access_client_secret: serviceToken.client_secret } },
    );
    integrationId = i.id;
    console.log(`Integration created: ${integrationId}`);
  } catch (err) {
    console.error("Failed:", err instanceof Error ? err.message : err);
    console.error("DNS may not have propagated. Wait a minute and run setup again.");
    printCredentials(serviceToken); rl.close(); return;
  }

  const postureChecks = [
    { name: `${APP_NAME} - Under Investigation`, operator: ">=" as const, score: 1, desc: "Score >= 1: enrolled but under SOC investigation" },
    { name: `${APP_NAME} - Restricted`, operator: ">=" as const, score: 2, desc: "Score >= 2: quarantined, remediation in progress" },
    { name: `${APP_NAME} - Non-Compliant`, operator: ">=" as const, score: 3, desc: "Score >= 3: AV outdated, OS unpatched" },
    { name: `${APP_NAME} - Basic`, operator: ">=" as const, score: 4, desc: "Score >= 4: baseline security passed" },
    { name: `${APP_NAME} - Managed`, operator: ">=" as const, score: 5, desc: "Score >= 5: MDM/EDR managed, fully compliant" },
    { name: `${APP_NAME} - High Security`, operator: ">=" as const, score: 6, desc: "Score >= 6: hardened device, secure boot, biometric" },
  ];

  console.log("Creating Posture Check Rules...");
  const checkIds: Record<string, string> = {};
  for (const check of postureChecks) {
    try {
      const rule = await cfApi<PostureRule>(
        "POST", `/accounts/${accountId}/devices/posture`, editToken,
        { name: check.name, type: "custom_s2s", description: check.desc, schedule: "5m", input: { connection_id: integrationId, operator: check.operator, score: check.score } },
      );
      checkIds[check.name] = rule.id;
      console.log(`  ${check.name} (${check.operator} ${check.score})`);
    } catch (err) { console.error(`  Failed: ${check.name}:`, err instanceof Error ? err.message : err); }
  }

  // ── Phase 7b: Reusable Access Policies per classification ─────────

  const classifications = [
    { name: `${APP_NAME} - Internal Apps`, checkName: `${APP_NAME} - Basic`, desc: "Require Basic posture (>= 4) for internal applications" },
    { name: `${APP_NAME} - Confidential Apps`, checkName: `${APP_NAME} - Managed`, desc: "Require Managed posture (>= 5) for confidential applications" },
    { name: `${APP_NAME} - Critical Apps`, checkName: `${APP_NAME} - High Security`, desc: "Require High Security posture (>= 6) for critical applications" },
  ];

  console.log("\nCreating reusable Access Policies for app classifications...");
  const existingAllPolicies = await listReusablePolicies(accountId, editToken);

  for (const cls of classifications) {
    const checkId = checkIds[cls.checkName];
    if (!checkId) {
      console.error(`  Skipped ${cls.name}: posture check "${cls.checkName}" was not created`);
      continue;
    }

    // Delete existing if present
    const existing = existingAllPolicies.find((p) => p.name === cls.name);
    if (existing) {
      try {
        await deleteReusablePolicy(accountId, existing.id, editToken);
      } catch { /* ignore */ }
    }

    try {
      await cfApi<AccessPolicy>(
        "POST", `/accounts/${accountId}/access/policies`, editToken,
        {
          name: cls.name,
          decision: "allow",
          include: [{ everyone: {} }],
          require: [{ device_posture: { integration_uid: checkId } }],
        },
      );
      console.log(`  ${cls.name}`);
    } catch (err) {
      console.error(`  Failed: ${cls.name}:`, err instanceof Error ? err.message : err);
    }
  }

  // ── Phase 8: Summary ──────────────────────────────────────────────

  console.log("\n" + "─".repeat(60));
  console.log("  Setup complete!\n");
  console.log(`  Worker:       https://${workerDomain}`);
  console.log(`  Access App:   ${APP_NAME} (AUD: ${policyAud.slice(0, 16)}...)`);
  console.log(`  Integration:  ${APP_NAME} (custom_s2s, polling every 5m)`);
  console.log(`  Posture Rules:`);
  console.log(`    Under Investigation  >= 1  (SOC analyzing)`);
  console.log(`    Restricted           >= 2  (quarantined)`);
  console.log(`    Non-Compliant        >= 3  (compliance gaps)`);
  console.log(`    Basic                >= 4  (baseline passed)`);
  console.log(`    Managed              >= 5  (MDM/EDR compliant)`);
  console.log(`    High Security        >= 6  (hardened device)`);
  console.log(`  Classification Policies (attach to your Access apps):`);
  console.log(`    Internal Apps        require Basic (>= 4)`);
  console.log(`    Confidential Apps    require Managed (>= 5)`);
  console.log(`    Critical Apps        require High Security (>= 6)`);
  console.log(`\n  Service Token credentials (save these!):`);
  console.log(`  Client ID:     ${serviceToken.client_id}`);
  console.log(`  Client Secret: ${serviceToken.client_secret}`);
  console.log("\n" + "─".repeat(60));

  // Offer read-only token
  if (!readToken) {
    const setReadOnly = await confirm("\nCreate a separate read-only token for the Worker?");
    if (setReadOnly) {
      console.log("\nCreate one here: https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22read%22%7D%5D&name=Posture+Simulator\n");
      const newRead = await ask("Read-only API Token (or Enter to skip): ");
      if (newRead) {
        readToken = newRead;
        try {
          execSync(`echo "${readToken}" | npx wrangler secret put CF_API_TOKEN`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
          console.log("CF_API_TOKEN replaced with read-only token.");
        } catch { console.error("Could not set secret."); }
        saveEnv({ accountId, editToken, readToken });
        console.log(".env updated.");
      }
    }
  }

  console.log("\nDone.\n");
  rl.close();
}

async function askForToken(): Promise<string> {
  console.log(`\nCreate an API token with these permissions:`);
  console.log(`  - Account > Zero Trust > Edit`);
  console.log(`  - Account > Access: Apps and Policies > Edit`);
  console.log(`  - Account > Access: Service Tokens > Edit`);
  console.log(`\nQuick link: ${SETUP_TOKEN_URL}\n`);
  const token = await ask("API Token: ");
  if (!token) { console.error("Required."); process.exit(1); }
  return token;
}

main().catch((err) => {
  console.error("\nSetup failed:", err instanceof Error ? err.message : err);
  rl.close();
  process.exit(1);
});
