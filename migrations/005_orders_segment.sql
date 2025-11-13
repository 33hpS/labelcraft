-- Add segment column to orders table for assembler filtering
-- Segment can be 'lux', 'econom', or NULL for general orders

ALTER TABLE orders ADD COLUMN segment TEXT CHECK (segment IN ('lux', 'econom'));

CREATE INDEX IF NOT EXISTS idx_orders_segment ON orders(segment);

-- Auto-detect and set segment for existing orders based on title
UPDATE orders 
SET segment = 'lux' 
WHERE segment IS NULL 
  AND (title LIKE '%Люкс%' OR title LIKE '%люкс%' OR title LIKE '%Lux%' OR title LIKE '%lux%' OR title LIKE '%LUX%');

UPDATE orders 
SET segment = 'econom' 
WHERE segment IS NULL 
  AND (title LIKE '%Эконом%' OR title LIKE '%эконом%' OR title LIKE '%Econom%' OR title LIKE '%econom%' OR title LIKE '%ECONOM%' OR title LIKE '%Ekonom%' OR title LIKE '%ekonom%');
