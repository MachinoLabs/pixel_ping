# IndependenceQR — controlled prelaunch domain cutover
Status: **PREPARATION ONLY — NOT APPROVED FOR DEPLOYMENT**
Prepared: November 6, 2026
Repository: MachinoLabs/pixel_ping
Working branch: rebrand/independenceqr-prelaunch
Source recovery branch: backup/pre-independenceqr-2026-11-06
Draft PR: #13

## Non-negotiable constraints
- PixelPing has NOT launched and has no paying customers. Do not invent a customer migration.
- Preserve Nomad, Rebellion, Evolution, existing functionality and backend IDs. Internal `pixelping` codenames stay in place.
- No merge, production publish, Clerk domain change or DNS cutover without explicit owner approval for the coordinated cutover.
- Preserve the source backup and inspect current production configuration before modifying it.
- No blanket find/replace or refactoring.
- A GitHub branch backs up code, **not** remote Clerk settings, live Cloudflare Worker bindings/DNS, Stripe settings or Google OAuth.
- Keep the site's origin `pixelping.app` live until the coordinated transition is confirmed.

## Already prepared
- Resend `updates.independenceqr.app` verified; original sending domain retained.
- Google Cloud OAuth web client `PixelPing Web` located in the existing Google project/account. New callback `https://clerk.independenceqr.app/v1/oauth_callback` was entered alongside the old callback. **Confirm it was saved** in Google Cloud before cutover (saved state not independently read back).
- `independenceqr.app` zone active in Cloudflare with GitHub Pages A records and `www` CNAME. The site is NOT live from that domain merely because DNS records exist.
- GitHub recovery branch created from main; PR #13 stages public branding, checkout return URL and Resend sender, and draft versioned policy text/manifest. New legal documents require owner/legal review.
- Clerk Production currently uses `pixelping.app`, Google OAuth custom credentials. Clerk's express-consent setting is OFF; independent server-verified agreement occurs before checkout.

## Live dependency inventory and exact source locations
1. Website GitHub Pages: `CNAME` contains `pixelping.app`; Pages setting publishes `main` from `/ (root)`. At cutover, change the custom domain and CNAME in a coordinated release, not earlier.
2. Frontend auth: `index.html` and `admin.html` both contain old Clerk **publishable key** and script loader `https://clerk.pixelping.app/npm/@clerk/clerk-js@latest/dist/clerk.browser.js`. Clerk generates a **new** publishable key after primary domain change; do not guess it. Replace in both files only after verified change.
3. Worker auth: `pixelping-worker/wrangler.jsonc` and `webhook-worker/wrangler.jsonc` have `CLERK_ISSUER_URL=https://clerk.pixelping.app`. Confirm the real deployed bindings too; update both together with Clerk switch. Do not rotate or expose `CLERK_SECRET_KEY` absent a specific need.
4. Signup consent fallback: `pixelping-worker/src/signup_terms_source.js` pins old issuer, URLs and a deliberately disabled `validFrom=Number.POSITIVE_INFINITY`. **Keep it disabled.** The independent `terms-client.js` checkout acceptance and Worker terms API work independently. No reason to enable Clerk checkbox as part of this rebrand.
5. Policy documents: PR #13 updates `terms.html`, `privacy.html`, new versioned files and both manifests. Historical October 17 versioned files are untouched. Get explicit review of legal wording and version/effective date before release.
6. Checkout: `webhook-worker/src/index.js` embedded checkout `return_url` stages `https://independenceqr.app/?session_id={CHECKOUT_SESSION_ID}`; confirm any Stripe/dashboard return settings separately if used.
7. Email: `webhook-worker/wrangler.jsonc` stages verified sender `IndependenceQR <notifications@updates.independenceqr.app>`; `notification_delivery.js` stages new account URL/subject. Check runtime sender binding and perform email test.
8. Dynamic QR: generator/admin `index.html`, `admin.html`, and Worker routing settings still deliberately use `qr.pixelping.app`. **This is a public-facing QR host, not just a backend codename.** Decide separately whether launch will use `qr.independenceqr.app`. If yes, add the new proxied DNS record/Worker route, validate TLS, update all QR-generating references and Worker allowlists/settings, and scan-test **before** accepting new production QR codes. Do not redirect a QR hostname blindly.
9. Service worker: `pixelping-sw.js` is a same-origin script with a versioned cache. New hostname gets separate browser-origin storage; run fresh-profile and normal-profile tests and check whether staged scripts update the cache version.
10. `independenceqr.com` is owned but not configured yet. Redirect separately only after .app works and TLS is valid.
11. Legacy `pixelping.app` redirects: configure for ordinary web visits only after verifying new domain, but preserve the dedicated `qr.pixelping.app` routing behavior. Do not redirect all subdomains or Worker routes via a blanket rule.

