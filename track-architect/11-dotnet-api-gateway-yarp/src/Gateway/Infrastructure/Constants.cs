using System.Net;
using System.Security.Claims;

namespace AdFlow.Gateway.Infrastructure;

public static class GatewayItems
{
    public const string RejectReason = "gateway.reject_reason";
    public const string SkipAbuse = "gateway.skip_abuse";
}

public static class GatewayHeaders
{
    public const string CorrelationId = "X-Correlation-Id";
    public const string ApiKey = "X-Api-Key";
    public const string UserId = "X-User-Id";
    public const string UserRoles = "X-User-Roles";
    public const string UserScopes = "X-User-Scopes";
    public const string ClientId = "X-Client-Id";
    public const string AuthMethod = "X-Auth-Method";
}

public static class GatewayClaims
{
    public const string Subject = "sub";
    public const string Role = "role";
    public const string Scope = "scope";
    public const string ClientId = "client_id";
    public const string AuthMethod = "auth_method";
}

public static class ClaimsExtensions
{
    public static string? Subject(this ClaimsPrincipal p) => p.FindFirst(GatewayClaims.Subject)?.Value;

    public static IEnumerable<string> Scopes(this ClaimsPrincipal p) =>
        p.FindAll(GatewayClaims.Scope).Concat(p.FindAll("scp"))
            .SelectMany(c => c.Value.Split(' ', StringSplitOptions.RemoveEmptyEntries));

    public static bool HasScope(this ClaimsPrincipal p, string scope) =>
        p.Scopes().Contains(scope, StringComparer.Ordinal);

    public static IEnumerable<string> Roles(this ClaimsPrincipal p) =>
        p.FindAll(GatewayClaims.Role).Select(c => c.Value);
}

public static class IpKey
{
    public static string Of(IPAddress? ip) =>
        ip is null ? "unknown" : (ip.IsIPv4MappedToIPv6 ? ip.MapToIPv4() : ip).ToString();
}
