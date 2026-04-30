# Posture Simulator

A Cloudflare Workers application that simulates custom device posture checks for Cloudflare Zero Trust. Assigns configurable posture levels to enrolled WARP devices via a web interface, enabling testing of posture-based access policies without a real endpoint security product.

## How it works

Cloudflare One Client periodically polls the Worker's posture API endpoint. The Worker looks up each device in its KV-backed configuration and returns the configured posture level. Devices without explicit configuration receive a configurable default level.

```
CF One Client --> Access (Service Auth) --> Worker POST /api/posture
                                              |
                                              v
                                           KV Store (device configs)
                                              ^
                                              |
Admin Browser --> Access (IdP Auth) -------> Worker GET /* (React UI)
```

## Posture Levels

Each device is assigned a level from 0 to 6, designed to model real-world security scenarios including SIEM/SOAR-driven state changes:

| Level | Label | Scenario | Typical Trigger |
|-------|-------|----------|-----------------|
| **0** | Compromised | Malware confirmed, credential theft | SOAR: Incident Response |
| **1** | Under Investigation | Suspicious activity, SOC analyzing | SIEM: Anomaly detected |
| **2** | Restricted | Quarantined, scan/patch in progress | SOAR: Auto-remediation |
| **3** | Non-Compliant | AV outdated, OS unpatched | SIEM: Compliance check failed |
| **4** | Basic | Baseline security passed, no EDR | Default for new devices |
| **5** | Managed | MDM/EDR enrolled, fully compliant | EDR: All checks passed |
| **6** | High Security | Hardened, secure boot, biometric | MDM: Full compliance |

The setup creates posture checks at each threshold (>= 1 through >= 6). Use them in Access or Gateway policies to control access based on the device's security posture.

## Features

- Web UI with per-device posture level dropdown and enable/disable toggle
- 7 posture levels modeling real security scenarios (including SIEM/SOAR states)
- 6 posture checks for tiered access control
- Secured behind Cloudflare Access (IdP for admin UI, Service Token for posture API)
- JWT signature + AUD validation in the Worker as defense-in-depth
- All secrets stored outside the repo (Worker Secrets)
- Fully automated setup and cleanup

## Prerequisites

- Cloudflare account with Zero Trust enabled
- At least one WARP-enrolled device
- A domain managed in Cloudflare (for the Worker custom domain)
- An identity provider configured in Cloudflare Access
- Node.js and npm installed

## Quick start

1. [Create an API token](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22access%22%2C%22type%22%3A%22edit%22%7D%5D&name=Posture+Simulator+Setup) with **Zero Trust: Edit**, **Access: Apps and Policies: Edit**, and **Access: Service Tokens: Edit** (the link pre-fills the first two, manually add Service Tokens)

2. Run the setup:
   ```bash
   git clone https://github.com/Zapfmeister/posture-simulator.git
   cd posture-simulator
   npm install
   npx wrangler login
   npm run setup
   ```

3. The script creates everything automatically: Access application, service token, policies, Worker deploy, custom S2S integration, and 6 tiered posture checks. Open the Worker URL to manage device posture levels.

For manual setup or details on each step, see [INSTRUCTIONS.md](INSTRUCTIONS.md).

To tear down all resources: `npm run cleanup`

## Development

```bash
npm install
npm run dev
```

## License

MIT
