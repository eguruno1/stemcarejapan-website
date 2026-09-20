CREATE TABLE "chat_settings" (
  "id" INTEGER NOT NULL DEFAULT 1,
  "translation_provider" TEXT NOT NULL DEFAULT 'external',
  "translation_enabled" BOOLEAN NOT NULL DEFAULT true,
  "ai_enabled" BOOLEAN NOT NULL DEFAULT true,
  "revision" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_settings_singleton" CHECK ("id" = 1),
  CONSTRAINT "chat_settings_provider" CHECK ("translation_provider" IN ('external', 'ollama'))
);

ALTER TABLE "chat_rooms" ADD COLUMN "consultation_mode" TEXT NOT NULL DEFAULT 'assisted';
ALTER TABLE "chat_rooms" ADD CONSTRAINT "chat_rooms_mode" CHECK ("consultation_mode" IN ('assisted', 'human'));
