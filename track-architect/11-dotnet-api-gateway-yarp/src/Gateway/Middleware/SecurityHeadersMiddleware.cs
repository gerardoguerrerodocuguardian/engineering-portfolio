namespace AdFlow.Gateway.Middleware;

/// <summary>
/// Secure response headers for an API surface (CSP forbids everything because an API never serves active content),
/// and removal of headers that fingerprint the stack, including ones copied from downstream services.
/// </summary>
public sealed class SecurityHeadersMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        ctx.Response.OnStarting(() =>
        {
            var h = ctx.Response.Headers;
            h.Remove("Server");
            h.Remove("X-Powered-By");
            h["X-Content-Type-Options"] = "nosniff";
            h["X-Frame-Options"] = "DENY";
            h["Referrer-Policy"] = "no-referrer";
            h["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'; base-uri 'none'";
            h["Cross-Origin-Resource-Policy"] = "same-site";
            h["Permissions-Policy"] = "geolocation=(), camera=(), microphone=()";
            if (!h.ContainsKey("Cache-Control"))
            {
                h["Cache-Control"] = "no-store";
            }

            return Task.CompletedTask;
        });
        return next(ctx);
    }
}
