using Microsoft.AspNetCore.Identity;
namespace Soc.Data.Entities;

public class ResearchCase
{
    public Guid Id { get; set; } = Guid.NewGuid(); public Guid ScopeId
    {
        get; set;
    }
    public string Number { get; set; } = ""; public string Title { get; set; } = ""; public PriorityLevel Priority
    {
        get; set;
    }
    public TicketStatus Status { get; set; } = TicketStatus.Open; public Guid OwnerId
    {
        get; set;
    }
    public string Owner { get; set; } = ""; public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow; public DateTimeOffset? ClosedAt
    {
        get; set;
    }
    public byte[] RowVersion { get; set; } = []; public string? Summary
    {
        get; set;
    }
    public string Conclusion { get; set; } = ""; public bool CustomerVisible
    {
        get; set;
    }
    public List<Alert> Alerts { get; set; } = []; public List<CaseEvent> Entries { get; set; } = []; public List<Observable> Observables { get; set; } = [];
}
