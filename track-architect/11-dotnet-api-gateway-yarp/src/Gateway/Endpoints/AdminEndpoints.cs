using System.Net;
using AdFlow.Gateway.Abuse;
using AdFlow.Gateway.Audit;
using AdFlow.Gateway.Infrastructure;

namespace AdFlow.Gateway.Endpoints;

public sealed record BanRequest(string Ip, int Minutes, string? Reason);

/// <summary>
/// Operator API. Three independent gates: the IP allowlist middleware (admin networks only), the "admin" authorization
/// policy (role), and an audit event for every state change.
/// </summary>
public static class AdminEndpoints
{
    public static IEndpointRouteBuilder MapAdmin(this IEndpointRouteBuilder app)
    {
        var admin = app.MapGroup("/admin").RequireAuthorization("admin");

        admin.MapGet("/blocked", (IAbuseStore store) => Results.Ok(store.ListBans()));

        admin.MapPost("/blocked", (BanRequest request, IAbuseStore store, IAuditLog audit, HttpContext ctx) =>
        {
            if (!IPAddress.TryParse(request.Ip, out var ip) || request.Minutes is < 1 or > 1440)
            {
                return Results.BadRequest(new { error = "invalid_request" });
            }

            var ban = store.Ban(IpKey.Of(ip), TimeSpan.FromMinutes(request.Minutes), request.Reason ?? "manual");
            audit.Write(AuditEvent.From(ctx, "admin_ban", 200, $"ip={ban.Ip} minutes={request.Minutes}"));
            return Results.Ok(ban);
        });

        admin.MapDelete("/blocked/{ip}", (string ip, IAbuseStore store, IAuditLog audit, HttpContext ctx) =>
        {
            if (!IPAddress.TryParse(ip, out var parsed))
            {
                return Results.BadRequest(new { error = "invalid_ip" });
            }

            var removed = store.Unban(IpKey.Of(parsed));
            audit.Write(AuditEvent.From(ctx, "admin_unblock", removed ? 204 : 404, $"ip={ip}"));
            return removed ? Results.NoContent() : Results.NotFound();
        });

        admin.MapGet("/stats", (GatewayMetrics metrics, IAbuseStore store) => Results.Ok(new
        {
            rejectedTotal = metrics.TotalRejected,
            rejectedByReason = metrics.ByReason,
            bansIssued = metrics.TotalBans,
            activeBans = store.ListBans().Count,
        }));

        admin.MapGet("/audit", (IAuditLog audit, int? take) => Results.Ok(audit.Recent(take ?? 50)));

        admin.MapPost("/reload", (IConfiguration configuration, IAuditLog audit, HttpContext ctx) =>
        {
            // Re-reads every configuration provider. YARP and IOptionsMonitor observe the change tokens and apply it
            // without a restart (routes, clusters, limits, lists).
            if (configuration is not IConfigurationRoot root)
            {
                return Results.StatusCode(StatusCodes.Status501NotImplemented);
            }

            root.Reload();
            audit.Write(AuditEvent.From(ctx, "admin_reload", 200, "configuration reloaded"));
            return Results.Ok(new { reloaded = true });
        });

        return app;
    }
}
