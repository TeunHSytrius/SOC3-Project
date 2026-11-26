using System.Security.Cryptography;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Soc.Data.Context;
using Soc.Data.Entities;
using static Soc.Business.Services.SocService;

namespace Soc.Business.Services;

public sealed class ApiKeyService(SocDbContext db, SocService platform)
{
    private static object KeyDto(ApiSource apiKey)
    {
        return new
        {
            id = apiKey.Id,
            apiKey.Name,
            organizationId = apiKey.TenantId,
            apiKey.ScopeId,
            apiKey.CreatedAt,
            apiKey.IsActive,
            apiKey.Prefix
        };
    }
    public async Task<object> Keys(AppUser user)
    {
        Admin(user);
        return (await db.Sources.ToListAsync()).Select(KeyDto);
    }
    public async Task<object> CreateKey(AppUser user, CreateApiKeyRequest input)
    {
        Admin(user);
        var organization = await platform.Tenant(input.OrganizationId);
        Require(organization.IsActive, "Klant is inactief.", 400);
        var scope = await db.Scopes.FirstOrDefaultAsync(x => x.TenantId == organization.Id && (!input.ScopeId.HasValue || x.Id == input.ScopeId)) ?? throw new SocException(400, "Scope ontbreekt.");
        var secret = "soc_demo_" + Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var apiSource = new ApiSource { TenantId = organization.Id, ScopeId = scope.Id, Name = Required(input.Name, 80), Hash = Hash(secret), Prefix = secret[..16] };
        db.Sources.Add(apiSource);
        await platform.Log(user, "API-sleutel aangemaakt", organization.Id);
        return new
        {
            id = apiSource.Id,
            apiSource.Name,
            organizationId = apiSource.TenantId,
            apiSource.ScopeId,
            apiSource.CreatedAt,
            apiSource.IsActive,
            apiSource.Prefix,
            secret
        };
    }
    public async Task<object> Revoke(AppUser user, Guid id)
    {
        Admin(user);
        var apiSource = await db.Sources.FindAsync(id) ?? throw new SocException(404, "Sleutel niet gevonden.");
        apiSource.IsActive = false;
        await platform.Log(user, "API-sleutel ingetrokken", apiSource.TenantId);
        return new
        {
            ok = true
        };
    }
}
