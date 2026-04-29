# Posture Simulator

A Cloudflare Workers application that simulates custom device posture checks for Cloudflare Zero Trust. Allows administrators to assign arbitrary posture scores (0-100) to enrolled WARP devices via a web interface, enabling testing of posture-based access policies without a real endpoint security product.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/gzapf/posture-simulator)

## How it works

Cloudflare One Client periodically polls the Worker's posture API endpoint. The Worker looks up each device in its KV-backed configuration and returns the configured score. Devices without explicit configuration receive a configurable default score.

```
CF One Client --> Access (Service Auth) --> Worker POST /api/posture
                                              |
                                              v
                                           KV Store (device configs)
                                              ^
                                              |
Admin Browser --> Access (IdP Auth) -------> Worker GET /* (React UI)
```

## Features

- Web UI to browse enrolled WARP devices and assign posture scores
- Per-device enable/disable toggle and score slider (0-100)
- Configurable default score for unconfigured devices
- Secured behind Cloudflare Access (IdP for admin UI, Service Token for posture API)
- JWT signature + AUD validation in the Worker as defense-in-depth
- All secrets stored outside the repo (Secrets Store / Worker Secrets)
- One-click deploy via "Deploy to Cloudflare" button

## Prerequisites

- Cloudflare account with Zero Trust enabled
- At least one WARP-enrolled device
- A domain managed in Cloudflare (for the Worker custom domain)
- An identity provider configured in Cloudflare Access

## Quick start

1. Click the **Deploy to Cloudflare** button above
2. Fill in the required secrets when prompted (see [INSTRUCTIONS.md](INSTRUCTIONS.md))
3. Configure the Access application and policies
4. Add the custom service provider integration in Zero Trust

For detailed setup instructions, see [INSTRUCTIONS.md](INSTRUCTIONS.md).

## Development

```bash
npm install
npm run dev
```

## License

MIT
