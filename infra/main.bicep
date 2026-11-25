// belmazad.com "Request a Property" on Azure Container Apps (resource group Matchmaking_belmazad, UAE North).
//
// What this creates, and why:
// - Log Analytics workspace: the site's logs (Container Apps writes stdout/stderr here). 30 days, smallest plan.
// - Container Registry (Basic): stores the site's Docker image. No admin user and no anonymous pull; the site pulls
//   with its managed identity.
// - Two user-assigned managed identities (robot accounts with no passwords):
//     id-belmazad-app    → used by the running site to pull its image and read its secrets from Key Vault.
//     id-belmazad-deploy → used by GitHub Actions (federated sign-in, no stored secret) to push images and update
//                          the site. Only pushes from the main branch of the GitHub repo are trusted.
// - Key Vault (RBAC, purge protection on): every secret the site needs. Values come from secure parameters at
//   deploy time (infra/deploy.ps1 asks for them); they are never written to a file in the repo.
// - PostgreSQL Flexible Server 16 (Burstable B1ms, 32 GB): accounts, sessions, submissions, chat usage.
//   TLS is required. Public access is limited to Azure services, because Container Apps on the Consumption plan
//   has no fixed outbound address; a private network (VNet) is the stricter option if needed later.
// - Container Apps environment (Consumption) + the container app: HTTPS on a *.azurecontainerapps.io address,
//   always 1 copy running (no slow first visit), up to 2 under load. Applies database migrations at start-up.
//
// Role assignments use only built-in roles that Nour's "RBAC Administrator" role may grant (never Owner/UAA).

targetScope = 'resourceGroup'

@description('Azure region. Defaults to the resource group region (UAE North).')
param location string = resourceGroup().location

@description('Short name used in resource names.')
param name string = 'belmazad'

@description('GitHub repository (owner/name) allowed to deploy, and the branch.')
param githubRepo string = 'Belmazad-Admin/Otlob-3qarak'
param githubBranch string = 'main'

@description('Container image to run. The first deploy uses Microsoft\'s public sample (listens on port 80) because the registry is still empty; GitHub Actions then switches to the real image.')
param image string = 'mcr.microsoft.com/k8se/quickstart:latest'

@description('PostgreSQL administrator login name.')
param postgresAdminLogin string = 'belmazadadmin'

@secure()
@description('PostgreSQL administrator password. Kept in Key Vault; reuse the same value on later deploys.')
param postgresAdminPassword string

@secure()
param hubspotAccessToken string
@secure()
param openaiApiKey string
@secure()
@description('Team admin password for /admin (min. 12 characters).')
param adminPassword string
@secure()
@description('Optional. Empty = derived from the admin password and HubSpot key, as on Vercel.')
param adminSessionSecret string = ''
@secure()
@description('Optional. Must match the value on Vercel (if any), or public BM- request IDs would change.')
param wishlistIdSalt string = ''

@description('Object ID of the person running the deploy (infra/deploy.ps1 fills it in). They get "Key Vault Secrets Officer" so they can update secrets later. Empty = skip.')
param operatorPrincipalId string = ''

@description('Hard daily spend cap for the buyer chat, in US dollars.')
param openaiDailyBudgetUsd string = '5'

var suffix = take(uniqueString(resourceGroup().id), 6)
var isSample = startsWith(image, 'mcr.microsoft.com/k8se/quickstart')
var dbName = 'belmazad'

// Built-in role IDs (https://learn.microsoft.com/azure/role-based-access-control/built-in-roles)
var roles = {
  acrPull: '7f951dda-4ed3-4680-a7ca-43fe172d538d'
  acrPush: '8311e382-0749-4cb8-b61a-304f252e45ec'
  keyVaultSecretsUser: '4633458b-17de-408a-b874-0445c86b69e6'
  keyVaultSecretsOfficer: 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7'
  contributor: 'b24988ac-6180-42a0-ab88-20f7382dd24c'
}

// ---------- Logs ----------
resource logs 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: 'log-${name}'
  location: location
  properties: {
    sku: { name: 'PerGB2018' }
    retentionInDays: 30
  }
}

// ---------- Identities ----------
resource appIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${name}-app'
  location: location
}

resource deployIdentity 'Microsoft.ManagedIdentity/userAssignedIdentities@2023-01-31' = {
  name: 'id-${name}-deploy'
  location: location
}

// GitHub Actions signs in as id-belmazad-deploy with a short-lived token, only for pushes to main.
resource githubTrust 'Microsoft.ManagedIdentity/userAssignedIdentities/federatedIdentityCredentials@2023-01-31' = {
  parent: deployIdentity
  name: 'github-${githubBranch}'
  properties: {
    issuer: 'https://token.actions.githubusercontent.com'
    subject: 'repo:${githubRepo}:ref:refs/heads/${githubBranch}'
    audiences: [ 'api://AzureADTokenExchange' ]
  }
}

// ---------- Container Registry ----------
resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: '${name}acr${suffix}'
  location: location
  sku: { name: 'Basic' }
  properties: {
    adminUserEnabled: false // anonymous pull is off by default on Basic and is never turned on
  }
}

resource appPullsImages 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, appIdentity.id, roles.acrPull)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPull)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployPushesImages 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(registry.id, deployIdentity.id, roles.acrPush)
  scope: registry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.acrPush)
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

