-- Create bookmarks table with RLS policies
-- @spec SPEC-2026-12

-- Create the bookmarks table
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (length(url) <= 2048),
  title TEXT NOT NULL CHECK (length(title) <= 500),
  description TEXT CHECK (length(description) <= 2000),
  tags TEXT[] CHECK (array_length(tags, 1) <= 20 AND array_length(tags, 1) >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);
CREATE INDEX idx_bookmarks_tags ON bookmarks USING GIN(tags);
CREATE INDEX idx_bookmarks_active ON bookmarks(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can only see their own non-deleted bookmarks
CREATE POLICY "Users can view their own bookmarks" ON bookmarks
  FOR SELECT USING (
    user_id = auth.uid() AND deleted_at IS NULL
  );

-- Users can insert bookmarks for themselves
CREATE POLICY "Users can insert their own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
  );

-- Users can update their own non-deleted bookmarks
CREATE POLICY "Users can update their own bookmarks" ON bookmarks
  FOR UPDATE USING (
    user_id = auth.uid() AND deleted_at IS NULL
  );

-- Users can soft delete their own bookmarks (update deleted_at)
CREATE POLICY "Users can delete their own bookmarks" ON bookmarks
  FOR UPDATE USING (
    user_id = auth.uid()
  );

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row changes
CREATE TRIGGER update_bookmarks_updated_at BEFORE UPDATE ON bookmarks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add constraint to ensure tag strings are not too long
CREATE OR REPLACE FUNCTION check_tag_length(tags TEXT[])
RETURNS BOOLEAN AS $$
BEGIN
  IF tags IS NULL THEN
    RETURN TRUE;
  END IF;
  
  FOR i IN 1..array_length(tags, 1) LOOP
    IF length(tags[i]) > 50 THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

ALTER TABLE bookmarks ADD CONSTRAINT check_tags_length 
  CHECK (check_tag_length(tags));