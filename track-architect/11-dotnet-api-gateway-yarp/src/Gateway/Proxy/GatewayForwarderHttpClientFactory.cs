using System.Net;
using AdFlow.Gateway.Configuration;
using Microsoft.Extensions.Options;
using Yarp.ReverseProxy.Forwarder;

namespace AdFlow.Gateway.Proxy;

/// <summary>
/// Builds the HttpMessageInvoker YARP uses to call destinations: hardened SocketsHttpHandler settings (no proxy, no
/// redirects, no cookies, no automatic decompression so payloads pass through untouched) wrapped by the resilience
/// handler. A client is rebuilt only when the cluster's HTTP client config changes, which preserves breaker state.
/// </summary>
public sealed class GatewayForwarderHttpClientFactory(IOptionsMonitor<GatewayOptions> options) : IForwarderHttpClientFactory
{
    public HttpMessageInvoker CreateClient(ForwarderHttpClientContext context)
    {
        if (context.OldClient is not null && context.NewConfig == context.OldConfig)
        {
            return context.OldClient;
        }

        var sockets = new SocketsHttpHandler
        {
            UseProxy = false,
            AllowAutoRedirect = false,
            AutomaticDecompression = DecompressionMethods.None,
            UseCookies = false,
            EnableMultipleHttp2Connections = true,
            ConnectTimeout = TimeSpan.FromSeconds(5),
            PooledConnectionLifetime = TimeSpan.FromMinutes(5),
        };

        return new HttpMessageInvoker(new IdempotentResilienceHandler(options.CurrentValue.Resilience, sockets), disposeHandler: true);
    }
}
