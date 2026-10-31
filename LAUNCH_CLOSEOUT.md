# Launch closeout — 2026-10-31

## Source reconciliation

The repository's Worker sources predated the deployed Batch 76 release. This change restores the preserved release modules rather than modifying the working Worker implementation.

- Router: the complete rebuilt JavaScript matches the downloaded production bundle after trimming its trailing newline. Compared with Wrangler 4.153.0.
- Checkout: the rebuilt application section (notification delivery and checkout modules) matches production exactly: SHA-256 `99b23b73241055d065e984735d7cb462189e6d2fb084c14851bad358000d50a1`. Both bundles identify Stripe 22.6.1. Bundled dependency paths and source-map packaging differ, so this is an application-code comparison, not a claim of complete bundle identity.
- Canonical configs are `pixelping-worker/wrangler.jsonc` and `webhook-worker/wrangler.jsonc`. The obsolete router TOML is removed to avoid competing deployment configurations.
- Configs preserve live storage identities, compatibility settings, email notices, checkout activation cutoff `1793283645`, and the checkout email cron. The Wrangler property for enabled preview URLs is `preview_urls`.
- No Worker redeployment is needed just to reconcile these files. Do not run a recovery config or reset the notification cutoff during this closeout.

## Application correction

New default Dynamic links, restored links, and Command Center copies use `qr.pixelping.app`. Verified customer domains still take precedence. API endpoints continue using the existing workers.dev addresses. The old host remains an allowed routing host, so existing printed workers.dev links remain functional. Static payload behavior and the Recent/My Codes controller are unchanged. The service-worker cache version is incremented with the updated shell.

## Pending Cloudflare routing change

Apply only after production approval. Preserve the existing exact routes:

| Pattern | Worker |
| --- | --- |
| `qr.pixelping.app/*` | `pixelping-worker` |
| `test.qrking.fyi/*` | `pixelping-worker-staging` |

First add bypass routes `pixelping.app/*` and `*.pixelping.app/*` with no Worker assigned. Then add `*/*` pointing to `pixelping-worker`, with `request_limit_fail_open: false`. Exact QR and staging routes retain precedence; the bypasses keep the website, Clerk, checkout, and other PixelPing subdomains off the router. The catch-all supplies routing for registered customer hostnames. The Worker's ownership checks still reject unregistered domains and another owner's routes.

Record the IDs of newly added routes. Roll back by deleting only the new catch-all, then the new bypass routes; retain the two existing exact routes. This route plan is managed separately from the Worker upload and is not applied by committing this document.

## Validation and release order

Local checks cover routing/recovery, legacy and branded hosts, four Smart Action pages, owner isolation, checkout webhook compatibility, HTML script syntax, and the scope of hostname changes. They do not replace signed-in browser and physical scan tests.

1. Review and approve the PR and Cloudflare route plan.
2. Apply the bypasses before the catch-all; verify routing.
3. Merge the PR and wait for GitHub Pages deployment success.
4. In a fresh browser session, verify a new branded Dynamic code, edit its destination, scan it, reopen its saved design, and confirm an old workers.dev QR still opens.
5. Check Phone/SMS/Email/Coupon pages, PNG/SVG/PDF downloads, print preview, and Help/Manual navigation. Recheck Recent/My Codes in the browser.

Do not declare launch closeout complete until the production checks pass. No production mutation was performed while preparing this PR.
