ALTER TABLE "chat_rooms" ADD COLUMN "translation_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "chat_rooms" ADD COLUMN "translation_revision" INTEGER NOT NULL DEFAULT 0;
UPDATE "chat_rooms" SET "translation_enabled" = false WHERE "consultation_mode" = 'human';
