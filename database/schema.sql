IF DB_ID(N'tech_store') IS NULL
    CREATE DATABASE [tech_store];
GO

USE [tech_store];
GO

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_users PRIMARY KEY,
        full_name NVARCHAR(150) NOT NULL,
        email NVARCHAR(255) NOT NULL,
        password_hash NVARCHAR(255) NOT NULL,
        phone NVARCHAR(25) NULL,
        role VARCHAR(20) NOT NULL CONSTRAINT df_users_role DEFAULT ('customer'),
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_users_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT df_users_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT uq_users_email UNIQUE (email),
        CONSTRAINT chk_users_role CHECK (role IN ('customer', 'admin'))
    );
END;
GO

IF OBJECT_ID(N'dbo.user_addresses', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_addresses (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_user_addresses PRIMARY KEY,
        user_id BIGINT NOT NULL,
        recipient_name NVARCHAR(150) NOT NULL,
        phone NVARCHAR(25) NOT NULL,
        address_line NVARCHAR(500) NOT NULL,
        ward NVARCHAR(120) NULL,
        district NVARCHAR(120) NULL,
        province NVARCHAR(120) NULL,
        is_default BIT NOT NULL CONSTRAINT df_user_addresses_is_default DEFAULT (0),
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_user_addresses_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_user_addresses_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_categories PRIMARY KEY,
        parent_id BIGINT NULL,
        name NVARCHAR(120) NOT NULL,
        slug VARCHAR(140) NOT NULL,
        sort_order SMALLINT NOT NULL CONSTRAINT df_categories_sort_order DEFAULT (0),
        is_active BIT NOT NULL CONSTRAINT df_categories_is_active DEFAULT (1),
        CONSTRAINT uq_categories_slug UNIQUE (slug),
        CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES dbo.categories(id)
    );
END;
GO

IF OBJECT_ID(N'dbo.brands', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.brands (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_brands PRIMARY KEY,
        name NVARCHAR(120) NOT NULL,
        slug VARCHAR(140) NOT NULL,
        CONSTRAINT uq_brands_slug UNIQUE (slug)
    );
END;
GO

IF OBJECT_ID(N'dbo.products', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.products (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_products PRIMARY KEY,
        category_id BIGINT NOT NULL,
        brand_id BIGINT NULL,
        slug VARCHAR(220) NOT NULL,
        name NVARCHAR(255) NOT NULL,
        short_description NVARCHAR(500) NULL,
        description NVARCHAR(MAX) NULL,
        price DECIMAL(13,2) NOT NULL,
        sale_price DECIMAL(13,2) NULL,
        stock_quantity INT NOT NULL CONSTRAINT df_products_stock_quantity DEFAULT (0),
        specifications NVARCHAR(MAX) NULL,
        main_image NVARCHAR(1000) NULL,
        is_featured BIT NOT NULL CONSTRAINT df_products_is_featured DEFAULT (0),
        is_active BIT NOT NULL CONSTRAINT df_products_is_active DEFAULT (1),
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_products_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT df_products_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT uq_products_slug UNIQUE (slug),
        CONSTRAINT fk_products_category FOREIGN KEY (category_id) REFERENCES dbo.categories(id),
        CONSTRAINT fk_products_brand FOREIGN KEY (brand_id) REFERENCES dbo.brands(id)
            ON DELETE SET NULL,
        CONSTRAINT chk_products_prices CHECK (
            price >= 0 AND (sale_price IS NULL OR (sale_price >= 0 AND sale_price <= price))
        ),
        CONSTRAINT chk_products_stock CHECK (stock_quantity >= 0),
        CONSTRAINT chk_products_specifications CHECK (
            specifications IS NULL OR ISJSON(specifications) = 1
        )
    );
END;
GO

IF OBJECT_ID(N'dbo.product_images', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_images (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_product_images PRIMARY KEY,
        product_id BIGINT NOT NULL,
        image_url NVARCHAR(1000) NOT NULL,
        alt_text NVARCHAR(255) NULL,
        sort_order SMALLINT NOT NULL CONSTRAINT df_product_images_sort_order DEFAULT (0),
        CONSTRAINT fk_product_images_product FOREIGN KEY (product_id) REFERENCES dbo.products(id)
            ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.product_variants', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.product_variants (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_product_variants PRIMARY KEY,
        product_id BIGINT NOT NULL,
        sku VARCHAR(80) NOT NULL,
        color NVARCHAR(80) NULL,
        storage NVARCHAR(80) NULL,
        price_adjustment DECIMAL(13,2) NOT NULL CONSTRAINT df_product_variants_price_adjustment DEFAULT (0),
        stock_quantity INT NOT NULL CONSTRAINT df_product_variants_stock_quantity DEFAULT (0),
        is_active BIT NOT NULL CONSTRAINT df_product_variants_is_active DEFAULT (1),
        CONSTRAINT uq_product_variants_sku UNIQUE (sku),
        CONSTRAINT fk_product_variants_product FOREIGN KEY (product_id) REFERENCES dbo.products(id)
            ON DELETE CASCADE,
        CONSTRAINT chk_product_variants_stock CHECK (stock_quantity >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.orders (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_orders PRIMARY KEY,
        user_id BIGINT NOT NULL,
        total_amount DECIMAL(13,2) NOT NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT df_orders_status DEFAULT ('pending'),
        payment_method VARCHAR(20) NOT NULL CONSTRAINT df_orders_payment_method DEFAULT ('cod'),
        shipping_full_name NVARCHAR(150) NOT NULL,
        shipping_phone NVARCHAR(25) NOT NULL,
        shipping_address NVARCHAR(700) NOT NULL,
        shipping_note NVARCHAR(500) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_orders_created_at DEFAULT (SYSUTCDATETIME()),
        updated_at DATETIME2(3) NOT NULL CONSTRAINT df_orders_updated_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_orders_user FOREIGN KEY (user_id) REFERENCES dbo.users(id),
        CONSTRAINT chk_orders_status CHECK (
            status IN ('pending', 'confirmed', 'shipping', 'completed', 'cancelled')
        ),
        CONSTRAINT chk_orders_payment_method CHECK (payment_method IN ('cod', 'vnpay', 'momo')),
        CONSTRAINT chk_orders_total CHECK (total_amount >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.order_details', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_details (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_order_details PRIMARY KEY,
        order_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        variant_id BIGINT NULL,
        quantity INT NOT NULL,
        unit_price DECIMAL(13,2) NOT NULL,
        CONSTRAINT fk_order_details_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id)
            ON DELETE CASCADE,
        CONSTRAINT fk_order_details_product FOREIGN KEY (product_id) REFERENCES dbo.products(id),
        CONSTRAINT fk_order_details_variant FOREIGN KEY (variant_id) REFERENCES dbo.product_variants(id)
            ON DELETE SET NULL,
        CONSTRAINT chk_order_details_quantity CHECK (quantity > 0),
        CONSTRAINT chk_order_details_unit_price CHECK (unit_price >= 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.reviews', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.reviews (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_reviews PRIMARY KEY,
        user_id BIGINT NOT NULL,
        product_id BIGINT NOT NULL,
        rating TINYINT NOT NULL,
        comment NVARCHAR(MAX) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_reviews_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_reviews_user FOREIGN KEY (user_id) REFERENCES dbo.users(id) ON DELETE CASCADE,
        CONSTRAINT fk_reviews_product FOREIGN KEY (product_id) REFERENCES dbo.products(id) ON DELETE CASCADE,
        CONSTRAINT chk_reviews_rating CHECK (rating BETWEEN 1 AND 5),
        CONSTRAINT uq_reviews_user_product UNIQUE (user_id, product_id)
    );
END;
GO

IF OBJECT_ID(N'dbo.payments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.payments (
        id BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT pk_payments PRIMARY KEY,
        order_id BIGINT NOT NULL,
        provider VARCHAR(20) NOT NULL,
        amount DECIMAL(13,2) NOT NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT df_payments_status DEFAULT ('pending'),
        transaction_ref NVARCHAR(180) NULL,
        paid_at DATETIME2(3) NULL,
        created_at DATETIME2(3) NOT NULL CONSTRAINT df_payments_created_at DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT fk_payments_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id)
            ON DELETE CASCADE,
        CONSTRAINT uq_payments_order UNIQUE (order_id),
        CONSTRAINT chk_payments_provider CHECK (provider IN ('cod', 'vnpay', 'momo')),
        CONSTRAINT chk_payments_status CHECK (
            status IN ('pending', 'initiated', 'paid', 'failed', 'refunded')
        ),
        CONSTRAINT chk_payments_amount CHECK (amount >= 0)
    );
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.user_addresses') AND name = N'idx_user_addresses_user')
    CREATE INDEX idx_user_addresses_user ON dbo.user_addresses(user_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.categories') AND name = N'idx_categories_parent')
    CREATE INDEX idx_categories_parent ON dbo.categories(parent_id, sort_order);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'idx_products_category')
    CREATE INDEX idx_products_category ON dbo.products(category_id, is_active);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'idx_products_brand')
    CREATE INDEX idx_products_brand ON dbo.products(brand_id, is_active);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.products') AND name = N'idx_products_price')
    CREATE INDEX idx_products_price ON dbo.products(sale_price, price);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.product_images') AND name = N'idx_product_images_product')
    CREATE INDEX idx_product_images_product ON dbo.product_images(product_id, sort_order);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.product_variants') AND name = N'idx_product_variants_product')
    CREATE INDEX idx_product_variants_product ON dbo.product_variants(product_id, is_active);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.orders') AND name = N'idx_orders_user_date')
    CREATE INDEX idx_orders_user_date ON dbo.orders(user_id, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.orders') AND name = N'idx_orders_status_date')
    CREATE INDEX idx_orders_status_date ON dbo.orders(status, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.order_details') AND name = N'idx_order_details_order')
    CREATE INDEX idx_order_details_order ON dbo.order_details(order_id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.reviews') AND name = N'idx_reviews_product_date')
    CREATE INDEX idx_reviews_product_date ON dbo.reviews(product_id, created_at DESC);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.payments') AND name = N'idx_payments_transaction_ref')
    CREATE UNIQUE INDEX idx_payments_transaction_ref ON dbo.payments(transaction_ref)
    WHERE transaction_ref IS NOT NULL;
GO
