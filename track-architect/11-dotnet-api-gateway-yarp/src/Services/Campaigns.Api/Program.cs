// Internal Campaigns API. It is only reachable inside the compose network (no published port);
// the gateway is the single entry point and injects trusted identity headers.
var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole();
var app = builder.Build();

var instance = Environment.GetEnvironmentVariable("INSTANCE_NAME") ?? "campaigns-local";

// Defence in depth: refuse anything that did not pass through the gateway (no identity headers).
// This is NOT authentication: anyone on the internal network can forge headers. Use mTLS or a
// service mesh for real service-to-service trust.
app.Use(async (ctx, next) =>
{
    ctx.Response.Headers["X-Served-By"] = instance;
    var viaGateway = ctx.Request.Headers.ContainsKey("X-User-Id") || ctx.Request.Headers.ContainsKey("X-Client-Id");
    if (ctx.Request.Path != "/healthz" && !viaGateway)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await ctx.Response.WriteAsJsonAsync(new { error = "must_call_through_gateway" });
        return;
    }
    await next();
});

var campaigns = new List<Campaign>
{
    new("cmp-1001", "Summer sneakers", 50_000, "active"),
    new("cmp-1002", "Back to school", 120_000, "active"),
    new("cmp-1003", "Holiday gifts", 300_000, "paused"),
};

app.MapGet("/healthz", () => Results.Ok(new { status = "ok", instance }));

// v1 contract
app.MapGet("/campaigns", () => Results.Ok(campaigns));
app.MapGet("/campaigns/echo", (HttpRequest req) => Results.Ok(new
{
    instance,
    headers = req.Headers.ToDictionary(h => h.Key.ToLowerInvariant(), h => h.Value.ToString()),
}));
app.MapGet("/campaigns/{id}", (string id) =>
    campaigns.FirstOrDefault(c => c.Id == id) is { } c ? Results.Ok(c) : Results.NotFound());
app.MapPost("/campaigns", (NewCampaign body) =>
{
    var created = new Campaign($"cmp-{Random.Shared.Next(2000, 9999)}", body.Name, body.DailyBudgetCents, "draft");
    campaigns.Add(created);
    return Results.Created($"/campaigns/{created.Id}", created);
});

// v2 contract: response envelope. The gateway maps /api/v2/campaigns -> /v2/campaigns.
app.MapGet("/v2/campaigns", () => Results.Ok(new { data = campaigns, meta = new { version = "v2", count = campaigns.Count } }));

app.Run();

internal sealed record Campaign(string Id, string Name, long DailyBudgetCents, string Status);
internal sealed record NewCampaign(string Name, long DailyBudgetCents);
