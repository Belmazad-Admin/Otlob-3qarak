<#
  Adds or replaces one secret in the site's Key Vault, with hidden typing:
      powershell -ExecutionPolicy Bypass -File .\infra\set-secret.ps1 hubspot-access-token

  The value goes to Azure through a temporary file that is deleted straight away (not on the command line, not in
  PowerShell history). Afterwards it prints only the secret's name and when it was updated.
#>
param(
  [Parameter(Mandatory = $true)]
  [ValidateSet('hubspot-access-token', 'openai-api-key', 'admin-password', 'admin-session-secret', 'wishlist-id-salt')]
  [string]$Name,
  [string]$ResourceGroup = 'Matchmaking_belmazad'
)
$ErrorActionPreference = 'Stop'

$old = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
$vault = (& az keyvault list -g $ResourceGroup --query "[0].name" -o tsv 2>$null | Out-String).Trim()
$ErrorActionPreference = $old
if (-not $vault) { throw "No Key Vault in $ResourceGroup yet. Run: .\infra\deploy.ps1 -Stage vault" }

$secure = Read-Host -Prompt "Value for $Name (typing is hidden)" -AsSecureString
$value = [Runtime.InteropServices.Marshal]::PtrToStringBSTR([Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure))
$value = $value.Trim()
if (-not $value) { throw 'Nothing was entered; the secret was not changed.' }
if ($Name -eq 'admin-password' -and $value.Length -lt 12) { throw 'The admin password must be at least 12 characters.' }

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("belmazad-secret-" + [guid]::NewGuid())
try {
  [IO.File]::WriteAllText($tmp, $value)   # UTF-8, no BOM, no trailing newline
  az keyvault secret set --vault-name $vault -n $Name --file $tmp --encoding utf-8 --query "{name:name, updated:attributes.updated}" -o table
} finally {
  Remove-Item $tmp -ErrorAction SilentlyContinue
  $value = $null
}
