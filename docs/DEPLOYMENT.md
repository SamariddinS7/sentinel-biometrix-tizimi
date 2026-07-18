# Sentinel AI VMS — Deployment Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Docker | 24+ | Required for all deployment modes |
| Docker Compose | 2.20+ | Development and simple production |
| kubectl | 1.28+ | Kubernetes deployments |
| Helm | 3.16+ | Kubernetes package management |
| Node.js | 20+ | Development only |

---

## Quick Start (Development)

```bash
# 1. Clone and install
git clone https://github.com/org/sentinel-vms
cd sentinel-vms
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set JWT_SECRET, etc.

# 3. Start all services (first run downloads ~2GB of images)
docker compose up -d

# 4. Verify everything is running
docker compose ps
curl http://localhost:5000/health/status | jq .
```

Access points:
- **Application:** http://localhost:5000
- **Grafana:** http://localhost:3001 (admin / sentinel_grafana)
- **MinIO Console:** http://localhost:9001 (sentinel_dev / sentinel_dev_secret)
- **NATS Monitor:** http://localhost:8222
- **Prometheus:** http://localhost:9091

---

## Production Deployment (Docker Compose)

### 1. Prepare secrets

```bash
# Create production env file (never commit this)
cp .env.example .env.prod

# Generate strong secrets
JWT_SECRET=$(openssl rand -hex 64)
SESSION_SECRET=$(openssl rand -hex 32)
VMS_ENCRYPTION_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)
REDIS_PASSWORD=$(openssl rand -base64 32)
MINIO_ROOT_PASSWORD=$(openssl rand -base64 32)
GRAFANA_PASSWORD=$(openssl rand -base64 24)

# Edit .env.prod with the generated values
```

### 2. TLS certificates

```bash
# Using certbot (Let's Encrypt)
certbot certonly --standalone -d vms.yourdomain.com
cp /etc/letsencrypt/live/vms.yourdomain.com/fullchain.pem nginx/ssl/
cp /etc/letsencrypt/live/vms.yourdomain.com/privkey.pem nginx/ssl/

# OR generate self-signed for internal deployments
openssl req -x509 -nodes -days 3650 -newkey rsa:4096 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=vms.internal"
```

### 3. Create Docker secrets

```bash
echo "${JWT_SECRET}"           | docker secret create jwt_secret -
echo "${POSTGRES_PASSWORD}"    | docker secret create postgres_password -
echo "${REDIS_PASSWORD}"       | docker secret create redis_password -
echo "${MINIO_ROOT_PASSWORD}"  | docker secret create minio_password -
```

### 4. Deploy

```bash
# Update nginx.conf with your domain
sed -i 's/vms.example.com/vms.yourdomain.com/g' nginx/nginx.conf

docker compose -f docker-compose.prod.yml up -d

# Verify deployment
docker compose -f docker-compose.prod.yml ps
curl -k https://vms.yourdomain.com/health/status
```

---

## Kubernetes Deployment (Helm)

### 1. Create namespace and secrets

```bash
kubectl apply -f k8s/namespace.yaml

# Create secrets (use Sealed Secrets or External Secrets in production)
kubectl create secret generic sentinel-vms-secrets \
  --namespace sentinel-vms \
  --from-literal=JWT_SECRET=$(openssl rand -hex 64) \
  --from-literal=SESSION_SECRET=$(openssl rand -hex 32) \
  --from-literal=VMS_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  --from-literal=POSTGRES_URL="postgres://sentinel:${POSTGRES_PASSWORD}@sentinel-vms-postgresql:5432/sentinel_vms?sslmode=require" \
  --from-literal=REDIS_URL="redis://:${REDIS_PASSWORD}@sentinel-vms-redis-sentinel:26379" \
  --from-literal=NATS_URL="nats://sentinel-vms-nats:4222" \
  --from-literal=STORAGE_ENDPOINT="http://sentinel-vms-minio:9000" \
  --from-literal=STORAGE_ACCESS_KEY="${MINIO_ACCESS_KEY}" \
  --from-literal=STORAGE_SECRET_KEY="${MINIO_SECRET_KEY}"
```

### 2. Add Helm repositories

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo add nats    https://nats-io.github.io/k8s/helm/charts
helm repo update
```

### 3. Update dependencies

```bash
helm dependency update helm/sentinel-vms
```

### 4. Install

```bash
# Staging
helm install sentinel-vms ./helm/sentinel-vms \
  --namespace sentinel-vms \
  --values helm/sentinel-vms/values.yaml \
  --set ingress.hosts[0].host=staging-vms.example.com \
  --set ingress.tls[0].hosts[0]=staging-vms.example.com \
  --wait

# Production
helm install sentinel-vms ./helm/sentinel-vms \
  --namespace sentinel-vms \
  --values helm/sentinel-vms/values.yaml \
  --values helm/sentinel-vms/values.prod.yaml \
  --set image.tag=$(git rev-parse --short HEAD) \
  --atomic \
  --timeout 10m
```

### 5. Verify

```bash
kubectl get pods -n sentinel-vms
kubectl rollout status deployment/sentinel-vms -n sentinel-vms

# Test health endpoint
kubectl port-forward svc/sentinel-vms 8080:80 -n sentinel-vms &
curl http://localhost:8080/health/status | jq .
```

---

## Rolling Update (Zero-Downtime)

```bash
# Build and push new image
docker build --target production -t ghcr.io/org/sentinel-vms:v3.1.0 .
docker push ghcr.io/org/sentinel-vms:v3.1.0

# Rolling update (Helm)
helm upgrade sentinel-vms ./helm/sentinel-vms \
  --namespace sentinel-vms \
  --set image.tag=v3.1.0 \
  --wait --timeout 10m

# Monitor rollout
kubectl rollout status deployment/sentinel-vms -n sentinel-vms
```

---

## Database Migrations

Migrations run automatically on startup when `POSTGRES_URL` is set.  
To run manually:

```bash
# Apply all pending migrations
POSTGRES_URL="..." npx tsx scripts/migrate.ts

# Or inside a running container
kubectl exec -it deployment/sentinel-vms -n sentinel-vms -- \
  node -e "import('./services/infrastructure/database.js').then(m => m.db)"
```

---

## Disaster Recovery

See [DISASTER_RECOVERY.md](DISASTER_RECOVERY.md) for full procedures.

Quick restore:
```bash
# 1. Stop application
docker compose -f docker-compose.prod.yml stop app

# 2. Restore PostgreSQL from backup
BACKUP_FILE="s3://vms-backups/2026/07/18/postgres_2026-07-18.dump"
aws s3 cp "${BACKUP_FILE}" /tmp/restore.dump --endpoint-url "${STORAGE_ENDPOINT}"
pg_restore --clean --if-exists -d "${POSTGRES_URL}" /tmp/restore.dump

# 3. Restart application
docker compose -f docker-compose.prod.yml start app
```
