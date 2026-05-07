//код воркера cloudflare.com

export default {
    async fetch(request, env, ctx) {
        const SUPABASE_URL = "https://ammpwqfcutlyrjcarubc.supabase.co";

        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD",
            // ДОБАВЛЕН accept-profile
            "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, prefer, x-supabase-api-version, content-profile, accept-profile, accept, origin, x-requested-with, range",
            "Access-Control-Max-Age": "86400",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }

        try {
            const url = new URL(request.url);
            const targetUrl = new URL(SUPABASE_URL);

            url.hostname = targetUrl.hostname;

            const headers = new Headers(request.headers);
            headers.set("Host", targetUrl.hostname);

            const modifiedRequest = new Request(url.toString(), {
                method: request.method,
                headers: headers,
                body: request.body,
                redirect: "manual"
            });

            const response = await fetch(modifiedRequest);

            if (response.status === 101) {
                return response;
            }

            const newResponse = new Response(response.body, response);

            for (const [key, value] of Object.entries(corsHeaders)) {
                newResponse.headers.set(key, value);
            }

            return newResponse;

        } catch (e) {
            return new Response(JSON.stringify({ error: e.message || "Bad Gateway" }), {
                status: 502,
                headers: { "Content-Type": "application/json", ...corsHeaders }
            });
        }
    }
};