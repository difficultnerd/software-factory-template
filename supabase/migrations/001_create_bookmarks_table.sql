-- Create bookmarks table
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  url TEXT NOT NULL CHECK (char_length(url) <= 2048),
  title TEXT NOT NULL CHECK (char_length(title) >= 1 AND char_length(title) <= 500),
  description TEXT CHECK (char_length(description) <= 2000),
  tags TEXT[] CHECK (array_length(tags, 1) <= 20 AND array_length(tags, 1) >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

-- Create indexes
CREATE INDEX bookmarks_user_id_idx ON bookmarks(user_id);
CREATE INDEX bookmarks_created_at_idx ON bookmarks(created_at DESC);
CREATE INDEX bookmarks_tags_gin_idx ON bookmarks USING GIN(tags);
CREATE INDEX bookmarks_active_idx ON bookmarks(user_id, created_at DESC) WHERE deleted_at IS NULL;

-- Add constraint to ensure all tags are within length limits
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_tags_length_check 
  CHECK (tags IS NULL OR (
    array_length(tags, 1) IS NULL OR (
      array_length(tags, 1) <= 20 AND 
      NOT EXISTS (
        SELECT 1 FROM unnest(tags) AS tag WHERE char_length(tag) > 50 OR char_length(tag) < 1
      )
    )
  ));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_bookmarks_updated_at 
  BEFORE UPDATE ON bookmarks 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can only see their own non-deleted bookmarks
CREATE POLICY "Users can view their own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Users can insert bookmarks for themselves
CREATE POLICY "Users can insert their own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own non-deleted bookmarks
CREATE POLICY "Users can update their own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (soft delete) their own bookmarks
CREATE POLICY "Users can delete their own bookmarks" ON bookmarks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON bookmarks TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;