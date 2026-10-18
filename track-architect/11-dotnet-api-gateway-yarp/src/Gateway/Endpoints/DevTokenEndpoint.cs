using AdFlow.Gateway.Configuration;
using AdFlow.Gateway.Security;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Endpoints;

public sealed record TokenRequest(string? User);

public static class DevTokenEndpoint
{
    /// <summary>
    /// Demo-only token issuer. Hidden (404) unless Gateway:Auth:DevTokens:Enabled is true AND no OIDC authority is
    /// configured. Never enable it on an internet-facing instance.
    /// </summary>
    public static IEndpointRouteBuilder MapDevToken(this IEndpointRouteBuilder app)
    {
        app.MapPost("/dev/token", Issue).AllowAnonymous();
        return app;
    }

    private static IResult Issue(TokenRequest? request, DevTokenService tokens, IOptionsMonitor<GatewayOptions> options)
    {
        var auth = options.CurrentValue.Auth;
        if (!auth.DevTokens.Enabled || !string.IsNullOrWhiteSpace(auth.Authority))
        {
            return Results.NotFound();
        }

        var user = request?.User ?? string.Empty;
        if (!DevTokenService.DemoUsers.ContainsKey(user))
        {
            return Results.BadRequest(new { error = "unknown_user", knownUsers = DevTokenService.DemoUsers.Keys });
        }

        var lifetime = TimeSpan.FromMinutes(auth.DevTokens.LifetimeMinutes);
        return Results.Ok(new
        {
            access_token = tokens.IssueFor(user, lifetime),
            token_type = "Bearer",
            expires_in = (int)lifetime.TotalSeconds,
        });
    }
}
