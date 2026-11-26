namespace Soc.Data.Entities;

    public class AlertEvent
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid AlertId
    { get; set; }

    public DateTimeOffset At { get; set; } = DateTimeOffset.UtcNow;

    public string Actor { get; set; } = "";

    public string Text { get; set; } = "";
}
