# Security Policy

StockFlow vNext handles commercial inventory and sales data. This document describes how we protect that data and how to report vulnerabilities.

## Supported versions

| Version        | Supported          |
| -------------- | ------------------ |
| latest `main`  | :white_check_mark: |
| older branches | :x:                |

## Security controls

- **Authentication**: Supabase Auth (email/password + magic links). Legacy PIN-first endpoint has been removed (`410 Gone`).
- **Authorization**: Postgres Row Level Security (RLS) policies isolate data per organization.
- **Session tokens**: stored in `localStorage` today; migration to `httpOnly` cookie/session architecture is tracked in ticket SF-010.
- **Service-role keys**: only Edge Functions running server-side can access `SUPABASE_SERVICE_ROLE_KEY`. It is never exposed to the browser.
- **Email escaping**: all user values interpolated into email templates are passed through `escapeHtml` / `escapeHtmlAttribute`.
- **Rate limiting**: shared `rate_limit_requests` table limits signups, API gateway calls and storefront orders by IP/email.
- **Audit logs**: `activity_logs` and `login_attempts` record business events and successful auth sign-ins.
- **Platform admin challenge**: PBKDF2-hashed password, account lockout after 5 failed attempts, challenge expiry.
- **CSP**: `vercel.json` sets strict Content-Security-Policy, X-Frame-Options and Referrer-Policy headers.
- **Dependencies**: `npm audit` runs in CI at high severity; Dependabot is enabled.

## Reporting a vulnerability

Please email security@grandigix.com with:

- A clear description of the issue
- Steps to reproduce
- Possible impact
- Optional patch or mitigation idea

We will acknowledge within 5 business days and ship a fix or disclosure timeline within 30 days.

## Manual secret rotation

If `.env` files were ever committed or shared, follow `SECURITY_ROTATION.md` in the repository root to rotate Supabase, Vercel and Resend secrets.
