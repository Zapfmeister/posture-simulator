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

export interface CloudflareDevice {
  id: string;
  name: string;
  user: { email: string } | null;
  serial_number: string;
  os_version: string;
  status: string;
  last_seen: string;
  model: string;
  os_distro_name: string;
  os_distro_revision: string;
  mac_address: string;
}
