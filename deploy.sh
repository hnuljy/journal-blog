#!/usr/bin/env sh
set -eu

if [ ! -f ".env" ]; then
  cp .env.example .env
  echo "Created .env from .env.example. Update admin credentials before exposing the site."
fi

echo "Starting public deployment with Docker Compose..."
echo "If you have a domain, set APP_DOMAIN and BASE_URL in .env before running this script."
echo "If APP_DOMAIN is empty, the site will listen on port 80 over HTTP."

docker compose up -d --build

echo "Deployment finished."
echo "Make sure ports 80 and 443 are open in the server firewall and cloud security group."
