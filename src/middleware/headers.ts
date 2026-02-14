/**
 * @file Security headers middleware
 * @purpose Sets security-related HTTP headers on every response.
 *          Implements controls from ASVS V14, ISM, and Essential Eight
 *          (user application hardening via CSP and Permissions-Policy).
 * @inputs Outgoing response object
 * @outputs Response with security headers appended
 * @invariants Every response leaving the application has these headers set.
 *             Headers can be tightened per-project but never loosened
 *             (enforced by policy-as-code in CI).
 * @spec N/A (bootstrap infrastructure)
 */

import { createMiddleware } from 'hono/factory';

/**
 * Default Content-Security-Policy.
 * Intentionally restrictive. Projects tighten this further or
 * add specific source allowances via the spec process.
 */
const DEFAULT_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // unsafe-inline for styles only; tighten if possible
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  'upgrade-insecure-requests',
].join('; ');

/**
 * Permissions-Policy restricting browser APIs the application does not need.
 * Per Essential Eight: user application hardening.
 */
const PERMISSIONS_POLICY = [
  'camera=()',
  'microphone=()',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'magnetometer=()',
  'gyroscope=()',
  'accelerometer=()',
].join(', ');

/**
 * Security headers middleware for Hono.
 * Applied to every response before it leaves the application.
 */
export const headersMiddleware = createMiddleware(async (c, next) => {
  await next();

  // Transport security (ASVS V14, ISM)
  c.res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');

  // Prevent MIME type sniffing (ASVS V14)
  c.res.headers.set('X-Content-Type-Options', 'nosniff');

  // Prevent clickjacking (ASVS V14)
  c.res.headers.set('X-Frame-Options', 'DENY');

  // Control referrer information leakage
  c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Content Security Policy (ASVS V14)
  c.res.headers.set('Content-Security-Policy', DEFAULT_CSP);

  // Restrict unnecessary browser APIs (Essential Eight: application hardening)
  c.res.headers.set('Permissions-Policy', PERMISSIONS_POLICY);

  // Prevent caching of authenticated responses (ASVS V8)
  const authHeader = c.req.header('Authorization');
  if (authHeader) {
    c.res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    c.res.headers.set('Pragma', 'no-cache');
  }
});
