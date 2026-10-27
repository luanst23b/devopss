CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(25),
  role VARCHAR(20) NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_addresses (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_name VARCHAR(150) NOT NULL,
  phone VARCHAR(25) NOT NULL,
  address_line VARCHAR(500) NOT NULL,
  ward VARCHAR(120),
  district VARCHAR(120),
  province VARCHAR(120),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
  id BIGSERIAL PRIMARY KEY,
  parent_id BIGINT REFERENCES categories(id),
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS brands (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  slug VARCHAR(140) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  category_id BIGINT NOT NULL REFERENCES categories(id),
  brand_id BIGINT REFERENCES brands(id) ON DELETE SET NULL,
  slug VARCHAR(220) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  short_description VARCHAR(500),
  description TEXT,
  price NUMERIC(13, 2) NOT NULL CHECK (price >= 0),
  sale_price NUMERIC(13, 2) CHECK (sale_price IS NULL OR (sale_price >= 0 AND sale_price <= price)),
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  specifications JSONB,
  main_image VARCHAR(1000),
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_images (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url VARCHAR(1000) NOT NULL,
  alt_text VARCHAR(255),
  sort_order SMALLINT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_variants (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(80) NOT NULL UNIQUE,
  color VARCHAR(80),
  storage VARCHAR(80),
  price_adjustment NUMERIC(13, 2) NOT NULL DEFAULT 0,
  stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS orders (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id),
  total_amount NUMERIC(13, 2) NOT NULL CHECK (total_amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')),
  payment_method VARCHAR(20) NOT NULL DEFAULT 'cod'
    CHECK (payment_method IN ('cod', 'vnpay', 'momo')),
  shipping_full_name VARCHAR(150) NOT NULL,
  shipping_phone VARCHAR(25) NOT NULL,
  shipping_address VARCHAR(700) NOT NULL,
  shipping_note VARCHAR(500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_details (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  variant_id BIGINT REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(13, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE IF NOT EXISTS reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uq_reviews_user_product UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  provider VARCHAR(20) NOT NULL CHECK (provider IN ('cod', 'vnpay', 'momo')),
  amount NUMERIC(13, 2) NOT NULL CHECK (amount >= 0),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'initiated', 'paid', 'failed', 'refunded')),
  transaction_ref VARCHAR(180),
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_addresses_user ON user_addresses(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent ON categories(parent_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_brand ON products(brand_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(sale_price, price);
CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id, is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user_date ON orders(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_date ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_details_order ON order_details(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product_date ON reviews(product_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_transaction_ref
  ON payments(transaction_ref) WHERE transaction_ref IS NOT NULL;
