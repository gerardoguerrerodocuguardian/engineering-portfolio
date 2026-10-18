using System.Net;
using AdFlow.Gateway.Configuration;
using Microsoft.Extensions.Options;

namespace AdFlow.Gateway.Infrastructure;

/// <summary>CIDR-aware allow/deny evaluation. Parsed lists are cached per options instance, so a config reload re-parses.</summary>
public sealed class IpPolicy(IOptionsMonitor<GatewayOptions> options)
{
    private sealed record Parsed(IpFilterOptions Source, IPNetwork[] Deny, IPNetwork[] Allow, IPNetwork[] AdminAllow);

    private Parsed? _parsed;

    public bool IsDenied(IPAddress? ip) => ip is not null && Matches(Get().Deny, ip);

    /// <summary>True when no global allowlist is configured, or the address is on it.</summary>
    public bool IsAllowedGlobally(IPAddress? ip)
    {
        var allow = Get().Allow;
        return allow.Length == 0 || (ip is not null && Matches(allow, ip));
    }

    /// <summary>Fails closed: an unknown address is never an admin address.</summary>
    public bool IsAdminAllowed(IPAddress? ip) => ip is not null && Matches(Get().AdminAllow, ip);

    private Parsed Get()
    {
        var source = options.CurrentValue.IpFilter;
        var current = _parsed;
        if (current is not null && ReferenceEquals(current.Source, source))
        {
            return current;
        }

        current = new Parsed(source, Parse(source.Deny), Parse(source.Allow), Parse(source.AdminAllow));
        _parsed = current;
        return current;
    }

    private static bool Matches(IPNetwork[] networks, IPAddress ip)
    {
        if (ip.IsIPv4MappedToIPv6)
        {
            ip = ip.MapToIPv4();
        }

        foreach (var network in networks)
        {
            if (network.Contains(ip))
            {
                return true;
            }
        }

        return false;
    }

    private static IPNetwork[] Parse(string[] items)
    {
        var list = new List<IPNetwork>();
        foreach (var raw in items)
        {
            var text = raw.Trim();
            if (text.Length == 0)
            {
                continue;
            }

            if (!text.Contains('/'))
            {
                text += text.Contains(':') ? "/128" : "/32";
            }

            if (IPNetwork.TryParse(text, out var network))
            {
                list.Add(network);
            }
        }

        return [.. list];
    }
}
