-- CreateTable
CREATE TABLE "chat_feedbacks" (
    "id" TEXT NOT NULL,
    "chat_room_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_feedbacks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "chat_feedbacks_chat_room_id_key" ON "chat_feedbacks"("chat_room_id");

-- CreateIndex
CREATE INDEX "chat_feedbacks_created_at_idx" ON "chat_feedbacks"("created_at");

-- AddForeignKey
ALTER TABLE "chat_feedbacks" ADD CONSTRAINT "chat_feedbacks_chat_room_id_fkey" FOREIGN KEY ("chat_room_id") REFERENCES "chat_rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
