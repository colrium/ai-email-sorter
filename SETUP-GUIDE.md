# AI Email Sorter - Local Development Setup Guide

Complete guide for setting up the AI Email Sorter application on your local machine.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [Google Cloud Configuration](#google-cloud-configuration)
4. [Anthropic API Setup](#anthropic-api-setup)
5. [Database Configuration](#database-configuration)
6. [Redis Configuration](#redis-configuration)
7. [Environment Variables](#environment-variables)
8. [Running the Application](#running-the-application)
9. [Testing](#testing)
10. [Troubleshooting](#troubleshooting)
11. [Database Management](#database-management)
12. [Useful Commands](#useful-commands)

---

## Prerequisites

Ensure you have the following installed and running:

- **Node.js**: Version 18 or higher
- **Yarn**: Package manager
- **PostgreSQL**: Version 13 or higher
- **Redis**: Version 6 or higher
- **Git**: Version control

Verify installations:

```bash
node --version    # Should be v18.0.0 or higher
yarn --version    # Should be 1.22.0 or higher
psql --version    # Should be 13.0 or higher
redis-cli --version
```

---

## Initial Setup

### 1. Clone Repository

```bash
git clone git@github.com:colrium/jump.ai-challenge.git jump-ai-challenge-mutugi
cd jump-ai-challenge-mutugi
```

### 2. Install Dependencies

```bash
yarn install
```

This will install all required packages including:

- Next.js 16
- Prisma ORM
- BullMQ
- Anthropic SDK
- Material UI
- NextAuth.js

### 3. Generate Security Keys

Generate two secure random keys for encryption and authentication:

```bash
# Using OpenSSL (Linux/Mac)
openssl rand -base64 32
openssl rand -base64 32

# Using Node.js (All platforms)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save these keys for later use in environment variables.

---

## Google Cloud Configuration

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" > "New Project"
3. Enter project name: `AI Email Sorter`
4. Click "Create"

### Step 2: Enable Gmail API

1. In the Google Cloud Console, navigate to "APIs & Services" > "Library"
2. Search for "Gmail API"
3. Click on "Gmail API"
4. Click "Enable"

### Step 3: Configure OAuth Consent Screen

1. Navigate to "APIs & Services" > "OAuth consent screen"
2. Select user type:
   - **Internal**: For Google Workspace users only
   - **External**: For testing with personal Gmail accounts
3. Click "Create"
4. Fill in application information:
   - **App name**: AI Email Sorter
   - **User support email**: Your email
   - **Developer contact**: Your email
5. Click "Save and Continue"
6. Add scopes:
   - Click "Add or Remove Scopes"
   - Add these Gmail scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
7. Click "Update" and "Save and Continue"
8. Add test users (for External type):
   - Click "Add Users"
   - Enter email addresses that will test the app
   - Click "Save and Continue"

### Step 4: Create OAuth 2.0 Credentials

1. Navigate to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client ID"
3. Select application type: "Web application"
4. Enter name: `AI Email Sorter Web Client`
5. Add Authorized redirect URIs:
   - For local development (NextAuth): `http://localhost:3000/api/auth/callback/google`
   - For local development (Additional Accounts): `http://localhost:3000/api/accounts/connect/callback`
   - For production (NextAuth): `https://your-domain.com/api/auth/callback/google`
   - For production (Additional Accounts): `https://your-domain.com/api/accounts/connect/callback`
6. Click "Create"
7. Save the **Client ID** and **Client Secret** (you'll need these for .env.local)

**Important:** Both redirect URIs are required:

- `/api/auth/callback/google` - Used for initial login (NextAuth)
- `/api/accounts/connect/callback` - Used for connecting additional Gmail accounts

---

## Anthropic API Setup

### Step 1: Create Anthropic Account

1. Visit [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Navigate to "API Keys"

### Step 2: Generate API Key

1. Click "Create Key"
2. Enter key name: `AI Email Sorter Development`
3. Copy the API key (it won't be shown again)
4. Save it for environment variables

### Pricing Information

- Claude API uses token-based pricing
- Development: Start with free tier or minimal credits
- Production: Monitor usage in Anthropic Console

---

## Database Configuration

### Step 1: Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE ai_email_sorter;

# Create user (optional)
CREATE USER email_sorter_user WITH PASSWORD 'your_secure_password';

# Grant privileges
GRANT ALL PRIVILEGES ON DATABASE ai_email_sorter TO email_sorter_user;

# Exit
\q
```

### Step 2: Verify Database Connection

```bash
psql -U postgres -d ai_email_sorter -c "SELECT version();"
```

### Step 3: Note Database URL Format

```
postgresql://username:password@localhost:5432/ai_email_sorter
```

Example:

```
postgresql://postgres:mypassword@localhost:5432/ai_email_sorter
```

---

## Redis Configuration

### Step 1: Install Redis

**Linux/Mac (using Homebrew):**

```bash
brew install redis
brew services start redis
```

**Linux (using apt):**

```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis-server
```

**Windows:**

- Download from [Redis Windows releases](https://github.com/microsoftarchive/redis/releases)
- Or use Docker: `docker run -d -p 6379:6379 redis`

### Step 2: Verify Redis is Running

```bash
redis-cli ping
# Should return: PONG
```

### Step 3: Note Redis URL

Local Redis URL:

```
redis://localhost:6379
```

With password:

```
redis://:password@localhost:6379
```

---

## Environment Variables

### Step 1: Create Environment Files

```bash
# Copy example to .env.local (used by Next.js)
cp .env.example .env.local

# Copy to .env (used by Prisma CLI)
cp .env.local .env
```

**Note:** Both files are needed:

- `.env.local` - Used by Next.js application at runtime
- `.env` - Used by Prisma CLI commands (generate, migrate, studio)

### Step 2: Configure .env.local

Open `.env.local` and fill in all values:

```env
# Application
NODE_ENV="development"
NEXTAUTH_URL="http://localhost:3000"

# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/ai_email_sorter"

# Redis
REDIS_URL="redis://localhost:6379"

# Authentication
NEXTAUTH_SECRET="<generated-secret-1>"

# Google OAuth
GOOGLE_CLIENT_ID="<your-client-id>.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="<your-client-secret>"

# Anthropic AI
ANTHROPIC_API_KEY="<your-anthropic-api-key>"

# Encryption
ENCRYPTION_KEY="<generated-secret-2>"

# Gmail Push Notifications (optional for local dev)
GMAIL_WEBHOOK_URL="http://localhost:3000/api/webhooks/gmail"
PUBSUB_VERIFICATION_TOKEN="<random-token>"
```

### Step 3: Validate Environment Variables

Create a validation script or manually verify all values are set correctly.

---

## Running the Application

### Step 1: Generate Prisma Client

```bash
yarn prisma:generate
```

This generates TypeScript types from your Prisma schema.

### Step 2: Run Database Migrations

```bash
yarn db:push
```

This creates all database tables based on the Prisma schema.

### Step 3: Start Development Server

```bash
yarn dev
```

The application will start on `http://localhost:3000`

### Step 4: Verify Application Start

You should see output similar to:

```
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
event - compiled client and server successfully
```

### Step 5: Access Application

Open browser and navigate to: `http://localhost:3000`

You should be redirected to `/login` page.

---

## Testing

### Authentication Flow Test

1. Navigate to `http://localhost:3000`
2. Click "Sign in with Google"
3. Select your Google account
4. Grant permissions when prompted
5. Verify redirect to `/dashboard`
6. Check that your profile appears in top-right corner

### Category Management Test

1. Click "Categories" in sidebar
2. Click "Create Category" button
3. Enter details:
   - Name: `Newsletters`
   - Description: `Marketing emails and promotional content`
   - Color: Choose any color
4. Click "Create"
5. Verify category appears in list
6. Test edit functionality
7. Test delete functionality

### Email Import Test

1. Navigate to Dashboard
2. Click "Import Emails" button
3. Select date range
4. Click "Start Import"
5. Monitor job progress
6. Verify emails appear in list
7. Check AI categorization results

### API Endpoints Test

Test API health:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2025-11-03T12:00:00.000Z"
}
```

### Database Connection Test

```bash
yarn run db:studio
```

This opens Prisma Studio at `http://localhost:5555` for visual database inspection.

### Queue System Test

Verify BullMQ queues are processing:

1. Import some emails
2. Check terminal logs for job processing
3. Look for: `[Queue] Processing job: <job-id>`

---

## Troubleshooting

### Issue: Module Not Found - '@/lib/db/prisma'

**Solution:**

```bash
yarn run prisma:generate
```

Then restart TypeScript server:

- VS Code: Press `Ctrl+Shift+P` > "TypeScript: Restart TS Server"
- Restart your IDE

### Issue: OAuth redirect_uri_mismatch

**Cause:** Google OAuth redirect URI doesn't match configuration

**Solution:**

1. Verify `.env.local` has: `NEXTAUTH_URL="http://localhost:3000"`
2. Check Google Console redirect URI is exactly: `http://localhost:3000/api/auth/callback/google`
3. No trailing slashes
4. Protocol must match (http vs https)

### Issue: Database Connection Failed

**Possible causes and solutions:**

1. PostgreSQL not running:

   ```bash
   # Check status
   sudo systemctl status postgresql

   # Start PostgreSQL
   sudo systemctl start postgresql
   ```

2. Wrong credentials:

   - Verify DATABASE_URL in `.env.local`
   - Test connection: `psql -U postgres -d ai_email_sorter`

3. Database doesn't exist:
   ```bash
   createdb ai_email_sorter
   ```

### Issue: Redis Connection Error

**Solution:**

```bash
# Check if Redis is running
redis-cli ping

# If not running, start Redis
brew services start redis  # Mac
sudo systemctl start redis-server  # Linux
```

### Issue: Port Already in Use (3000)

**Solution:**

```bash
# Find process using port 3000
lsof -i :3000  # Mac/Linux
netstat -ano | findstr :3000  # Windows

# Kill the process
kill -9 <PID>  # Mac/Linux
taskkill /PID <PID> /F  # Windows

# Or use a different port
PORT=3001 yarn run dev
```

### Issue: Prisma Schema Changes Not Reflected

**Solution:**

```bash
# Clear generated client
rm -rf node_modules/.prisma

# Regenerate
yarn run db:generate

# Push changes
yarn run db:push
```

### Issue: Next.js Build Errors

**Solution:**

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules
yarn install

# Try building again
yarn run build
```

### Issue: Anthropic API Key Invalid

**Solution:**

1. Verify API key in Anthropic Console
2. Check no extra spaces in `.env.local`
3. Ensure key starts with `sk-ant-`
4. Generate new key if necessary

### Issue: Gmail API Quota Exceeded

**Solution:**

1. Check quota usage in Google Cloud Console
2. Navigate to "APIs & Services" > "Dashboard"
3. Click on Gmail API
4. Review quota limits
5. Request quota increase if needed

---

## Database Management

### Open Database GUI

```bash
yarn db:studio
```

Access Prisma Studio at `http://localhost:5555`

### View Database Schema

```bash
yarn prisma db pull
```

### Check Migration Status

```bash
yarn prisma migrate status
```

### Create New Migration

```bash
yarn prisma:migrate --name add_new_field
```

### Reset Database (Delete All Data)

```bash
yarn prisma migrate reset
```

**Warning:** This deletes all data and re-runs all migrations.

### Backup Database

```bash
pg_dump -U postgres ai_email_sorter > backup.sql
```

### Restore Database

```bash
psql -U postgres ai_email_sorter < backup.sql
```

### View All Tables

```bash
psql -U postgres -d ai_email_sorter -c "\dt"
```

---

## Useful Commands

### Development

```bash
# Start development server
yarn dev

# Start with specific port
PORT=3001 yarn dev

# Type checking
yarn type-check

# Lint code
yarn lint
```

### Testing

```bash
# Run all tests
yarn test

# Run tests with coverage
yarn test:coverage

# Run specific test file
yarn test tests/unit/encryption.test.ts

# Run tests in watch mode
yarn test --watch

# Run e2e tests
yarn test:e2e
```

### Building

```bash
# Build for production
yarn build

# Start production server
yarn start

# Build and start
yarn build && yarn start
```

### Database

```bash
# Generate Prisma client
yarn prisma:generate

# Push schema changes
yarn db:push

# Open Prisma Studio
yarn db:studio

# Check migration status
yarn prisma migrate status

# Create migration
yarn prisma:migrate --name migration_name

# Deploy migrations
yarn prisma migrate deploy

# Reset database (WARNING: deletes all data)
yarn prisma migrate reset

# Seed database
yarn prisma:seed

# Pull schema from database
yarn prisma db pull
```

### Code Quality

```bash
# Format code
yarn format

# Lint and fix
yarn lint --fix

# Check types
yarn type-check
```

### Logs and Debugging

```bash
# View logs with error filtering
yarn dev | grep ERROR

# View logs with specific pattern
yarn dev | grep "Queue"

# Enable debug mode
DEBUG=* yarn dev
```

---

## Next Steps

After successful setup:

1. Review [PROJECT-SYSTEM-DESIGN.md](PROJECT-SYSTEM-DESIGN.md) to understand architecture
2. Read [PROJECT-REQUIREMENTS.md](PROJECT-REQUIREMENTS.md) for feature details
3. See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for production deployment
4. Check [README.md](README.md) for project overview

---

## Support

For issues not covered in this guide:

1. Check existing GitHub issues
2. Review error logs in terminal
3. Verify all environment variables are set
4. Ensure all services (PostgreSQL, Redis) are running
5. Try clearing caches and rebuilding
