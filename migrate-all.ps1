param(
    [switch]$DryRun,
    [int]$TimeoutSeconds = 900
)

$ErrorActionPreference = "Stop"
$projectRoot = $PSScriptRoot
$composeFile = Join-Path $projectRoot "docker-compose.yml"

$services = @(
    "api-gateway",
    "customer-service",
    "book-service",
    "cart-service",
    "staff-service",
    "manager-service",
    "catalog-service",
    "order-service",
    "ship-service",
    "pay-service",
    "comment-rate-service",
    "recommender-ai-service"
)

Write-Host "=== Parallel Migration Runner ===" -ForegroundColor Cyan
Write-Host "Services: $($services.Count)" -ForegroundColor Cyan
Write-Host ""

if ($DryRun) {
    Write-Host "Dry run mode. Commands that would run:" -ForegroundColor Yellow
    foreach ($service in $services) {
        Write-Host "docker compose exec -T $service python manage.py migrate" -ForegroundColor Gray
    }
    exit 0
}

# Check docker compose availability and running containers.
$null = docker compose -f $composeFile version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: docker compose is not available." -ForegroundColor Red
    exit 1
}

$psOutput = docker compose -f $composeFile ps --services --status running 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not read docker compose status." -ForegroundColor Red
    Write-Host $psOutput -ForegroundColor DarkYellow
    exit 1
}

$runningServices = @($psOutput | Where-Object { $_ -and $_.Trim().Length -gt 0 })
if ($runningServices.Count -eq 0) {
    Write-Host "ERROR: No running services found. Start stack first: docker compose up -d" -ForegroundColor Red
    exit 1
}

Write-Host "Starting migrations in parallel..." -ForegroundColor Yellow
$jobs = @()

foreach ($service in $services) {
    $job = Start-Job -Name "migrate-$service" -ScriptBlock {
        param($serviceName, $composePath)
        $output = docker compose -f $composePath exec -T $serviceName python manage.py migrate 2>&1
        [pscustomobject]@{
            Service  = $serviceName
            ExitCode = $LASTEXITCODE
            Output   = ($output -join "`n")
        }
    } -ArgumentList $service, $composeFile

    $jobs += $job
}

$null = Wait-Job -Job $jobs -Timeout $TimeoutSeconds

$results = @()
foreach ($job in $jobs) {
    if ($job.State -eq "Running") {
        Stop-Job -Job $job | Out-Null
        $results += [pscustomobject]@{
            Service  = $job.Name.Replace("migrate-", "")
            ExitCode = 124
            Output   = "Timed out after $TimeoutSeconds seconds"
        }
    }
    else {
        $received = Receive-Job -Job $job
        $results += $received
    }
}

$jobs | Remove-Job -Force | Out-Null

$ok = @($results | Where-Object { $_.ExitCode -eq 0 })
$failed = @($results | Where-Object { $_.ExitCode -ne 0 })

Write-Host ""
Write-Host "=== Migration Summary ===" -ForegroundColor Cyan
Write-Host "Success: $($ok.Count)" -ForegroundColor Green
Write-Host "Failed:  $($failed.Count)" -ForegroundColor Red
Write-Host ""

if ($ok.Count -gt 0) {
    Write-Host "Successful services:" -ForegroundColor Green
    foreach ($item in $ok) {
        Write-Host "  - $($item.Service)" -ForegroundColor Green
    }
    Write-Host ""
}

if ($failed.Count -gt 0) {
    Write-Host "Failed services and short errors:" -ForegroundColor Red
    foreach ($item in $failed) {
        Write-Host "  - $($item.Service) (exit $($item.ExitCode))" -ForegroundColor Red
        $snippet = ($item.Output -split "`n" | Select-Object -Last 6) -join "`n"
        Write-Host $snippet -ForegroundColor DarkYellow
        Write-Host ""
    }
    exit 1
}

Write-Host "All migrations completed successfully." -ForegroundColor Green
exit 0
