#!/usr/bin/env sh
# Docker HEALTHCHECK script
# Called by Docker/Kubernetes to determine container health.
set -e

PORT="${PORT:-5000}"
ENDPOINT="http://localhost:${PORT}/health/live"

# curl with timeout — exits non-zero if unhealthy
response=$(curl --silent --fail --max-time 5 "${ENDPOINT}" 2>/dev/null) || exit 1

# Verify response contains status:ok
echo "${response}" | grep -q '"ok"' || exit 1

exit 0
