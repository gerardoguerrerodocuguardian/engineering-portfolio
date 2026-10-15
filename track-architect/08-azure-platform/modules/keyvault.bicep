// Key Vault: RBAC authorization only (no access policies), purge protection, private endpoint.
param name string
param location string
param tags object
param logAnalyticsId string
param publicNetworkAccess bool
param softDeleteDays int = 90
@description('Principals allowed to read secrets (Key Vault Secrets User).')
param secretsReaderPrincipalIds array
param enablePrivateEndpoint bool
param peSubnetId string = ''
param kvZoneId string = ''

// Key Vault Secrets User
var secretsUserRole = '4633458b-17de-408a-b874-0445c86b69e6'

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: softDeleteDays
    enablePurgeProtection: true
    publicNetworkAccess: publicNetworkAccess ? 'Enabled' : 'Disabled'
    networkAcls: {
      defaultAction: publicNetworkAccess ? 'Allow' : 'Deny'
      bypass: 'AzureServices'
    }
  }
}

resource reader 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in secretsReaderPrincipalIds: {
  name: guid(kv.id, p, secretsUserRole)
  scope: kv
  properties: {
    principalId: p
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', secretsUserRole)
  }
}]

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-law'
  scope: kv
  properties: {
    workspaceId: logAnalyticsId
    logs: [
      {
        categoryGroup: 'audit'
        enabled: true
      }
    ]
  }
}

module pe 'private-endpoint.bicep' = if (enablePrivateEndpoint) {
  name: 'pe-${name}'
  params: {
    name: name
    location: location
    tags: tags
    subnetId: peSubnetId
    targetResourceId: kv.id
    groupId: 'vault'
    privateDnsZoneId: kvZoneId
  }
}

output id string = kv.id
output uri string = kv.properties.vaultUri
