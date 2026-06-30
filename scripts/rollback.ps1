param(
    [ValidateSet('1', '2', '3')]
    [string]$Slot = '2'
)

$historyPath = Join-Path $PSScriptRoot '..\k8s\overlays\prod\deploy-history.json'
$kustomizationPath = Join-Path $PSScriptRoot '..\k8s\overlays\prod\kustomization.yaml'

if (-not (Test-Path $historyPath)) {
    throw "Release history file not found: $historyPath"
}

$history = Get-Content $historyPath -Raw | ConvertFrom-Json
$slotIndex = [int]$Slot - 1

if ($history.Count -le $slotIndex) {
    throw "Slot $Slot is not available yet."
}

$selected = $history[$slotIndex]
$content = Get-Content $kustomizationPath -Raw
$content = $content -replace '(newTag:\s*)deploy-\d+', "`$1deploy-$Slot"
$content = $content -replace '(p-g20\.io/build-sha:\s*).+$', "`$1$($selected.sha)"
$content = $content -replace '(p-g20\.io/release-slot:\s*).+$', "`$1`"$Slot`""
Set-Content -Path $kustomizationPath -Value $content -NoNewline -Encoding UTF8

Write-Host "Rolled overlay to slot $Slot with SHA $($selected.sha). Commit the change so ArgoCD can sync it."