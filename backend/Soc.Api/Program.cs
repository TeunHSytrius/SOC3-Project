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
var app=builder.Build();
app.Use(async (ctx,next)=>{if(ctx.Request.Path.StartsWithSegments("/api"))ctx.Response.Headers.CacheControl="no-store";try {if((HttpMethods.IsPost(ctx.Request.Method)||HttpMethods.IsPatch(ctx.Request.Method))&&ctx.Request.Headers.TryGetValue("Origin",out var origin)&&(!Uri.TryCreate(origin.ToString(),UriKind.Absolute,out var uri)||!string.Equals(uri.Authority,ctx.Request.Host.Value,StringComparison.OrdinalIgnoreCase)))throw new SocException(403,"Ongeldige origin.");await next();}catch(SocException ex){if(!ctx.Response.HasStarted){ctx.Response.StatusCode=ex.Status;await ctx.Response.WriteAsJsonAsync(new{message=ex.Message,traceId=ctx.TraceIdentifier});}}catch(DbUpdateConcurrencyException ex){app.Logger.LogWarning("Concurrency conflict for {EntityTypes}, trace {TraceId}",string.Join(", ",ex.Entries.Select(e=>e.Metadata.ClrType.Name)),ctx.TraceIdentifier);if(!ctx.Response.HasStarted){ctx.Response.StatusCode=409;await ctx.Response.WriteAsJsonAsync(new{message="Record is gewijzigd. Vernieuw de gegevens.",traceId=ctx.TraceIdentifier});}}catch(DbUpdateException ex) when(ex.InnerException is Microsoft.Data.SqlClient.SqlException sql&&sql.Number==1205){if(!ctx.Response.HasStarted){ctx.Response.StatusCode=409;await ctx.Response.WriteAsJsonAsync(new{message="Gelijktijdige wijziging. Vernieuw de gegevens.",traceId=ctx.TraceIdentifier});}}catch(Microsoft.Data.SqlClient.SqlException ex) when(ex.Number==1205){if(!ctx.Response.HasStarted){ctx.Response.StatusCode=409;await ctx.Response.WriteAsJsonAsync(new{message="Gelijktijdige wijziging. Vernieuw de gegevens.",traceId=ctx.TraceIdentifier});}}});
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
app.Use(async (ctx,next)=>{if((HttpMethods.IsPost(ctx.Request.Method)||HttpMethods.IsPatch(ctx.Request.Method))&&ctx.Request.Path.StartsWithSegments("/api/v1")&&!ctx.Request.Path.StartsWithSegments("/api/v1/ingest")){try{await ctx.RequestServices.GetRequiredService<IAntiforgery>().ValidateRequestAsync(ctx);}catch(AntiforgeryValidationException){ctx.Response.StatusCode=400;await ctx.Response.WriteAsJsonAsync(new{message="Ongeldige CSRF-token. Vernieuw de pagina."});return;}}await next();});
app.UseAuthorization();app.MapControllers();app.MapOpenApi();app.MapGet("/api/v1/health",()=>Results.Ok(new{status="ok"}));app.MapFallbackToFile("index.html");
if(builder.Configuration.GetValue<bool>("Demo:Enabled")) { using var scope=app.Services.CreateScope();var service=scope.ServiceProvider.GetRequiredService<SocService>();for(var i=0;;i++){try{await service.InitializeAsync();break;}catch(Exception ex) when(i<29 && ex is not SocException){app.Logger.LogWarning(ex,"SQL Server nog niet gereed (poging {Attempt})",i+1);await Task.Delay(3000);}} }
app.Run();
