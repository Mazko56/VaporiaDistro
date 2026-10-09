CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY, telegram_id BIGINT UNIQUE NOT NULL, username TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '', photo_url TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'customer',
  age_confirmed BOOLEAN NOT NULL DEFAULT FALSE, age_verified BOOLEAN NOT NULL DEFAULT FALSE, bonus_balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'box', image_url TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY, category_id INTEGER NOT NULL REFERENCES categories(id), slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL, brand TEXT NOT NULL DEFAULT '', subtitle TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '', gallery JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_price INTEGER NOT NULL CHECK(base_price>=0), compare_at_price INTEGER CHECK(compare_at_price IS NULL OR compare_at_price>=0),
  badge TEXT NOT NULL DEFAULT '', is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS variants (
  id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL, sku TEXT UNIQUE NOT NULL, price_override INTEGER CHECK(price_override IS NULL OR price_override>=0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK(stock>=0), is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS banners (
  id SERIAL PRIMARY KEY, eyebrow TEXT NOT NULL DEFAULT '', title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL DEFAULT '', button_text TEXT NOT NULL DEFAULT 'Дивитися', button_link TEXT NOT NULL DEFAULT '/catalog',
  kind TEXT NOT NULL DEFAULT 'hero', sort_order INTEGER NOT NULL DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS favorites (
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE, PRIMARY KEY(user_id,product_id)
);
CREATE TABLE IF NOT EXISTS cart_items (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  variant_id INTEGER NOT NULL REFERENCES variants(id) ON DELETE CASCADE, quantity INTEGER NOT NULL CHECK(quantity BETWEEN 1 AND 99),
  UNIQUE(user_id,variant_id)
);
CREATE TABLE IF NOT EXISTS coupons (
  id SERIAL PRIMARY KEY, code TEXT UNIQUE NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('percent','fixed')),
  value INTEGER NOT NULL CHECK(value>0), min_subtotal INTEGER NOT NULL DEFAULT 0, max_uses INTEGER,
  uses INTEGER NOT NULL DEFAULT 0, expires_at TIMESTAMPTZ, is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), number BIGSERIAL UNIQUE NOT NULL, user_id BIGINT NOT NULL REFERENCES users(id),
  request_id UUID UNIQUE NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','shipped','completed','cancelled')),
  customer_name TEXT NOT NULL, phone TEXT NOT NULL, delivery_method TEXT NOT NULL CHECK(delivery_method IN ('nova_poshta','pickup')),
  city TEXT NOT NULL DEFAULT '', shipping_details TEXT NOT NULL DEFAULT '', payment_method TEXT NOT NULL CHECK(payment_method IN ('cod','manager')),
  comment TEXT NOT NULL DEFAULT '', subtotal INTEGER NOT NULL, discount INTEGER NOT NULL DEFAULT 0,
  bonus_used INTEGER NOT NULL DEFAULT 0, total INTEGER NOT NULL, coupon_code TEXT,
  bonus_awarded INTEGER NOT NULL DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  id BIGSERIAL PRIMARY KEY, order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL, product_name TEXT NOT NULL,
  variant_label TEXT NOT NULL, sku TEXT NOT NULL, quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL, line_total INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS bonus_ledger (
  id BIGSERIAL PRIMARY KEY, user_id BIGINT NOT NULL REFERENCES users(id), order_id UUID REFERENCES orders(id),
  delta INTEGER NOT NULL, description TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 1.2: previous completed orders remain historical; only newly received orders earn bonuses.
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK(status IN ('pending','confirmed','shipped','received','completed','cancelled'));
CREATE INDEX IF NOT EXISTS idx_bonus_awarded_order ON bonus_ledger(order_id) WHERE delta>0;
-- Update only the default demo subtitle. Hand-edited marketing copy remains untouched.
UPDATE banners SET subtitle='5% бонусами після статусу «Отримано»'
WHERE kind='bonus' AND subtitle='5% бонусами після виконаного замовлення';
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_variants_product ON variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bonus_user ON bonus_ledger(user_id,created_at DESC);

-- Safe additive migration for existing databases created before age verification was added.
ALTER TABLE users ADD COLUMN IF NOT EXISTS age_verified BOOLEAN NOT NULL DEFAULT FALSE;

-- Version 1.1: manufacturer directory and persistent media (no existing data removed).
CREATE TABLE IF NOT EXISTS brands (
  id SERIAL PRIMARY KEY, slug TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '', sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp')),
  content BYTEA NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_brands_order ON brands(sort_order,id);

-- VAPORIA 1.3: switch only old bundled banner paths to correctly proportioned 2:1 artwork.
-- Uploaded/custom banner images are never overwritten.
UPDATE banners SET image_url='/banners/main-v13.webp' WHERE image_url='/banners/main.webp';
UPDATE banners SET image_url='/banners/bonus-v13.webp' WHERE image_url='/banners/bonus.webp';
UPDATE banners SET image_url='/banners/delivery-v13.webp' WHERE image_url='/banners/delivery.webp';
