document.addEventListener('DOMContentLoaded', () => {
    const arsenalPlays = {
        "tip-jar": {
            payload: "crypto",
            ctaText: "Scan to tip",
            printSize: "2in", 
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "dot", 
            centerIcon: "", 
            tierRequired: "master-key"
        },
        "ghost-trainer": {
            payload: "url",
            ctaText: "Watch Equipment Tutorial",
            printSize: "3.5in", 
            dataColor: "#10b981", 
            eyeColor: "#10b981",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "cloud-clipboard": {
            payload: "url",
            ctaText: "Scan to Update Ledger",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "stealth-merch": {
            payload: "url",
            ctaText: "", 
            printSize: "2in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "phantom-speakeasy": {
            payload: "url", 
            ctaText: "Unlock Secret Menu",
            printSize: "3.5in",
            dataColor: "#d4af37", 
            eyeColor: "#d4af37",
            bgColor: "#1a1a1a",   
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "contractor-sticky": {
            payload: "sms",
            ctaText: "Scan for Emergency Service",
            printSize: "2in",
            dataColor: "#e11d48", 
            eyeColor: "#9f1239",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "golden-ticket": {
            payload: "url",
            ctaText: "Unlock VIP Unboxing",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#d4af37", 
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "wifi-trojan": {
            payload: "wifi",
            ctaText: "Connect to Cafe Wi-Fi",
            printSize: "3.5in",
            dataColor: "#0ea5e9", 
            eyeColor: "#0369a1",
            bgColor: "#f8fafc",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "silent-salesman": {
            payload: "url",
            ctaText: "Scan for Audio Tour",
            printSize: "2in",
            dataColor: "#334155",
            eyeColor: "#0f172a",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "free"
        },
        "hacker-card": {
            payload: "wifi",
            ctaText: "Scan to Connect",
            printSize: "3.5in",
            dataColor: "#10b981", 
            eyeColor: "#10b981",
            bgColor: "#000000",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "silent-hall-pass": {
            payload: "url",
            ctaText: "The Fridge Syllabus",
            printSize: "3.5in",
            dataColor: "#0f766e", 
            eyeColor: "#115e59",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "waiting-room": {
            payload: "url",
            ctaText: "Scan to Check In",
            printSize: "3.5in",
            dataColor: "#0369a1",
            eyeColor: "#075985",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "superhost-concierge": {
            payload: "url",
            ctaText: "Scan for Local Eats",
            printSize: "2in",
            dataColor: "#be123c",
            eyeColor: "#9f1239",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "kennel-breakout": {
            payload: "url",
            ctaText: "See Me in the Yard",
            printSize: "3.5in",
            dataColor: "#ea580c",
            eyeColor: "#c2410c",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "free"
        },
        "seed-to-table": {
            payload: "url",
            ctaText: "Meet the Farmer",
            printSize: "2in",
            dataColor: "#4d7c0f",
            eyeColor: "#3f6212",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "digital-tip-in": {
            payload: "url",
            ctaText: "Tonight's Secret Setlist",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "line-buster": {
            payload: "url",
            ctaText: "Skip Line: Scan to Order",
            printSize: "3.5in",
            dataColor: "#ea580c",
            eyeColor: "#c2410c",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "instant-rma": {
            payload: "sms",
            ctaText: "Text Founder Directly",
            printSize: "2in",
            dataColor: "#2563eb",
            eyeColor: "#1d4ed8",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "ghost-tour": {
            payload: "text",
            ctaText: "Self-Guided Ghost Tour",
            printSize: "3.5in",
            dataColor: "#475569",
            eyeColor: "#0f172a",
            bgColor: "#f8fafc",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "test-drive": {
            payload: "url",
            ctaText: "Virtual Test Drive",
            printSize: "3.5in",
            dataColor: "#dc2626",
            eyeColor: "#991b1b",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "wreck-report": {
            payload: "sms",
            ctaText: "Scan if in Accident",
            printSize: "3.5in",
            dataColor: "#b91c1c",
            eyeColor: "#7f1d1d",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "trojan-mailer": {
            payload: "url",
            ctaText: "Scan to Unlock",
            printSize: "2in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "zero-day": {
            payload: "text",
            ctaText: "Emergency IT Protocol",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#fef08a",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "frictionless-reorder": {
            payload: "email",
            ctaText: "Scan to Reorder",
            printSize: "3.5in",
            dataColor: "#0369a1",
            eyeColor: "#075985",
            bgColor: "#f0f9ff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "ceramic-passport": {
            payload: "url",
            ctaText: "Wash Instructions & Warranty",
            printSize: "2in",
            dataColor: "#94a3b8",
            eyeColor: "#475569",
            bgColor: "#0f172a",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "mortgage-fast-track": {
            payload: "url",
            ctaText: "Scan to Jump the Line",
            printSize: "3.5in",
            dataColor: "#d4af37",
            eyeColor: "#996515",
            bgColor: "#000000",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "living-benefits": {
            payload: "url",
            ctaText: "Live Benefits Dashboard",
            printSize: "3.5in",
            dataColor: "#2563eb",
            eyeColor: "#1e3a8a",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "guardian-angel": {
            payload: "sms",
            ctaText: "I Found Your Child",
            printSize: "2in",
            dataColor: "#dc2626",
            eyeColor: "#991b1b",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "guerrilla-pothole": {
            payload: "email",
            ctaText: "Report Pothole to City",
            printSize: "3.5in",
            dataColor: "#ea580c",
            eyeColor: "#9a3412",
            bgColor: "#facc15",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "vip-fast-pass": {
            payload: "sms",
            ctaText: "Order Bottle Service",
            printSize: "2in",
            dataColor: "#ffffff",
            eyeColor: "#ffffff",
            bgColor: "#000000",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "drive-by-capture": {
            payload: "sms",
            ctaText: "Get Price & Tour",
            printSize: "3.5in",
            dataColor: "#1e40af",
            eyeColor: "#1e3a8a",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "podcast-hijack": {
            payload: "url",
            ctaText: "Hear the True Story",
            printSize: "3.5in",
            dataColor: "#1db954",
            eyeColor: "#191414",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "digital-tip-sheet": {
            payload: "crypto",
            ctaText: "Loved the Tour? Tip Here",
            printSize: "2in",
            dataColor: "#047857",
            eyeColor: "#064e3b",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "infinite-tombstone": {
            payload: "url",
            ctaText: "Living Digital Memorial",
            printSize: "2in",
            dataColor: "#334155",
            eyeColor: "#0f172a",
            bgColor: "#f8fafc",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "ghost-card": {
            payload: "vcard",
            ctaText: "",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "living-wallet": {
            payload: "url",
            ctaText: "Scan to see what's new",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "etsy-boomerang": {
            payload: "sms",
            ctaText: "I found your item",
            printSize: "2in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "wedding-invite": {
            payload: "url",
            ctaText: "Scan for Wedding Details",
            printSize: "3.5in",
            dataColor: "#333333",
            eyeColor: "#333333",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "infinite-billboard": {
            payload: "url",
            ctaText: "Scan for this week's Local Deal",
            printSize: "Flyer/Poster",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "apparel-egg": {
            payload: "url",
            ctaText: "Unlock Exclusive Drop",
            printSize: "2in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "offline-survival-cache": {
            payload: "text",
            ctaText: "Emergency Medical Info",
            printSize: "3.5in",
            dataColor: "#b91c1c",
            eyeColor: "#7f1d1d",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "time-capsule": {
            payload: "url",
            ctaText: "Scan this on our anniversary",
            printSize: "2in",
            dataColor: "#d4af37",
            eyeColor: "#996515",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "resume-bypass": {
            payload: "url",
            ctaText: "Scan to see me in action",
            printSize: "3.5in",
            dataColor: "#1e3a8a",
            eyeColor: "#1e40af",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "conference-hitman": {
            payload: "sms",
            ctaText: "Scan my badge",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "industrial-manual": {
            payload: "text",
            ctaText: "Scan for Operating Manual",
            printSize: "3.5in",
            dataColor: "#0f172a",
            eyeColor: "#000000",
            bgColor: "#f8fafc",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "free"
        },
        "willy-wonka": {
            payload: "url",
            ctaText: "Find the Golden Ticket",
            printSize: "Flyer/Poster",
            dataColor: "#d4af37",
            eyeColor: "#b45309",
            bgColor: "#1a1a1a",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "equipment-tag": {
            payload: "text",
            ctaText: "Reward if found",
            printSize: "2in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "glovebox-ledger": {
            payload: "url",
            ctaText: "Maintenance History",
            printSize: "2in",
            dataColor: "#1e40af",
            eyeColor: "#1e3a8a",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "evolution"
        },
        "curb-appeal": {
            payload: "sms",
            ctaText: "I want a quote",
            printSize: "Flyer/Poster",
            dataColor: "#166534",
            eyeColor: "#14532d",
            bgColor: "#ffffff",
            eyeStyle: "square",
            centerIcon: "",
            tierRequired: "master-key"
        },
        "epilogue-egg": {
            payload: "url",
            ctaText: "Secret Bonus Chapter",
            printSize: "3.5in",
            dataColor: "#000000",
            eyeColor: "#000000",
            bgColor: "#ffffff",
            eyeStyle: "dot",
            centerIcon: "",
            tierRequired: "master-key"
        }
    };

    const recipeParams = new URLSearchParams(window.location.search);
    const requestedPlay = recipeParams.get('play');

    if (requestedPlay && arsenalPlays[requestedPlay]) {
        const recipe = arsenalPlays[requestedPlay];

        // Populate Canvas Forms
        document.getElementById('payload-type').value = recipe.payload;
        document.getElementById('pl-smart-label').value = recipe.ctaText;
        document.getElementById('pl-print-size').value = recipe.printSize;
        
        document.getElementById('qr-color-dots').value = recipe.dataColor;
        document.getElementById('qr-color-corners').value = recipe.eyeColor;
        document.getElementById('qr-color-bg').value = recipe.bgColor;
        document.getElementById('qr-corners-type').value = recipe.eyeStyle;
        document.getElementById('qr-icon').value = recipe.centerIcon;

        document.querySelectorAll('.payload-form').forEach(form => {
            form.classList.toggle('active', form.id === 'form-' + recipe.payload);
        });

        if (typeof window.updateQR === 'function') {
            window.updateQR();
        }

        // Frontend Authentication Logic with Proper Hierarchy
        setTimeout(() => {
            // Retrieve session tokens from local storage
            const isMasterKey = localStorage.getItem('pixelping-pro') === 'true';
            const isEvolution = localStorage.getItem('pixelping-evolution') === 'true';

            // Establish Hierarchy: Evolution grants Master Key access automatically
            const hasEvolutionAccess = isEvolution;
            const hasMasterKeyAccess = isMasterKey || isEvolution;

            if (recipe.tierRequired === "evolution") {
                // Ensure UI reflects the dynamic tier
                const btnDynamic = document.getElementById('mode-dynamic');
                if (btnDynamic) btnDynamic.click();

                // Throw modal only if they lack Evolution access
                if (!hasEvolutionAccess && typeof window.openEvolutionModal === 'function') {
                    window.openEvolutionModal();
                }
            } 
            else if (recipe.tierRequired === "master-key") {
                // Throw modal only if they lack Master Key (and Evolution) access
                if (!hasMasterKeyAccess && typeof window.openMasterKeyModal === 'function') {
                    window.openMasterKeyModal();
                }
            }
        }, 500); 
    }
});