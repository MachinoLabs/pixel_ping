export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const method = request.method;
        const pathname = url.pathname;

        // CORS Setup for Frontend Communication
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
        };

        if (method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        // --- STATIC PAGE BYPASS ---
        // Let HTML files and specific paths pass through normally
        if (method === "GET" && (pathname.endsWith(".html") || pathname === "/admin" || pathname === "/help")) {
            return fetch(request); 
        }

        try {
            // ==========================================
            // ROUTE 1: INCOMING FRONTEND REQUESTS (POST)
            // Handling License Verification AND Link Generation
            // ==========================================
            if (method === "POST" && pathname === "/") {
                const body = await request.json();

               // --- A. THE MASTER KEY VERIFIER (Legacy/Manual Integration) ---
            if (body.licenseKey) {
                const submittedKey = body.licenseKey.trim().toUpperCase();
                let isValid = false;

                // 1. Check if Stripe generated this key and saved it to KV
                const stripeKeyData = await env.PIXELPING_KV.get(submittedKey);

                if (stripeKeyData) {
                    isValid = true;
                } else {
                    // 2. Always allow your personal Developer Keys
                    const devKeys = ["MACHINO-PRO", "PIXEL-2026", "JOE-DEV", "DEV-TEST-KEY"]; 
                    if (devKeys.includes(submittedKey)) {
                        isValid = true;
                    }
                }

                // 3. Grant Access or Deny
                if (isValid) {
                    const ghostScript = `
                        console.log('%c[MACHINOLABS] Ghost Script Injected: Master Key Verified.', 'color: #3cff8f; font-weight: bold;');
                        window.proIcons = {
                            'shield': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%233b82f6' d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E",
                            'check': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2322c55e' d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E"
                        };
                        if (typeof window.updateQR === 'function') window.updateQR();
                    `;
                    return new Response(JSON.stringify({ success: true, script: ghostScript }), { 
                        status: 200, headers: corsHeaders 
                    });
                } else {
                    return new Response(JSON.stringify({ success: false, error: "Invalid License Key." }), { 
                        status: 401, headers: corsHeaders 
                    });
                }
            }
                    // 4. Grant Access or Deny
                    if (isValid) {
                        const ghostScript = `
                            console.log('%c[MACHINOLABS] Ghost Script Injected: Master Key Verified.', 'color: #3cff8f; font-weight: bold;');
                            window.proIcons = {
                                'shield': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%233b82f6' d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E",
                                'check': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2322c55e' d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E"
                            };
                            if (typeof window.updateQR === 'function') window.updateQR();
                        `;
                        return new Response(JSON.stringify({ success: true, script: ghostScript }), { 
                            status: 200, headers: corsHeaders 
                        });
                    } else {
                        return new Response(JSON.stringify({ success: false, error: "Invalid or Refunded License Key." }), { 
                            status: 401, headers: corsHeaders 
                        });
                    }
                }

                    // 3. Grant Access or Deny
                    if (isValid) {
                        // The elusive Ghost Script that unlocks frontend features
                        const ghostScript = `
                            console.log('%c[MACHINOLABS] Ghost Script Injected: Master Key Verified.', 'color: #3cff8f; font-weight: bold;');
                            window.proIcons = {
                                'shield': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%233b82f6' d='M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z'/%3E%3C/svg%3E",
                                'check': "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%2322c55e' d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'/%3E%3C/svg%3E"
                            };
                            if (typeof window.updateQR === 'function') window.updateQR();
                        `;
                        return new Response(JSON.stringify({ success: true, script: ghostScript }), { 
                            status: 200, headers: corsHeaders 
                        });
                    } else {
                        return new Response(JSON.stringify({ success: false, error: "Invalid or Refunded License Key." }), { 
                            status: 401, headers: corsHeaders 
                        });
                    }
                }

                // ==========================================
                // --- C. THE EVOLUTION VERIFIER (Stripe) ---
                // ==========================================
                if (body.evoEmail) {
                    const submittedEmail = body.evoEmail.trim().toLowerCase();

                    // 1. Developer Bypass - So you don't have to pay yourself $39/mo to test it!
                    if (submittedEmail === "joe@machinolabs.com" || submittedEmail === "support@senditin.app") {
                         return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
                    }

                    try {
                        const stripeKey = env.STRIPE_SECRET_KEY; 
                        if (!stripeKey) throw new Error("Stripe Secret Key not configured.");

                        // 2. Ping Stripe to find the customer by email
                        const customerRes = await fetch(`https://api.stripe.com/v1/customers?email=${encodeURIComponent(submittedEmail)}`, {
                            headers: { 'Authorization': `Bearer ${stripeKey}` }
                        });
                        const customerData = await customerRes.json();

                        if (!customerData.data || customerData.data.length === 0) {
                            return new Response(JSON.stringify({ success: false, error: "No Stripe account found for this email." }), { status: 401, headers: corsHeaders });
                        }

                        const customerId = customerData.data[0].id;

                        // 3. Check if this specific customer has an 'active' subscription
                        const subRes = await fetch(`https://api.stripe.com/v1/subscriptions?customer=${customerId}&status=active`, {
                            headers: { 'Authorization': `Bearer ${stripeKey}` }
                        });
                        const subData = await subRes.json();

                        if (subData.data && subData.data.length > 0) {
                            return new Response(JSON.stringify({ success: true }), { status: 200, headers: corsHeaders });
                        } else {
                            return new Response(JSON.stringify({ success: false, error: "No active Evolution subscription found." }), { status: 401, headers: corsHeaders });
                        }

                    } catch (err) {
                        return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: corsHeaders });
                    }
                }

                // --- B. THE DYNAMIC LINK BUILDER ---
                if (body.slug && body.destination) {
                    // Set up the telemetry properties
                    body.clicks = 0;
                    
                    // FIXED: Changed PIXEL_KV to PIXELPING_KV
                    await env.PIXELPING_KV.put(`link:${body.slug}`, JSON.stringify(body));
                    return new Response(JSON.stringify({ success: true, slug: body.slug }), { status: 200, headers: corsHeaders });
                }

            } // <-- Reinstated the missing bracket

            // ==========================================
            // ROUTE 2: ADMIN DASHBOARD API
            // ==========================================
            if (pathname.startsWith("/api/")) {
                if (pathname === "/api/telemetry" && method === "GET") {
                    const userId = url.searchParams.get('userId');
                    if (!userId) {
                        return new Response(JSON.stringify({ error: "Missing User ID" }), { 
                            status: 400, headers: corsHeaders 
                        });
                    }
                    
                    try {
                        let totalPings = 0;
                        let activeRoutes = 0;
                        let topLink = "/none";
                        let maxClicks = -1;

                        // FIXED: Added prefix filter for efficiency
                        const listed = await env.PIXELPING_KV.list({ prefix: "link:" });
                        
                        // Loop through them to find the user's routes and aggregate the clicks
                        for (const key of listed.keys) {
                            const recordString = await env.PIXELPING_KV.get(key.name);
                            if (recordString) {
                                const record = JSON.parse(recordString);
                                
                                // Check if this route belongs to the requesting user
                                if (record.userId === userId) {
                                    activeRoutes++;
                                    const clicks = record.clicks || 0;
                                    totalPings += clicks;
                                    
                                    // Calculate the top performing link
                                    if (clicks > maxClicks) {
                                        maxClicks = clicks;
                                        topLink = `/${record.slug}`;
                                    }
                                }
                            }
                        }

                        const liveStats = {
                            pings: totalPings, 
                            activeRoutes: activeRoutes,
                            topLink: topLink
                        };

                        return new Response(JSON.stringify({ success: true, telemetry: liveStats }), {
                            status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
                        });
                        
                    } catch (err) {
                        return new Response(JSON.stringify({ error: "Aggregation failed", details: err.message }), {
                            status: 500, headers: corsHeaders
                        });
                    }
                }
                return new Response(JSON.stringify({ error: "API Route Not Found" }), { status: 404, headers: corsHeaders });
            }

            // ==========================================
            // ROUTE 3: THE QR REDIRECT & TELEMETRY ENGINE
            // ==========================================
            const slug = pathname.substring(1); 
            
            // If someone just hits the root worker URL, show a status message
            if (!slug) {
                return new Response("PixelPing Edge Network Online.", { status: 200, headers: corsHeaders });
            }

            // FIXED: Added 'link:' prefix to the lookup to match the save function
            const recordString = await env.PIXELPING_KV.get(`link:${slug}`);
            
            if (recordString) {
                const record = JSON.parse(recordString);
                
                // Increment the live scan counter
                record.clicks = (record.clicks || 0) + 1;
                
                // FIXED: Added 'link:' prefix to the update function
                await env.PIXELPING_KV.put(`link:${slug}`, JSON.stringify(record));
                
                // Instantly redirect the user
                return Response.redirect(record.destination, 302);
            } else {
                return new Response("404: PixelPing Route Not Found or Inactive.", { status: 404, headers: corsHeaders });
            }

        } catch (error) {
            console.error("Worker Error:", error);
            return new Response(JSON.stringify({ error: "Internal Server Error", details: error.message }), { 
                status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } 
            });
        }
    }
};