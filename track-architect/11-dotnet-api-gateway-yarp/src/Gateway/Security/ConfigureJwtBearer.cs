using AdFlow.Gateway.Configuration;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AdFlow.Gateway.Security;

/// <summary>
/// OIDC-style token validation: signature, issuer, audience, lifetime with a bounded clock skew, and an explicit
/// algorithm allowlist (blocks "alg" confusion / "none"). Resolved lazily so test and runtime configuration apply.
/// </summary>
public sealed class ConfigureJwtBearer(IOptionsMonitor<GatewayOptions> gateway, SigningKeyProvider keys) : IConfigureNamedOptions<JwtBearerOptions>
{
    public void Configure(JwtBearerOptions options) => Configure(JwtBearerDefaults.AuthenticationScheme, options);

    public void Configure(string? name, JwtBearerOptions options)
    {
        if (name != JwtBearerDefaults.AuthenticationScheme)
        {
            return;
        }

        var auth = gateway.CurrentValue.Auth;
        var useAuthority = !string.IsNullOrWhiteSpace(auth.Authority);

        options.MapInboundClaims = false; // keep "sub", "role", "scope" as issued
        options.SaveToken = false;
        options.IncludeErrorDetails = false; // do not leak validation details to callers
        if (useAuthority)
        {
            options.Authority = auth.Authority;
            options.RequireHttpsMetadata = true;
        }

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = string.IsNullOrWhiteSpace(auth.Issuer) ? null : auth.Issuer,
            ValidateAudience = true,
            ValidAudience = auth.Audience,
            ValidateLifetime = true,
            RequireExpirationTime = true,
            RequireSignedTokens = true,
            ValidateIssuerSigningKey = true,
            ClockSkew = TimeSpan.FromSeconds(auth.ClockSkewSeconds),
            NameClaimType = "sub",
            RoleClaimType = "role",
            ValidAlgorithms = useAuthority
                ? new[] { SecurityAlgorithms.RsaSha256, SecurityAlgorithms.EcdsaSha256, SecurityAlgorithms.RsaSsaPssSha256 }
                : new[] { SecurityAlgorithms.HmacSha256 },
            IssuerSigningKey = useAuthority ? null : keys.Key,
        };
    }
}
