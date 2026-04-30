/**
 * Shared Cloudflare API helpers for setup and cleanup scripts.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

export interface CfApiResult<T> {
  success: boolean;
  result: T;
  errors?: Array<{ code: number; message: string }>;
}

export async function cfApi<T>(
  method: string,
  path: string,
  token: string,
  body?: unknown,
): Promise<T> {
  const resp = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data: CfApiResult<T>;
  try {
    data = (await resp.json()) as CfApiResult<T>;
  } catch {
    throw new Error(`API returned non-JSON (HTTP ${resp.status})`);
  }

  if (!data.success) {
    const msgs = data.errors?.map((e) => `${e.message} [code: ${e.code}]`).join(", ");
    const detail = msgs || `HTTP ${resp.status} ${resp.statusText}`;
    throw new Error(`Cloudflare API error: ${detail}`);
  }

  return data.result;
}

// ── Types ────────────────────────────────────────────────────────────

export interface ServiceToken {
  id: string;
  client_id: string;
  client_secret?: string;
  name: string;
}

export interface AccessApp {
  id: string;
  aud: string;
  name: string;
  domain: string;
}

export interface AccessPolicy {
  id: string;
  name: string;
  decision: string;
  precedence: number;
}

export interface IdpInfo {
  id: string;
  name: string;
  type: string;
}

export interface PostureIntegration {
  id: string;
  name: string;
  type: string;
}

export interface PostureRule {
  id: string;
  name: string;
  type: string;
}

// ── Service Tokens ───────────────────────────────────────────────────

export async function listServiceTokens(accountId: string, token: string): Promise<ServiceToken[]> {
  return cfApi<ServiceToken[]>("GET", `/accounts/${accountId}/access/service_tokens`, token);
}

export async function deleteServiceToken(accountId: string, tokenId: string, apiToken: string): Promise<void> {
  await cfApi<unknown>("DELETE", `/accounts/${accountId}/access/service_tokens/${tokenId}`, apiToken);
}

// ── Access Applications ──────────────────────────────────────────────

export async function listAccessApps(accountId: string, token: string): Promise<AccessApp[]> {
  return cfApi<AccessApp[]>("GET", `/accounts/${accountId}/access/apps`, token);
}

export async function deleteAccessApp(accountId: string, appId: string, apiToken: string): Promise<void> {
  await cfApi<unknown>("DELETE", `/accounts/${accountId}/access/apps/${appId}`, apiToken);
}

// ── Reusable Access Policies ─────────────────────────────────────────

export async function listReusablePolicies(accountId: string, token: string): Promise<AccessPolicy[]> {
  return cfApi<AccessPolicy[]>("GET", `/accounts/${accountId}/access/policies`, token);
}

export async function deleteReusablePolicy(accountId: string, policyId: string, token: string): Promise<void> {
  await cfApi<unknown>("DELETE", `/accounts/${accountId}/access/policies/${policyId}`, token);
}

// ── Posture Integrations (Service Providers) ─────────────────────────

export async function listPostureIntegrations(accountId: string, token: string): Promise<PostureIntegration[]> {
  return cfApi<PostureIntegration[]>("GET", `/accounts/${accountId}/devices/posture/integration`, token);
}

export async function deletePostureIntegration(accountId: string, integrationId: string, token: string): Promise<void> {
  await cfApi<unknown>("DELETE", `/accounts/${accountId}/devices/posture/integration/${integrationId}`, token);
}

// ── Posture Rules (Checks) ───────────────────────────────────────────

export async function listPostureRules(accountId: string, token: string): Promise<PostureRule[]> {
  return cfApi<PostureRule[]>("GET", `/accounts/${accountId}/devices/posture`, token);
}

export async function deletePostureRule(accountId: string, ruleId: string, token: string): Promise<void> {
  await cfApi<unknown>("DELETE", `/accounts/${accountId}/devices/posture/${ruleId}`, token);
}

// ── Local .env persistence ───────────────────────────────────────────

/**
 * Stored credentials in .env (gitignored).
 * - editToken: has Zero Trust Edit + Access Edit + Service Tokens Edit (for setup/cleanup)
 * - readToken: has only Zero Trust Read (for the Worker at runtime)
 * Both are optional - the edit token is always stored, the read token only after setup offers to create one.
 */
export interface SavedCredentials {
  accountId: string;
  editToken: string;
  readToken?: string;
}

function envPath(): string {
  return resolve(import.meta.dirname ?? ".", "../.env");
}

export function loadEnv(): SavedCredentials | null {
  const path = envPath();
  if (!existsSync(path)) return null;

  const raw = readFileSync(path, "utf-8");
  const accountId = raw.match(/^SETUP_ACCOUNT_ID=(.+)$/m)?.[1]?.trim();
  const editToken = raw.match(/^SETUP_TOKEN_EDIT=(.+)$/m)?.[1]?.trim();
  const readToken = raw.match(/^SETUP_TOKEN_READ=(.+)$/m)?.[1]?.trim();

  // Backwards compat: old format used SETUP_API_TOKEN
  const legacyToken = raw.match(/^SETUP_API_TOKEN=(.+)$/m)?.[1]?.trim();

  const resolvedEdit = editToken ?? legacyToken;
  if (!accountId || !resolvedEdit) return null;
  return { accountId, editToken: resolvedEdit, readToken: readToken || undefined };
}

export function saveEnv(creds: SavedCredentials): void {
  const path = envPath();
  let content = `SETUP_ACCOUNT_ID=${creds.accountId}\nSETUP_TOKEN_EDIT=${creds.editToken}\n`;
  if (creds.readToken) {
    content += `SETUP_TOKEN_READ=${creds.readToken}\n`;
  }
  writeFileSync(path, content);
}

export function maskToken(token: string): string {
  if (token.length <= 16) return "****";
  return `${token.slice(0, 8)}...${token.slice(-8)}`;
}
