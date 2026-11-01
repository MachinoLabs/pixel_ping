/* Batch 71: Arsenal recipes enter through the existing Canvas protection flow. */
document.addEventListener('DOMContentLoaded', () => {
    const arsenalPlays = {
    "tip-jar": {
        "payload": "url",
        "ctaText": "Scan to tip",
        "printSize": "2in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Frictionless Tip Jar",
        "number": 9,
        "mode": "static",
        "layout": "label",
        "instructions": "Paste a payment-page URL you control (for example, a tip page). For a crypto wallet instead, choose Crypto under QR Content and supply your own wallet.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "ghost-trainer": {
        "payload": "url",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Ghost Trainer",
        "number": 22,
        "mode": "static",
        "layout": "label",
        "instructions": "Add the tutorial URL for this specific machine. Branding and a printed headline can be added with Master Key.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "cloud-clipboard": {
        "payload": "url",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Cloud Clipboard",
        "number": 21,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your existing document or sheet URL. Choose its sharing permissions deliberately; PixelPing does not create the document or grant access.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "stealth-merch": {
        "payload": "url",
        "ctaText": "",
        "printSize": "2in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Stealth Merch Loop",
        "number": 16,
        "mode": "static",
        "layout": "label",
        "instructions": "Add the exact product or cart URL. Any cart setup or affiliate tracking belongs to your store. Test the actual garment and print size.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "phantom-speakeasy": {
        "payload": "url",
        "ctaText": "Unlock Secret Menu",
        "printSize": "3.5in",
        "dataColor": "#182b3a",
        "eyeColor": "#182b3a",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Phantom Speakeasy Menu",
        "number": 43,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add your menu URL. Update the Evolution destination when needed; test the code on the actual coaster or menu material.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "contractor-sticky": {
        "payload": "sms",
        "ctaText": "Scan for Emergency Service",
        "printSize": "2in",
        "dataColor": "#e11d48",
        "eyeColor": "#9f1239",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Contractor Sticky-Trap",
        "number": 1,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the service phone number and customize the message. Scanning opens a text draft; the customer sends it.",
        "inputs": {
            "pl-sms-msg": "I need service for [EQUIPMENT] at [ADDRESS]. Please contact me."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "golden-ticket": {
        "payload": "url",
        "ctaText": "Unlock VIP Unboxing",
        "printSize": "3.5in",
        "dataColor": "#000000",
        "eyeColor": "#182b3a",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The E-Commerce Golden Ticket",
        "number": 3,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add your existing warranty or VIP tutorial page URL. PixelPing routes to that page; it does not create a registration service.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "wifi-trojan": {
        "payload": "wifi",
        "ctaText": "Connect to Cafe Wi-Fi",
        "printSize": "3.5in",
        "dataColor": "#0ea5e9",
        "eyeColor": "#0369a1",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Wi-Fi Trojan Horse",
        "number": 4,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter your network details. A Wi-Fi QR offers a connection; email capture requires a separately configured captive portal on your network.",
        "inputs": {},
        "required": [
            "pl-wifi-ssid"
        ]
    },
    "silent-salesman": {
        "payload": "url",
        "ctaText": "",
        "printSize": "2in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Silent Salesman Audio Tour",
        "number": 8,
        "mode": "static",
        "layout": "label",
        "instructions": "Add a hosted audio or video URL. Opening hosted content requires an internet connection.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "hacker-card": {
        "payload": "wifi",
        "ctaText": "Scan to Connect",
        "printSize": "3.5in",
        "dataColor": "#182b3a",
        "eyeColor": "#182b3a",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Hacker's Business Card",
        "number": 50,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter your hotspot network details. The Wi-Fi QR does not force a connection or configure a captive portal; those depend on the device and network.",
        "inputs": {},
        "required": [
            "pl-wifi-ssid"
        ]
    },
    "silent-hall-pass": {
        "payload": "url",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Silent Hall Pass",
        "number": 26,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your classroom website or read-only schedule URL. The reader needs access to that destination.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "waiting-room": {
        "payload": "url",
        "ctaText": "Scan to Check In",
        "printSize": "3.5in",
        "dataColor": "#0369a1",
        "eyeColor": "#075985",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Waiting Room Fast-Pass",
        "number": 27,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your existing secure intake-form URL. The form provider and clinic handle patient-data access, integration and compliance.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "superhost-concierge": {
        "payload": "url",
        "ctaText": "Scan for Local Eats",
        "printSize": "2in",
        "dataColor": "#be123c",
        "eyeColor": "#9f1239",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Superhost Concierge",
        "number": 28,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "This opens the changing Local Eats link. For an appliance tutorial sticker, choose Static URL and add that tutorial’s address.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "kennel-breakout": {
        "payload": "url",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Kennel Breakout",
        "number": 29,
        "mode": "static",
        "layout": "label",
        "instructions": "Add this animal’s hosted video URL. Give the reader a clear reason to scan; test the printed kennel card.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "seed-to-table": {
        "payload": "url",
        "ctaText": "Meet the Farmer",
        "printSize": "2in",
        "dataColor": "#4d7c0f",
        "eyeColor": "#3f6212",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Seed-to-Table Flex",
        "number": 30,
        "mode": "static",
        "layout": "label",
        "instructions": "Add the producer’s video URL. Check contrast and scanning on the final package, especially on curved surfaces.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "digital-tip-in": {
        "payload": "url",
        "ctaText": "Tonight's Secret Setlist",
        "printSize": "3.5in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Digital Tip-In",
        "number": 31,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the current setlist or promotion URL. Place stickers only where you have permission; update destinations yourself.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "line-buster": {
        "payload": "url",
        "ctaText": "Skip Line: Scan to Order",
        "printSize": "3.5in",
        "dataColor": "#182b3a",
        "eyeColor": "#c2410c",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Line-Buster",
        "number": 32,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your existing mobile ordering URL. Your ordering service handles checkout and fulfillment; test the final sign at its intended distance.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "instant-rma": {
        "payload": "sms",
        "ctaText": "Text Founder Directly",
        "printSize": "2in",
        "dataColor": "#2563eb",
        "eyeColor": "#1d4ed8",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Instant RMA",
        "number": 33,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the support phone and customize the damaged-order message. The customer supplies the order number and attaches photos manually.",
        "inputs": {
            "pl-sms-msg": "My order [ORDER NUMBER] arrived damaged. Please help me with the next steps."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "ghost-tour": {
        "payload": "text",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Ghost Tour",
        "number": 34,
        "mode": "static",
        "layout": "label",
        "instructions": "This is the offline Text variant. Replace the text with the story for this stop. For hosted audio instead, choose URL; audio links need connectivity.",
        "inputs": {
            "pl-text": "[STOP NAME]\n[SHORT HISTORICAL STORY]"
        },
        "required": [
            "pl-text"
        ]
    },
    "test-drive": {
        "payload": "url",
        "ctaText": "Virtual Test Drive",
        "printSize": "3.5in",
        "dataColor": "#dc2626",
        "eyeColor": "#991b1b",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The POV Test Drive",
        "number": 35,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the video URL for the specific vehicle. Upload your dealership logo if desired; the preset does not create a video.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "wreck-report": {
        "payload": "sms",
        "ctaText": "Scan if in Accident",
        "printSize": "3.5in",
        "dataColor": "#b91c1c",
        "eyeColor": "#7f1d1d",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Wreck Report",
        "number": 36,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the claims contact and customize the draft. The sender supplies incident information and attaches any photos manually.",
        "inputs": {
            "pl-sms-msg": "I was involved in an accident at [LOCATION]. My policy is [POLICY NUMBER]. Please contact me about the next steps."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "trojan-mailer": {
        "payload": "url",
        "ctaText": "Scan to Unlock",
        "printSize": "2in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Trojan Horse Mailer",
        "number": 37,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add your personalized pitch URL. This recipe uses Evolution so the destination can be changed; a fixed URL can also be made in Static mode.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "zero-day": {
        "payload": "text",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Zero-Day Protocol",
        "number": 38,
        "mode": "static",
        "layout": "label",
        "instructions": "Replace the bracketed fields with a recovery checklist and the location of controlled recovery materials. Do not place passwords or recovery secrets in ordinary QR text.",
        "inputs": {
            "pl-text": "Recovery contact: [CONTACT]\nChecklist: [RECOVERY STEPS]\nControlled recovery materials: [LOCATION]"
        },
        "required": [
            "pl-text"
        ]
    },
    "frictionless-reorder": {
        "payload": "email",
        "ctaText": "Scan to Reorder",
        "printSize": "3.5in",
        "dataColor": "#0369a1",
        "eyeColor": "#075985",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Frictionless Re-Order",
        "number": 39,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the supplier address and replace the bracketed part, quantity and delivery details in the subject and message.",
        "inputs": {
            "pl-email-sub": "Reorder: [PART NUMBER]",
            "pl-action-email-message": "Please send [QUANTITY] units of [ITEM] to [DELIVERY LOCATION]. Please confirm availability and price."
        },
        "required": [
            "pl-email-to",
            "pl-email-sub",
            "pl-action-email-message"
        ]
    },
    "ceramic-passport": {
        "payload": "url",
        "ctaText": "Wash Instructions & Warranty",
        "printSize": "2in",
        "dataColor": "#182b3a",
        "eyeColor": "#475569",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Ceramic Shield Passport",
        "number": 40,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add your care and warranty page URL. This recipe uses Evolution for destination changes; use a Static URL for a fixed destination if preferred.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "mortgage-fast-track": {
        "payload": "url",
        "ctaText": "Scan to Jump the Line",
        "printSize": "3.5in",
        "dataColor": "#182b3a",
        "eyeColor": "#182b3a",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Mortgage Fast-Track",
        "number": 41,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your lender’s existing secure upload portal URL. The lender handles document security and the approval process.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "living-benefits": {
        "payload": "url",
        "ctaText": "Live Benefits Dashboard",
        "printSize": "3.5in",
        "dataColor": "#2563eb",
        "eyeColor": "#1e3a8a",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Living Benefits Card",
        "number": 42,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the benefits dashboard URL. Protect employee-specific information with the destination’s access controls.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "guardian-angel": {
        "payload": "sms",
        "ctaText": "I Found Your Child",
        "printSize": "2in",
        "dataColor": "#dc2626",
        "eyeColor": "#991b1b",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Guardian Angel Band",
        "number": 44,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the parent or guardian contact and customize the found-child message. Anyone scanning can see the contact number; follow venue procedures.",
        "inputs": {
            "pl-sms-msg": "I found your child. I am at [LOCATION]. Please contact venue staff."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "guerrilla-pothole": {
        "payload": "email",
        "ctaText": "Report Pothole to City",
        "printSize": "3.5in",
        "dataColor": "#182b3a",
        "eyeColor": "#9a3412",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Guerrilla Pothole",
        "number": 45,
        "mode": "static",
        "layout": "label",
        "instructions": "This is the Email variant. Enter the city contact address and replace [LOCATION]. Use safe, permitted sign placement.",
        "inputs": {
            "pl-email-sub": "Pothole report: [LOCATION]",
            "pl-action-email-message": "I would like to report a pothole at [LOCATION]. Please advise on the repair request."
        },
        "required": [
            "pl-email-to",
            "pl-email-sub",
            "pl-action-email-message"
        ]
    },
    "vip-fast-pass": {
        "payload": "sms",
        "ctaText": "Order Bottle Service",
        "printSize": "2in",
        "dataColor": "#182b3a",
        "eyeColor": "#182b3a",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The VIP Fast-Pass",
        "number": 46,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the service phone and replace [TABLE]. The scan opens an order-request text, not a completed payment or confirmed order.",
        "inputs": {
            "pl-sms-msg": "Table [TABLE] would like [ORDER]. Please confirm."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "drive-by-capture": {
        "payload": "sms",
        "ctaText": "Get Price & Tour",
        "printSize": "3.5in",
        "dataColor": "#1e40af",
        "eyeColor": "#1e3a8a",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Drive-By Real Estate Capture",
        "number": 5,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the agent’s phone and replace [PROPERTY ADDRESS]. The customer sends the inquiry from their own phone.",
        "inputs": {
            "pl-sms-msg": "I am outside [PROPERTY ADDRESS]. Can I get the price and a video tour?"
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "podcast-hijack": {
        "payload": "url",
        "ctaText": "Hear the True Story",
        "printSize": "3.5in",
        "dataColor": "#182b3a",
        "eyeColor": "#191414",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Podcast Hijack",
        "number": 47,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add your episode URL. This recipe uses Evolution for destination changes. Playback and any start time depend on the listening app.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "digital-tip-sheet": {
        "payload": "url",
        "ctaText": "Loved the Tour? Tip Here",
        "printSize": "2in",
        "dataColor": "#047857",
        "eyeColor": "#064e3b",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Digital Tip-Sheet",
        "number": 48,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your payment-page URL. For a crypto wallet instead, choose Crypto and supply your own wallet. An uploaded headshot is branding, not payment verification.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "infinite-tombstone": {
        "payload": "url",
        "ctaText": "Living Digital Memorial",
        "printSize": "2in",
        "dataColor": "#334155",
        "eyeColor": "#0f172a",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Infinite Tombstone",
        "number": 49,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the hosted memorial URL. Maintain the website and routing service for the intended lifetime of the physical marker.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "ghost-card": {
        "payload": "vcard",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Ghost Card",
        "number": 2,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter your contact details. The reader reviews and saves the contact on their phone. Use a high-contrast print and test it before ordering cards.",
        "inputs": {},
        "required": [
            "pl-vc-first",
            "pl-vc-phone"
        ]
    },
    "living-wallet": {
        "payload": "url",
        "ctaText": "Scan to see what's new",
        "printSize": "3.5in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Living Wallet Card",
        "number": 6,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the current promotion URL. With Evolution, change the destination later without reprinting the card.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "etsy-boomerang": {
        "payload": "sms",
        "ctaText": "I found your item",
        "printSize": "2in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Etsy Boomerang Business",
        "number": 7,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter the owner’s contact number and customize the found-item message. The finder supplies their location before sending.",
        "inputs": {
            "pl-sms-msg": "I found your [ITEM]. I am at [LOCATION]. Please contact me."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "wedding-invite": {
        "payload": "url",
        "ctaText": "Scan for Wedding Details",
        "printSize": "3.5in",
        "dataColor": "#333333",
        "eyeColor": "#333333",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Disaster-Proof Wedding Invite",
        "number": 10,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add your RSVP or wedding-information URL. With Evolution, update the destination for later event details or photos.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "infinite-billboard": {
        "payload": "url",
        "ctaText": "Scan for this week's Local Deal",
        "printSize": "8in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Infinite Billboard",
        "number": 11,
        "mode": "dynamic",
        "layout": "poster",
        "instructions": "Add the current campaign URL. Poster starts with a US Letter preview; scale the SVG for larger placements and test the actual print.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "apparel-egg": {
        "payload": "url",
        "ctaText": "Unlock Exclusive Drop",
        "printSize": "2in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Apparel Easter Egg",
        "number": 12,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the current drop or playlist URL. Update the Evolution destination yourself when the campaign changes; no schedule is created.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "offline-survival-cache": {
        "payload": "text",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Offline Survival Cache",
        "number": 13,
        "mode": "static",
        "layout": "label",
        "instructions": "Replace the bracketed fields with a short emergency note. Anyone who scans the printed text can read it. Test your intended phone and print size.",
        "inputs": {
            "pl-text": "Emergency contact: [CONTACT]\nRendezvous point: [LOCATION]\nImportant note: [NOTE]"
        },
        "required": [
            "pl-text"
        ]
    },
    "time-capsule": {
        "payload": "url",
        "ctaText": "Scan this on our anniversary",
        "printSize": "2in",
        "dataColor": "#182b3a",
        "eyeColor": "#182b3a",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Digital Time Capsule",
        "number": 14,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your hosted video or memory URL. Keep that destination available for as long as the gift is intended to work.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "resume-bypass": {
        "payload": "url",
        "ctaText": "Scan to see me in action",
        "printSize": "3.5in",
        "dataColor": "#1e3a8a",
        "eyeColor": "#1e40af",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Resume Bypass",
        "number": 15,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your portfolio or introduction-video URL. Uploading a headshot is optional and remains your choice.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "conference-hitman": {
        "payload": "sms",
        "ctaText": "Scan my badge",
        "printSize": "3.5in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The B2B Conference Hitman",
        "number": 17,
        "mode": "static",
        "layout": "label",
        "instructions": "Enter your business phone and customize the inquiry. The reader fills in their details and sends the text.",
        "inputs": {
            "pl-sms-msg": "I would like to discuss [SERVICE]. My name is [NAME] and my email is [EMAIL]."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "industrial-manual": {
        "payload": "text",
        "ctaText": "",
        "printSize": "3.5in",
        "dataColor": "#27cfff",
        "eyeColor": "#3cff8f",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "free",
        "name": "The Read-Only Industrial Manual",
        "number": 18,
        "mode": "static",
        "layout": "label",
        "instructions": "Replace the bracketed text with a short, verified equipment reference. This is not a replacement for the equipment’s operating manual.",
        "inputs": {
            "pl-text": "Equipment: [EQUIPMENT]\nReference: [SHORT VERIFIED INSTRUCTIONS]\nFull manual: [MANUAL LOCATION]"
        },
        "required": [
            "pl-text"
        ]
    },
    "willy-wonka": {
        "payload": "url",
        "ctaText": "Find the Golden Ticket",
        "printSize": "8in",
        "dataColor": "#182b3a",
        "eyeColor": "#b45309",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Gamified Mural",
        "number": 19,
        "mode": "dynamic",
        "layout": "poster",
        "instructions": "This is the winning-code preset. Add the prize URL. Create separate Static Text codes saying “Try again” for losing entries; this preset does not generate a 100-code campaign.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "equipment-tag": {
        "payload": "text",
        "ctaText": "Reward if found",
        "printSize": "2in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Proof of Life Equipment Tag",
        "number": 20,
        "mode": "static",
        "layout": "label",
        "instructions": "Replace the bracketed equipment and owner details. Keep the printed contact information suitable for public viewing.",
        "inputs": {
            "pl-text": "Property of [OWNER]\nEquipment: [ITEM]\nSerial: [SERIAL]\nIf found, contact [CONTACT]"
        },
        "required": [
            "pl-text"
        ]
    },
    "glovebox-ledger": {
        "payload": "url",
        "ctaText": "Maintenance History",
        "printSize": "2in",
        "dataColor": "#1e40af",
        "eyeColor": "#1e3a8a",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Glovebox Ledger",
        "number": 23,
        "mode": "dynamic",
        "layout": "label",
        "instructions": "Add the service-record URL supplied by your shop. Use the record system’s access controls for customer-specific information.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "curb-appeal": {
        "payload": "sms",
        "ctaText": "I want a quote",
        "printSize": "8in",
        "dataColor": "#166534",
        "eyeColor": "#14532d",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Curb Appeal Capture",
        "number": 24,
        "mode": "static",
        "layout": "poster",
        "instructions": "Enter the business phone and replace [PROPERTY ADDRESS]. Place the sign where pedestrians can safely scan it.",
        "inputs": {
            "pl-sms-msg": "I saw your work at [PROPERTY ADDRESS] and would like a quote for my property."
        },
        "required": [
            "pl-sms-to",
            "pl-sms-msg"
        ]
    },
    "epilogue-egg": {
        "payload": "url",
        "ctaText": "Secret Bonus Chapter",
        "printSize": "3.5in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "dot",
        "centerIcon": "",
        "tierRequired": "master-key",
        "name": "The Epilogue Easter Egg",
        "number": 25,
        "mode": "static",
        "layout": "label",
        "instructions": "Add your bonus-chapter signup-page URL. Your email service handles subscriber signup and delivery.",
        "inputs": {},
        "required": [
            "pl-url"
        ]
    },
    "big-league-billboard": {
        "payload": "url",
        "ctaText": "Scan to discover what’s next",
        "printSize": "8in",
        "dataColor": "#000000",
        "eyeColor": "#000000",
        "bgColor": "#ffffff",
        "eyeStyle": "square",
        "centerIcon": "",
        "tierRequired": "evolution",
        "name": "The Big-League Billboard",
        "number": 51,
        "mode": "dynamic",
        "layout": "poster",
        "instructions": "Add the HTTPS address of the page visitors should open. Save to activate the Dynamic route, then scan the Canvas with your phone. The Poster preview uses US Letter; download SVG for a billboard or stadium display. Give the printer the SVG, keep a clear margin around the code, and test the final installation from the intended viewing distance and angles. Place it where people can safely stop and scan. Save a named copy and record where it is displayed. To change the destination later, open the same route, update its address, save, and scan it again.",
        "inputs": {},
        "required": [
                "pl-url"
        ]
}
};

    const params = new URLSearchParams(window.location.search);
    const requested = params.get('play');
    let initialApplied = false, userEdited = false, opening = false;
    let returning = params.has('ppDraftReturn') || params.has('session_id');
    try { returning ||= Boolean(sessionStorage.getItem('pixelping-command-center-draft-v1') || sessionStorage.getItem('pixelping-library-open-v1')); } catch (_) {}
    const edited = e => {
        if (e.isTrusted && e.target.matches?.('.pl-input, #include-qr-name-print')) userEdited = true;
    };
    document.addEventListener('input', edited);
    document.addEventListener('change', edited);
    function notice(text) {
        const status = document.getElementById('canvas-saved-status');
        if (status) status.textContent = text;
    }
    async function open(slug, { initial = false } = {}) {
        const recipe = Object.hasOwn(arsenalPlays, slug) ? arsenalPlays[slug] : null;
        if (!recipe) { notice('This Arsenal play was not found. Choose a play from the guide.'); return false; }
        if (opening || !window.pixelPingOpenArsenal || window.pixelPingAuthReady !== true ||
            window.pixelPingAccountStatusPending === true || window.pixelPingCommandDraftSettled !== true) return false;
        if (initial && (returning || userEdited || initialApplied)) return false;
        opening = true;
        try {
            // The Canvas entry point owns save/discard protection and access checks.
            const applied = await window.pixelPingOpenArsenal(recipe);
            if (applied) initialApplied = true;
            return applied;
        } catch (error) { notice(error.message || 'The play could not be loaded. Please try again.'); return false; }
        finally { opening = false; }
    }
    window.pixelPingArsenal = { open, list: () => Object.entries(arsenalPlays).map(([slug, recipe]) => ({slug, ...JSON.parse(JSON.stringify(recipe))})) };
    // Browse existing recipes without changing the canvas; Open Play uses the existing guard.
    const launcher = document.getElementById('btn-arsenal');
    const picker = document.getElementById('arsenal-picker');
    const select = document.getElementById('arsenal-play-select');
    const openButton = document.getElementById('arsenal-open-play');
    const status = document.getElementById('arsenal-picker-status');
    if (launcher && picker && select && openButton && status) {
        const accessLabel = recipe => recipe.tierRequired === 'evolution' ? 'Evolution'
            : recipe.tierRequired === 'master-key' ? 'Rebellion (Master Key)' : 'Nomad (Free)';
        const selection = () => Object.hasOwn(arsenalPlays, select.value) ? arsenalPlays[select.value] : null;
        let loadingPlay = false;
        const ready = () => Boolean(window.pixelPingOpenArsenal && window.pixelPingAuthReady === true &&
            window.pixelPingAccountStatusPending !== true && window.pixelPingCommandDraftSettled === true);
        function updateAvailability() {
            openButton.disabled = loadingPlay || !selection() || !ready();
            if (!ready()) status.textContent = 'Waiting for account and canvas checks. If this persists, refresh the app and try again.';
            else if (status.textContent.startsWith('Waiting for account')) status.textContent = '';
        }
        Object.entries(arsenalPlays).sort((a, b) => a[1].number - b[1].number).forEach(([slug, recipe]) => {
            const option = document.createElement('option');
            option.value = slug;
            option.textContent = recipe.number + '. ' + recipe.name;
            select.appendChild(option);
        });
        launcher.addEventListener('click', () => {
            picker.hidden = !picker.hidden;
            launcher.setAttribute('aria-expanded', String(!picker.hidden));
            if (!picker.hidden) { updateAvailability(); select.focus(); }
        });
        picker.addEventListener('keydown', event => {
            if (event.key !== 'Escape' || loadingPlay) return;
            event.preventDefault();
            picker.hidden = true;
            launcher.setAttribute('aria-expanded', 'false');
            launcher.focus();
        });
        select.addEventListener('change', () => {
            const recipe = selection();
            document.getElementById('arsenal-selection-access').textContent = recipe
                ? (recipe.mode === 'dynamic' ? 'Dynamic' : 'Static') + ' · ' + accessLabel(recipe) + ' required' : '';
            document.getElementById('arsenal-selection-instructions').textContent = recipe?.instructions || '';
            status.textContent = '';
            updateAvailability();
        });
        openButton.addEventListener('click', async () => {
            if (loadingPlay || !selection()) return;
            if (!ready()) { updateAvailability(); return; }
            const slug = select.value;
            loadingPlay = true;
            select.disabled = true;
            openButton.textContent = 'Opening…';
            updateAvailability();
            try {
                const applied = await open(slug);
                status.textContent = applied
                    ? 'Draft opened. Follow the setup instructions below; no route has been activated.'
                    : 'Play was not opened. Review the canvas status or choose a play to try again.';
            } finally {
                loadingPlay = false;
                select.disabled = false;
                openButton.textContent = 'Open Play';
                updateAvailability();
            }
        });
        for (const name of ['pixelping:auth-ready', 'pixelping:entitlement-ready', 'pixelping:command-draft-ready', 'pixelping:canvas-controls-ready'])
            window.addEventListener(name, updateAvailability);
        updateAvailability();
    }
    const openRequested = () => { if (requested && !initialApplied) void open(requested, {initial:true}); };
    for (const name of ['pixelping:auth-ready','pixelping:entitlement-ready','pixelping:command-draft-ready','pixelping:canvas-controls-ready']) window.addEventListener(name, openRequested);
    queueMicrotask(openRequested);
});

