import Stripe from 'stripe';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        // 1. GLOBAL CORS HEADERS
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature"
        };

        // 2. HANDLE CORS PREFLIGHT
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // 3. ROUTE: GET /verify (Frontend grabs the key after checkout)
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

        // Initialize Stripe
        const stripe = new Stripe(env.STRIPE_SECRET_KEY || 'sk_test_dummy', {
            apiVersion: '2023-10-16',
        });

        // 4. ROUTE: POST /create-session (Frontend starts checkout)
        if (request.method === "POST" && url.pathname === "/create-session") {
            try {
                const body = await request.json();
                
                const session = await stripe.checkout.sessions.create({
                    payment_method_types: ['card'],
                    line_items: [{
                        price: body.priceId,
                        quantity: 1,
                    }],
                    mode: body.mode || 'payment',
                    success_url: 'https://pixelping.app/?session_id={CHECKOUT_SESSION_ID}',
                    cancel_url: 'https://pixelping.app/',
                    client_reference_id: body.userId,
                });

                return new Response(JSON.stringify({ sessionId: session.id }), { 
                    status: 200, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            } catch (err) {
                console.error("Session creation error:", err);
                return new Response(JSON.stringify({ error: err.message }), { 
                    status: 400, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
        }

        // 5. ROUTE: STRIPE WEBHOOK RECEIVER
        if (request.method === "POST") {
            const signature = request.headers.get('stripe-signature');
            
            try {
                const payload = await request.text();
                const event = await stripe.webhooks.constructEventAsync(
                    payload,
                    signature,
                    env.STRIPE_WEBHOOK_SECRET
                );

                if (event.type === 'checkout.session.completed') {
                    const session = event.data.object;
                    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
                    const priceId = lineItems.data[0]?.price?.id;
                    
                    let tierToGrant = null;
                    if (priceId === 'price_1U85qDIZcbLigL0N6FImW5v6') {
                        tierToGrant = 'master-key';
                    } else if (priceId === 'price_1U87KcIZcbLigL0Nou9BMy4z') {
                        tierToGrant = 'evolution';
                    }

                    if (tierToGrant) {
                        const userId = session.client_reference_id;
                        
                        // Upgrade Clerk Account
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
                            } catch (err) {
                                console.error("Clerk update failed:", err);
                            }
                        }

                        // Generate and Store License Key
                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
                        let licenseKey = 'PP';
                        for (let i = 0; i < 12; i++) {
                            if (i % 4 === 0) licenseKey += '-';
                            licenseKey += chars.charAt(Math.floor(Math.random() * chars.length));
                        }

                        if (env.PIXELPING_KV) {
                            await env.PIXELPING_KV.put(licenseKey, JSON.stringify({
                                tier: tierToGrant,
                                userId: userId || 'guest',
                                created_at: new Date().toISOString()
                            }));
                            await env.PIXELPING_KV.put(`session:${session.id}`, licenseKey, { expirationTtl: 86400 });
                        }
                    }
                }

                return new Response(JSON.stringify({ received: true }), { 
                    status: 200, 
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
                });

            } catch (err) {
                console.error(`Webhook error:`, err.message);
                return new Response(`Webhook Error: ${err.message}`, { 
                    status: 400,
                    headers: corsHeaders 
                });
            }
        }

        return new Response('Not Found', { status: 404, headers: corsHeaders });
    }
}