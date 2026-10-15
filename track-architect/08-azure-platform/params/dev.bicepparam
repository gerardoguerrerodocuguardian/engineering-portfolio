using '../main.bicep'

param envName = 'dev'
param entraApiAudience = 'api://00000000-0000-0000-0000-000000000000' // placeholder app registration
param pgAdminGroupObjectId = '00000000-0000-0000-0000-000000000000' // placeholder
param pgAdminGroupName = 'sg-adflow-dev-db-admins'

param internalEnvironment = false
param zoneRedundant = false
param enablePrivateEndpoints = false // Key Vault PE only matters when public access is off
param serviceBusSku = 'Standard'
param acrSku = 'Basic'
param pgSkuName = 'Standard_B1ms'
param pgSkuTier = 'Burstable'
param pgStorageGB = 32
param pgHighAvailability = false
param kvPublicAccess = true
param acrPublicAccess = true
param logDailyQuotaGb = 1
param apiMinReplicas = 1
param apiMaxReplicas = 3
param workerMinReplicas = 0
param workerMaxReplicas = 5
