using System.Security.Cryptography;
using AdFlow.Gateway.Configuration;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AdFlow.Gateway.Security;

/// <summary>
/// Dev signing key. Never committed: it is either supplied through configuration (base64) or generated randomly at
/// startup, so tokens do not survive a restart. Production uses an OIDC authority (JWKS) instead.
/// </summary>
public sealed class SigningKeyProvider
{
    public SigningKeyProvider(IOptionsMonitor<GatewayOptions> options)
    {
        var configured = options.CurrentValue.Auth.SigningKey;
        var bytes = string.IsNullOrWhiteSpace(configured) ? RandomNumberGenerator.GetBytes(32) : Convert.FromBase64String(configured);
        if (bytes.Length < 32)
        {
            throw new InvalidOperationException("Gateway:Auth:SigningKey must decode to at least 32 bytes.");
        }

        Key = new SymmetricSecurityKey(bytes) { KeyId = "dev-1" };
        Credentials = new SigningCredentials(Key, SecurityAlgorithms.HmacSha256);
    }

    public SymmetricSecurityKey Key { get; }

    public SigningCredentials Credentials { get; }
}
