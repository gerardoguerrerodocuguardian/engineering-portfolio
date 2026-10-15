// Service Bus namespace with a topic, a subscription and dead-lettering.
// Standard SKU has no private endpoints; Premium does (see enablePrivateEndpoint).
param name string
param location string
param tags object
param logAnalyticsId string
@allowed(['Standard', 'Premium'])
param sku string
@description('Premium messaging units (1, 2, 4, 8, 16). Ignored for Standard.')
param premiumCapacity int = 1
param publicNetworkAccess bool
param topicName string = 'bid-events'
param subscriptionName string = 'bid-processor'
param maxDeliveryCount int = 10
param lockDuration string = 'PT1M'
param messageTtl string = 'P1D'
param senderPrincipalIds array
param receiverPrincipalIds array
@description('Principals needing queue-depth (management) rights for KEDA. Scoped to the topic.')
param ownerPrincipalIds array
param enablePrivateEndpoint bool
param peSubnetId string = ''
param sbZoneId string = ''

var senderRole = '69a216fc-b8fb-44d8-bc22-1f3c2cd27a39' // Azure Service Bus Data Sender
var receiverRole = '4f6d3b9b-027b-4f4c-9142-0e5a2a2247e0' // Azure Service Bus Data Receiver
var ownerRole = '090c5cfd-751d-490a-894a-3ce6f1109419' // Azure Service Bus Data Owner

resource ns 'Microsoft.ServiceBus/namespaces@2023-01-01-preview' = {
  name: name
  location: location
  tags: tags
  sku: sku == 'Premium' ? {
    name: 'Premium'
    tier: 'Premium'
    capacity: premiumCapacity
  } : {
    name: 'Standard'
    tier: 'Standard'
  }
  properties: {
    disableLocalAuth: true // no SAS keys anywhere; Entra ID only
    minimumTlsVersion: '1.2'
    publicNetworkAccess: publicNetworkAccess ? 'Enabled' : 'Disabled'
    zoneRedundant: sku == 'Premium'
  }
}

resource topic 'Microsoft.ServiceBus/namespaces/topics@2023-01-01-preview' = {
  parent: ns
  name: topicName
  properties: {
    defaultMessageTimeToLive: messageTtl
    requiresDuplicateDetection: true
    duplicateDetectionHistoryTimeWindow: 'PT10M'
    enablePartitioning: false
  }
}

resource sub 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2023-01-01-preview' = {
  parent: topic
  name: subscriptionName
  properties: {
    lockDuration: lockDuration
    maxDeliveryCount: maxDeliveryCount
    deadLetteringOnMessageExpiration: true
    deadLetteringOnFilterEvaluationExceptions: true
    defaultMessageTimeToLive: messageTtl
  }
}

resource senders 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in senderPrincipalIds: {
  name: guid(topic.id, p, senderRole)
  scope: topic
  properties: {
    principalId: p
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', senderRole)
  }
}]

resource receivers 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in receiverPrincipalIds: {
  name: guid(sub.id, p, receiverRole)
  scope: sub
  properties: {
    principalId: p
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', receiverRole)
  }
}]

resource owners 'Microsoft.Authorization/roleAssignments@2022-04-01' = [for p in ownerPrincipalIds: {
  name: guid(topic.id, p, ownerRole)
  scope: topic
  properties: {
    principalId: p
    principalType: 'ServicePrincipal'
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', ownerRole)
  }
}]

resource diag 'Microsoft.Insights/diagnosticSettings@2021-05-01-preview' = {
  name: 'to-law'
  scope: ns
  properties: {
    workspaceId: logAnalyticsId
    logs: [
      {
        categoryGroup: 'allLogs'
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
    targetResourceId: ns.id
    groupId: 'namespace'
    privateDnsZoneId: sbZoneId
  }
}

output id string = ns.id
output fqdn string = '${ns.name}.servicebus.windows.net'
output namespaceName string = ns.name
output topicName string = topic.name
output subscriptionName string = sub.name
