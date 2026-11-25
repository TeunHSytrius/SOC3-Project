namespace Soc.Business.Services;
public sealed class SocException(int status,string message):Exception(message) { public int Status {get;}=status; }
