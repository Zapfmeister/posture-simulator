# Setup Instructions

Step-by-step guide to deploy and configure the Posture Simulator.

## Prerequisites

- A Cloudflare account with [Zero Trust](https://one.dash.cloudflare.com/) enabled
- At least one device enrolled via the [Cloudflare One Client](https://developers.cloudflare.com/cloudflare-one/team-and-resources/devices/cloudflare-one-client/)
- A domain managed in Cloudflare (for the Worker custom domain)
- An identity provider (IdP) configured in [Cloudflare Access](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/)
- Node.js and npm installed

## 1. Create an API Token

[Create a token with pre-filled permissions](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22edit%22%7D%2C%7B%22key%22%3A%22access%22%2C%22type%22%3A%22edit%22%7D%5D&name=Posture+Simulator+Setup) (opens the Dashboard with most permissions pre-filled).

**Before creating the token**, manually add one more permission that the template URL cannot pre-fill:
- **Account > Access: Service Tokens > Edit**

The final token needs these permissions:
- **Zero Trust: Edit** - needed for creating the posture integration and check rule
- **Access: Apps and Policies: Edit** - needed for creating the Access application and policies
- **Access: Service Tokens: Edit** - needed for creating the service token

Under **Account Resources**, select the account that has Zero Trust enabled. Select **Continue to summary** and then **Create Token**. Save the token.

> After setup is complete, you can replace this token with a [read-only token](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22read%22%7D%5D&name=Posture+Simulator) (Zero Trust: Read only) since the Worker does not need edit permissions at runtime. The setup script offers to do this at the end.

## 2. Run the Setup Script

```bash
git clone https://github.com/Zapfmeister/posture-simulator.git
cd posture-simulator
npm install
npx wrangler login
npm run setup
```

The script will prompt you for:
- Your **Cloudflare Account ID**
- The **API token** from step 1
- Which **identity providers** to use for the admin UI
- The **Worker domain** (e.g., `posture.example.com`)
- Your **admin email** for the Access Allow policy

The script automatically:
- Fetches your Zero Trust team domain
- Creates an Access Service Token
- Creates an Access Application with non-legacy policies (Service Auth + Allow)
- Creates a KV namespace for device score configuration
- Configures `wrangler.jsonc` with all values (including custom domain routing)
- Builds and deploys the Worker
- Stores the API token as a Worker secret
- Creates the Custom S2S Integration (service provider)
- Creates the Posture Check Rule (score >= 1 = pass)
- Offers to replace the setup token with a read-only token

## 3. Verify

1. Open your Worker URL in a browser. You should be prompted to authenticate via your IdP.
2. After login, the admin UI shows your enrolled devices.
3. Enable a device and set a score, then save.
4. Check **Insight** > **Logs** > **Posture logs** in Cloudflare One to verify scores are being reported.

## Cleanup

To tear down all created resources:

```bash
npm run cleanup
```

This deletes (with confirmation for each): the posture check rule, custom S2S integration, Access application, service token, KV namespace, and the deployed Worker.

## Manual Setup (without the setup script)

If you prefer to configure everything manually:

1. [Create an API token](https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22read%22%7D%5D&name=Posture+Simulator) with **Zero Trust: Read**
2. Create an Access Service Token in **Access controls** > **Service credentials** > **Service tokens**
3. Create an Access Application with Service Auth + Allow policies
4. Copy the **AUD tag** from the Access Application settings
5. Create a KV namespace: `npx wrangler kv namespace create POSTURE_KV`
6. Set the environment variables in `wrangler.jsonc`:
   - `TEAM_DOMAIN`: `https://<your-team-name>.cloudflareaccess.com`
   - `POLICY_AUD`: The AUD tag
   - `CF_ACCOUNT_ID`: Your Cloudflare account ID
7. Add a custom domain route in `wrangler.jsonc` and set `workers_dev: false`
8. Deploy: `npm run deploy`
9. Set the API token: `npx wrangler secret put CF_API_TOKEN`
10. Add the Custom S2S Integration in **Integrations** > **Service providers**
11. Add the Posture Check in **Reusable components** > **Posture checks**

## Security Notes

- **No secrets in the repo**: All tokens and credentials are stored as Worker secrets.
- **JWT validation**: The Worker validates every Access JWT signature, issuer, and audience.
- **Least privilege**: The Worker only needs **Zero Trust: Read** at runtime. Replace the setup token with a read-only token after setup.
- **Access controls**: The admin UI is protected by your IdP. The posture API is protected by a service token. These are separate Access policies on the same application.
- **Custom domain**: The Worker only listens on the custom domain you specify. The `workers.dev` subdomain is disabled.
