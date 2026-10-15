using '../main.bicep'

param envName = 'prod'
param entraApiAudience = 'api://00000000-0000-0000-0000-000000000000' // placeholder app registration
param pgAdminGroupObjectId = '00000000-0000-0000-0000-000000000000' // placeholder
param pgAdminGroupName = 'sg-adflow-prod-db-admins'
param vnetCidr = '10.50.0.0/22'

param internalEnvironment = true
param zoneRedundant = true
param enablePrivateEndpoints = true
param serviceBusSku = 'Premium'
param acrSku = 'Premium'
param pgSkuName = 'Standard_D4ds_v5'
param pgSkuTier = 'GeneralPurpose'
param pgStorageGB = 128
param pgHighAvailability = true
param kvPublicAccess = false
param acrPublicAccess = false
param logRetentionDays = 90
param apiMinReplicas = 3
param apiMaxReplicas = 20
param workerMinReplicas = 1
param workerMaxReplicas = 50
