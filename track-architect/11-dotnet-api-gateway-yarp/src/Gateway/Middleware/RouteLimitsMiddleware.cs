using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.Options;
using Microsoft.Net.Http.Headers;
using Yarp.ReverseProxy.Model;

namespace AdFlow.Gateway.Middleware;

/// <summary>
/// Per-route limits read from YARP route metadata (after routing): "MaxBodyBytes" and "RequiredContentType".
/// Keeping them next to the route in configuration means a route's contract is reviewed in one place.
/// </summary>
public sealed class RouteLimitsMiddleware(RequestDelegate next, IOptionsMonitor<GatewayOptions> options)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        if (!options.CurrentValue.Validation.Enabled)
        {
            return next(ctx);
        }

        var metadata = ctx.GetEndpoint()?.Metadata.GetMetadata<RouteModel>()?.Config.Metadata;
        if (metadata is null)
        {
            return next(ctx);
        }

        var req = ctx.Request;
        if (metadata.TryGetValue("MaxBodyBytes", out var maxText) && long.TryParse(maxText, out var max))
        {
            if (req.ContentLength > max)
            {
                return Reject.WriteAsync(ctx, StatusCodes.Status413PayloadTooLarge, "payload_too_large", "Request body too large for this route.", "body_too_large");
            }

            // Also bounds chunked uploads that carry no Content-Length (Kestrel enforces while reading).
            var feature = ctx.Features.Get<IHttpMaxRequestBodySizeFeature>();
            if (feature is { IsReadOnly: false })
            {
                feature.MaxRequestBodySize = max;
            }
        }

        if (metadata.TryGetValue("RequiredContentType", out var required) && HasBody(req))
        {
            var actual = MediaTypeHeaderValue.TryParse(req.ContentType, out var parsed) ? parsed.MediaType.Value : null;
            var ok = string.Equals(actual, required, StringComparison.OrdinalIgnoreCase)
                     || (required.Equals("application/json", StringComparison.OrdinalIgnoreCase)
                         && actual is not null && actual.EndsWith("+json", StringComparison.OrdinalIgnoreCase));
            if (!ok)
            {
                return Reject.WriteAsync(ctx, StatusCodes.Status415UnsupportedMediaType, "unsupported_media_type", $"Content-Type must be {required}.", "bad_content_type");
            }
        }

        return next(ctx);
    }

    private static bool HasBody(HttpRequest req) =>
        req.ContentLength > 0 || req.Headers.ContainsKey(HeaderNames.TransferEncoding);
}
