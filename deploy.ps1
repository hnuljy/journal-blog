$ErrorActionPreference = "Stop"

if (-not (Test-Path ".env")) {
  Copy-Item ".env.example" ".env"
  Write-Host "Created .env from .env.example. Update the admin credentials before exposing the site."
}

Write-Host "Starting public deployment with Docker Compose..."
Write-Host "If you have a domain, set APP_DOMAIN and BASE_URL in .env before running this script."
Write-Host "If APP_DOMAIN is empty, the site will listen on port 80 over HTTP."

docker compose up -d --build

Write-Host "Deployment finished."
Write-Host "Make sure ports 80 and 443 are open in the server firewall and cloud security group."
