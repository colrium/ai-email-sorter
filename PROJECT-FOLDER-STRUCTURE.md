## ** PROJECT FOLDER STRUCTURE **
```bash

ai-email-sorter/
├── .dockerignore
├── .env
├── .env.example
├── .env.local
├── .gitignore
├── deploy.js
├── DEPLOYMENT-GUIDE.md
├── docker-entrypoint.js
├── Dockerfile
├── eslint.config.mjs
├── fly.toml
├── jest.config.js
├── jest.setup.js
├── next-env.d.ts
├── next.config.ts
├── package.json
├── playwright.config.ts
├── PROJECT-REQUIREMENTS.md
├── PROJECT-SYSTEM-DESIGN.md
├── README.md
├── SETUP-GUIDE.md
├── tsconfig.json
├── yarn.lock
│
├── .github/
│   └── workflows/
│       ├── cron-sync.yml
│       └── deploy.yml
│
├── coverage/              (test coverage reports)
│   ├── clover.xml
│   ├── coverage-final.json
│   ├── coverage-summary.json
│   ├── lcov.info
│   └── lcov-report/
│
├── prisma/
│   ├── schema.prisma
│   └── migrations/
│       ├── migration_lock.toml
│       ├── 20251102181355_migration_1/
│       └── 20251102233145_add_unsubscribed_at/
│
├── public/
│
├── src/
│   ├── theme.ts
│   ├── worker.ts
│   │
│   ├── app/                     (Next.js App Router)
│   │   ├── favicon.ico
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── page.module.css
│   │   ├── page.tsx
│   │   │
│   │   ├── (auth)/
│   │   │   ├── layout.tsx
│   │   │   └── login/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx
│   │   │   ├── categories/
│   │   │   │   ├── page.tsx
│   │   │   │   └── new/
│   │   │   │       └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx
│   │   │   │   └── emails/
│   │   │   │       └── [id]/
│   │   │   │           └── page.tsx
│   │   │   ├── jobs/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   │
│   │   └── api/                 (API Routes)
│   │       ├── accounts/
│   │       │   ├── route.ts
│   │       │   ├── connect/route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── refresh/route.ts
│   │       ├── auth/
│   │       │   └── [...nextauth]/route.ts
│   │       ├── categories/
│   │       │   ├── route.ts
│   │       │   └── [id]/route.ts
│   │       ├── emails/
│   │       │   ├── route.ts
│   │       │   ├── bulk-delete/route.ts
│   │       │   ├── bulk-unsubscribe/route.ts
│   │       │   ├── import/route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── unsubscribe/route.ts
│   │       ├── health/
│   │       │   └── route.ts
│   │       ├── jobs/
│   │       │   └── route.ts
│   │       └── webhooks/
│   │           └── gmail/route.ts
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── DashboardLayout.tsx
│   │   │   └── Providers.tsx
│   │   └── emails/
│   │       ├── EmailList.tsx
│   │       ├── ImportButton.tsx
│   │       └── UnsubscribeProgressDialog.tsx
│   │
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── claude-client.ts
│   │   │   └── unsubscribe-agent.ts
│   │   ├── browser/
│   │   │   └── puppeteer-client.ts
│   │   ├── db/
│   │   │   └── prisma.ts
│   │   ├── gmail/
│   │   │   ├── client.ts
│   │   │   ├── fetch-emails.ts
│   │   │   └── watch-service.ts
│   │   ├── queue/
│   │   │   ├── cache.ts
│   │   │   ├── connection.ts
│   │   │   ├── queues.ts
│   │   │   └── jobs/
│   │   │       ├── bulk-delete-job.ts
│   │   │       ├── email-import-job.ts
│   │   │       ├── gmail-watch-job.ts
│   │   │       └── scheduled-import-job.ts
│   │   ├── services/
│   │   │   ├── email-import-service.ts
│   │   │   └── unsubscribe-service.ts
│   │   └── utils/
│   │       ├── encryption.ts
│   │       ├── logger.ts
│   │       ├── unsubscribe-link-finder.ts
│   │       └── validation.ts
│   │
│   └── types/
│       └── next-auth.d.ts
│
└── tests/
    ├── e2e/                      (End-to-End Tests)
    │   ├── bulk-actions.spec.ts
    │   ├── create-category.spec.ts
    │   ├── oauth-flow.spec.ts
    │   └── unsubscribe-agent.spec.ts
    │
    ├── integration/               (Integration Tests)
    │   ├── gmail-api.test.ts
    │   ├── api/
    │   └── database/
    │
    ├── performance/              (Performance Tests)
    │   └── email-processing.test.ts
    │
    └── unit/                     (Unit Tests)
        ├── ai-categorization.test.ts
        ├── bulk-delete-job.test.ts
        ├── claude-client.test.ts
        ├── email-import-job.test.ts
        ├── email-import-service.test.ts
        ├── email-parser.test.ts
        ├── encryption.test.ts
        ├── gmail-client.test.ts
        ├── gmail-watch-job.test.ts
        ├── logger.test.ts
        ├── queue-connection.test.ts
        ├── queue-helpers.test.ts
        ├── scheduled-import-job.test.ts
        ├── unsubscribe-link-finder.test.ts
        └── validation.test.ts

```