-- ============================================================
-- Pop Mart Shop - PostgreSQL schema
-- Tables: members, series, products, orders, order_items
-- Cart = an order with status 'pending' (one per member)
-- Confirm = status 'confirmed' (locked, cannot edit/delete)
-- ============================================================

DROP TABLE IF EXISTS member_addresses CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders      CASCADE;
DROP TABLE IF EXISTS products    CASCADE;
DROP TABLE IF EXISTS series      CASCADE;
DROP TABLE IF EXISTS members     CASCADE;
DROP SEQUENCE IF EXISTS order_no_seq;

-- ---------- members ----------
CREATE TABLE members (
    id            SERIAL PRIMARY KEY,
    email         VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,              -- bcrypt hash, never plain text
    name          VARCHAR(100) NOT NULL,
    phone         VARCHAR(20),
    address       TEXT,
    image         VARCHAR(255),                       -- file name of profile picture
    role          VARCHAR(10)  NOT NULL DEFAULT 'member'
                  CHECK (role IN ('member', 'admin')),
    status        VARCHAR(10)  NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'suspended')),
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ---------- series (Labubu, Molly, Skullpanda, ...) ----------
CREATE TABLE series (
    id   SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- ---------- products ----------
CREATE TABLE products (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(20)   NOT NULL UNIQUE,       -- e.g. 'P001'
    name         VARCHAR(200)  NOT NULL,
    series_id    INT REFERENCES series(id) ON DELETE SET NULL,
    product_type VARCHAR(15)   NOT NULL DEFAULT 'blind_box'
                 CHECK (product_type IN ('blind_box', 'whole_set', 'single')),
    price        NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    stock        INT           NOT NULL DEFAULT 0 CHECK (stock >= 0),
    description  TEXT,
    image        VARCHAR(255),                        -- file name of product picture
    is_active    BOOLEAN       NOT NULL DEFAULT TRUE, -- hide instead of delete
    created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_series ON products(series_id);

-- ---------- orders (cart + confirmed orders) ----------
-- order_no looks like 202510270001 (date + running number)
-- note: the running number does not reset daily; it only needs to be unique
CREATE SEQUENCE order_no_seq START 1;

CREATE TABLE orders (
    id           SERIAL PRIMARY KEY,
    order_no     VARCHAR(20) NOT NULL UNIQUE
                 DEFAULT (to_char(now(), 'YYYYMMDD') || lpad(nextval('order_no_seq')::text, 4, '0')),
    member_id    INT NOT NULL REFERENCES members(id),
    status       VARCHAR(10) NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'confirmed')),
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,    -- filled when confirmed
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- order date shown in UI
    confirmed_at TIMESTAMPTZ
);
CREATE INDEX idx_orders_member ON orders(member_id);

-- each member can have only ONE pending order (= one cart) at a time
CREATE UNIQUE INDEX uq_one_cart_per_member
    ON orders(member_id) WHERE status = 'pending';

-- ---------- order_items ----------
CREATE TABLE order_items (
    id         SERIAL PRIMARY KEY,
    order_id   INT NOT NULL REFERENCES orders(id)   ON DELETE CASCADE,
    product_id INT NOT NULL REFERENCES products(id),
    qty        INT NOT NULL CHECK (qty > 0),
    unit_price NUMERIC(10,2) NOT NULL CHECK (unit_price >= 0), -- price at time of adding
    UNIQUE (order_id, product_id)                     -- same product = update qty
);
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- ---------- member_addresses (extra shipping addresses; main one is members.address) ----------
CREATE TABLE member_addresses (
    id         SERIAL PRIMARY KEY,
    member_id  INT  NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    address    TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_member_addresses_member ON member_addresses(member_id);

-- ============================================================
-- SAMPLE DATA (change names / prices as you like)
-- Admin user: register one normally via POST /api/auth/register,
-- then run:  UPDATE members SET role = 'admin' WHERE email = 'you@example.com';
-- ============================================================
INSERT INTO series (name) VALUES
    ('Labubu'), ('Molly'), ('Skullpanda'), ('Dimoo'), ('Crybaby');

INSERT INTO products (code, name, series_id, product_type, price, stock, description) VALUES
    ('P001', 'Labubu The Monsters Blind Box',    1, 'blind_box', 450.00, 50, 'Sample blind box'),
    ('P002', 'Labubu The Monsters Whole Set',    1, 'whole_set', 5400.00, 5, 'Sample whole set'),
    ('P003', 'Molly Sweet Dreams Blind Box',     2, 'blind_box', 420.00, 40, 'Sample blind box'),
    ('P004', 'Skullpanda Night Blind Box',       3, 'blind_box', 450.00, 30, 'Sample blind box'),
    ('P005', 'Dimoo Daydream Blind Box',         4, 'blind_box', 420.00, 35, 'Sample blind box'),
    ('P006', 'Crybaby Tears Factory Blind Box',  5, 'blind_box', 450.00, 25, 'Sample blind box');
