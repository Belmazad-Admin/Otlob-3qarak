<#
  Creates or updates the belmazad.com site on Azure Container Apps from infra/main.bicep.

  Run it yourself in PowerShell from the project folder, signed in with `az login` (MFA):
      .\infra\deploy.ps1 -WhatIf     # preview only: lists what would be created or changed, creates nothing
      .\infra\deploy.ps1             # create / update

  It asks for the secret settings (HubSpot key, OpenAI key, admin password ...) with hidden typing. On later runs
  you can press Enter to keep each value already in Key Vault. Values only live in this PowerShell process and a
  temporary file that is deleted at the end; they are never written to the repo or printed.
#>
param(
  [string]$ResourceGroup = 'Matchmaking_belmazad',
  [switch]$WhatIf
)
$ErrorActionPreference = 'Stop'
$template = Join-Path $PSScriptRoot 'main.bicep'

function Read-Secret([string]$Prompt) {
  $s = Read-Host -Prompt $Prompt -AsSecureString
  return [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
}
function New-Password {
  $chars = [char[]]'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  $bytes = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return -join ($bytes | ForEach-Object { $chars[$_ % $chars.Length] })
}

# Look-ups that may fail (e.g. "not created yet") return '' instead of stopping the script. Windows PowerShell 5.1
# would otherwise treat the Azure CLI's error text as a fatal error.
function Get-AzValue([string[]]$AzArgs) {
  $old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  try { $out = & az @AzArgs 2>$null; if ($LASTEXITCODE -eq 0 -and $out) { return ($out | Out-String).Trim() } else { return '' } }
  finally { $ErrorActionPreference = $old }
}

# Existing Key Vault (later runs): reuse its values when the answer is left empty.
$vault = Get-AzValue @('keyvault', 'list', '-g', $ResourceGroup, '--query', '[0].name', '-o', 'tsv')
function Get-Existing([string]$Name) {
  if (-not $vault) { return '' }
  return Get-AzValue @('keyvault', 'secret', 'show', '--vault-name', $vault, '-n', $Name, '--query', 'value', '-o', 'tsv')
}
function Ask([string]$Label, [string]$SecretName, [bool]$Required) {
  $existing = Get-Existing $SecretName
  $hint = if ($existing) { ' (Enter = keep current)' } elseif (-not $Required) { ' (optional, Enter = skip)' } else { '' }
  while ($true) {
    $v = Read-Secret "$Label$hint"
    if (-not $v) { $v = $existing }
    if ($v -or -not $Required) { return $v }
    Write-Host '  This one is required.' -ForegroundColor Yellow
  }
}

if ($WhatIf) {
  # A preview needs no real secrets: placeholders show the same resources without touching anything.
  $values = @{ hubspotAccessToken = 'preview'; openaiApiKey = 'preview'; adminPassword = 'preview-preview'; postgresAdminPassword = 'Preview-only-1' }
} else {
  $values = @{
    hubspotAccessToken = Ask 'HubSpot access token (HUBSPOT_ACCESS_TOKEN)' 'hubspot-access-token' $true
    openaiApiKey       = Ask 'OpenAI API key (OPENAI_API_KEY)' 'openai-api-key' $true
    adminPassword      = Ask 'Team admin password for /admin (ADMIN_PASSWORD, 12+ characters)' 'admin-password' $true
    adminSessionSecret = Ask 'Admin session secret (ADMIN_SESSION_SECRET)' 'admin-session-secret' $false
    wishlistIdSalt     = Ask 'Wishlist ID salt (WISHLIST_ID_SALT, use the Vercel value if it has one)' 'wishlist-id-salt' $false
  }
  if ($values.adminPassword.Length -lt 12) { throw 'The admin password must be at least 12 characters.' }
  $pg = Get-Existing 'postgres-admin-password'
  $values.postgresAdminPassword = if ($pg) { $pg } else { New-Password }   # first run: a new random password
}

# Keep the real image on later runs (GitHub Actions sets it); the first run starts with Microsoft's sample.
$current = Get-AzValue @('containerapp', 'show', '-g', $ResourceGroup, '-n', 'ca-belmazad', '--query', 'properties.template.containers[0].image', '-o', 'tsv')
if ($current) { $values.image = $current }
$values.operatorPrincipalId = Get-AzValue @('ad', 'signed-in-user', 'show', '--query', 'id', '-o', 'tsv')

$params = @{ '$schema' = 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#'; contentVersion = '1.0.0.0'; parameters = @{} }
foreach ($k in $values.Keys) { if ($values[$k]) { $params.parameters[$k] = @{ value = $values[$k] } } }
$tmp = Join-Path ([IO.Path]::GetTempPath()) ("belmazad-params-" + [guid]::NewGuid() + '.json')
try {
  $params | ConvertTo-Json -Depth 5 | Set-Content -Path $tmp -Encoding utf8
  $name = 'belmazad-' + (Get-Date -Format 'yyyyMMdd-HHmmss')
  if ($WhatIf) {
    az deployment group what-if -g $ResourceGroup -n $name --template-file $template --parameters "@$tmp"
  } else {
    az deployment group create -g $ResourceGroup -n $name --template-file $template --parameters "@$tmp" `
      --query 'properties.outputs.{url:appUrl.value, app:appName.value, registry:registryName.value, vault:keyVaultName.value, deployClientId:deployClientId.value}' -o table
  }
} finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $values.Clear()
}
