using System.Text.RegularExpressions;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Middleware;

/// <summary>Pure functions so the path rules are unit-testable without a server.</summary>
public static class PathSafety
{
    private static readonly Regex PercentEncoded = new("%[0-9a-fA-F]{2}", RegexOptions.CultureInvariant | RegexOptions.Compiled);

    /// <summary>
    /// Evaluated on the already-decoded path. Rejects dot segments, backslashes, control characters, empty segments
    /// and leftover percent escapes (which indicate double encoding such as %252e%252e).
    /// </summary>
    public static bool IsUnsafe(string? path)
    {
        if (string.IsNullOrEmpty(path))
        {
            return false;
        }

        foreach (var c in path)
        {
            if (c < 0x20 || c == 0x7f || c == '\\')
            {
                return true;
            }
        }

        return path.Contains("..", StringComparison.Ordinal)
               || path.Contains("//", StringComparison.Ordinal)
               || path.Contains("/./", StringComparison.Ordinal)
               || path.EndsWith("/.", StringComparison.Ordinal)
               || PercentEncoded.IsMatch(path);
    }
}

/// <summary>Cheap structural checks that run before routing: method allowlist, path hygiene, size limits.</summary>
public sealed class RequestValidationMiddleware(RequestDelegate next, IOptionsMonitor<GatewayOptions> options)
{
    public Task InvokeAsync(HttpContext ctx)
    {
        var v = options.CurrentValue.Validation;
        if (!v.Enabled)
        {
            return next(ctx);
        }

        var req = ctx.Request;
        if (!v.AllowedMethods.Contains(req.Method, StringComparer.OrdinalIgnoreCase))
        {
            ctx.Response.Headers["Allow"] = string.Join(", ", v.AllowedMethods);
            return Reject.WriteAsync(ctx, StatusCodes.Status405MethodNotAllowed, "method_not_allowed", "Method not allowed.", "method_not_allowed");
        }

        var path = req.Path.Value ?? string.Empty;
        if (path.Length > v.MaxPathLength || PathSafety.IsUnsafe(path))
        {
            return Reject.WriteAsync(ctx, StatusCodes.Status400BadRequest, "invalid_path", "The request path is not acceptable.", "invalid_path");
        }

        if ((req.QueryString.Value?.Length ?? 0) > v.MaxQueryLength)
        {
            return Reject.WriteAsync(ctx, StatusCodes.Status414UriTooLong, "uri_too_long", "Query string too long.", "query_too_long");
        }

        if (req.Headers.Count > v.MaxHeaderCount)
        {
            return Reject.WriteAsync(ctx, StatusCodes.Status431RequestHeaderFieldsTooLarge, "too_many_headers", "Too many headers.", "too_many_headers");
        }

        foreach (var header in req.Headers)
        {
            foreach (var value in header.Value)
            {
                if (value is { } text && text.Length > v.MaxHeaderValueLength)
                {
                    return Reject.WriteAsync(ctx, StatusCodes.Status431RequestHeaderFieldsTooLarge, "header_too_large", "A header value is too large.", "header_too_large");
                }
            }
        }

        if (req.ContentLength > v.MaxBodyBytes)
        {
            return Reject.WriteAsync(ctx, StatusCodes.Status413PayloadTooLarge, "payload_too_large", "Request body too large.", "body_too_large");
        }

        return next(ctx);
    }
}