// ---------- PostgreSQL ----------
resource postgres 'Microsoft.DBforPostgreSQL/flexibleServers@2024-08-01' = {
  name: 'pg-${name}-${suffix}'
  location: location
  sku: { name: 'Standard_B1ms', tier: 'Burstable' }
  properties: {
    version: '16'
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    storage: { storageSizeGB: 32, autoGrow: 'Enabled' }
    backup: { backupRetentionDays: 7, geoRedundantBackup: 'Disabled' }
    highAvailability: { mode: 'Disabled' }
    authConfig: { activeDirectoryAuth: 'Disabled', passwordAuth: 'Enabled' }
    network: { publicNetworkAccess: 'Enabled' }
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2024-08-01' = {
  parent: postgres
  name: dbName
  properties: { charset: 'UTF8', collation: 'en_US.utf8' }
}

// 0.0.0.0–0.0.0.0 is Azure's special rule for "services running in Azure". Other addresses stay blocked.
resource allowAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2024-08-01' = {
  parent: postgres
  name: 'AllowAzureServices'
  properties: { startIpAddress: '0.0.0.0', endIpAddress: '0.0.0.0' }
}

var databaseUrl = 'postgres://${postgresAdminLogin}:${uriComponent(postgresAdminPassword)}@${postgres.properties.fullyQualifiedDomainName}:5432/${dbName}?sslmode=require'

// ---------- Key Vault ----------
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

// The connection string needs the server's address, which is only known during the deployment, so it is its own
// resource rather than part of the loop below.
resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: { value: databaseUrl }
}

// Secret name in Key Vault → value. Optional ones are only stored when given.
var secretValues = union({
  'postgres-admin-password': postgresAdminPassword
  'hubspot-access-token': hubspotAccessToken
  'openai-api-key': openaiApiKey
  'admin-password': adminPassword
}, empty(adminSessionSecret) ? {} : { 'admin-session-secret': adminSessionSecret },
  empty(wishlistIdSalt) ? {} : { 'wishlist-id-salt': wishlistIdSalt })

resource secrets 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = [for s in items(secretValues): {
  parent: vault
  name: s.key
  properties: { value: s.value }
}]

resource appReadsSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appIdentity.id, roles.keyVaultSecretsUser)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource operatorManagesSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(operatorPrincipalId)) {
  name: guid(vault.id, operatorPrincipalId, roles.keyVaultSecretsOfficer)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsOfficer)
    principalId: operatorPrincipalId
    principalType: 'User'
  }
}

// ---------- Container Apps ----------
resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: 'cae-${name}'
  location: location
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logs.properties.customerId
        sharedKey: logs.listKeys().primarySharedKey
      }
    }
    workloadProfiles: [ { name: 'Consumption', workloadProfileType: 'Consumption' } ]
  }
}

// Environment variable → Key Vault secret. The site reads these through src/env.ts, exactly as on Vercel.
var secretEnv = union({
  DATABASE_URL: 'database-url'
  HUBSPOT_ACCESS_TOKEN: 'hubspot-access-token'
  OPENAI_API_KEY: 'openai-api-key'
  ADMIN_PASSWORD: 'admin-password'
}, empty(adminSessionSecret) ? {} : { ADMIN_SESSION_SECRET: 'admin-session-secret' },
  empty(wishlistIdSalt) ? {} : { WISHLIST_ID_SALT: 'wishlist-id-salt' })
var secretEnvVars = [for s in items(secretEnv): { name: s.key, secretRef: s.value }]

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${name}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  dependsOn: [ appPullsImages, appReadsSecrets, secrets, databaseUrlSecret, database, allowAzure ]
  properties: {
    environmentId: environment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: isSample ? 80 : 3000
        transport: 'auto'
        allowInsecure: false
      }
      registries: [ { server: registry.properties.loginServer, identity: appIdentity.id } ]
      secrets: [for s in items(secretEnv): {
        name: s.value
        keyVaultUrl: '${vault.properties.vaultUri}secrets/${s.value}'
        identity: appIdentity.id
      }]
    }
    template: {
      containers: [
        {
          name: 'web'
          image: image
          resources: { cpu: json('0.5'), memory: '1Gi' }
          env: concat(secretEnvVars, [
            { name: 'RUN_MIGRATIONS', value: '1' }
            { name: 'OPENAI_DAILY_BUDGET_USD', value: openaiDailyBudgetUsd }
          ])
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 2
        rules: [ { name: 'http', http: { metadata: { concurrentRequests: '50' } } } ]
      }
    }
  }
}

// GitHub Actions may update this app (new image = new revision), and nothing else.
resource deployUpdatesApp 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(app.id, deployIdentity.id, roles.contributor)
  scope: app
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.contributor)
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

resource deployUsesEnvironment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(environment.id, deployIdentity.id, roles.contributor)
  scope: environment
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.contributor)
    principalId: deployIdentity.properties.principalId
    principalType: 'ServicePrincipal'
  }
}

output appUrl string = 'https://${app.properties.configuration.ingress.fqdn}'
output appName string = app.name
output registryName string = registry.name
output registryLoginServer string = registry.properties.loginServer
output keyVaultName string = vault.name
output postgresHost string = postgres.properties.fullyQualifiedDomainName
output deployClientId string = deployIdentity.properties.clientId
output tenantId string = subscription().tenantId
output subscriptionId string = subscription().subscriptionId
