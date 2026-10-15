// Log Analytics workspace + workspace-based Application Insights.
param prefix string
param location string
param tags object
@minValue(30)
param retentionDays int = 30
@description('Daily ingestion cap in GB; -1 = no cap. Use a cap in dev to bound cost.')
param dailyQuotaGb int = -1
@description('Principals allowed to publish telemetry (Monitoring Metrics Publisher).')
param metricsPublisherPrincipalIds array = []

var metricsPublisherRole = '3913510d-42f4-4e42-8a64-420c390055eb'

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${prefix}'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionDays
    workspaceCapping: {
      dailyQuotaGb: dailyQuotaGb
    }
    features: {
      disableLocalAuth: true
    }
  }
}

resource appi 'Microsoft.Insights/components@2020-02-02' = {
  name: 'appi-${prefix}'
  location: location
  tags: tags
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: law.id
    DisableLocalAuth: true // telemetry must use Entra auth (Monitor Metrics Publisher)
  }
}

resource publisher 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in metricsPublisherPrincipalIds: {
  name: guid(appi.id, p, metricsPublisherRole)
  scope: appi
  properties: {
    principalId: p
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', metricsPublisherRole)
  }
}]

output workspaceId string = law.id
output workspaceName string = law.name
output appInsightsId string = appi.id
output appInsightsConnectionString string = appi.properties.ConnectionString
