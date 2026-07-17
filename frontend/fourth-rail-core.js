0/**
 * Fourth Rail Core - Drop-In Payment Engine
 * Built for the StupidSimpleCrazyFast™ framework.
 */

// 1. The "Vibe-Coder" Guardrail (Console Easter Egg)
const consoleStyle = "color: #ff3366; font-size: 14px; font-weight: bold; font-family: monospace;";
console.log(
`%c
  █▀▀ █▀▀█ █  █ █▀▀█ ▀▀█▀▀ █  █   █▀▀█ █▀▀█  ▀  █    
  █▀▀ █  █ █  █ █▄▄▀   █   █▀▀█   █▄▄▀ █▄▄█ ▀█▀ █    
  ▀   ▀▀▀▀  ▀▀▀ ▀ ▀▀   ▀   ▀  ▀   ▀ ▀▀ ▀  ▀  ▀  ▀▀▀▀ 

  Hold up! 🖐️
  
  This application's payment rails are secured by Fourth Rail Core.
  Unauthorized ripping, tampering with local payment tokens, or bypass 
  attempts are strictly prohibited.
  
  Respect the build, support indie devs, and keep it ethical.
  
  © 2026 MachinoLabs • Built with StupidSimpleCrazyFast™
`, consoleStyle);

class FourthRail {
    constructor(config) {
        this.workerUrl = config.workerUrl; // e.g., 'https://payments.yourdomain.workers.dev'
        this.publishableKey = config.stripePublicKey;
        this.onUnlock = config.onUnlock; // Callback to unlock host app UI
    }

    async initCheckout(priceId) {
        // Dynamically inject Stripe.js so the host app stays clean
        if (!window.Stripe) {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            document.head.appendChild(script);
            await new Promise(resolve => script.onload = resolve);
        }

        const stripe = window.Stripe(this.publishableKey);

        // 1. Ask the Edge Worker for a Checkout Session
        const response = await fetch(`${this.workerUrl}/create-session`, {
            method: 'POST',
            body: JSON.stringify({ priceId: priceId })
        });
        const { clientSecret } = await response.json();

        // 2. Mount the Embedded Overlay
        const checkout = await stripe.initEmbeddedCheckout({
            clientSecret,
            onComplete: async () => {
                // 3. User paid! Ping the worker to verify and get the JWT
                checkout.destroy(); // Close the modal
                await this.verifyAndUnlock(clientSecret);
            }
        });

        // Create a modal container on the fly
        const modal = document.createElement('div');
        modal.id = 'fourth-rail-checkout';
        modal.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.8); z-index:9999;";
        document.body.appendChild(modal);

        checkout.mount('#fourth-rail-checkout');
    }

    async verifyAndUnlock(clientSecret) {
        // Fetch the Session ID from the client secret (Stripe format)
        const sessionId = clientSecret.split('_secret_')[0];

        // Ask the Worker: "Did this session actually get paid?"
        const verifyRes = await fetch(`${this.workerUrl}/verify-session`, {
            method: 'POST',
            body: JSON.stringify({ sessionId })
        });

        const data = await verifyRes.json();

        if (data.valid && data.token) {
            // Drop the JWT into Local Storage
            localStorage.setItem('fr_core_token', data.token);
            
            // Trigger the host app's unlock logic
            this.onUnlock();

            // Inject the MachinoLabs Branding Footer
            this.injectFooter();
        } else {
            alert("Payment verification failed. Please contact support.");
        }
    }

    injectFooter() {
        const footer = document.createElement('div');
        footer.innerHTML = `
            <div style="text-align: center; padding: 20px; font-family: monospace; font-size: 12px; color: #666; border-top: 1px solid #eee; margin-top: 40px;">
                <strong>Fourth Rail Core</strong><br>
                Secure Payment Processing<br>
                Built with the StupidSimpleCrazyFast™ micro-app framework.<br>
                Built by MachinoLabs • machinolabs.com • stupidsimplecrazyfast.com<br>
                support@senditin.app
            </div>
        `;
        document.body.appendChild(footer);
    }
}

// Attach to window for the host app to use
window.FourthRail = FourthRail;0