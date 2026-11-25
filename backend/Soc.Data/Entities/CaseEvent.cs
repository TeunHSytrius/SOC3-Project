using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class CaseEvent { public Guid Id {get;set;}=Guid.NewGuid(); public Guid CaseId {get;set;} public DateTimeOffset At {get;set;}=DateTimeOffset.UtcNow; public string Actor {get;set;}=""; public string Kind {get;set;}=""; public string Text {get;set;}=""; public bool Visible {get;set;} }
