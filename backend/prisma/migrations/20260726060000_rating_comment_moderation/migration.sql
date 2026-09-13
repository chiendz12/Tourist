CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'APPROVED', 'HIDDEN');

ALTER TABLE "Rating" ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "Comment" ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED';

CREATE INDEX "Rating_moderationStatus_idx" ON "Rating"("moderationStatus");
CREATE INDEX "Comment_moderationStatus_idx" ON "Comment"("moderationStatus");
