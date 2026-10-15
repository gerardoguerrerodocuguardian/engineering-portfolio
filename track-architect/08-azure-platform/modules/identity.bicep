// User-assigned managed identities (created first so RBAC can be granted before apps start).
param prefix string
param location string
param tags object

resource app 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${prefix}-app'
  location: location
  tags: tags
}

// Separate identity used only by the KEDA scaler: it needs broader Service Bus rights than the app.
resource scaler 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${prefix}-scaler'
  location: location
  tags: tags
}

output appId string = app.id
output appPrincipalId string = app.properties.principalId
output appClientId string = app.properties.clientId
output scalerId string = scaler.id
output scalerPrincipalId string = scaler.properties.principalId