## Controlled cutover sequence — requires go/no-go approval
### Phase A: final prepare and record baseline
- [ ] Owner approves precise draft legal text and public branding.
- [ ] Audit PR #13 diff, run syntactic/build/tests and check generated QR details, emails, payments, Clerk script loading.
- [ ] Confirm Google OAuth has **both** redirect URIs saved.
- [ ] Capture and document current GitHub Pages, Clerk, Cloudflare Worker routes/bindings and Stripe configuration (without secrets).
- [ ] Decide branded Dynamic QR hostname. Prepare matching Worker routes and target host, but do not activate untested changes.
- [ ] Choose a short maintenance/test window; have rollback references and access ready.

### Phase B: coordinated migration
- [ ] Explicit cutover approval.
- [ ] Change Clerk production primary domain to `independenceqr.app` in the existing Clerk instance. Follow generated DNS/SSL verification steps, record **new** publishable key and verify frontend hostname.
- [ ] Apply required Clerk DNS records under the new Cloudflare zone, set Clerk-specific records DNS-only where provider directs, verify certificate issuance.
- [ ] Confirm new issuer hostname and update both Worker auth bindings/settings; deploy carefully with other cutover changes.
- [ ] Update both frontend Clerk keys and SDK hosts on the isolated branch using verified values; review diff.
- [ ] Confirm Google OAuth redirect for new verified Clerk hostname.
- [ ] Finalize QR host selection/routing and check Worker/KV bindings. DO NOT change internal Worker names or storage keys.
- [ ] Merge only approved source changes into main; coordinate GitHub Pages custom domain and CNAME switch. Validate HTTPS.
- [ ] Confirm checkout return, transactional email sender and proper legal acceptance on new origin.
- [ ] Configure optional .com redirect after .app is stable.

### Phase C: acceptance checks
- [ ] New `https://independenceqr.app/` and `/admin.html` load without old Clerk errors.
- [ ] Google and email sign-in; sign-out and fresh incognito; session refresh.
- [ ] Static QR generation, print/download, phone scan and saved-name behavior.
- [ ] Dynamic QR creation, Save/Activate, Smart Cards, View QR, scan analytics, edit destination; physical scan verifies branded route host and correct payload.
- [ ] Nomad, Rebellion and Evolution entitlement/payment test flows, Stripe webhook, post-checkout return and receipt.
- [ ] Explicit Terms acknowledgment and recorded version/digest in Worker.
- [ ] Resend test delivery from `updates.independenceqr.app`.
- [ ] Help/Manual/Command Center navigation and old-host redirect only for approved routes.
- [ ] Normal browser and fresh profile cache behavior, mobile.
- [ ] Go/no-go: record exact passing evidence and release revision. If failure, stop and use coordinated rollback, not just Git revert.

## Rollback considerations
- Git code recovery: restore `main` to the verified pre-change commit/branch after owner authorization.
- Clerk domain rollback: dashboard domain, DNS/SSL and key changes need their own coordinated reverse sequence; source rollback alone is insufficient.
- GitHub Pages custom-domain and `CNAME`, DNS, checkout URL, Worker issuer and routes require corresponding rollback.
- Do not delete original domain zone or stored QR routes during rebrand; no paying customers exist, but functional test records do.

## Current status
Draft PR #13 is NOT mergeable as a complete deployment unit until new Clerk publishable key, issuer and hostname/domain steps are verified and inserted. This document is a runbook, not an authorization to perform production changes.
