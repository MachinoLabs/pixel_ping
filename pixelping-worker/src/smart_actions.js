// Batch 25: one shared typed-action validator and automatic server-rendered page.
// No page builder, arbitrary HTML, remote assets, provider writes, or client payload URLs.
const ACTION_KINDS = Object.freeze(['phone', 'sms', 'email', 'coupon']);
const ACTION_LABELS = Object.freeze({ phone: 'Call now', sms: 'Send a message', email: 'Send an email', coupon: 'Copy Coupon Code' });
const ACTION_TITLES = Object.freeze({ phone: "Let's talk.", sms: 'Start a conversation.', email: 'Get in touch.', coupon: 'An offer for you.' });
const actionControls = /[\u0000-\u001f\u007f]/;
function onlyKeys(value, allowed) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).every(key => allowed.includes(key));
}
function actionText(value, max, optional = false) {
  if (typeof value !== 'string' || value.length > max || actionControls.test(value)) return null;
  const text = value.trim();
  return text || (optional ? '' : null);
}
function actionMessage(value, max) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return null;
  const text = value.replace(/\r\n/g, '\n');
  return text.includes('\r') ? null : text;
}
function actionPhone(value) {
  return typeof value === 'string' && /^\+[1-9][0-9]{6,14}$/.test(value) ? value : null;
}
function actionEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || actionControls.test(value) || value.includes('..')) return null;
  // Restrict URI-reserved delimiters so a recipient can never create extra headers.
  if (!/^[A-Za-z0-9.!$'*+_~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\.[A-Za-z]{2,}$/.test(value)) return null;
  const at = value.lastIndexOf('@');
  const domain = value.slice(at + 1);
  if (value.slice(0, at).length > 64 || value.startsWith('.') || value[at - 1] === '.' ||
      domain.split('.').some(label => !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?$/.test(label))) return null;
  return value.slice(0, at) + '@' + domain.toLowerCase();
}
export function safeOfferUrl(value) {
  if (typeof value !== 'string' || value.length > 2048 || /[\u0000-\u0020\u007f\\]/.test(value)) return null;
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') ||
        !host.includes('.') || host.endsWith('.') || /(?:^|\.)(?:localhost|local|internal)$/.test(host) || host.includes(':')) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a,b] = host.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
          (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
    }
    return url.toString();
  } catch { return null; }
}
export function validateSmartAction(raw) {
  if (!onlyKeys(raw, ['kind','action','brand','title']) || !ACTION_KINDS.includes(raw.kind) ||
      !onlyKeys(raw.brand, ['businessName','description','logoAssetId'])) return null;
  const businessName = actionText(raw.brand.businessName, 64);
  const description = actionText(raw.brand.description ?? '', 180, true);
  // Reserve the optional business-logo slot. An owner-verified raster upload
  // pipeline is not shipped in Stage1; unvetted references/URLs are rejected.
  if (!businessName || description === null || (raw.brand.logoAssetId ?? null) !== null) return null;
  const title = actionText(raw.title ?? businessName, 120);
  if (!title) return null;
  let action;
  if (raw.kind === 'phone') {
    if (!onlyKeys(raw.action, ['phone'])) return null;
    const phone = actionPhone(raw.action.phone);
    if (!phone) return null;
    action = { phone };
  } else if (raw.kind === 'sms') {
    if (!onlyKeys(raw.action, ['phone','message'])) return null;
    const phone = actionPhone(raw.action.phone);
    const message = actionMessage(raw.action.message ?? '', 320);
    if (!phone || message === null) return null;
    action = { phone, message };
  } else if (raw.kind === 'email') {
    if (!onlyKeys(raw.action, ['email','subject','message'])) return null;
    const email = actionEmail(raw.action.email);
    const subject = actionText(raw.action.subject ?? '', 140, true);
    const message = actionMessage(raw.action.message ?? '', 800);
    if (!email || subject === null || message === null) return null;
    action = { email, subject, message };
  } else {
    if (!onlyKeys(raw.action, ['code','note','redeemUrl'])) return null;
    const code = actionText(raw.action.code, 40);
    const note = actionText(raw.action.note ?? '', 140, true);
    const redeemUrl = raw.action.redeemUrl == null || raw.action.redeemUrl === '' ? null : safeOfferUrl(raw.action.redeemUrl);
    if (!code || note === null || (raw.action.redeemUrl != null && raw.action.redeemUrl !== '' && !redeemUrl)) return null;
    action = { code, note, redeemUrl };
  }
  return { kind: raw.kind, action, brand: { businessName, description, logoAssetId: null }, title };
}
const escapeActionHtml = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function actionPresentation(data) {
  const a = data.action;
  if (data.kind === 'phone') return { detail: a.phone, href: `tel:${a.phone}`, helper: 'Opens your device dialer. No call is placed automatically.', label: 'CALL', eyebrow: "LET'S CONNECT" };
  if (data.kind === 'sms') return { detail: a.phone, href: `sms:${a.phone}${a.message ? '?body=' + encodeURIComponent(a.message) : ''}`, helper: 'Opens your messaging app with a prepared message. Nothing is sent automatically.', label: 'MESSAGE', eyebrow: 'START A CONVERSATION' };
  if (data.kind === 'email') {
    const query = [];
    if (a.subject) query.push('subject=' + encodeURIComponent(a.subject));
    if (a.message) query.push('body=' + encodeURIComponent(a.message));
    return { detail: a.email, href: `mailto:${a.email}${query.length ? '?' + query.join('&') : ''}`, helper: 'Opens your default email app. Nothing is sent automatically.', label: 'EMAIL', eyebrow: "WE'RE ALL EARS" };
  }
  return { detail: a.code, href: null, helper: a.note || 'Copy this code to use it with the business.', label: 'OFFER', eyebrow: 'JUST FOR YOU' };
}
const actionPageCss = ":root {\n  color-scheme: light;\n  --ink: #172e36;\n  --ink-soft: #39505a;\n  --mist: #f5f7f5;\n  --white: #ffffff;\n  --teal: #276962;\n  --teal-deep: #205750;\n  --line: #e1e8e4;\n  --sage: #e8efe9;\n  --muted: #7a8b87;\n  font-family: ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif;\n  font-synthesis: none;\n}\n* { box-sizing: border-box; }\nhtml { min-height: 100%; }\nbody { margin: 0; }\nbutton, a { -webkit-tap-highlight-color: transparent; }\nbutton { font: inherit; }\na { color: inherit; }\n:focus-visible { outline: 3px solid #c28b3e; outline-offset: 4px; }\n.symbols { position: absolute; overflow: hidden; }\n.site-mark { width: 25px; height: 25px; flex: 0 0 25px; display: grid; grid-template-columns: repeat(2, 9px); grid-template-rows: repeat(2, 9px); gap: 3px; }\n.site-mark span { background: #f1f5ef; border-radius: 2px; }\n.site-mark span:nth-child(4) { background: #98bcb2; }\n\n/* Real customer-facing action page concept */\n.action-body { background: radial-gradient(circle at 50% 7%, #edf2ed 0, #f5f7f5 44%, #f8f9f7 100%); color: var(--ink); min-height: 100vh; }\n.action-layout { min-height: 100vh; max-width: 510px; margin: auto; padding: 34px 24px 26px; display: flex; flex-direction: column; align-items: center; }\n.action-branding { width: 100%; display: flex; align-items: center; justify-content: center; gap: 12px; margin-bottom: 32px; }\n.action-branding .site-mark span { background: #315d58; }\n.action-branding .site-mark span:nth-child(4) { background: #97b5a9; }\n.brand-wordmark { font-size: 10px; letter-spacing: .17em; font-weight: 800; color: #45625e; }\n.brand-separator { opacity: .3; padding: 0 7px; }\n.action-card { width: 100%; position: relative; overflow: hidden; background: var(--white); border: 1px solid #e4ebe6; border-radius: 25px; box-shadow: 0 26px 68px rgba(31,62,56,.08), 0 2px 7px rgba(31,62,56,.025); }\n.action-card[hidden] { display: none; }\n.card-edge { position: absolute; top: 0; left: 0; right: 0; height: 5px; background: linear-gradient(90deg,#d7e2d9 0%,#65988d 48%,#294f4c 100%); }\n.brand-row { display: flex; gap: 12px; align-items: center; padding: 27px 30px 24px; border-bottom: 1px solid #edf1ee; }\n.monogram { width: 45px; height: 45px; display: grid; place-items: center; flex: 0 0 45px; border-radius: 13px; background: #e5eeea; color: #2a6058; font-size: 20px; font-weight: 800; }\n.company-lines { min-width: 0; display: flex; flex-direction: column; gap: 5px; }\n.company-eyebrow { font-size: 9px; letter-spacing: .15em; color: #82918c; font-weight: 700; }\n.company-name { font-size: 16px; color: var(--ink); font-weight: 760; letter-spacing: -.02em; line-height: 1.25; overflow-wrap: anywhere; }\n.card-main { text-align: center; padding: 36px 34px 31px; }\n.icon-medallion { width: 76px; height: 76px; border-radius: 24px; background: #eff4f0; border: 1px solid #e2ebe3; display: grid; place-items: center; margin: 0 auto 27px; }\n.action-icon { width: 32px; height: 32px; fill: none; stroke: #376b62; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }\n.eyebrow { font-size: 10px; letter-spacing: .19em; font-weight: 850; color: #5b8177; margin: 0 0 13px; }\n.action-card h1 { font-size: clamp(27px,6vw,34px); letter-spacing: -.055em; font-weight: 750; line-height: 1.16; margin: 0 auto 13px; max-width: 330px; }\n.description { font-size: 14px; line-height: 1.7; color: #6f807c; margin: 0 auto 31px; max-width: 310px; }\n.detail-pane { margin: 0 auto 20px; padding: 17px 18px 18px; border: 1px solid #e4eae4; background: #fafbfa; border-radius: 13px; display: flex; gap: 8px; flex-direction: column; max-width: 335px; }\n.detail-label { font-size: 9px; letter-spacing: .15em; font-weight: 800; color: #82918c; }\n.detail-value { font-size: 17px; color: #27454b; font-weight: 740; line-height: 1.35; overflow-wrap: anywhere; user-select: text; }\n.primary-action { display: flex; align-items: center; justify-content: center; gap: 17px; max-width: 335px; min-height: 58px; margin: auto; width: 100%; padding: 14px 18px; font-size: 15px; line-height: 1.3; font-weight: 770; text-decoration: none; background: var(--teal); color: white; border: 1px solid var(--teal); border-radius: 12px; cursor: pointer; transition: background .17s ease, transform .17s ease; }\n.primary-action:hover { background: var(--teal-deep); transform: translateY(-1px); }\n.primary-action svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }\n.primary-action[hidden] { display: none; }\n.helper { font-size: 11px; line-height: 1.65; color: #8a9692; margin: 18px auto 0; max-width: 300px; }\n.status-message { font-size: 12px; color: #2c7358; margin: 8px 0 0; min-height: 19px; }\n.card-footer { display: flex; align-items: center; justify-content: center; gap: 9px; background: #f9fbf9; border-top: 1px solid #edf1ee; padding: 19px 15px; color: #879790; font-size: 11px; }\n.foot-accent { width: 5px; height: 5px; border-radius: 50%; background: #80a79b; }\n.page-footer { margin-top: 25px; font-size: 10px; color: #8b9b95; display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }\n.page-footer strong { color: #44665d; }\n.foot-dot { width: 3px; height: 3px; border-radius: 50%; align-self: center; background: #a1b0a8; }\n.demo-disclaimer { margin: auto 0 0; padding-top: 28px; color: #a0aaa4; font-size: 9px; letter-spacing: .075em; text-align: center; line-height: 1.6; }\n.unavailable { border: 1px solid #dae2dd; background: white; border-radius: 16px; color: #39524c; padding: 30px; text-align: center; line-height: 1.6; }\n\n\n.page-footer { margin-top: auto; padding-top: 25px; }\n.page-footer a { text-decoration: none; }\n.page-footer a:hover { text-decoration: underline; }\n.business-logo { width: 45px; height: 45px; flex: 0 0 45px; object-fit: contain; border-radius: 13px; }\n.secondary-action { background: white; color: var(--teal); margin-top: 12px; }\n.secondary-action:hover { background: var(--sage); }\n@media(max-width: 520px) { .action-layout { padding: 26px 15px 20px; } .action-branding { margin-bottom: 22px; } .brand-row { padding: 23px 22px 20px; } .card-main { padding: 28px 23px 24px; } .action-card h1 { font-size: 29px; } .icon-medallion { width: 68px; height: 68px; margin-bottom: 23px; } }\n@media(prefers-reduced-motion: reduce) { *, *::before, *::after { transition: none !important; animation: none !important; } }\n";
const actionCopyScript = "const copy = document.getElementById('copy-action');\nif (copy) copy.addEventListener('click', async () => {\n  const status = document.getElementById('status');\n  try {\n    if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');\n    await navigator.clipboard.writeText(copy.dataset.code);\n    document.getElementById('copy-text').textContent = 'Copied';\n    status.textContent = 'Coupon code copied to your clipboard.';\n  } catch {\n    status.textContent = 'Clipboard unavailable. Select the coupon code above to copy it manually.';\n  }\n});";
const actionSymbols = "  <svg xmlns=\"http://www.w3.org/2000/svg\" aria-hidden=\"true\" width=\"0\" height=\"0\" class=\"symbols\">\n    <symbol id=\"ico-phone\" viewBox=\"0 0 24 24\"><path d=\"M8.2 3.6 10 7.3 7.9 9.1c1.3 2.8 3.1 4.6 6 6l1.8-2 3.7 1.8-.8 4.1c-.2.9-1 1.5-2 1.5C9.5 20.5 3.5 14.5 3.5 7.1c0-1 .6-1.8 1.5-2l3.2-1.5Z\"/></symbol>\n    <symbol id=\"ico-sms\" viewBox=\"0 0 24 24\"><path d=\"M20 11.5c0 4.4-3.8 7.9-8.5 7.9-1.3 0-2.6-.3-3.7-.8l-3.5 1 1-3.3c-1.5-1.4-2.3-3.1-2.3-4.8 0-4.3 3.8-7.9 8.5-7.9S20 7.2 20 11.5Z\"/><path d=\"M7.7 11.5h8.1M7.7 14.4h5.5\"/></symbol>\n    <symbol id=\"ico-email\" viewBox=\"0 0 24 24\"><rect x=\"3.5\" y=\"5.5\" width=\"17\" height=\"13\" rx=\"2\"/><path d=\"m4.5 7 7.5 5.8L19.5 7\"/></symbol>\n    <symbol id=\"ico-coupon\" viewBox=\"0 0 24 24\"><path d=\"M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5V10a2 2 0 0 0 0 4v2.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5V14a2 2 0 0 0 0-4V7.5Z\"/><path d=\"M12 7v10\" stroke-dasharray=\"2 2\"/></symbol>\n    <symbol id=\"ico-arrow\" viewBox=\"0 0 24 24\"><path d=\"M4 12h16m-6-6 6 6-6 6\"/></symbol>\n    <symbol id=\"ico-check\" viewBox=\"0 0 24 24\"><path d=\"m5 12 4.2 4.3L19 7\"/></symbol>\n  </svg>\n";
const actionHeader = "    <header class=\"action-branding\">\n      <span class=\"site-mark\" aria-hidden=\"true\"><span></span><span></span><span></span><span></span></span>\n      <span class=\"brand-wordmark\">PIXELPING <span class=\"brand-separator\">/</span> SMART ACTIONS</span>\n    </header>\n";
const actionPageCsp = "default-src 'none'; style-src 'sha256-Uvn1AFLRSa1zttMe01GYFtvtIztI45h9x2W3RBvto8Y='; script-src 'sha256-O5MrKhnW6kCtbwJP0Z0Is58rcjivEgYQafRuWhZDMjU='; img-src data:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

