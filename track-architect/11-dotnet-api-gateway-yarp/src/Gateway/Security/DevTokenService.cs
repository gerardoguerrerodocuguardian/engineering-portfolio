using AdFlow.Gateway.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace AdFlow.Gateway.Security;

public sealed record DemoUser(string Name, string[] Roles, string[] Scopes);

/// <summary>Issues demo JWTs for fictional users. A real deployment delegates this to an identity provider.</summary>
public sealed class DevTokenService(SigningKeyProvider keys, IOptionsMonitor<GatewayOptions> options, TimeProvider time)
{
    public static IReadOnlyDictionary<string, DemoUser> DemoUsers { get; } = new Dictionary<string, DemoUser>(StringComparer.OrdinalIgnoreCase)
    {
        ["alice"] = new("alice", ["campaign-manager"], ["campaigns.read", "campaigns.write"]),
        ["bob"] = new("bob", ["analyst"], ["campaigns.read", "reports.read"]),
        ["root"] = new("root", ["admin"], ["campaigns.read", "campaigns.write", "reports.read", "admin"]),
    };

    public string IssueFor(string user, TimeSpan? lifetime = null)
    {
        var demo = DemoUsers[user];
        return Issue(demo.Name, demo.Roles, demo.Scopes, lifetime ?? TimeSpan.FromMinutes(options.CurrentValue.Auth.DevTokens.LifetimeMinutes));
    }

    /// <summary>A negative lifetime produces an already-expired token (used by tests).</summary>
    public string Issue(string subject, string[] roles, string[] scopes, TimeSpan lifetime, string? audience = null)
    {
        var auth = options.CurrentValue.Auth;
        var now = time.GetUtcNow().UtcDateTime;
        var expires = now + lifetime;
        var notBefore = lifetime > TimeSpan.Zero ? now : expires.AddMinutes(-5);

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = auth.Issuer,
            Audience = audience ?? auth.Audience,
            IssuedAt = notBefore,
            NotBefore = notBefore,
            Expires = expires,
            SigningCredentials = keys.Credentials,
            Claims = new Dictionary<string, object>
            {
                ["sub"] = subject,
                ["role"] = roles,
                ["scope"] = string.Join(' ', scopes),
                ["jti"] = Guid.NewGuid().ToString("N"),
            },
        };

        return new JsonWebTokenHandler().CreateToken(descriptor);
    }
}
