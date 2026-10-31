// Emergency maintenance entry point. Keeps all existing DO class identities.
// No request can read or mutate application storage through this handler.

export default {
    fetch(request) {
        return new Response(
            request.method === 'HEAD' ? null :
                'PixelPing is temporarily unavailable while maintenance is completed. Please try again shortly.',
            {
                status: 503,
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-store',
                    'Retry-After': '60',
                    'Access-Control-Allow-Origin': '*'
                }
            }
        );
    }
};

