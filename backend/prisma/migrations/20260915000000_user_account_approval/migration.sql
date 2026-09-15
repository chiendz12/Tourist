-- Self-registered STUDENT/LECTURER accounts start unapproved; existing rows backfill to true.
ALTER TABLE "User" ADD COLUMN "isApproved" BOOLEAN NOT NULL DEFAULT true;
