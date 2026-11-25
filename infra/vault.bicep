// Step 1 of the Azure setup: the Key Vault that holds every secret the site needs, created before anything else so
// the secrets can be added one by one (infra/set-secret.ps1) before the site is deployed (infra/main.bicep).
// RBAC mode, soft delete and purge protection on. The person running the deploy gets "Key Vault Secrets Officer"
// so they can add and change secrets.

targetScope = 'resourceGroup'

param location string = resourceGroup().location
param name string = 'belmazad'

@description('Object ID of the person running the deploy (infra/deploy.ps1 fills it in).')
param operatorPrincipalId string

var suffix = take(uniqueString(resourceGroup().id), 6) // same suffix as main.bicep
var keyVaultSecretsOfficer = 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: 'kv-${name}-${suffix}'
  location: location
  properties: {
    tenantId: subscription().tenantId
    sku: { family: 'A', name: 'standard' }
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enablePurgeProtection: true
    publicNetworkAccess: 'Enabled'
  }
}

resource operatorManagesSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, operatorPrincipalId, keyVaultSecretsOfficer)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', keyVaultSecretsOfficer)
    principalId: operatorPrincipalId
    principalType: 'User'
  }
}

output keyVaultName string = vault.name
