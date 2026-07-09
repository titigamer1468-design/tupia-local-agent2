export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);
    
    // Si una ruta da 404, responde con el index.html para mantener el modo SPA de React
    if (response.status === 404) {
      const indexRequest = new Request(`${url.origin}/index.html`, request);
      response = await env.ASSETS.fetch(indexRequest);
    }
    
    // 🔥 FORZADO DE CABECERAS REALES EN LA NUBE DE CLOUDFLARE 🔥
    const newHeaders = new Headers(response.headers);
    newHeaders.set("Cross-Origin-Embedder-Policy", "require-corp");
    newHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders
    });
  }
};
