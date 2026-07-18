# Sentinel AI VMS — Security Architecture

---

## 1. Authentication & Authorization

### JWT Configuration

- **Algorithm:** HS256 (development), RS256 (production recommended)
- **Expiry:** 24 hours (configurable via `JWT_EXPIRY` env var)
- **Secret:** Minimum 256-bit random secret; rotated quarterly
- **Storage:** Client stores in `localStorage`; server validates on every request

### RBAC Roles

| Role | Cameras | AI Events | Incidents | Evidence | Users | System |
|------|---------|-----------|-----------|----------|-------|--------|
| ADMIN | Full | Full | Full | Full | Full | Full |
| SUPERVISOR | Full | Full | Full | Read+Write | Read | Read |
| OPERATOR | Read | Full | Read+Write | Read | None | Read |
| VIEWER | Read | Read | Read | None | None | None |

### Secret Rotation

```bash
# Rotate JWT secret (zero-downtime: old tokens remain valid for 1 hour via dual validation)
kubectl patch secret sentinel-vms-secrets -n sentinel-vms \
  --type='json' \
  -p='[{"op":"replace","path":"/data/JWT_SECRET","value":"'$(openssl rand -hex 64 | base64)'"}]'

kubectl rollout restart deployment/sentinel-vms -n sentinel-vms
```

---

## 2. Network Security

### TLS Configuration

- **External:** TLS 1.2/1.3 at nginx (ECDHE ciphers, HSTS with 2-year max-age, preload)
- **Internal:** Plain TCP within the cluster (upgrade to mTLS via Istio/Linkerd for zero-trust)
- **Certificate management:** cert-manager + Let's Encrypt in Kubernetes; manual cert in Docker Compose

### Security Headers

All responses include (enforced at nginx):
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Frame-Options: SAMEORIGIN
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Content-Security-Policy: default-src 'self'; ...
Permissions-Policy: camera=*,microphone=()
```

---

## 3. Secrets Management

### Development

Use `.env` file (never committed to source control).

### Production (Kubernetes)

**Option A — Sealed Secrets (recommended for GitOps):**
```bash
kubeseal --cert pubkey.pem -o yaml < k8s/secret.yaml > k8s/sealed-secret.yaml
```

**Option B — External Secrets Operator (recommended for Vault/AWS SSM):**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: sentinel-vms-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: sentinel-vms-secrets
  data:
    - secretKey: JWT_SECRET
      remoteRef:
        key: sentinel/vms/jwt-secret
```

---

## 4. Audit Logging

Every security-significant event is recorded in:
1. **PostgreSQL `audit_log` table** (partitioned by month, retained 1 year)
2. **VMS Audit Service** (`vmsAuditService`) — async writes with Firestore fallback
3. **Application logs** (Winston structured JSON → log aggregator)

Audited events:
- Authentication (login, logout, failed attempts)
- Authorization failures (403 responses)
- Configuration changes
- User management (create, delete, role change)
- Evidence access and export
- Camera additions and removals
- Deployment events (logged by CI/CD pipeline)
- Emergency controls (lockdown, buzzer activation)

---

## 5. Vulnerability Management

### CI/CD Pipeline Scans

| Tool | Type | Trigger |
|------|------|---------|
| `npm audit` | Dependency vulnerabilities | Every push |
| CodeQL | SAST (static analysis) | Every push |
| Trivy | Container image vulnerabilities | After build |
| TruffleHog | Secret detection | Every push |

### Patching Policy

- **Critical (CVSS 9.0+):** Patch within 24 hours
- **High (CVSS 7.0-8.9):** Patch within 7 days
- **Medium:** Patch within 30 days
- **Low:** Next scheduled release

---

## 6. Data Privacy

- **Evidence encryption at rest:** MinIO server-side encryption (SSE-S3)
- **Database encryption:** Filesystem-level encryption (LUKS) on host
- **PII minimisation:** Face embeddings stored as numeric vectors (no biometric templates in plaintext)
- **Data retention:** Configurable per-bucket lifecycle policies; audit log partitioned for easy deletion
- **Right to erasure:** `DELETE FROM identities WHERE id = $1 CASCADE` removes all associated embeddings and tracks
