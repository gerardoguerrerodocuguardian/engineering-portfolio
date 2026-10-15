// One Container App. Optional HTTP ingress, HTTP or Service Bus (KEDA) scaling, Key Vault secret reference.
param name string
param location string
param tags object
param environmentId string
param image string
param registryServer string
@description('User-assigned identity resource id used for ACR pull, Key Vault and data-plane access.')
param identityId string
param identityClientId string
param cpu string = '0.5'
param memory string = '1Gi'
param minReplicas int
param maxReplicas int
param env array = []
@description('Optional Key Vault secret URI (versionless) exposed as env var APP_KEY. Empty = none.')
param keyVaultSecretUri string = ''

param enableIngress bool = false
param targetPort int = 8080
param httpConcurrentRequests string = '50'

@description('Set to enable KEDA Service Bus scaling.')
param serviceBusScale bool = false
param serviceBusNamespace string = ''
param serviceBusTopic string = ''
param serviceBusSubscription string = ''
param messageCountPerReplica string = '50'
param scalerIdentityId string = ''

var secrets = empty(keyVaultSecretUri) ? [] : [
  {
    name: 'app-key'
    keyVaultUrl: keyVaultSecretUri
    identity: identityId
  }
]

var secretEnv = empty(keyVaultSecretUri) ? [] : [
  {
    name: 'APP_KEY'
    secretRef: 'app-key'
  }
]

var baseEnv = [
  {
    name: 'AZURE_CLIENT_ID'
    value: identityClientId // selects the user-assigned identity for DefaultAzureCredential
  }
]

var sbRule = {
  name: 'sb-depth'
  custom: {
    type: 'azure-servicebus'
    metadata: {
      namespace: serviceBusNamespace
      topicName: serviceBusTopic
      subscriptionName: serviceBusSubscription
      messageCount: messageCountPerReplica
    }
    identity: scalerIdentityId
  }
}

var httpRule = {
  name: 'http'
  http: {
    metadata: {
      concurrentRequests: httpConcurrentRequests
    }
  }
}

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: union({
      '${identityId}': {}
    }, empty(scalerIdentityId) ? {} : {
      '${scalerIdentityId}': {}
    })
  }
  properties: {
    environmentId: environmentId
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: enableIngress ? {
        external: true
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      } : null
      registries: [
        {
          server: registryServer
          identity: identityId
        }
      ]
      secrets: secrets
    }
    template: {
      containers: [
        {
          name: name
          image: image
          resources: {
            cpu: json(cpu)
            memory: memory
          }
          env: concat(baseEnv, env, secretEnv)
          probes: enableIngress ? [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: targetPort
              }
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: targetPort
              }
            }
          ] : []
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: serviceBusScale ? [sbRule] : [httpRule]
      }
    }
  }
}

output fqdn string = enableIngress ? app.properties.configuration.ingress.fqdn : ''
output name string = app.name
