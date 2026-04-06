# Redis Production Deployment Guide

This document provides instructions for setting up and maintaining a production-ready Redis instance for the MealCart API.

## 1. Recommended Providers

### Option A: Upstash (Serverless)
Best for deployments on Vercel, Railway, or Render. It scales to zero and handles TLS automatically.
- **Protocol**: `rediss://` (Required)
- **Configuration**: `REDIS_URL=rediss://default:PASSWORD@your-instance.upstash.io:6379`

### Option B: Redis Cloud
Great for AWS, GCP, or Azure deployments with a generous free tier.
- **Protocol**: `rediss://` (Required for encrypted traffic)
- **Configuration**: `REDIS_URL=rediss://:PASSWORD@redis-12345.c1.us-central1-2.gce.cloud.redislabs.com:12345`

## 2. Environment Configuration

Ensure your production environment variables are set correctly:

| Variable | Recommended Value | Description |
| :--- | :--- | :--- |
| `REDIS_URL` | `rediss://...` | Connection string starting with `rediss` for TLS. |
| `REDIS_TLS_REJECT_UNAUTHORIZED` | `true` | Enforces valid SSL certificates. |

## 3. Server Configuration (Self-Managed)

If you are running your own Redis via Docker or VPS, ensure the following `redis.conf` settings are applied for optimal caching:

```conf
# Eviction policy to prevent memory exhaustion
maxmemory 256mb
maxmemory-policy allkeys-lru

# Persistence (optional for pure caching)
save ""
appendonly no
```

## 4. Troubleshooting

- **Connection Refused**: Verify the host and port. Ensure your provider's firewall allows your API server's IP.
- **Handshake Failed**: This usually means you are using `redis://` instead of `rediss://` for a provider that requires TLS.
- **Slow Queries**: Monitor expensive operations like `KEYS *`. MealCart uses `SCAN` and patterns to avoid blocking the single-threaded Redis process.

---

> [!TIP]
> Always use a managed service for production to ensure data availability and automatic backups of your cached sessions.
