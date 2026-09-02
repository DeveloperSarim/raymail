# Security Policy

## Supported versions

RayMail is pre-1.x in practice; security fixes land on `main`. Please run the
latest commit before reporting.

## Reporting a vulnerability

**Do not open a public issue for a security problem.**

Use GitHub's private reporting instead: go to the repository's **Security** tab
and choose **Report a vulnerability**. That opens a private advisory only the
maintainers can see.

Please include:

- what the issue is and which component it affects
- steps to reproduce, or a proof of concept
- what an attacker gains

You can expect an acknowledgement within a few days.

## Scope

RayMail runs a mail server, so the interesting boundaries are:

| Area | What matters |
|---|---|
| Tracking tokens | Open and click tokens are HMAC-signed. Forging one, or repointing the click redirector, is a vulnerability. |
| Session cookies | Credentials are AES-256-GCM sealed in an httpOnly cookie. Recovering a credential from a cookie is a vulnerability. |
| Message reader | Mail renders in a sandboxed iframe with no `allow-scripts`. Script execution or same-origin access is a vulnerability. |
| Attachments | Only an allowlist of types is served inline, under a `sandbox` CSP. Getting arbitrary content to render inline is a vulnerability. |
| Admin API | Authorisation is delegated to Stalwart. A normal mailbox reaching a management method is a vulnerability. |
| Mail relay | Anything that lets an unauthenticated party send mail through the server is a vulnerability. |

## Out of scope

- Missing hardening on a deployment you configured yourself (no TLS, open ports, weak passwords)
- Deliverability and spam-folder placement
- Findings from automated scanners without a working proof of concept
