// Container registry. Premium is required for private endpoints.
param name string
param location string
param tags object
@allowed(['Basic', 'Premium'])
param sku string
param publicNetworkAccess bool
param pullPrincipalIds array
param enablePrivateEndpoint bool
param peSubnetId string = ''
param acrZoneId string = ''

var acrPullRole = '7f951dda-4ed3-4680-a7ca-43fe172d0ec8'

resource acr 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: sku
  }
  properties: {
    adminUserEnabled: false
    anonymousPullEnabled: false
    publicNetworkAccess: publicNetworkAccess ? 'Enabled' : 'Disabled'
  }
}

resource pull 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in pullPrincipalIds: {
  name: guid(acr.id, p, acrPullRole)
  scope: acr
  properties: {
    principalId: p
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', acrPullRole)
  }
}]

module pe 'private-endpoint.bicep' = if (enablePrivateEndpoint) {
  name: 'pe-${name}'
  params: {
    name: name
    location: location
    tags: tags
    subnetId: peSubnetId
    targetResourceId: acr.id
    groupId: 'registry'
    privateDnsZoneId: acrZoneId
  }
}

output id string = acr.id
output loginServer string = acr.properties.loginServer
