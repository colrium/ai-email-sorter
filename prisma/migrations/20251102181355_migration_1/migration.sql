-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "image" TEXT,
    "email_verified" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gmail_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "token_expiry" TIMESTAMP(3),
    "scope" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "watch_expiration" TIMESTAMP(3),
    "history_id" TEXT,
    "last_synced_at" TIMESTAMP(3),
    "sync_status" TEXT NOT NULL DEFAULT 'idle',
    "sync_error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gmail_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT DEFAULT '#1976d2',
    "icon" TEXT DEFAULT 'category',
    "email_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "emails" (
    "id" TEXT NOT NULL,
    "gmail_account_id" TEXT NOT NULL,
    "gmail_message_id" TEXT NOT NULL,
    "gmail_thread_id" TEXT,
    "category_id" TEXT,
    "subject" TEXT,
    "from" TEXT NOT NULL,
    "from_name" TEXT,
    "to" TEXT,
    "cc" TEXT,
    "bcc" TEXT,
    "reply_to" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "snippet" TEXT,
    "body_html" TEXT,
    "body_text" TEXT,
    "attachment_count" INTEGER NOT NULL DEFAULT 0,
    "has_attachments" BOOLEAN NOT NULL DEFAULT false,
    "labels" TEXT[],
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "is_important" BOOLEAN NOT NULL DEFAULT false,
    "is_archived_in_gmail" BOOLEAN NOT NULL DEFAULT false,
    "is_deleted_in_gmail" BOOLEAN NOT NULL DEFAULT false,
    "unsubscribe_link" TEXT,
    "list_unsubscribe_header" TEXT,
    "ai_summary" TEXT,
    "ai_categorization_reasoning" TEXT,
    "processing_status" TEXT NOT NULL DEFAULT 'pending',
    "processing_error" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "emails_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unsubscribe_logs" (
    "id" TEXT NOT NULL,
    "email_id" TEXT NOT NULL,
    "unsubscribe_url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "method" TEXT,
    "actions" TEXT,
    "screenshot" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unsubscribe_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_logs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload" TEXT,
    "result" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "gmail_accounts_user_id_idx" ON "gmail_accounts"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "gmail_accounts_user_id_email_key" ON "gmail_accounts"("user_id", "email");

-- CreateIndex
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "categories_user_id_name_key" ON "categories"("user_id", "name");

-- CreateIndex
CREATE INDEX "emails_category_id_idx" ON "emails"("category_id");

-- CreateIndex
CREATE INDEX "emails_gmail_account_id_idx" ON "emails"("gmail_account_id");

-- CreateIndex
CREATE INDEX "emails_date_idx" ON "emails"("date" DESC);

-- CreateIndex
CREATE INDEX "emails_processing_status_idx" ON "emails"("processing_status");

-- CreateIndex
CREATE UNIQUE INDEX "emails_gmail_account_id_gmail_message_id_key" ON "emails"("gmail_account_id", "gmail_message_id");

-- CreateIndex
CREATE INDEX "unsubscribe_logs_email_id_idx" ON "unsubscribe_logs"("email_id");

-- CreateIndex
CREATE INDEX "unsubscribe_logs_status_idx" ON "unsubscribe_logs"("status");

-- CreateIndex
CREATE INDEX "job_logs_job_type_idx" ON "job_logs"("job_type");

-- CreateIndex
CREATE INDEX "job_logs_status_idx" ON "job_logs"("status");

-- CreateIndex
CREATE INDEX "job_logs_created_at_idx" ON "job_logs"("created_at");

-- AddForeignKey
ALTER TABLE "gmail_accounts" ADD CONSTRAINT "gmail_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_gmail_account_id_fkey" FOREIGN KEY ("gmail_account_id") REFERENCES "gmail_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "emails" ADD CONSTRAINT "emails_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unsubscribe_logs" ADD CONSTRAINT "unsubscribe_logs_email_id_fkey" FOREIGN KEY ("email_id") REFERENCES "emails"("id") ON DELETE CASCADE ON UPDATE CASCADE;
