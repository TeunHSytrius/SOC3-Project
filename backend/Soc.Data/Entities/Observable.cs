using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class Observable { public Guid Id {get;set;}=Guid.NewGuid(); public Guid CaseId {get;set;} public string Value {get;set;}=""; public string Type {get;set;}="Other"; public DateTimeOffset At {get;set;}=DateTimeOffset.UtcNow; public string Actor {get;set;}=""; }
