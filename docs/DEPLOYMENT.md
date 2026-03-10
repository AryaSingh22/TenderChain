# TenderChain — Production Deployment Guide

## Prerequisites

| Component | Version | Description |
|-----------|---------|-------------|
| Kubernetes | ≥ 1.27 | Container orchestration |
| Helm | ≥ 3.12 | Package manager for K8s |
| Docker | ≥ 24.0 | Container runtime |
| kubectl | ≥ 1.27 | K8s CLI |
| PostgreSQL | ≥ 15 | Primary database |
| Node.js | ≥ 18 | Runtime for backend/frontend |

## Architecture Overview

```
                ┌──────────────┐
                │  Cloudflare  │
                │   CDN/WAF    │
                └──────┬───────┘
                       │
            ┌──────────┴──────────┐
            │   Ingress (nginx)   │
            └──┬──────────────┬───┘
               │              │
        ┌──────┴──────┐  ┌────┴─────┐
        │  Frontend   │  │  Backend │
        │  (Next.js)  │  │ (Fastify)│
        └─────────────┘  └────┬─────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
               ┌────┴─────┐    ┌─────────┴────┐
               │PostgreSQL │    │  Blockchain  │
               │  (RDS)   │    │  (Hardhat /  │
               └──────────┘    │   Sepolia)   │
                               └──────────────┘
```

## Step 1: Container Images

```bash
# Build backend image
docker build -t tenderchain-api:latest -f apps/backend/Dockerfile .

# Build frontend image
docker build -t tenderchain-web:latest -f apps/frontend/Dockerfile .

# Push to registry
docker tag tenderchain-api:latest gcr.io/PROJECT_ID/tenderchain-api:latest
docker push gcr.io/PROJECT_ID/tenderchain-api:latest
docker tag tenderchain-web:latest gcr.io/PROJECT_ID/tenderchain-web:latest
docker push gcr.io/PROJECT_ID/tenderchain-web:latest
```

## Step 2: Kubernetes Namespace and Secrets

```bash
kubectl create namespace tenderchain

kubectl create secret generic tenderchain-secrets \
  --namespace tenderchain \
  --from-literal=JWT_SECRET=$(openssl rand -hex 32) \
  --from-literal=DATABASE_URL="postgresql://user:pass@postgres:5432/tenderchain" \
  --from-literal=DEPLOYER_PRIVATE_KEY="0x..." \
  --from-literal=RPC_URL="https://rpc.tenderchain.io"
```

## Step 3: Deploy PostgreSQL

```bash
helm install postgres bitnami/postgresql \
  --namespace tenderchain \
  --set auth.postgresPassword=STRONG_PASSWORD \
  --set auth.database=tenderchain \
  --set primary.persistence.size=50Gi
```

## Step 4: Deploy Backend API

```yaml
# infra/k8s/backend-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: tenderchain-api
  namespace: tenderchain
spec:
  replicas: 3
  selector:
    matchLabels:
      app: tenderchain-api
  template:
    metadata:
      labels:
        app: tenderchain-api
    spec:
      containers:
        - name: api
          image: gcr.io/PROJECT_ID/tenderchain-api:latest
          ports:
            - containerPort: 3001
          envFrom:
            - secretRef:
                name: tenderchain-secrets
          resources:
            requests:
              cpu: 250m
              memory: 256Mi
            limits:
              cpu: 500m
              memory: 512Mi
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 15
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health
              port: 3001
            initialDelaySeconds: 5
            periodSeconds: 5
```

```bash
kubectl apply -f infra/k8s/backend-deployment.yaml
```

## Step 5: Deploy Frontend

```bash
kubectl apply -f infra/k8s/frontend-deployment.yaml
```

## Step 6: Ingress and TLS

```yaml
# infra/k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: tenderchain-ingress
  namespace: tenderchain
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.tenderchain.io
        - app.tenderchain.io
      secretName: tenderchain-tls
  rules:
    - host: api.tenderchain.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tenderchain-api
                port:
                  number: 3001
    - host: app.tenderchain.io
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: tenderchain-web
                port:
                  number: 3000
```

## Step 7: Smart Contract Deployment

```bash
# Deploy to production chain
npx hardhat run scripts/deploy.ts --network tenderchain

# Verify contracts on block explorer
npx hardhat verify --network tenderchain <CONTRACT_ADDRESS>
```

## Step 8: Monitoring

Deploy Prometheus + Grafana for monitoring:

```bash
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring --create-namespace
```

## Step 9: Verification Checklist

- [ ] All pods running: `kubectl get pods -n tenderchain`
- [ ] Health check passes: `curl https://api.tenderchain.io/api/health`
- [ ] TLS certificates valid
- [ ] Database migrations applied
- [ ] Smart contracts deployed and verified
- [ ] Environment variables set correctly
- [ ] Rate limiting configured
- [ ] CORS and CSP headers correct
