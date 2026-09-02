# Contributing to RayMail

Thanks for taking the time to contribute.

## Getting set up

```bash
git clone https://github.com/DeveloperSarim/raymail.git
cd raymail/web
npm install
npm run dev
```

The webmail expects a JMAP server. Either point `JMAP_ENDPOINT` at an existing
Stalwart instance, or bring the whole stack up with `docker compose up -d` and
develop against that.

## Before you open a pull request

```bash
npm run typecheck   # must pass - the project is strict, including noUncheckedIndexedAccess
npm test            # must pass
npm run build       # must succeed
```

## What we look for

- **Keep TypeScript strict.** No `any` to make an error go away, no `@ts-ignore`
  without a comment explaining why it is unavoidable.
- **Add a test when you touch a security or delivery path.** Tracking tokens,
  session crypto, the click redirector and anything that sends mail all have
  consequences when they break.
- **Match the surrounding style** rather than introducing a new one.
- **Explain the why, not the what,** in comments. The code already says what.

## Reporting a security issue

Please do **not** open a public issue for a vulnerability. Open a private
security advisory through the repository's Security tab instead.

## Commit messages

Short imperative subject, and a body when the change needs justification:

```
Fix open redirect in the click tracker

The destination was taken from the URL rather than the signed token, so a
crafted link could redirect anywhere while still recording a click.
```