// logoDataUrl is a server-only display hook for a future owner-verified,
// re-encoded raster asset. It is never accepted from the action API or QR URL.
export function renderSmartAction(record, logoDataUrl = null) {
  const data = validateSmartAction({ kind: record.kind, action: record.action, brand: record.brand, title: record.title });
  if (!data) throw new Error('Invalid stored action');
  const view = actionPresentation(data);
  const e = escapeActionHtml;
  const letter = data.brand.businessName.match(/[\p{L}\p{N}]/u)?.[0].toUpperCase() || '?';
  const safeLogo = typeof logoDataUrl === 'string' && logoDataUrl.length <= 300000 &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(logoDataUrl);
  const logo = safeLogo ? `<img class="business-logo" id="business-logo" src="${e(logoDataUrl)}" alt="${e(data.brand.businessName)} logo">` :
    `<div id="monogram" class="monogram" aria-hidden="true">${e(letter)}</div>`;
  const arrow = '<svg aria-hidden="true"><use href="#ico-arrow"></use></svg>';
  const button = data.kind === 'coupon' ?
    `<button class="primary-action" id="copy-action" type="button" data-code="${e(view.detail)}"><span id="copy-text">Copy Coupon Code</span>${arrow}</button>` :
    `<a class="primary-action" id="native-action" href="${e(view.href)}" rel="nofollow"><span id="button-text">${ACTION_LABELS[data.kind]}</span>${arrow}</a>`;
  const redemption = data.kind === 'coupon' && data.action.redeemUrl ?
    `<a class="primary-action secondary-action" id="redeem-action" href="${e(data.action.redeemUrl)}" rel="nofollow noreferrer">Redeem Offer${arrow}</a>` : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#f5f7f5"><title>${e(data.brand.businessName)} - ${view.label} | PixelPing</title><style>${actionPageCss}</style></head>
<body class="action-body">${actionSymbols}<div class="action-layout">${actionHeader}
<main class="action-card" id="action-card" aria-labelledby="action-title"><div class="card-edge" aria-hidden="true"></div>
<div class="brand-row">${logo}<div class="company-lines"><span class="company-eyebrow">A QUICK WAY TO CONNECT</span><span id="business-name" class="company-name">${e(data.brand.businessName)}</span></div></div>
<div class="card-main"><div class="icon-medallion"><svg class="action-icon" aria-hidden="true"><use id="action-symbol" href="#ico-${data.kind}"></use></svg></div>
<p id="action-kind" class="eyebrow">${view.eyebrow}</p><h1 id="action-title">${ACTION_TITLES[data.kind]}</h1><p class="description" id="action-description">${e(data.brand.description)}</p>
<div class="detail-pane"><span class="detail-label" id="detail-label">${view.label}</span><span class="detail-value" id="detail-value">${e(view.detail)}</span></div>
${button}${redemption}<p class="helper" id="helper">${e(view.helper)}</p><p class="status-message" id="status" role="status" aria-live="polite"></p></div>
<div class="card-footer"><span class="foot-accent" aria-hidden="true"></span><span>Thoughtful connections, made simple.</span></div></main>
<footer class="page-footer"><a id="powered-by" href="https://pixelping.app/">Powered by <strong>PixelPing</strong></a><span class="foot-dot" aria-hidden="true"></span><span>Print once. Change anytime.</span></footer></div>
${data.kind === 'coupon' ? '<script>' + actionCopyScript + '</script>' : ''}</body></html>`;
  return new Response(html, { status: 200, headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store',
    'Content-Security-Policy': actionPageCsp, 'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'X-Robots-Tag': 'noindex, nofollow'
  } });
}
