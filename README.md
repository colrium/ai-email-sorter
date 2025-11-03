# AI Email Sorter

An intelligent email management system that automatically categorizes, summarizes, and organizes your Gmail inbox using AI.

## ✨ Key Features

- 🤖 **AI-Powered Categorization** - Automatically sorts emails into custom categories using Claude AI
- 📝 **Smart Summaries** - Generates concise summaries for each email
- 🔄 **Auto-Archive** - Archives processed emails in Gmail automatically
- 🚫 **Smart Unsubscribe** - AI agent that finds and executes unsubscribe actions
- 📮 **Multi-Account** - Manage multiple Gmail accounts from one dashboard
- ⚡ **Real-time Sync** - Gmail push notifications for instant email processing
- 📊 **Bulk Operations** - Delete or unsubscribe from multiple emails at once

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router) + Material UI
- **Backend**: Next.js API Routes
- **Database**: PostgreSQL + Prisma ORM
- **Queue**: BullMQ + Redis
- **AI**: Anthropic Claude API
- **Auth**: NextAuth.js (Google OAuth)
- **Browser Automation**: Puppeteer
- **Deployment**: Fly.io

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL database
- Redis instance
- Google Cloud Project with OAuth credentials
- Anthropic API key

## ⚡ Quick Start

### 1. Clone and Install

```bash
yarn install
```

### 2. Environment Setup

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in required values (see SETUP-GUIDE.md for details):

- Database URL
- Google OAuth credentials
- Anthropic API key
- Redis URL
- Generate secrets with `openssl rand -base64 32`

### 3. Database Setup

```bash
yarn run db:generate
yarn run db:push
```

### 4. Start Development Server

```bash
yarn run dev
```

Visit http://localhost:3000

## 📚 Documentation

- **[SETUP-GUIDE.md](SETUP-GUIDE.md)** - Detailed setup instructions
- **[DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md)** - Production deployment
- **[PROJECT-SYSTEM-DESIGN.md](PROJECT-SYSTEM-DESIGN.md)** - Architecture & design
- **[PROJECT-REQUIREMENTS.md](PROJECT-REQUIREMENTS.md)** - Original requirements

## 🧪 Testing

```bash
yarn test              # Run all tests
yarn test:coverage     # With coverage report
yarn test:ci          # CI mode
```

## 🚀 Production Deployment

Deploy to Fly.io:

```bash
node deploy.js
```

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for detailed instructions.

## 📝 Scripts

- `yarn dev` - Development server
- `yarn build` - Production build
- `yarn start` - Start production server
- `yarn test` - Run tests
- `yarn run db:studio` - Database GUI

## 🔒 Security

- AES-256 encryption for OAuth tokens
- HTTP-only session cookies
- CSRF protection
- Environment-based secrets

## License

GNU General Public License v3.0 (GPL-3.0)