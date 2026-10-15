// AdFlow platform on Azure. Scope: resource group.
//   az deployment group create -g <rg> -f main.bicep -p params/dev.bicepparam
targetScope = 'resourceGroup'

@allowed(['dev', 'prod'])
param envName string
param location string = resourceGroup().location
@description('Short workload name used in resource names.')
@minLength(3)
@maxLength(10)
param workload string = 'adflow'
param vnetCidr string = '10.40.0.0/22'

@description('Entra tenant is taken from the deployment context; audience is the API app registration URI.')
param entraApiAudience string
@description('Entra group (object id) that administers PostgreSQL. Placeholder in samples.')
param pgAdminGroupObjectId string
param pgAdminGroupName string

// Tiers (see params/*.bicepparam)
param internalEnvironment bool
param zoneRedundant bool
param enablePrivateEndpoints bool
@allowed(['Standard', 'Premium'])
param serviceBusSku string
param acrSku string
param pgSkuName string
param pgSkuTier string
param pgStorageGB int
param pgHighAvailability bool
param kvPublicAccess bool
param acrPublicAccess bool
param logRetentionDays int = 30
param logDailyQuotaGb int = -1
param apiMinReplicas int = 1
param apiMaxReplicas int = 5
param workerMinReplicas int = 0
param workerMaxReplicas int = 10
param messagesPerWorkerReplica string = '50'

@description('false = infrastructure only. Push the first image to ACR, then redeploy with true.')
param deployApps bool = false
param apiImage string = ''
param workerImage string = ''
@description('Optional versionless Key Vault secret URI the apps read as APP_KEY. Secret created out-of-band.')
param appKeySecretUri string = ''

var prefix = '${workload}-${envName}'
var uniq = take(uniqueString(resourceGroup().id), 6)
var tags = {
  workload: workload
  environment: envName
  managedBy: 'bicep'
}
var privateEndpointsSb = enablePrivateEndpoints && serviceBusSku == 'Premium'
var privateEndpointsAcr = enablePrivateEndpoints && acrSku == 'Premium'

module network 'modules/network.bicep' = {
  name: 'network'
  params: {
    prefix: prefix
    location: location
    tags: tags
    vnetCidr: vnetCidr
  }
}

module identity 'modules/identity.bicep' = {
  name: 'identity'
  params: {
    prefix: prefix
    location: location
    tags: tags
  }
}

module monitoring 'modules/monitoring.bicep' = {
  name: 'monitoring'
  params: {
    prefix: prefix
    location: location
    tags: tags
    retentionDays: logRetentionDays
    dailyQuotaGb: logDailyQuotaGb
    metricsPublisherPrincipalIds: [identity.outputs.appPrincipalId]
  }
}

module keyvault 'modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: take('kv-${workload}-${envName}-${uniq}', 24)
    location: location
    tags: tags
    logAnalyticsId: monitoring.outputs.workspaceId
    publicNetworkAccess: kvPublicAccess
    secretsReaderPrincipalIds: [identity.outputs.appPrincipalId]
    enablePrivateEndpoint: enablePrivateEndpoints
    peSubnetId: network.outputs.peSubnetId
    kvZoneId: network.outputs.kvZoneId
  }
}

module servicebus 'modules/servicebus.bicep' = {
  name: 'servicebus'
  params: {
    name: 'sb-${workload}-${envName}-${uniq}'
    location: location
    tags: tags
    logAnalyticsId: monitoring.outputs.workspaceId
    sku: serviceBusSku
    publicNetworkAccess: !privateEndpointsSb
    senderPrincipalIds: [identity.outputs.appPrincipalId]
    receiverPrincipalIds: [identity.outputs.appPrincipalId]
    ownerPrincipalIds: [identity.outputs.scalerPrincipalId]
    enablePrivateEndpoint: privateEndpointsSb
    peSubnetId: network.outputs.peSubnetId
    sbZoneId: network.outputs.sbZoneId
  }
}

module acr 'modules/acr.bicep' = {
  name: 'acr'
  params: {
    name: 'acr${workload}${envName}${uniq}'
    location: location
    tags: tags
    sku: acrSku
    publicNetworkAccess: acrPublicAccess
    pullPrincipalIds: [identity.outputs.appPrincipalId]
    enablePrivateEndpoint: privateEndpointsAcr
    peSubnetId: network.outputs.peSubnetId
    acrZoneId: network.outputs.acrZoneId
  }
}

