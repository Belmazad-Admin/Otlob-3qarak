<#
  Creates or updates the belmazad.com site on Azure Container Apps. Run it in PowerShell from the project folder,
  signed in with `az login` (MFA). Three steps:

    1. powershell -ExecutionPolicy Bypass -File .\infra\deploy.ps1 -Stage vault
         Creates only the Key Vault (infra/vault.bicep) and lets you manage its secrets.
    2. powershell -ExecutionPolicy Bypass -File .\infra\set-secret.ps1 <name>      (once per key)
         hubspot-access-token, openai-api-key, admin-password (required);
         admin-session-secret, wishlist-id-salt (optional).
    3. powershell -ExecutionPolicy Bypass -File .\infra\deploy.ps1 [-WhatIf]
         Checks the keys are in Key Vault, then creates everything else (infra/main.bicep). -WhatIf only previews.

  No key is typed into this script or passed through the template: the site reads them from Key Vault. The only
  value it handles is the database password, which it generates once and then reuses from Key Vault.
#>
param(
  [ValidateSet('vault', 'all')]
  [string]$Stage = 'all',
  [string]$ResourceGroup = 'Matchmaking_belmazad',
  [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'

# Look-ups that may fail (e.g. "not created yet") return '' instead of stopping the script. Windows PowerShell 5.1
# would otherwise treat the Azure CLI's error text as a fatal error.
function Get-AzValue([string[]]$AzArgs) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & az @AzArgs 2>$null; if ($LASTEXITCODE -eq 0 -and $out) { return ($out | Out-String).Trim() } else { return '' } }
  finally { $ErrorActionPreference = $old }
}
function New-Password {
  $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}
function Invoke-Deployment([string]$Template, [hashtable]$Values, [string]$Query) {
  $params = @{ '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'; contentVersion = '1.0.0.0'; parameters = @{} }
  foreach ($k in $Values.Keys) { if ($null -ne $Values[$k] -and $Values[$k] -ne '') { $params.parameters[$k] = @{ value = $Values[$k] } } }
  $tmp = Join-Path ([IO.Path]::GetTempPath()) ("belmazad-params-" + [guid]::NewGuid() + '.json')
  try {
    [IO.File]::WriteAllText($tmp, ($params | ConvertTo-Json -Depth 5))
    $name = 'belmazad-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
    if ($WhatIf) { az deployment group what-if -g $ResourceGroup -n $name --template-file $Template --parameters "@$tmp" }
    else { az deployment group create -g $ResourceGroup -n $name --template-file $Template --parameters "@$tmp" --query $Query -o table }
    if ($LASTEXITCODE -ne 0) { throw 'The deployment failed (see the message above).' }
  } finally { Remove-Item $tmp -ErrorAction SilentlyContinue }
}

$me = Get-AzValue @('ad', 'signed-in-user', 'show', '--query', 'id', '-o', 'tsv')
if (-not $me) { throw 'Not signed in. Run az login first (with MFA).' }

if ($Stage -eq 'vault') {
  Invoke-Deployment (Join-Path $PSScriptRoot 'vault.bicep') @{ operatorPrincipalId = $me } 'properties.outputs.{vault:keyVaultName.value}'
  if (-not $WhatIf) { Write-Host "`nKey Vault ready. Next: add the keys with .\infra\set-secret.ps1 (permissions can take a minute or two to apply)." }
  return
}

$vault = Get-AzValue @('keyvault', 'list', '-g', $ResourceGroup, '--query', '[0].name', '-o', 'tsv')
if (-not $vault) { throw 'No Key Vault yet. Run step 1 first: .\infra\deploy.ps1 -Stage vault' }
$names = (Get-AzValue @('keyvault', 'secret', 'list', '--vault-name', $vault, '--query', '[].name', '-o', 'tsv')) -split "`r?`n"
$missing = @('hubspot-access-token', 'openai-api-key', 'admin-password') | Where-Object { $names -notcontains $_ }
if ($missing -and -not $WhatIf) { throw ("Missing in Key Vault: " + ($missing -join ', ') + ". Add each with .\infra\set-secret.ps1 <name>.") }

$pg = Get-AzValue @('keyvault', 'secret', 'show', '--vault-name', $vault, '-n', 'postgres-admin-password', '--query', 'value', '-o', 'tsv')
$values = @{
  postgresAdminPassword = if ($pg) { $pg } else { New-Password }   # first run: a new random password
  hasAdminSessionSecret = [bool]($names -contains 'admin-session-secret')
  hasWishlistIdSalt     = [bool]($names -contains 'wishlist-id-salt')
}
# Keep the real image on later runs (GitHub Actions sets it); the first run starts with Microsoft's sample page.
$current = Get-AzValue @('containerapp', 'show', '-g', $ResourceGroup, '-n', 'ca-belmazad', '--query', 'properties.template.containers[0].image', '-o', 'tsv')
if ($current) { $values.image = $current }

try {
  Invoke-Deployment (Join-Path $PSScriptRoot 'main.bicep') $values 'properties.outputs.{url:appUrl.value, app:appName.value, registry:registryName.value, vault:keyVaultName.value, deployClientId:deployClientId.value, tenant:tenantId.value, subscription:subscriptionId.value}'
} finally { $values.Clear() }
