namespace Soc.Business.DTOs;

public sealed record CaseActionRequest
{
    public string? RowVersion { get; init; }

    public string? Status { get; init; }

    public Guid? UserId { get; init; }

    public string? Priority { get; init; }

    public string? Reason { get; init; }

    public string? NextAction { get; init; }

    public string? Summary { get; init; }

    public string? Conclusion { get; init; }

    public bool? Visible { get; init; }

    public string? Kind { get; init; }

    public string? Text { get; init; }

    public string? Type { get; init; }

    public string? Value { get; init; }

    public string? Assessment { get; init; }

    public Guid? AlertId { get; init; }
}
