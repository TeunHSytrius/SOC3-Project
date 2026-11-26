namespace Soc.Business.DTOs;

public sealed class AlertActionRequest
{
    public string? RowVersion { get; init; }

    public string? Outcome { get; init; }

    public string? Reason { get; init; }

    public Guid? CaseId { get; init; }

    public string? Title { get; init; }
}
