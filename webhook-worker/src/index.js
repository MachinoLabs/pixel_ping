import Stripe from 'stripe';

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
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
          if (priceId === 'price_1U85qDIZcbLigL0N6FImW5v6') {
            console.log(`🗝️ Master Key purchased by ${customerEmail}!`);
            // TODO: Generate permanent access and email the key
            
          } else if (priceId === 'price_1U87KcIZcbLigL0Nou9BMy4z') {
            console.log(`🚀 Evolution Subscription activated for ${customerEmail}!`);
            // TODO: Activate dynamic telemetry in database
            
          } else {
            console.log(`❓ Unknown product purchased: ${priceId}`);
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