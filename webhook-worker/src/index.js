import Stripe from 'stripe';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
     const url = new URL(request.url);

    // 1. CORS Headers so your frontend browser doesn't block the request
    const corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature"
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    // 2. ROUTE: GET VERIFY (Frontend grabs the key after checkout)
    if (request.method === "GET" && url.pathname === "/verify") {
        const sessionId = url.searchParams.get("session_id");
        
        let licenseKey = null;
        if (env.PIXELPING_KV && sessionId) {
            licenseKey = await env.PIXELPING_KV.get(`session:${sessionId}`);
        }

        return new Response(JSON.stringify({ 
            valid: true,
            licenseKey: licenseKey 
        }), { 
            status: 200, 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
    }

    // 3. Block any other non-POST requests from hitting the Stripe logic below
    if (request.method !== 'POST') {
        return new Response('Method Not Allowed', { status: 405, headers: corsHeaders });
    }
    // Notice we are using env.STRIPE_SECRET_KEY now. We will need to add this to .dev.vars next 
    // so the worker has permission to read the receipt details.
    const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
      apiVersion: '2023-10-16', 
    });

    const signature = request.headers.get('stripe-signature');
    
    try {
      const payload = await request.text();
      const event = await stripe.webhooks.constructEventAsync(
        payload,
        signature,
        env.STRIPE_WEBHOOK_SECRET
      );

      switch (event.type) {
        case 'checkout.session.completed':
          const session = event.data.object;
          
          // Fetch the line items to see exactly what they bought
          const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
          const priceId = lineItems.data[0]?.price?.id;
          const customerEmail = session.customer_details?.email || 'Unknown Email';

         // Route the logic based on the specific Price ID
        let tierToGrant = null;
        if (priceId === 'price_1U85qDIZcbLigL0N6FImW5v6') {
            tierToGrant = 'master-key';
        } else if (priceId === 'price_1U87KcIZcbLigL0Nou9BMy4z') {
            tierToGrant = 'evolution';
        } else {
            console.log(`❓ Unknown product purchased: ${priceId}`);
        }

        if (tierToGrant) {
            const userId = session.client_reference_id;
            
            // 1. Upgrade Clerk Account via API
            if (userId && env.CLERK_SECRET_KEY) {
                try {
                    await fetch(`https://api.clerk.com/v1/users/${userId}/metadata`, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${env.CLERK_SECRET_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ public_metadata: { tier: tierToGrant } })
                    });
                    console.log(`✅ Upgraded Clerk user ${userId} to ${tierToGrant}`);
                } catch (err) {
                    console.error("❌ Clerk update failed:", err);
                }
            }

            // 2. Generate and Store Offline License Key
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let licenseKey = 'PP';
            for (let i = 0; i < 12; i++) {
                if (i % 4 === 0) licenseKey += '-';
                licenseKey += chars.charAt(Math.floor(Math.random() * chars.length));
            }

            if (env.PIXELPING_KV) {
                // Save the actual key for future verifications
                await env.PIXELPING_KV.put(licenseKey, JSON.stringify({
                    tier: tierToGrant,
                    userId: userId || 'guest',
                    created_at: new Date().toISOString()
                }));
                
                // Save a temporary reference so the checkout success screen can display it
                await env.PIXELPING_KV.put(`session:${session.id}`, licenseKey, { expirationTtl: 86400 });
                
                console.log(`🔑 Generated offline license key: ${licenseKey}`);
            }
        }
          break;
        case 'payment_intent.succeeded':
          console.log('💰 Payment intent succeeded:', event.data.object.id);
          break;
          
        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return new Response(JSON.stringify({ received: true }), { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      });

    } catch (err) {
      console.error(`⚠️ Webhook error:`, err.message);
      return new Response(`Webhook Error: ${err.message}`, { status: 400 });
    }
  },
};