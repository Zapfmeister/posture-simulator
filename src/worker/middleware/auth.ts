import { createMiddleware } from "hono/factory";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { HonoEnv } from "../types";

// Cache the JWKS fetcher so it can reuse its internal HTTP cache across
// requests instead of creating a new instance (and a new fetch) every time.
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedTeamDomain: string | null = null;

function getJwks(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  if (cachedTeamDomain !== teamDomain) {
    cachedJwks = createRemoteJWKSet(
      new URL(`${teamDomain}/cdn-cgi/access/certs`),
    );
    cachedTeamDomain = teamDomain;
  }
  return cachedJwks!;
}

/**
 * Hono middleware that validates the Cloudflare Access JWT.
 *
 * Checks:
 * - Presence of Cf-Access-Jwt-Assertion header
 * - RSA256 signature against the team's JWKS endpoint
 * - iss matches TEAM_DOMAIN
 * - aud matches POLICY_AUD
 * - exp/nbf (handled by jose automatically)
 */
export const accessAuth = createMiddleware<HonoEnv>(
  async (c, next) => {
    const { TEAM_DOMAIN, POLICY_AUD } = c.env;

    if (!TEAM_DOMAIN || !POLICY_AUD) {
      console.error("Missing TEAM_DOMAIN or POLICY_AUD configuration");
      return c.json({ error: "Server misconfigured" }, 500);
    }

    const token = c.req.header("Cf-Access-Jwt-Assertion");

    if (!token) {
      return c.json({ error: "Missing Access JWT" }, 401);
    }

    try {
      const jwks = getJwks(TEAM_DOMAIN);

      const { payload } = await jwtVerify(token, jwks, {
        issuer: TEAM_DOMAIN,
        audience: POLICY_AUD,
      });

      c.set("jwtPayload", payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("JWT verification failed:", message);
      return c.json({ error: "Invalid Access token" }, 401);
    }

    await next();
  },
);
