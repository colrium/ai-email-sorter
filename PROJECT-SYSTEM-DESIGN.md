> Frontend: Next.js  EXCELLENT CHOICE
    Why Next.js is ideal here:
      - Server-Side Rendering (SSR): Great for initial load of email lists and authentication states
      - API Routes: Built-in API handling for OAuth callbacks and webhook endpoints
      - React Server Components: Efficient for displaying large email lists
      - Edge Functions: Can handle lightweight operations close to users
      - Built-in OAuth support: Works well with NextAuth.js for Google OAuth

> Backend: Next.js API Routes + Serverless Functions  GOOD CHOICE
    Why Next.js API Routes are suitable:
      - Seamless integration with frontend
      - Scales automatically with demand
      - Easy to deploy on platforms like Vercel or Fly.io
      - Simplifies development with a unified codebase

> Database: PostgreSQL + Prisma ORM  STRONG CHOICE
    Why PostgreSQL + Prisma is suitable:
      - Transactional integrity: When archiving email + updating category counts
      - Foreign keys: Ensure referential integrity (deleted category = handle emails)
      - Relational Data: Emails, categories, and user accounts fit well in relational schema
      - Prisma ORM: Type-safe database interactions, easy migrations, and schema management
      - Scalability: PostgreSQL can handle growing data with indexing and optimization
      - JSONB Support: Store raw email data flexibly
      - Row-level security: Can implement multi-tenant security at DB level
      - Better for testing: Easier to write deterministic tests


