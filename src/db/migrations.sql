-- Required for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  security_code TEXT, -- 6-8 digit code chosen at registration for unlock
  is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'active', -- active|suspended
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Email verification codes
CREATE TABLE IF NOT EXISTS email_verification_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_codes(user_id);

-- Password reset codes
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_codes(user_id);

-- Sessions (JWT id mapping + lock state)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jwt_id TEXT NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_jwt ON sessions(jwt_id);

-- Audit log
CREATE TABLE IF NOT EXISTS auth_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- login_success, login_fail, lock, unlock_success, unlock_fail, logout, auto_logout
  ip TEXT,
  user_agent TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'users_set_updated'
  ) THEN
    CREATE TRIGGER users_set_updated BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;

-- Drop obsolete pricing columns if they exist (cleanup)
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tax_percent'
  ) THEN
    ALTER TABLE products DROP COLUMN tax_percent;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price_unit'
  ) THEN
    ALTER TABLE products DROP COLUMN sale_price_unit;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price_bulk'
  ) THEN
    ALTER TABLE products DROP COLUMN sale_price_bulk;
  END IF;
END $$;

-- Ensure pricing columns exist for older schemas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='purchase_price'
  ) THEN
    ALTER TABLE products ADD COLUMN purchase_price NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='tax_percent'
  ) THEN
    ALTER TABLE products ADD COLUMN tax_percent NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price_unit'
  ) THEN
    ALTER TABLE products ADD COLUMN sale_price_unit NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price_bulk'
  ) THEN
    ALTER TABLE products ADD COLUMN sale_price_bulk NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='discount_percent'
  ) THEN
    ALTER TABLE products ADD COLUMN discount_percent NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='margin_percent'
  ) THEN
    ALTER TABLE products ADD COLUMN margin_percent NUMERIC NOT NULL DEFAULT 0;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sale_price_cop'
  ) THEN
    ALTER TABLE products ADD COLUMN sale_price_cop NUMERIC NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Ensure avatar_url exists for older schemas
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='avatar_url'
  ) THEN
    ALTER TABLE users ADD COLUMN avatar_url TEXT;
  END IF;
END $$;

-- Employee extended profile (one-to-one with users, only for employees)
CREATE TABLE IF NOT EXISTS employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rut TEXT,              -- RUT
  national_id TEXT,      -- cédula
  blood_type TEXT,       -- tipo de sangre
  findings TEXT,         -- hallazgos
  birth_date DATE,       -- fecha de nacimiento
  experience_years INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'employee_profiles_set_updated'
  ) THEN
    CREATE TRIGGER employee_profiles_set_updated BEFORE UPDATE ON employee_profiles
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;

-- ==============================
-- Papelería core entities
-- ==============================

-- Products catalog
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT, -- unidad de medida (unidad, caja, paquete)
  -- pricing
  purchase_price NUMERIC NOT NULL DEFAULT 0, -- precio compra (neto)
  tax_percent NUMERIC NOT NULL DEFAULT 0,    -- % impuesto aplicado sobre compra/venta
  sale_price_unit NUMERIC NOT NULL DEFAULT 0,   -- precio venta unidad (neto)
  sale_price_bulk NUMERIC NOT NULL DEFAULT 0,   -- precio venta por mayor (neto)
  discount_percent NUMERIC NOT NULL DEFAULT 0,  -- % descuento por producto
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'products_set_updated'
  ) THEN
    CREATE TRIGGER products_set_updated BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE PROCEDURE set_updated_at();
  END IF;
END $$;

-- Inventory stock per area (bodega/surtido)
CREATE TABLE IF NOT EXISTS inventory_stock (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('bodega','surtido')),
  quantity NUMERIC NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, area)
);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_area ON inventory_stock(area);

-- Inventory movements (kardex)
CREATE TABLE IF NOT EXISTS inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  area TEXT NOT NULL CHECK (area IN ('bodega','surtido')),
  type TEXT NOT NULL CHECK (type IN ('ingreso','salida','ajuste')),
  quantity NUMERIC NOT NULL,
  reason TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inv_mov_prod ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_created ON inventory_movements(created_at);

-- Sales and items
CREATE TABLE IF NOT EXISTS sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  customer TEXT,
  total NUMERIC NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_sales_occurred ON sales(occurred_at);

CREATE TABLE IF NOT EXISTS sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_price NUMERIC NOT NULL,
  line_total NUMERIC NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);

-- Returns
CREATE TABLE IF NOT EXISTS returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE SET NULL,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  reason TEXT,
  occurred_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_returns_occurred ON returns(occurred_at);
