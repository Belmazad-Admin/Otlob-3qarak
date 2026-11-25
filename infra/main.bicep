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
// - Key Vault (created first by infra/vault.bicep): every secret the site needs. The site keys are added one by one
//   with infra/set-secret.ps1 (hidden input); this template only writes the two database secrets.
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
@description('PostgreSQL administrator password. infra/deploy.ps1 generates it once and then reuses the copy in Key Vault.')
param postgresAdminPassword string

// The site's own keys (HubSpot, OpenAI, admin password ...) are added to Key Vault beforehand with
// infra/set-secret.ps1 and are never passed through this template. deploy.ps1 checks they exist and tells it which
// optional ones are there.
@description('True when Key Vault holds the optional secret "admin-session-secret".')
param hasAdminSessionSecret bool = false
@description('True when Key Vault holds the optional secret "wishlist-id-salt".')
param hasWishlistIdSalt bool = false

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

// ---------- Key Vault (created by infra/vault.bicep in step 1) ----------
resource vault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: 'kv-${name}-${suffix}'
}

// The two database secrets are written here because the connection string needs the server's address.
resource databaseUrlSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'database-url'
  properties: { value: databaseUrl }
}

resource postgresPasswordSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'postgres-admin-password'
  properties: { value: postgresAdminPassword }
}

resource appReadsSecrets 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, appIdentity.id, roles.keyVaultSecretsUser)
  scope: vault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roles.keyVaultSecretsUser)
    principalId: appIdentity.properties.principalId
    principalType: 'ServicePrincipal'
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
}, !hasAdminSessionSecret ? {} : { ADMIN_SESSION_SECRET: 'admin-session-secret' },
  !hasWishlistIdSalt ? {} : { WISHLIST_ID_SALT: 'wishlist-id-salt' })
var secretEnvVars = [for s in items(secretEnv): { name: s.key, secretRef: s.value }]

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: 'ca-${name}'
  location: location
  identity: {
    type: 'UserAssigned'
    userAssignedIdentities: { '${appIdentity.id}': {} }
  }
  dependsOn: [ appPullsImages, appReadsSecrets, databaseUrlSecret, postgresPasswordSecret, database, allowAzure ]
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
