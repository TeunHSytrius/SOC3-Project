using Soc.Data.Domain.Entities.Enums;
namespace Soc.Data.Domain.Entities;
using System.ComponentModel.DataAnnotations;

public class Employee
{
    [Key]
    public int EmployeeId { get; set; }
    [Required]
    public string Name { get; set; }
    [Required]
    public string Email { get; set; }
    [Required]
    public string Adress { get; set; }
    [Required]
    public ClearanceLevel Clearance { get; set; }

}

public class Analyst : Employee
{
    [Required]
    public string analystType { get; set; }


}
