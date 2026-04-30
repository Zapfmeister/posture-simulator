const SETUP_TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22read%22%7D%2C%7B%22key%22%3A%22access%22%2C%22type%22%3A%22edit%22%7D%5D&name=Posture+Simulator+Setup";

const READ_ONLY_TOKEN_URL =
  "https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22teams%22%2C%22type%22%3A%22read%22%7D%5D&name=Posture+Simulator";

interface Props {
  missing: string[];
}

const descriptions: Record<string, string> = {
  TEAM_DOMAIN: "Your Cloudflare Access team domain (e.g., https://myteam.cloudflareaccess.com)",
  POLICY_AUD: "The Application Audience (AUD) tag from your Access application",
  CF_ACCOUNT_ID: "Your Cloudflare account ID",
  CF_API_TOKEN: "API token with Zero Trust: Read permission",
};

export function SetupGuide({ missing }: Props) {
  return (
    <div className="mx-auto max-w-2xl py-16 space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold text-gray-100">Setup Required</h2>
        <p className="text-gray-400">
          The Posture Simulator is deployed but not fully configured yet.
        </p>
      </div>

      <div className="rounded-lg border border-yellow-800/50 bg-yellow-950/20 p-6 space-y-4">
        <h3 className="text-sm font-medium uppercase text-yellow-500">Missing configuration</h3>
        <ul className="space-y-3">
          {missing.map((key) => (
            <li key={key} className="flex items-start gap-3">
              <span className="mt-0.5 inline-block h-2 w-2 rounded-full bg-yellow-500 shrink-0" />
              <div>
                <code className="text-sm font-mono text-gray-200">{key}</code>
                <p className="text-sm text-gray-500">{descriptions[key] ?? ""}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-lg border border-gray-800 p-6 space-y-4">
        <h3 className="text-sm font-medium uppercase text-gray-500">Option A: Automated setup</h3>
        <p className="text-sm text-gray-400">
          Run the setup script locally. It creates the Access application,
          service token, and configures all Worker variables automatically.
        </p>
        <pre className="rounded-md bg-gray-900 px-4 py-3 text-sm text-gray-300 overflow-x-auto">
          npm run setup
        </pre>
        <p className="text-xs text-gray-500">
          Requires an API token with{" "}
          <a
            href={SETUP_TOKEN_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 underline underline-offset-2 hover:text-orange-300"
          >
            Zero Trust: Read + Access: Edit
          </a>{" "}
          permissions.
        </p>
      </div>

      <div className="rounded-lg border border-gray-800 p-6 space-y-4">
        <h3 className="text-sm font-medium uppercase text-gray-500">Option B: Manual setup</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-400">
          <li>
            <a
              href={READ_ONLY_TOKEN_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-400 underline underline-offset-2 hover:text-orange-300"
            >
              Create an API token
            </a>{" "}
            with Zero Trust: Read permission
          </li>
          <li>Create an Access Service Token in the Zero Trust dashboard</li>
          <li>Create an Access Application with Service Auth + Allow policies</li>
          <li>
            Set the missing variables in{" "}
            <strong className="text-gray-300">Workers &amp; Pages &gt; Settings &gt; Variables and Secrets</strong>
          </li>
        </ol>
        <p className="text-xs text-gray-500">
          See{" "}
          <a
            href="https://github.com/Zapfmeister/posture-simulator/blob/main/INSTRUCTIONS.md"
            target="_blank"
            rel="noopener noreferrer"
            className="text-orange-400 underline underline-offset-2 hover:text-orange-300"
          >
            INSTRUCTIONS.md
          </a>{" "}
          for the full step-by-step guide.
        </p>
      </div>
    </div>
  );
}
