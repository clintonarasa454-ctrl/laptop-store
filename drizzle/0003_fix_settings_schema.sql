-- Fix settings table column names
-- This migration handles the case where updatedAAt exists and needs to be renamed to updatedAt

BEGIN;

-- Drop the index first if it exists
DROP INDEX IF EXISTS "settings_key_idx";

-- Check if the wrong column exists (updatedAAt) and rename it
DO $$ 
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns 
              WHERE table_name='settings' AND column_name='updatedAAt') THEN
        ALTER TABLE "settings" RENAME COLUMN "updatedAAt" TO "updatedAt";
    END IF;
END $$;

-- Ensure all required columns exist with correct names
DO $$
BEGIN
    IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                  WHERE table_name='settings' AND column_name='id') THEN
        -- Table doesn't exist, create it
        CREATE TABLE "settings" (
            "id" SERIAL PRIMARY KEY NOT NULL,
            "key" VARCHAR(64) NOT NULL UNIQUE,
            "value" JSON,
            "updatedAt" TIMESTAMP DEFAULT NOW() NOT NULL
        );
    END IF;
END $$;

-- Recreate the index
CREATE INDEX "settings_key_idx" ON "settings" ("key");

COMMIT;
