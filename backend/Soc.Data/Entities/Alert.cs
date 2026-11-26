namespace Soc.Data.Entities;

public class Alert
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid? SourceIntegrationId
    {
        get; set;
    }

    public string? ExternalEventId
    {
        get; set;
    }

    public string? PayloadHash
    {
        get; set;
    }

    public DateTimeOffset? OccurredAt
    {
        get; set;
    }

    public byte[] RowVersion { get; set; } = [];

    public Guid ScopeId
    {
        get; set;
    }

    public string Number { get; set; } = "";

    public string Title { get; set; } = "";

    public string Description { get; set; } = "";

    public string Source { get; set; } = "";

    public string RawPayload { get; set; } = "";

    public string? NormalizedPayload
    {
        get; set;
    }

    public PriorityLevel Priority
    {
        get; set;
    }

    public AlertStatus Status { get; set; } = AlertStatus.New;

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;

    public DateTimeOffset Deadline
    {
        get; set;
    }

    public DateTimeOffset? FirstHandledAt
    {
        get; set;
    }

    public Guid? OwnerId
    {
        get; set;
    }

    public string? Owner
    {
        get; set;
    }

    public string? Triage
    {
        get; set;
    }

    public Guid? CaseId
    {
        get; set;
    }

    public ResearchCase? Case
    {
        get; set;
    }

    public List<AlertEvent> History { get; set; } = [];
}
