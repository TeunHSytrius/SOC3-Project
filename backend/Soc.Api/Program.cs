using Soc.Api.Diagnostics;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using System.Threading.RateLimiting;
using Soc.Api.Security;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using Soc.Business.Services;
var builder=WebApplication.CreateBuilder(args);
var connection=builder.Configuration.GetConnectionString("Soc") ?? throw new InvalidOperationException("ConnectionStrings:Soc ontbreekt.");
var demo=builder.Configuration.GetValue<bool>("Demo:Enabled");
builder.Services.AddDataProtection().SetApplicationName("SOC3");
if(builder.Configuration["DataProtection:KeyPath"] is string keyPath) builder.Services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keyPath));
builder.Services.AddAntiforgery(o=>{o.HeaderName="X-CSRF-TOKEN";o.Cookie.HttpOnly=true;o.Cookie.SecurePolicy=demo?CookieSecurePolicy.SameAsRequest:CookieSecurePolicy.Always;o.Cookie.SameSite=SameSiteMode.Lax;});
builder.Services.AddRateLimiter(o=>{o.RejectionStatusCode=429;o.AddPolicy("login",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions{PermitLimit=12,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));o.AddPolicy("ingest",ctx=>RateLimitPartition.GetFixedWindowLimiter(ctx.Connection.RemoteIpAddress?.ToString()??"local",_=>new FixedWindowRateLimiterOptions{PermitLimit=120,Window=TimeSpan.FromMinutes(1),QueueLimit=0}));});
builder.Services.AddDbContext<SocDbContext>(o=>o.UseSqlServer(connection));
builder.Services.AddSingleton(new TenantDbFactory(connection));
builder.Services.AddIdentity<AppUser,IdentityRole<Guid>>(o=>{o.User.RequireUniqueEmail=true;o.Password.RequiredLength=8;o.Password.RequireNonAlphanumeric=true;o.Lockout.MaxFailedAccessAttempts=5;}).AddEntityFrameworkStores<SocDbContext>().AddDefaultTokenProviders();
builder.Services.AddScoped<IUserStore<AppUser>,ProtectedUserStore>();
builder.Services.ConfigureApplicationCookie(o=>{o.Cookie.HttpOnly=true;o.Cookie.SameSite=SameSiteMode.Lax;o.Cookie.SecurePolicy=demo?CookieSecurePolicy.SameAsRequest:CookieSecurePolicy.Always;o.ExpireTimeSpan=TimeSpan.FromHours(8);o.Events.OnRedirectToLogin=c=>{c.Response.StatusCode=401;return Task.CompletedTask;};o.Events.OnRedirectToAccessDenied=c=>{c.Response.StatusCode=403;return Task.CompletedTask;};});
builder.Services.AddControllers().AddJsonOptions(o=>o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter()));builder.Services.AddOpenApi();builder.Services.AddScoped<SocService>();
builder.Services.AddSingleton<ApiErrorLog>();
var app=builder.Build();
app.UseMiddleware<ApiErrorMiddleware>();
app.UseStatusCodePages(async statusContext =>
{
    var ctx = statusContext.HttpContext;
    if (!ctx.Request.Path.StartsWithSegments("/api")) return;
    await ctx.Response.WriteAsJsonAsync(new { message = ApiErrorMiddleware.Reason(ctx.Response.StatusCode), traceId = ctx.TraceIdentifier });
});
app.UseDefaultFiles();app.UseStaticFiles();app.UseRouting();app.UseAuthentication();
// A browser tab that was signed in as a different user must not use a newly shared cookie.
app.Use(async (ctx,next)=>{
    if(ctx.Request.Path.StartsWithSegments("/api/v1")&&ctx.Request.Headers.TryGetValue("X-SOC-User",out var expected)&&ctx.User.Identity?.IsAuthenticated==true)
    {
        var actual=ctx.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if(!string.Equals(expected.ToString(),actual,StringComparison.OrdinalIgnoreCase))
        {
            ctx.Response.StatusCode=401;
            await ctx.Response.WriteAsJsonAsync(new{message="De sessie is gewijzigd. Log opnieuw in.",traceId=ctx.TraceIdentifier});
            return;
        }
    }
    await next();
});
app.UseRateLimiter();
app.Use(async (ctx,next)=>{if((HttpMethods.IsPost(ctx.Request.Method)||HttpMethods.IsPatch(ctx.Request.Method))&&ctx.Request.Path.StartsWithSegments("/api/v1")&&!ctx.Request.Path.StartsWithSegments("/api/v1/ingest")){try{await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);}catch(AntiforgeryValidationException){ctx.Response.StatusCode=400;await ctx.Response.WriteAsJsonAsync(new{message="Ongeldige CSRF-token. Vernieuw de pagina.",traceId=ctx.TraceIdentifier});return;}}await next();});
app.UseAuthorization();app.MapControllers();app.MapOpenApi();app.MapGet("/api/v1/health",async (SocDbContext db)=>await db.Database.CanConnectAsync()?Results.Ok(new{status="ok"}):Results.Json(new{status="unavailable",message="SQL Server niet bereikbaar."},statusCode:503));app.MapFallback("/api/{**path}", (HttpContext ctx) => {ctx.Response.StatusCode=404;return Task.CompletedTask;});app.MapFallbackToFile("index.html");
if(demo)
{
    app.Logger.LogInformation("SOC-demo initialiseren: database, klantschema's en demoaccounts.");
    for(var attempt=1; ;attempt++)
    {
        using var scope=app.Services.CreateScope();
        try
        {
            await scope.ServiceProvider.GetRequiredService<SocService>().InitializeAsync();
            app.Logger.LogInformation("SOC-demo gereed.");
            break;
        }
        catch(Microsoft.Data.SqlClient.SqlException ex) when(attempt<30 && ex.Number is -2 or 53 or 64 or 233 or 258 or 10053 or 10054 or 10060 or 10061 or 11001)
        {
            app.Logger.LogWarning("SQL Server niet bereikbaar (poging {Attempt}/30, SQL-code {Code}).",attempt,ex.Number);
            await Task.Delay(3000);
        }
        catch(Exception ex)
        {
            app.Logger.LogError(ex,"SOC-demo initialisatie mislukt. Controleer SQL-configuratie en bestaande schema's. Verwijder geen volumes om de fout te maskeren.");
            throw;
        }
    }
}
app.Run();
