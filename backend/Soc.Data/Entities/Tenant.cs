using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class Tenant { public Guid Id {get;set;}=Guid.NewGuid(); public string Name {get;set;}=""; public string SchemaName {get;set;}=""; public bool IsActive {get;set;}=true; public DateTimeOffset CreatedAt {get;set;}=DateTimeOffset.UtcNow; public DateTimeOffset? DeactivatedAt {get;set;} }
