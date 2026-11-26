using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Storage;
using Soc.Data.Entities;
namespace Soc.Data.Context;

public sealed class TenantDbFactory(string connectionString)
{
    public TenantDbContext Open(Tenant tenant) => new(new DbContextOptionsBuilder<TenantDbContext>().UseSqlServer(connectionString).ReplaceService<IModelCacheKeyFactory, SchemaModelCacheKeyFactory>().Options, tenant.SchemaName);
    // Additive upgrade for existing local demo schemas; production requires separate reviewed deployment.
    public async Task UpgradeDemoAsync(Tenant tenant)
    {
        await using var db = Open(tenant);
        var schema = db.Schema;
        var alerts = $"[{schema}].[Alerts]";
        var cases = $"[{schema}].[Cases]";
        var observables = $"[{schema}].[Observables]";
        var events = $"[{schema}].[CaseEvents]";
        var sql = $"""
            IF COL_LENGTH('{alerts}', 'SourceIntegrationId') IS NULL ALTER TABLE {alerts} ADD SourceIntegrationId uniqueidentifier NULL;
            IF COL_LENGTH('{alerts}', 'ExternalEventId') IS NULL ALTER TABLE {alerts} ADD ExternalEventId nvarchar(200) NULL;
            IF COL_LENGTH('{alerts}', 'PayloadHash') IS NULL ALTER TABLE {alerts} ADD PayloadHash nvarchar(64) NULL;
            IF COL_LENGTH('{alerts}', 'OccurredAt') IS NULL ALTER TABLE {alerts} ADD OccurredAt datetimeoffset NULL;
            IF COL_LENGTH('{alerts}', 'NormalizedPayload') IS NULL ALTER TABLE {alerts} ADD NormalizedPayload nvarchar(max) NULL;
            IF COL_LENGTH('{alerts}', 'RowVersion') IS NULL ALTER TABLE {alerts} ADD RowVersion rowversion NOT NULL;
            IF COL_LENGTH('{cases}', 'RowVersion') IS NULL ALTER TABLE {cases} ADD RowVersion rowversion NOT NULL;
            IF COL_LENGTH('{cases}', 'Summary') IS NULL ALTER TABLE {cases} ADD Summary nvarchar(max) NULL;
            IF COL_LENGTH('{observables}', 'Assessment') IS NULL ALTER TABLE {observables} ADD Assessment nvarchar(max) NULL;
            IF COL_LENGTH('{events}', 'ScopeId') IS NULL
            BEGIN
                ALTER TABLE {events} ADD ScopeId uniqueidentifier NULL;
                EXEC(N'UPDATE e SET ScopeId=c.ScopeId FROM {events} e JOIN {cases} c ON e.CaseId=c.Id');
                EXEC(N'ALTER TABLE {events} ALTER COLUMN ScopeId uniqueidentifier NOT NULL');
            END;
            IF COL_LENGTH('{observables}', 'ScopeId') IS NULL
            BEGIN
                ALTER TABLE {observables} ADD ScopeId uniqueidentifier NULL;
                EXEC(N'UPDATE o SET ScopeId=c.ScopeId FROM {observables} o JOIN {cases} c ON o.CaseId=c.Id');
                EXEC(N'ALTER TABLE {observables} ALTER COLUMN ScopeId uniqueidentifier NOT NULL');
            END;
            IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE parent_object_id=OBJECT_ID('{alerts}') AND name='CK_Alert_Deadline')
                ALTER TABLE {alerts} WITH CHECK ADD CONSTRAINT [CK_Alert_Deadline] CHECK ([Deadline] >= [CreatedAt]);
            IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE parent_object_id=OBJECT_ID('{cases}') AND name='AK_Cases_ScopeId_Id')
                ALTER TABLE {cases} ADD CONSTRAINT [AK_Cases_ScopeId_Id] UNIQUE ([ScopeId],[Id]);
            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('{alerts}') AND name='FK_Alerts_Cases_ScopeId_CaseId')
                ALTER TABLE {alerts} WITH CHECK ADD CONSTRAINT [FK_Alerts_Cases_ScopeId_CaseId] FOREIGN KEY ([ScopeId],[CaseId]) REFERENCES {cases} ([ScopeId],[Id]);
            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('{events}') AND name='FK_CaseEvents_Cases_ScopeId_CaseId')
                EXEC(N'ALTER TABLE {events} WITH CHECK ADD CONSTRAINT [FK_CaseEvents_Cases_ScopeId_CaseId] FOREIGN KEY ([ScopeId],[CaseId]) REFERENCES {cases} ([ScopeId],[Id])');
            IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID('{observables}') AND name='FK_Observables_Cases_ScopeId_CaseId')
                EXEC(N'ALTER TABLE {observables} WITH CHECK ADD CONSTRAINT [FK_Observables_Cases_ScopeId_CaseId] FOREIGN KEY ([ScopeId],[CaseId]) REFERENCES {cases} ([ScopeId],[Id])');
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID('{alerts}') AND name='IX_Alerts_SourceIntegrationId_ExternalEventId')
                EXEC(N'CREATE UNIQUE INDEX [IX_Alerts_SourceIntegrationId_ExternalEventId] ON {alerts} ([SourceIntegrationId],[ExternalEventId]) WHERE [SourceIntegrationId] IS NOT NULL AND [ExternalEventId] IS NOT NULL');
            """;
        await using var transaction = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync(sql);
        await transaction.CommitAsync();
    }
    // Called on provision only; platform and tenant schemas share one database.
    public async Task ProvisionAsync(Tenant tenant)
    {
        await using var db = Open(tenant);
        await db.GetService<IRelationalDatabaseCreator>().CreateTablesAsync();
    }
}
