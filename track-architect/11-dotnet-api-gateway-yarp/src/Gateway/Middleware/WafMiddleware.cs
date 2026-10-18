using System.Text;
using System.Text.RegularExpressions;
using AdFlow.Gateway.Audit;
using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Infrastructure;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Middleware;

public sealed record WafHit(string RuleId, string Category);

/// <summary>
/// TEACHING EXAMPLE. A handful of OWASP-style signatures to show where inspection plugs into the pipeline.
/// This is NOT a WAF: no paranoia levels, no anomaly scoring, no virtual patching, no maintained rule set.
/// See docs/waf-integration.md for putting ModSecurity/Coraza + the OWASP Core Rule Set in front.
/// </summary>
public static class WafSignatures
{
    private static readonly (string Id, string Category, Regex Pattern)[] Rules =
    [
        ("SQLI-001", "sqli", Make(@"\bunion\b[\s/*()+]+(all[\s/*()+]+)?select\b")),
        ("SQLI-002", "sqli", Make(@"['""]\s*(or|and)\s+['""]?\w+['""]?\s*=\s*['""]?\w+")),
        ("SQLI-003", "sqli", Make(@";\s*(drop|truncate|alter|delete)\s+(table|database|from)\b")),
        ("XSS-001", "xss", Make(@"<\s*script\b")),
        ("XSS-002", "xss", Make(@"\bon(error|load|click|mouseover)\s*=")),
        ("XSS-003", "xss", Make(@"javascript\s*:")),
        ("TRAV-001", "path-traversal", Make(@"(\.\./|\.\.\\|%2e%2e)")),
        ("CMDI-001", "command-injection", Make(@"[;|&]{1,2}\s*(cat|wget|curl|bash|nc)\s+\S")),
    ];

    public static WafHit? Inspect(string? text)
    {
        if (string.IsNullOrEmpty(text))
        {
            return null;
        }

        foreach (var (id, category, pattern) in Rules)
        {
            try
            {
                if (pattern.IsMatch(text))
                {
                    return new WafHit(id, category);
                }
            }
            catch (RegexMatchTimeoutException)
            {
                // Pathological input: skip this rule rather than stall the request.
            }
        }

        return null;
    }

    private static Regex Make(string pattern) =>
        new(pattern, RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled, TimeSpan.FromMilliseconds(50));
}

public sealed class WafMiddleware(RequestDelegate next, IOptionsMonitor<GatewayOptions> options, IAuditLog audit, GatewayMetrics metrics)
{
    public async Task InvokeAsync(HttpContext ctx)
    {
        var waf = options.CurrentValue.Waf;
        if (waf.Mode == WafMode.Off)
        {
            await next(ctx);
            return;
        }

        var req = ctx.Request;
        var hit = WafSignatures.Inspect(Decode(req.Path.Value))
                  ?? WafSignatures.Inspect(req.QueryString.Value)
                  ?? WafSignatures.Inspect(Decode(req.QueryString.Value))
                  ?? WafSignatures.Inspect(req.Headers.UserAgent.ToString())
                  ?? WafSignatures.Inspect(req.Headers.Referer.ToString());

        if (hit is null && waf.InspectBody)
        {
            hit = WafSignatures.Inspect(await ReadBodyAsync(req, waf.MaxInspectBytes, ctx.RequestAborted));
        }

        if (hit is not null)
        {
            var mode = waf.Mode.ToString().ToLowerInvariant();
            metrics.WafMatch(hit.RuleId, mode);
            audit.Write(AuditEvent.From(ctx, $"waf_{mode}", null, $"rule={hit.RuleId} category={hit.Category}"));
            if (waf.Mode == WafMode.Block)
            {
                await Reject.WriteAsync(ctx, StatusCodes.Status403Forbidden, "forbidden", "Request blocked by policy.", "waf_blocked");
                return;
            }
        }

        await next(ctx);
    }

    private static string? Decode(string? value) =>
        value is null ? null : Uri.UnescapeDataString(value.Replace('+', ' '));

    /// <summary>Only small textual bodies are inspected; larger ones are skipped (a real WAF has a body-size policy too).</summary>
    private static async Task<string?> ReadBodyAsync(HttpRequest req, int max, CancellationToken ct)
    {
        if (req.ContentLength is not > 0 || req.ContentLength > max)
        {
            return null;
        }

        var type = req.ContentType ?? string.Empty;
        var textual = type.Contains("json", StringComparison.OrdinalIgnoreCase)
                      || type.Contains("x-www-form-urlencoded", StringComparison.OrdinalIgnoreCase)
                      || type.StartsWith("text/", StringComparison.OrdinalIgnoreCase);
        if (!textual)
        {
            return null;
        }

        req.EnableBuffering();
        using var reader = new StreamReader(req.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, bufferSize: 1024, leaveOpen: true);
        var text = await reader.ReadToEndAsync(ct);
        req.Body.Position = 0;
        return text;
    }
}
