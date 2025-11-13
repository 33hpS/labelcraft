-- Warehouse receipts schema for incoming stock management

-- Main receipts table (приёмки)
CREATE TABLE IF NOT EXISTS warehouse_receipts (
  id TEXT PRIMARY KEY,
  receipt_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  notes TEXT,
  created_by TEXT NOT NULL,
  created_by_name TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Receipt items (позиции приёмки)
CREATE TABLE IF NOT EXISTS warehouse_receipt_items (
  id TEXT PRIMARY KEY,
  receipt_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  notes TEXT,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (receipt_id) REFERENCES warehouse_receipts(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_status ON warehouse_receipts(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipts_created_at ON warehouse_receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipt_items_receipt ON warehouse_receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_warehouse_receipt_items_product ON warehouse_receipt_items(product_id);

-- Triggers for updated_at
CREATE TRIGGER IF NOT EXISTS trg_warehouse_receipts_updated_at
AFTER UPDATE ON warehouse_receipts
FOR EACH ROW
BEGIN
  UPDATE warehouse_receipts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_warehouse_receipt_items_updated_at
AFTER UPDATE ON warehouse_receipt_items
FOR EACH ROW
BEGIN
  UPDATE warehouse_receipt_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
