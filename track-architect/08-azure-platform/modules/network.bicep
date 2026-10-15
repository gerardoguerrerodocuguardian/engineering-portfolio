// VNet with three subnets + private DNS zones for private endpoints / PostgreSQL VNet injection.
@description('Resource name prefix, e.g. adflow-dev')
param prefix string
param location string
param tags object
@description('VNet address space. /22 or larger recommended.')
param vnetCidr string = '10.40.0.0/22'

var acaSubnetCidr = cidrSubnet(vnetCidr, 24, 0) // 256 addresses, delegated to Container Apps
var peSubnetCidr = cidrSubnet(vnetCidr, 26, 4) // private endpoints
var pgSubnetCidr = cidrSubnet(vnetCidr, 27, 10) // delegated to PostgreSQL Flexible Server

var privateZones = [
  'privatelink.vaultcore.azure.net'
  'privatelink.servicebus.windows.net'
  'privatelink.azurecr.io'
  '${prefix}.private.postgres.database.azure.com'
]

resource nsg 'Microsoft.Network/networkSecurityGroups@2023-11-01' = {
  name: 'nsg-${prefix}-pe'
  location: location
  tags: tags
  properties: {
    securityRules: [
      {
        name: 'deny-internet-inbound'
        properties: {
          priority: 4000
          direction: 'Inbound'
          access: 'Deny'
          protocol: '*'
          sourceAddressPrefix: 'Internet'
          sourcePortRange: '*'
          destinationAddressPrefix: '*'
          destinationPortRange: '*'
        }
      }
    ]
  }
}

resource vnet 'Microsoft.Network/virtualNetworks@2023-11-01' = {
  name: 'vnet-${prefix}'
  location: location
  tags: tags
  properties: {
    addressSpace: {
      addressPrefixes: [vnetCidr]
    }
    subnets: [
      {
        name: 'snet-aca'
        properties: {
          addressPrefix: acaSubnetCidr
          delegations: [
            {
              name: 'aca'
              properties: {
                serviceName: 'Microsoft.App/environments'
              }
            }
          ]
        }
      }
      {
        name: 'snet-pe'
        properties: {
          addressPrefix: peSubnetCidr
          networkSecurityGroup: {
            id: nsg.id
          }
          privateEndpointNetworkPolicies: 'Enabled'
        }
      }
      {
        name: 'snet-pg'
        properties: {
          addressPrefix: pgSubnetCidr
          delegations: [
            {
              name: 'pg'
              properties: {
                serviceName: 'Microsoft.DBforPostgreSQL/flexibleServers'
              }
            }
          ]
        }
      }
    ]
  }
}

resource zones 'Microsoft.Network/privateDnsZones@2020-06-01' = [for z in privateZones: {
  name: z
  location: 'global'
  tags: tags
}]

resource links 'Microsoft.Network/privateDnsZones/virtualNetworkLinks@2020-06-01' = [for (z, i) in privateZones: {
  parent: zones[i]
  name: 'link-${prefix}'
  location: 'global'
  properties: {
    registrationEnabled: false
    virtualNetwork: {
      id: vnet.id
    }
  }
}]

output vnetId string = vnet.id
output acaSubnetId string = '${vnet.id}/subnets/snet-aca'
output peSubnetId string = '${vnet.id}/subnets/snet-pe'
output pgSubnetId string = '${vnet.id}/subnets/snet-pg'
output kvZoneId string = zones[0].id
output sbZoneId string = zones[1].id
output acrZoneId string = zones[2].id
output pgZoneId string = zones[3].id