module postgres 'modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    name: 'pg-${workload}-${envName}-${uniq}'
    location: location
    tags: tags
    logAnalyticsId: monitoring.outputs.workspaceId
    delegatedSubnetId: network.outputs.pgSubnetId
    privateDnsZoneId: network.outputs.pgZoneId
    skuName: pgSkuName
    skuTier: pgSkuTier
    storageSizeGB: pgStorageGB
    haEnabled: pgHighAvailability
    geoRedundantBackup: envName == 'prod'
    backupRetentionDays: envName == 'prod' ? 14 : 7
    adminGroupObjectId: pgAdminGroupObjectId
    adminGroupName: pgAdminGroupName
  }
}

module acaEnv 'modules/containerapps-env.bicep' = {
  name: 'aca-env'
  params: {
    name: 'cae-${prefix}'
    location: location
    tags: tags
    logAnalyticsName: monitoring.outputs.workspaceName
    infrastructureSubnetId: network.outputs.acaSubnetId
    internal: internalEnvironment
    zoneRedundant: zoneRedundant
  }
}

module acaDns 'modules/aca-dns.bicep' = if (internalEnvironment) {
  name: 'aca-dns'
  params: {
    tags: tags
    defaultDomain: acaEnv.outputs.defaultDomain
    staticIp: acaEnv.outputs.staticIp
    vnetId: network.outputs.vnetId
  }
}

var commonEnv = [
  {
    name: 'ENTRA_TENANT_ID'
    value: subscription().tenantId
  }
  {
    name: 'ENTRA_AUDIENCE'
    value: entraApiAudience
  }
  {
    name: 'SERVICEBUS_FQDN'
    value: servicebus.outputs.fqdn
  }
  {
    name: 'SERVICEBUS_TOPIC'
    value: servicebus.outputs.topicName
  }
  {
    name: 'SERVICEBUS_SUBSCRIPTION'
    value: servicebus.outputs.subscriptionName
  }
  {
    name: 'PGHOST'
    value: postgres.outputs.fqdn
  }
  {
    name: 'PGDATABASE'
    value: 'adflow'
  }
  {
    name: 'PGUSER'
    value: 'id-${prefix}-app' // Entra principal created in the DB with pgaadauth_create_principal
  }
  {
    name: 'KEYVAULT_URI'
    value: keyvault.outputs.uri
  }
  {
    name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
    value: monitoring.outputs.appInsightsConnectionString
  }
]

module api 'modules/containerapp.bicep' = if (deployApps) {
  name: 'app-api'
  params: {
    name: 'ca-${prefix}-api'
    location: location
    tags: tags
    environmentId: acaEnv.outputs.id
    image: apiImage
    registryServer: acr.outputs.loginServer
    identityId: identity.outputs.appId
    identityClientId: identity.outputs.appClientId
    minReplicas: apiMinReplicas
    maxReplicas: apiMaxReplicas
    env: commonEnv
    keyVaultSecretUri: appKeySecretUri
    enableIngress: true
  }
}

module worker 'modules/containerapp.bicep' = if (deployApps) {
  name: 'app-worker'
  params: {
    name: 'ca-${prefix}-worker'
    location: location
    tags: tags
    environmentId: acaEnv.outputs.id
    image: workerImage
    registryServer: acr.outputs.loginServer
    identityId: identity.outputs.appId
    identityClientId: identity.outputs.appClientId
    minReplicas: workerMinReplicas
    maxReplicas: workerMaxReplicas
    env: commonEnv
    keyVaultSecretUri: appKeySecretUri
    serviceBusScale: true
    serviceBusNamespace: servicebus.outputs.namespaceName
    serviceBusTopic: servicebus.outputs.topicName
    serviceBusSubscription: servicebus.outputs.subscriptionName
    messageCountPerReplica: messagesPerWorkerReplica
    scalerIdentityId: identity.outputs.scalerId
  }
}

output acrLoginServer string = acr.outputs.loginServer
output keyVaultUri string = keyvault.outputs.uri
output serviceBusFqdn string = servicebus.outputs.fqdn
output postgresFqdn string = postgres.outputs.fqdn
output appIdentityName string = 'id-${prefix}-app'
output apiFqdn string = api.?outputs.fqdn ?? ''
