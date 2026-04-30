export interface Env {
  POSTURE_KV: KVNamespace;
  CF_API_TOKEN: string;
  TEAM_DOMAIN: string;
  POLICY_AUD: string;
  CF_ACCOUNT_ID: string;
}

export interface DeviceRequest {
  device_id: string;
  email: string;
  serial_number: string;
  mac_address: string;
  virtual_ipv4: string;
  hostname: string;
}

export interface PostureRequest {
  devices: DeviceRequest[];
}

export interface DeviceEvaluation {
  s2s_id: string;
  score: number;
}

export interface PostureResponse {
  result: Record<string, DeviceEvaluation>;
}

export const POSTURE_LEVELS = [
  { score: 0, label: "Compromised", description: "Malware confirmed, credential theft, active incident" },
  { score: 1, label: "Under Investigation", description: "Suspicious activity detected, SOC analyzing" },
  { score: 2, label: "Restricted", description: "Quarantined, scan or patch in progress" },
  { score: 3, label: "Non-Compliant", description: "AV outdated, OS unpatched, disk unencrypted" },
  { score: 4, label: "Basic", description: "Baseline security checks passed, no EDR/MDM" },
  { score: 5, label: "Managed", description: "MDM/EDR enrolled, disk encrypted, OS current" },
  { score: 6, label: "High Security", description: "Hardened device, secure boot, biometric auth" },
] as const;

export const MAX_POSTURE_SCORE = 6;

export interface DeviceConfig {
  enabled: boolean;
  score: number;
  label: string;
}

export interface PostureConfig {
  devices: Record<string, DeviceConfig>;
  default_score: number;
}

export type HonoEnv = {
  Bindings: Env;
  Variables: {
    jwtPayload: Record<string, unknown>;
  };
};

export interface DeviceRegistration {
  id: string;
  device: {
    id: string;
    name: string;
    client_version?: string;
  };
  user?: {
    id?: string;
    email?: string;
    name?: string;
  };
  last_seen_at: string;
  created_at: string;
}
