import { createMiddleware } from "hono/factory";
import { jwtVerify, createRemoteJWKSet } from "jose";
import type { HonoEnv } from "../types";

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
      return c.json({ error: "Missing Access JWT" }, 403);
    }

    try {
      const jwks = createRemoteJWKSet(
        new URL(`${TEAM_DOMAIN}/cdn-cgi/access/certs`),
      );

      const { payload } = await jwtVerify(token, jwks, {
        issuer: TEAM_DOMAIN,
        audience: POLICY_AUD,
      });

      // Store the verified payload for downstream handlers
      c.set("jwtPayload", payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("JWT verification failed:", message);
      return c.json({ error: "Invalid Access token" }, 403);
    }

    await next();
  },
);
