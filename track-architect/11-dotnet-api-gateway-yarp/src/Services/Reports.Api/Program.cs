// Internal Reports API (fictional AdFlow data). Gateway-only exposure, same convention as Campaigns.Api.
var builder = WebApplication.CreateBuilder(args);
builder.Logging.AddJsonConsole();
var app = builder.Build();

app.Use(async (ctx, next) =>
{
    var viaGateway = ctx.Request.Headers.ContainsKey("X-User-Id") || ctx.Request.Headers.ContainsKey("X-Client-Id");
    if (ctx.Request.Path != "/healthz" && !viaGateway)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        await ctx.Response.WriteAsJsonAsync(new { error = "must_call_through_gateway" });
        return;
    }
    await next();
});

app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

app.MapGet("/reports/summary", () => Results.Ok(new[]
{
    new { campaignId = "cmp-1001", impressions = 120_400, clicks = 2_310, spendCents = 41_250 },
    new { campaignId = "cmp-1002", impressions = 310_900, clicks = 5_870, spendCents = 98_700 },
}));

// Slow endpoint used to demonstrate gateway timeouts (delay capped at 10 s).
app.MapGet("/reports/slow", async (int? delayMs, CancellationToken ct) =>
{
    await Task.Delay(Math.Clamp(delayMs ?? 1000, 0, 10_000), ct);
    return Results.Ok(new { status = "done" });
});

app.Run();
