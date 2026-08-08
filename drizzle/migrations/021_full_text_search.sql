-- Full-text search for products/ads
-- Uses PostgreSQL tsvector/tsquery for scalable search (100K+ ads)

-- Add GIN index for full-text search
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products 
  USING GIN (to_tsvector('arenglish', title || ' ' || COALESCE(description, '')));

-- Create search function with ranking
CREATE OR REPLACE FUNCTION search_products(
  query_text TEXT,
  page INTEGER DEFAULT 1,
  limit INTEGER DEFAULT 20,
  category_slug TEXT DEFAULT NULL
)
RETURNS SETOF products AS $$
DECLARE
  query_vec TSQUERY;
  offset_val INTEGER;
BEGIN
  -- Convert search query to TSQUERY
  query_vec := to_tsquery('arenglish', query_text);
  
  -- Calculate offset
  offset_val := (page - 1) * limit;
  
  -- Build dynamic query with category filter
  RETURN QUERY
  SELECT p.*
  FROM products p
  WHERE p.status = 'approved'
    AND (p.expires_at IS NULL OR p.expires_at > NOW())
    AND (category_slug IS NULL OR p.category_slug = category_slug)
    AND to_tsvector('arenglish', p.title || ' ' || COALESCE(p.description, '')) 
        @@ query_vec
  ORDER BY 
    ts_rank(
      to_tsvector('arenglish', p.title || ' ' || COALESCE(p.description, '')),
      query_vec
    ) DESC,
    p.created_at DESC
  LIMIT limit
  OFFSET offset_val;
END;
$$ LANGUAGE plpgsql;

-- Create count function for pagination
CREATE OR REPLACE FUNCTION count_search_results(
  query_text TEXT,
  category_slug TEXT DEFAULT NULL
)
RETURNS BIGINT AS $$
DECLARE
  query_vec TSQUERY;
  cnt BIGINT;
BEGIN
  query_vec := to_tsquery('arenglish', query_text);
  
  SELECT COUNT(*) INTO cnt
  FROM products p
  WHERE p.status = 'approved'
    AND (p.expires_at IS NULL OR p.expires_at > NOW())
    AND (category_slug IS NULL OR p.category_slug = category_slug)
    AND to_tsvector('arenglish', p.title || ' ' || COALESCE(p.description, '')) 
        @@ query_vec;
  
  RETURN cnt;
END;
$$ LANGUAGE plpgsql;