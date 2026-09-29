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
        }
    };

    const recipeParams = new URLSearchParams(window.location.search);
    const requestedPlay = recipeParams.get('play');

    if (requestedPlay && arsenalPlays[requestedPlay]) {
        const recipe = arsenalPlays[requestedPlay];

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

        setTimeout(() => {
            const isMasterKey = localStorage.getItem('pixelping-pro') === 'true';
            const isEvolution = localStorage.getItem('pixelping-evolution') === 'true';

            if (recipe.tierRequired === "master-key" && !isMasterKey) {
                if (typeof window.openMasterKeyModal === 'function') {
                    window.openMasterKeyModal();
                }
            } 
            else if (recipe.tierRequired === "evolution") {
                const btnDynamic = document.getElementById('mode-dynamic');
                if (btnDynamic) btnDynamic.click();

                if (!isEvolution && typeof window.openEvolutionModal === 'function') {
                    window.openEvolutionModal();
                }
            }
        }, 500); 
    }
});