COMPLETE SYSTEM ARCHITECTURE:

                         USER INTERFACE                          
                    (Next.js 16 App Router)                      

  Sign In    Dashboard    Categories    Email List    Settings 

                              
                              ↓

                      NEXT.JS API ROUTES                         

  • /api/auth/* (NextAuth.js - OAuth)                           
  • /api/categories/* (CRUD)                                     
  • /api/emails/* (List, View, Bulk Actions)                    
  • /api/accounts/* (Connect Gmail accounts)                     
  • /api/webhooks/gmail (Gmail Push Notifications)              

                              
                              ↓

                      BACKGROUND WORKERS                         
                    (BullMQ + Redis Queue)                       

  • Email Import Job                                             
  • AI Categorization Job                                        
  • AI Summarization Job                                         
  • Archive Email Job                                            
  • Unsubscribe Agent Job                                        

                              
                              ↓

   GMAIL API         AI SERVICES       DATABASE              
   (Google APIs)     (Claude/OpenAI)   (PostgreSQL)          

 • OAuth 2.0       • Categorization  • Users                  
 • Read emails     • Summarization   • Gmail Accounts         
 • Archive emails  • Unsubscribe     • Categories             
 • Watch inbox       agent actions   • Emails                 
 • Delete emails                     • Unsubscribe Logs       

                              
                              ↓

                    EXTERNAL SERVICES                            

  • Redis (Job Queue + Caching)                                  
  • S3/Cloud Storage (Email attachments - optional)              
  • Monitoring (Sentry for errors)                               
  • Analytics (PostHog/Mixpanel - optional)                      




      ## SYSTEM DESIGN DOCUMENTATION
DETAILED DATA MODELS (PostgreSQL Schema):

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Gmail Accounts (Multiple accounts per user)
CREATE TABLE gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  access_token TEXT NOT NULL, -- Encrypted
  refresh_token TEXT NOT NULL, -- Encrypted
  token_expiry TIMESTAMP,
  history_id VARCHAR(255), -- For Gmail incremental sync
  watch_expiration TIMESTAMP, -- Gmail push notification expiry
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, email)
);

-- Categories
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  color VARCHAR(7), -- Hex color for UI
  email_count INTEGER DEFAULT 0, -- Denormalized for performance
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, name)
);

-- Emails
CREATE TABLE emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_account_id UUID REFERENCES gmail_accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  gmail_message_id VARCHAR(255) NOT NULL, -- Gmail's unique ID
  gmail_thread_id VARCHAR(255),
  
  -- Email metadata
  subject TEXT,
  from_email VARCHAR(255),
  from_name VARCHAR(255),
  to_emails TEXT[], -- Array of recipient emails
  date TIMESTAMP,
  
  -- Content
  body_text TEXT, -- Plain text version
  body_html TEXT, -- HTML version
  snippet TEXT, -- Gmail's snippet
  
  -- AI-generated content
  ai_summary TEXT,
  ai_category_reasoning TEXT, -- Why AI chose this category
  
  -- State
  is_read BOOLEAN DEFAULT false,
  is_archived_in_gmail BOOLEAN DEFAULT false,
  has_unsubscribe_link BOOLEAN DEFAULT false,
  unsubscribe_url TEXT,
  
  -- Raw data
  raw_email_data JSONB, -- Full Gmail API response
  
  -- Metadata
  processing_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  processing_error TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(gmail_account_id, gmail_message_id)
);

-- Unsubscribe logs (track unsubscribe attempts)
CREATE TABLE unsubscribe_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id UUID REFERENCES emails(id) ON DELETE CASCADE,
  unsubscribe_url TEXT NOT NULL,
  status VARCHAR(50), -- pending, in_progress, success, failed
  ai_agent_log JSONB, -- Log of AI agent actions
  error_message TEXT,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Processing queue tracking (optional - if not using BullMQ dashboard)
CREATE TABLE job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type VARCHAR(100), -- 'import_email', 'categorize', 'summarize', etc.
  email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
  status VARCHAR(50),
  error TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_emails_category ON emails(category_id);
CREATE INDEX idx_emails_gmail_account ON emails(gmail_account_id);
CREATE INDEX idx_emails_date ON emails(date DESC);
CREATE INDEX idx_emails_processing_status ON emails(processing_status);
CREATE INDEX idx_gmail_accounts_user ON gmail_accounts(user_id);
CREATE INDEX idx_categories_user ON categories(user_id);

-- Full-text search index for email content
CREATE INDEX idx_emails_search ON emails USING GIN(
  to_tsvector('english', COALESCE(subject, '') || ' ' || COALESCE(body_text, ''))
);
```

---

## API ENDPOINT DESIGN

### **Authentication**
```
POST   /api/auth/signin              # Initiate Google OAuth
GET    /api/auth/callback/google     # OAuth callback
POST   /api/auth/signout             # Sign out
GET    /api/auth/session              # Get current session
```

### **Gmail Accounts**
```
GET    /api/accounts                 # List connected accounts
POST   /api/accounts/connect         # Connect new Gmail account
DELETE /api/accounts/:id             # Disconnect account
POST   /api/accounts/:id/refresh     # Manually refresh emails
```

### **Categories**
```
GET    /api/categories               # List all categories
POST   /api/categories               # Create category
PUT    /api/categories/:id           # Update category
DELETE /api/categories/:id           # Delete category (what happens to emails?)
```

### **Emails**
```
GET    /api/emails                   # List all emails (with filters)
GET    /api/emails?categoryId=:id    # Emails in specific category
GET    /api/emails/:id               # Get single email details
DELETE /api/emails/:id               # Delete single email
POST   /api/emails/bulk-delete       # Bulk delete
POST   /api/emails/bulk-unsubscribe  # Bulk unsubscribe
POST   /api/emails/:id/unsubscribe   # Single unsubscribe
POST   /api/emails/reprocess         # Reprocess categorization
```

### **Webhooks**
```
POST   /api/webhooks/gmail           # Gmail push notification endpoint
```

---

## AUTHENTICATION & AUTHORIZATION FLOW
```

  User    
 clicks   
"Sign in  
 Google"  

     
     ↓

  NextAuth.js handles OAuth flow:               
  1. Redirect to Google OAuth consent screen    
  2. User grants permissions                    
  3. Google redirects to callback               
  4. Exchange code for tokens                   
  5. Create/update user in DB                   
  6. Create gmail_accounts record               
  7. Set up Gmail push notifications            
  8. Return session cookie                      

     
     ↓

  Required OAuth Scopes:                      
  • https://www.googleapis.com/auth/gmail.readonly  
  • https://www.googleapis.com/auth/gmail.modify    
  • https://www.googleapis.com/auth/userinfo.email  
  • https://www.googleapis.com/auth/userinfo.profile

```

**Security Measures:**
- Store tokens encrypted in database (use crypto library)
- Implement token refresh logic
- Session-based auth with httpOnly cookies
- CSRF protection (NextAuth handles this)
- Rate limiting on API routes
- Input validation with Zod

---

## EMAIL PROCESSING PIPELINE
```

                    NEW EMAIL ARRIVES                        

                     
                     ↓

  STEP 1: Email Detection                                    
  • Gmail Push Notification → /api/webhooks/gmail            
  • OR Periodic polling (fallback every 5 mins)              

                     
                     ↓

  STEP 2: Queue Job                                          
  • Add 'import-email' job to BullMQ                         
  • Job data: { accountId, messageId }                       

                     
                     ↓

  STEP 3: Worker Processes Job                               
  • Fetch full email from Gmail API                          
  • Extract: subject, from, body, date, etc.                 
  • Check for unsubscribe link                               
  • Save to database (status: 'processing')                  

                     
                     ↓

  STEP 4: AI Categorization                                  
  • Fetch user's categories + descriptions                   
  • Build prompt:                                            
    "Given these categories: [list]                          
     Categorize this email:                                  
     Subject: ...                                            
     From: ...                                               
     Body: ..."                                              
  • Call Claude/GPT API                                      
  • Parse response → category_id                             
  • Update email record                                      

                     
                     ↓

  STEP 5: AI Summarization                                   
  • Build prompt:                                            
    "Summarize this email in 2-3 sentences"                  
  • Call AI API                                              
  • Save summary to email.ai_summary                         

                     
                     ↓

  STEP 6: Archive in Gmail                                   
  • Call Gmail API: modify message                           
  • Remove 'INBOX' label                                     
  • Keep in 'All Mail'                                       
  • Update email.is_archived_in_gmail = true                 

                     
                     ↓

  STEP 7: Update counters                                    
  • Increment category.email_count                           
  • Mark email status: 'completed'                           
  • Trigger UI refresh (WebSocket/polling)                   



AI Prompts Design
Categorization Prompt:

const categorizationPrompt = `
You are an email categorization assistant. 

USER'S CATEGORIES:
${categories.map(c => `
- "${c.name}": ${c.description}
`).join('\n')}

EMAIL TO CATEGORIZE:
From: ${email.from}
Subject: ${email.subject}
Body Preview: ${email.snippet}

Rules:
1. Choose the BEST matching category
2. If no good match, return "Uncategorized"
3. Respond with JSON: { "category": "category_name", "reasoning": "brief explanation" }
`;


Summarization Prompt:

const summarizationPrompt = `
Summarize this email in 2-3 clear, concise sentences. Focus on:
- Main action items or requests
- Key information
- Deadlines (if any)

EMAIL:
From: ${email.from}
Subject: ${email.subject}
Body: ${email.bodyText}

Return ONLY the summary text, no preamble.
`;


Unsubscribe Agent Prompt:

const unsubscribePrompt = `
You are an automated unsubscribe agent. I will give you a webpage HTML and you need to:
1. Identify the unsubscribe action (button, link, form)
2. Provide step-by-step actions to unsubscribe

Webpage HTML:
${htmlContent}

Return JSON with actions:
{
  "actions": [
    { "type": "click", "selector": "#unsubscribe-btn" },
    { "type": "fill", "selector": "#email", "value": "${email}" },
    { "type": "click", "selector": "#confirm" }
  ]
}
`;
```

---

## UNSUBSCRIBE AGENT IMPLEMENTATION

**Challenge**: Most complex feature - requires browser automation

**Solution: Puppeteer/Playwright-based AI Agent**
```

  User clicks "Unsubscribe" on email(s)         

                     
                     ↓

  Extract unsubscribe URL from email body        
  • Parse HTML for <a> with "unsubscribe"        
  • Check List-Unsubscribe header               

                     
                     ↓

  Queue "unsubscribe-agent" job                  
  • Job data: { emailId, unsubscribeUrl }        

                     
                     ↓

  Worker: Launch headless browser                
  1. Navigate to unsubscribe URL                 
  2. Take screenshot                             
  3. Get page HTML                               

                     
                     ↓

  Send HTML + screenshot to AI                   
  • AI analyzes page structure                   
  • Returns list of actions to perform           

                     
                     ↓

  Execute AI's actions in browser                
  • Click buttons                                
  • Fill forms                                   
  • Select options                               
  • Submit forms                                 

                     
                     ↓

  Verify success                                 
  • Check for confirmation message               
  • Log all actions                              
  • Update unsubscribe_logs table                
  • Close browser                                

```

**Safety Measures:**
- Timeout after 30 seconds
- Sandbox browser (no access to other sites)
- Log all actions for debugging
- Handle common errors (CAPTCHA, already unsubscribed, etc.)
- Rate limit (max 5 unsubscribes/minute)

---

## REAL-TIME EMAIL UPDATES

**Gmail Push Notifications Setup:**
```

  On account connection:                     
  1. Call Gmail API: watch()                 
  2. Register webhook: /api/webhooks/gmail   
  3. Save watch expiration (7 days max)      
  4. Set up renewal job (renew every 6 days) 

                    
                    ↓

  When new email arrives:                    
  1. Gmail sends POST to /api/webhooks/gmail 
  2. Payload: { historyId, emailAddress }    
  3. Verify signature                        
  4. Queue import job                        

```

**Fallback Polling:**
- If push notifications fail, poll every 5 minutes
- Use Gmail history API for efficiency (only fetch changes)
- Store last historyId per account

---

## DEPLOYMENT ARCHITECTURE

### **Recommended Platform: Fly.io** (or Render)

**Why Fly.io:**
- Supports long-running jobs (for email processing)
- Global edge locations
- Built-in Redis
- Affordable ($0-$10/month for MVP)
- Supports background workers
- Easy to add Puppeteer (browser automation)

**Infrastructure:**
```

  Fly.io App (Next.js)                       
  • 1x VM (shared-cpu-1x, 512MB RAM)         
  • Auto-scaling: 1-3 instances              
  • Region: Closest to user                  

                    
                    ↓

  Fly.io Worker (Background jobs)            
  • 1x VM (shared-cpu-1x, 1GB RAM)           
  • Runs BullMQ workers                      
  • Puppeteer installed                      

                    
                    ↓

  Fly Redis     Fly Postgres  S3 (opt)    
  (Queue)       (Database)    (Attachments)



## SECURITY CONSIDERATIONS

1. **Token Storage**: Encrypt OAuth tokens at rest
2. **HTTPS Only**: Force SSL everywhere
3. **CSRF Protection**: NextAuth.js handles this
4. **Rate Limiting**: 
   - 100 requests/minute per user
   - 5 unsubscribes/minute per user
5. **Input Validation**: Zod schemas for all inputs
6. **SQL Injection**: Use Prisma (parameterized queries)
7. **XSS Protection**: Sanitize email HTML before display
8. **CORS**: Restrict to your domain only
9. **Webhook Security**: Verify Gmail webhook signatures
10. **API Key Rotation**: Support key rotation without downtime



## TESTING STRATEGY
```
tests/
 unit/
    email-parser.test.js         # Parse email content
    ai-categorization.test.js    # Mock AI responses
    unsubscribe-link-finder.test.js
    token-encryption.test.js

 integration/
    api/
       categories.test.js       # CRUD operations
       emails.test.js           # Email operations
       auth.test.js             # OAuth flow
    database/
       queries.test.js          # Complex DB queries
    gmail-api.test.js            # Gmail integration

 e2e/
    oauth-flow.spec.js           # Full sign-in flow
    create-category.spec.js      # Create + assign emails
    bulk-actions.spec.js         # Select + delete/unsubscribe
    unsubscribe-agent.spec.js    # Full unsubscribe flow

 performance/
     email-processing.test.js     # Process 100 emails test
```

**Testing Tools:**
- **Unit**: Jest + React Testing Library
- **Integration**: Supertest (API testing)
- **E2E**: Playwright
- **Mocking**: MSW (Mock Service Worker) for API mocking
- **DB**: Test database with seed data

**Coverage Target**: 80% minimum


## MONITORING & OBSERVABILITY

**Essential Metrics:**
1. Email processing time (avg, p95, p99)
2. AI API latency
3. Failed jobs count
4. Unsubscribe success rate
5. Active users
6. Emails processed per hour

**Tools:**
- **Error Tracking**: Sentry
- **Logs**: Fly.io logs + structured logging
- **Metrics**: Prometheus + Grafana (overkill for MVP)
- **Uptime**: UptimeRobot (free)
