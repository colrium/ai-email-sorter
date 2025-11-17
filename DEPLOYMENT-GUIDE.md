# Production Deployment Guide

## Overview

This guide walks through deploying the AI Email Sorter app to production on Fly.io.

## Prerequisites

- Fly.io account (https://fly.io)
- Fly CLI installed (`brew install flyctl` or https://fly.io/docs/getting-started/installing-flyctl/)
- Docker installed locally
- All environment variables ready

## Deployment Steps

### 1. Set Up External Services

#### PostgreSQL Database

```bash
# Create Fly Postgres app
fly postgres create --name jump-ai-challenge-db --region sea

# Get connection string
fly postgres connect --app jump-ai-challenge-db

# Note the DATABASE_URL for later
```

#### Redis Instance

```bash
# Create Fly Redis (Upstash)
fly redis create --name jump-ai-challenge-redis --region sea

# Get Redis URL
fly redis status jump-ai-challenge-redis

# Note the REDIS_URL for later
```

### 2. Configure Fly.io App

Create `fly.toml` in project root:

```toml
app = "jump-ai-challenge"
primary_region = "sea"

[build]
  dockerfile = "Dockerfile"

[env]
  NODE_ENV = "production"
  PORT = "8080"

[[services]]
  internal_port = 8080
  protocol = "tcp"

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443

  [[services.http_checks]]
    interval = 10000
    grace_period = "5s"
    method = "get"
    path = "/api/health"
    protocol = "http"
    timeout = 2000

[processes]
  web = "yarn start"
  worker = "yarn worker"

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 1024
```

### 3. Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
FROM node:20-alpine AS base

# Install dependencies for Puppeteer
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

# Tell Puppeteer to use installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app

COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile

# Stage 2: Builder
FROM base AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Build Next.js app
RUN yarn build

# Stage 3: Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma

USER nextjs

EXPOSE 8080

ENV PORT 8080
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### 4. Update next.config.ts

```typescript
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

module.exports = nextConfig;
```

### 5. Set Environment Variables

```bash
# Set secrets in Fly.io
fly secrets set DATABASE_URL="postgresql://..." \\
  NEXTAUTH_URL="https://jump-ai-challenge.fly.dev" \\
  NEXTAUTH_SECRET="$(openssl rand -base64 32)" \\
  GOOGLE_CLIENT_ID="..." \\
  GOOGLE_CLIENT_SECRET="..." \\
  ANTHROPIC_API_KEY="sk-ant-..." \\
  REDIS_URL="redis://..." \\
  ENCRYPTION_KEY="$(openssl rand -base64 32)" \\
  CRON_SECRET="$(openssl rand -base64 32)"
```

### 6. Run Database Migrations

```bash
# Connect to your Postgres database
fly postgres connect --app jump-ai-challenge-db

# Or run migrations from local
DATABASE_URL="your-production-db-url" yarn prisma migrate deploy
```

### 7. Deploy Application

```bash
# Initialize Fly app
fly launch --no-deploy

# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs
```

### 8. Scale Application

```bash
# Scale web instances
fly scale count 2

# Scale worker process
fly scale count worker=1

# Increase VM resources
fly scale vm shared-cpu-2x --memory 2048
```

## Post-Deployment Configuration

### 1. Update Google OAuth Redirect URIs

In Google Cloud Console:

- Add `https://jump-ai-challenge.fly.dev/api/auth/callback/google`
- Update JavaScript origins to include `https://jump-ai-challenge.fly.dev`

### 2. Set Up Cron Jobs

For scheduled email sync, configure a cron service:

```bash
# Using GitHub Actions (recommended)
# Create .github/workflows/cron-sync.yml
```

Or use Fly.io scheduled tasks:

```toml
# In fly.toml
[[cron]]
  schedule = "*/5 * * * *"  # Every 5 minutes
  command = "curl https://jump-ai-challenge.fly.dev/api/cron/sync-emails -H 'Authorization: Bearer $CRON_SECRET'"
```

### 3. Configure Monitoring

#### Basic Monitoring

```bash
# View metrics
fly dashboard jump-ai-challenge

# Set up alerts
fly alerts create --app jump-ai-challenge
```

#### Advanced Monitoring (Optional)

- Sentry for error tracking
- LogDNA/Datadog for logs
- Uptime Robot for availability

### 4. Set Up Backups

```bash
# Automated Postgres backups (Fly does this automatically)
fly postgres backup list --app jump-ai-challenge-db

# Manual backup
fly postgres backup create --app jump-ai-challenge-db
```

## Environment Variables Reference

```env
# Required
DATABASE_URL=postgresql://user:pass@host:5432/dbname
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=<generated-secret>
GOOGLE_CLIENT_ID=<from-google-console>
GOOGLE_CLIENT_SECRET=<from-google-console>
ANTHROPIC_API_KEY=sk-ant-<your-key>
REDIS_URL=redis://default:<password>@host:port
ENCRYPTION_KEY=<generated-32-byte-key>

# Optional but recommended
CRON_SECRET=<generated-secret>
NODE_ENV=production
PORT=8080

# Monitoring (optional)
SENTRY_DSN=<your-sentry-dsn>
```

## Verification Checklist

After deployment, verify:

- [ ] App is accessible at your domain
- [ ] OAuth login works
- [ ] Database connection successful
- [ ] Redis connection successful
- [ ] Email import works
- [ ] AI categorization works
- [ ] Background jobs processing
- [ ] Gmail push notifications work
- [ ] Unsubscribe agent works (Puppeteer)
- [ ] Multi-account support works
- [ ] SSL certificate active
- [ ] Health check endpoint responding
- [ ] Logs are being captured
- [ ] Backups are running

## Troubleshooting

### Common Issues

#### 1. Puppeteer Fails

```bash
# Check Chromium installation
fly ssh console -a jump-ai-challenge
chromium-browser --version

# If missing, rebuild with proper Dockerfile
```

#### 2. Database Connection Errors

```bash
# Verify DATABASE_URL
fly secrets list

# Test connection
fly ssh console -a jump-ai-challenge
psql $DATABASE_URL
```

#### 3. Redis Connection Issues

```bash
# Check Redis status
fly redis status jump-ai-challenge-redis

# Test connection
fly ssh console
redis-cli -u $REDIS_URL ping
```

#### 4. Out of Memory

```bash
# Increase memory
fly scale vm shared-cpu-2x --memory 2048

# Or reduce concurrent workers
```

#### 5. OAuth Redirect Mismatch

- Double-check redirect URIs in Google Console
- Ensure NEXTAUTH_URL matches your domain exactly
- Check for http vs https mismatch

### Viewing Logs

```bash
# Real-time logs
fly logs -a jump-ai-challenge

# Specific process
fly logs -a jump-ai-challenge --worker

# Last 100 lines
fly logs -a jump-ai-challenge --lines 100
```

### SSH Access

```bash
# SSH into container
fly ssh console -a jump-ai-challenge

# Run commands
fly ssh console -a jump-ai-challenge -C "yarn prisma studio"
```

## Cost Estimation (Fly.io)

**Typical monthly costs:**

- Shared CPU-1x (256MB RAM): ~$0.60/month per instance
- Shared CPU-2x (2GB RAM): ~$17/month per instance
- PostgreSQL (10GB): ~$10/month
- Redis (250MB): ~$2/month
- Egress traffic: ~$0.02/GB

**Estimated total:** $30-60/month depending on usage

## Security Best Practices

1.  Use secrets for all sensitive data
2.  Enable HTTPS (automatic on Fly.io)
3.  Rotate secrets regularly
4.  Use least-privilege database users
5.  Enable audit logging
6.  Monitor for suspicious activity
7.  Keep dependencies updated
8.  Use environment-specific secrets
9.  Enable CORS restrictions
10.  Implement rate limiting

## Scaling Strategies

### Vertical Scaling

```bash
# Increase CPU/RAM
fly scale vm shared-cpu-2x --memory 2048
```

### Horizontal Scaling

```bash
# Add more web instances
fly scale count 3

# Regional distribution
fly regions add lax sea
```

### Database Scaling

```bash
# Upgrade Postgres plan
fly postgres update --plan performance-1
```

## Rollback Procedure

```bash
# List releases
fly releases -a jump-ai-challenge

# Rollback to previous version
fly releases rollback <version-number>
```

## Support Resources

- Fly.io Docs: https://fly.io/docs
- Fly.io Community: https://community.fly.io
- Next.js Deploy Docs: https://nextjs.org/docs/deployment
- Prisma Production: https://www.prisma.io/docs/guides/deployment

## Success!

Your AI Email Sorter app should now be live and processing emails automatically! 

Access your app at: https://jump-ai-challenge.fly.dev

