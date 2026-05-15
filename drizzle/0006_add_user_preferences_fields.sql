-- Migration: Add missing fields to user_preferences table
-- Adds support for tracking user brand preferences, category preferences, and view count

ALTER TABLE user_preferences ADD COLUMN preferredBrands JSON DEFAULT '[]';
ALTER TABLE user_preferences ADD COLUMN preferredCategories JSON DEFAULT '[]';
ALTER TABLE user_preferences ADD COLUMN viewCount INTEGER DEFAULT 0;
