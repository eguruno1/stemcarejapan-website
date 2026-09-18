-- CreateTable
CREATE TABLE "operators" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'operator',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "preferred_language" TEXT NOT NULL DEFAULT 'ja',
    "service_type" TEXT NOT NULL,
    "memo" TEXT,
    "privacy_agreed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_rooms" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "assigned_operator_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'bot',
    "source_page" TEXT,
    "service_type" TEXT NOT NULL,
    "visitor_token_hash" TEXT NOT NULL,
    "operator_last_read_at" TIMESTAMP(3),
    "last_message_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "chat_rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "chat_room_id" TEXT NOT NULL,
    "sender_type" TEXT NOT NULL,
    "sender_id" TEXT,
    "message_type" TEXT NOT NULL DEFAULT 'text',
    "original_language" TEXT NOT NULL DEFAULT 'unknown',
    "original_text" TEXT NOT NULL,
    "translated_language" TEXT,
    "translated_text" TEXT,
    "visible_text" TEXT NOT NULL,
    "translation_status" TEXT NOT NULL DEFAULT 'none',
    "client_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_summaries" (
    "id" TEXT NOT NULL,
    "chat_room_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "customer_needs" TEXT,
    "next_action" TEXT,
    "risk_flags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operator_notes" (
    "id" TEXT NOT NULL,
    "chat_room_id" TEXT NOT NULL,
    "operator_id" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operator_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operators_email_key" ON "operators"("email");

-- CreateIndex
CREATE INDEX "chat_rooms_status_last_message_at_idx" ON "chat_rooms"("status", "last_message_at");

-- CreateIndex
CREATE INDEX "chat_rooms_customer_id_idx" ON "chat_rooms"("customer_id");

-- CreateIndex
CREATE INDEX "messages_chat_room_id_created_at_idx" ON "messages"("chat_room_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_chat_room_id_client_message_id_key" ON "messages"("chat_room_id", "client_message_id");

-- CreateIndex
CREATE INDEX "chat_summaries_chat_room_id_created_at_idx" ON "chat_summaries"("chat_room_id", "created_at");

-- CreateIndex
CREATE INDEX "operator_notes_chat_room_id_created_at_idx" ON "operator_notes"("chat_room_id", "created_at");

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_assigned_operator_id_fkey" FOREIGN KEY ("assigned_operator_id") REFERENCES "operators"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_summaries" ADD CONSTRAINT "chat_summaries_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_notes" ADD CONSTRAINT "operator_notes_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "operator_notes" ADD CONSTRAINT "operator_notes_operator_id_fkey" FOREIGN KEY ("operator_id") REFERENCES "operators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
