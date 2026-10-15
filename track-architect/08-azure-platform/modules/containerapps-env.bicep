// Container Apps managed environment, VNet-integrated, zone-redundant in prod.
param name string
param location string
param tags object
param logAnalyticsName string
param infrastructureSubnetId string
@description('true = internal load balancer only (front with Front Door Private Link or Application Gateway).')
param internal bool
param zoneRedundant bool

resource law 'Microsoft.OperationalInsights/workspaces@2023-09-01' existing = {
  name: logAnalyticsName
}

resource env 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    zoneRedundant: zoneRedundant
    vnetConfiguration: {
      infrastructureSubnetId: infrastructureSubnetId
      internal: internal
    }
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: law.properties.customerId
        sharedKey: law.listKeys().primarySharedKey // consumed by ARM, never output
      }
    }
  }
}

output id string = env.id
output defaultDomain string = env.properties.defaultDomain
output staticIp string = env.properties.staticIp
