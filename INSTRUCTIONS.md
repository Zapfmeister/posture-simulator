# Setup Instructions

Step-by-step guide to deploy and configure the Posture Simulator.

## Prerequisites

- A Cloudflare account with [Zero Trust](https://one.dash.cloudflare.com/) enabled
- At least one device enrolled via the [Cloudflare One Client](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/)
- A domain managed in Cloudflare (for the Worker custom domain)
- An identity provider (IdP) configured in [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/)

## 1. Deploy the Worker

### Option A: Deploy to Cloudflare button (recommended)

Click the button in the [README](README.md). During the setup flow, you will be prompted to fill in:

- **CF_API_TOKEN**: A Cloudflare API token with `Devices: Read` permission. Create one at [dash.cloudflare.com/profile/api-tokens](https://dash.cloudflare.com/profile/api-tokens). Use the "Custom token" template and add the permission `Account > Devices > Read`.
- **POSTURE_KV**: Automatically provisioned by Cloudflare.

After deploy completes, note your Worker URL (e.g., `posture-simulator.<your-subdomain>.workers.dev`).

### Option B: Manual deploy with wrangler

```bash
git clone https://github.com/Zapfmeister/posture-simulator.git
cd posture-simulator
npm install
```

Create the KV namespace:

```bash
npx wrangler kv namespace create POSTURE_KV
```

Copy the returned namespace ID into `wrangler.jsonc` under `kv_namespaces[0].id`.

Set the environment variables in `wrangler.jsonc`:

- `TEAM_DOMAIN`: `https://<your-team-name>.cloudflareaccess.com`
- `POLICY_AUD`: The AUD tag from your Access application (see step 3)
- `CF_ACCOUNT_ID`: Your Cloudflare account ID

Configure the API token as a Worker secret:

```bash
npx wrangler secret put CF_API_TOKEN
# Paste your API token when prompted
```

Or, if using Secrets Store, update the `secrets_store_secrets` section in `wrangler.jsonc` with your store ID and create the secret via `npx wrangler secrets-store secret create`.

Deploy:

```bash
npm run deploy
```

## 2. Create an Access Service Token

The Cloudflare One Client authenticates to the posture API using a service token.

1. Go to [Cloudflare One](https://one.dash.cloudflare.com/) > **Access controls** > **Service credentials** > **Service tokens**
2. Select **Create a service token**
3. Name it (e.g., "Posture Simulator")
4. Save the **Client ID** and **Client Secret** securely. You will need these in step 4.

## 3. Create the Access Application

Protect the Worker behind Cloudflare Access.

1. Go to **Access controls** > **Applications** > **Add an application**
2. Select **Self-hosted application**
3. Configure:
   - **Application name**: Posture Simulator
   - **Application domain**: Your Worker's custom domain or workers.dev URL
   - **Session duration**: 24h (or your preference)
4. Add **two policies**:

**Policy 1: Service Auth (for the posture API)**

| Field    | Value                              |
|----------|------------------------------------|
| Action   | Service Auth                       |
| Include  | Service Token = "Posture Simulator" |

**Policy 2: Allow (for the admin UI)**

| Field    | Value                                    |
|----------|------------------------------------------|
| Action   | Allow                                    |
| Include  | Emails = your-email@example.com          |

Or use "Email domain" / "Identity provider groups" depending on your needs.

5. From the **Additional settings** tab, copy the **Application Audience (AUD) Tag**
6. Set this as `POLICY_AUD` in your Worker configuration

## 4. Add the Custom Service Provider Integration

1. Go to [Cloudflare One](https://one.dash.cloudflare.com/) > **Integrations** > **Service providers**
2. Select **Add new** > **Custom service provider**
3. Configure:
   - **Name**: Posture Simulator
   - **Access client ID**: The Client ID from step 2
   - **Access client secret**: The Client Secret from step 2
   - **REST API URL**: `https://<your-worker-domain>/api/posture`
   - **Polling frequency**: Choose your preferred interval (e.g., 5 minutes)
4. Select **Test and save**

## 5. Configure the Posture Check

1. Go to **Reusable components** > **Posture checks** > **Service provider checks**
2. Select **Add a check**
3. Select the **Posture Simulator** provider
4. Name it (e.g., "Simulated Risk Score")
5. Set the threshold (e.g., score greater than 60 = pass)
6. Select **Save**

You can now use this posture check in device posture policies.

## 6. Assign a Custom Domain (optional)

To use a custom domain instead of workers.dev:

1. Go to **Workers & Pages** > your Worker > **Settings** > **Domains & Routes**
2. Add your custom domain (e.g., `posture.example.com`)
3. Cloudflare will automatically create the DNS record
4. Update the Access application domain to match

## Verifying the Setup

1. Open the Worker URL in your browser. You should be prompted to authenticate via Access.
2. After login, you should see the admin UI with your enrolled devices.
3. Enable a device and set a score, then save.
4. Go to **Insight** > **Logs** > **Posture logs** in Cloudflare One to verify the scores are being reported.

## Security Notes

- **No secrets in the repo**: All tokens and credentials are stored as Worker secrets or in the Secrets Store.
- **JWT validation**: The Worker validates every Access JWT signature, issuer, and audience. Even if someone bypasses Access at the network level, the Worker will reject the request.
- **Least privilege**: The API token only needs `Devices: Read`. It cannot modify devices or any other account resources.
- **Access controls**: The admin UI is protected by your IdP. The posture API is protected by a service token. These are separate Access policies on the same application.
