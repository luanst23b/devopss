import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pool } from "../src/db.js";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const projectDirectory = path.resolve(backendDirectory, "..");

function parseSqlLiteral(source, state) {
  while (/\s/.test(source[state.index] || "")) state.index += 1;
  if (source.slice(state.index, state.index + 4).toUpperCase() === "NULL") {
    state.index += 4;
    return null;
  }
  if (source[state.index] === "N" && source[state.index + 1] === "'") state.index += 1;
  if (source[state.index] === "'") {
    state.index += 1;
    let value = "";
    while (state.index < source.length) {
      const character = source[state.index++];
      if (character !== "'") {
        value += character;
      } else if (source[state.index] === "'") {
        value += "'";
        state.index += 1;
      } else {
        return value;
      }
    }
    throw new Error("Unterminated string in database seed data.");
  }
  const start = state.index;
  while (state.index < source.length && !/[,\s)]/.test(source[state.index])) state.index += 1;
  const token = source.slice(start, state.index);
  if (!/^-?\d+(?:\.\d+)?$/.test(token)) {
    throw new Error(`Unsupported SQL seed value: ${token}`);
  }
  return Number(token);
}

function parseValues(source, marker, columnCount) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) throw new Error(`Could not find ${marker} in database seed data.`);
  const state = { index: markerIndex + marker.length };
  const rows = [];
  while (state.index < source.length) {
    while (/[\s,]/.test(source[state.index] || "")) state.index += 1;
    if (source[state.index] !== "(") break;
    state.index += 1;
    const row = [];
    while (row.length < columnCount) {
      row.push(parseSqlLiteral(source, state));
      while (/\s/.test(source[state.index] || "")) state.index += 1;
      if (source[state.index] === ",") {
        state.index += 1;
      } else if (source[state.index] === ")" && row.length === columnCount) {
        break;
      } else {
        throw new Error(`Malformed database seed row near byte ${state.index}.`);
      }
    }
    if (source[state.index] !== ")") throw new Error("Malformed database seed row terminator.");
    state.index += 1;
    rows.push(row);
  }
  return rows;
}

function readVariants(source) {
  const variants = [];
  const pattern = /INSERT INTO dbo\.product_variants[\s\S]*?SELECT id,\s*'([^']+)',\s*N'((?:''|[^'])*)',\s*N'((?:''|[^'])*)',\s*([\d.]+),\s*(\d+) FROM dbo\.products WHERE slug = '([^']+)';/gi;
  for (const match of source.matchAll(pattern)) {
    variants.push([
      match[1],
      match[2].replaceAll("''", "'"),
      match[3].replaceAll("''", "'"),
      Number(match[4]),
      Number(match[5]),
      match[6],
    ]);
  }
  return variants;
}

async function seedDatabase(client) {
  const { rows: [count] } = await client.query("SELECT COUNT(*)::integer AS total FROM products");
  if (count.total > 0) return;

  const seedPath = path.join(projectDirectory, "database", "seed.sql");
  const seed = await readFile(seedPath, "utf8");
  const categories = [
    ["dien-thoai", "Điện thoại", 1],
    ["laptop", "Laptop", 2],
    ["tablet", "Tablet", 3],
    ["dong-ho", "Đồng hồ", 4],
    ["phu-kien", "Phụ kiện", 5],
  ];
  const brands = [
    ["apple", "Apple"], ["samsung", "Samsung"], ["xiaomi", "Xiaomi"], ["anker", "Anker"],
    ["oppo", "OPPO"], ["asus", "ASUS"], ["lenovo", "Lenovo"], ["sony", "Sony"],
    ["logitech", "Logitech"], ["jbl", "JBL"], ["garmin", "Garmin"],
  ];

  await client.query("BEGIN");
  try {
    for (const [slug, name, sortOrder] of categories) {
      await client.query(
        `INSERT INTO categories (slug, name, sort_order) VALUES ($1, $2, $3)
         ON CONFLICT (slug) DO NOTHING`,
        [slug, name, sortOrder],
      );
    }
    for (const [slug, name] of brands) {
      await client.query(
        "INSERT INTO brands (slug, name) VALUES ($1, $2) ON CONFLICT (slug) DO NOTHING",
        [slug, name],
      );
    }

    const products = parseValues(seed, "INSERT INTO @seedProducts VALUES", 12);
    for (const row of products) {
      const [
        slug, categorySlug, brandSlug, name, shortDescription, description,
        price, salePrice, stockQuantity, specifications, image, featured,
      ] = row;
      await client.query(
        `INSERT INTO products
           (category_id, brand_id, slug, name, short_description, description, price,
            sale_price, stock_quantity, specifications, main_image, is_featured)
         SELECT c.id, b.id, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11
         FROM categories c LEFT JOIN brands b ON b.slug = $1
         WHERE c.slug = $12
         ON CONFLICT (slug) DO NOTHING`,
        [
          brandSlug, slug, name, shortDescription, description, price, salePrice,
          stockQuantity, JSON.stringify(JSON.parse(specifications)), image, Boolean(featured), categorySlug,
        ],
      );
    }

    await client.query(
      `INSERT INTO product_images (product_id, image_url, alt_text, sort_order)
       SELECT id, main_image, name, 0 FROM products p
       WHERE main_image IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM product_images i WHERE i.product_id = p.id AND i.image_url = p.main_image
         )`,
    );
    for (const [sku, color, storage, priceAdjustment, stockQuantity, productSlug] of readVariants(seed)) {
      await client.query(
        `INSERT INTO product_variants (product_id, sku, color, storage, price_adjustment, stock_quantity)
         SELECT id, $1, $2, $3, $4, $5 FROM products WHERE slug = $6
         ON CONFLICT (sku) DO NOTHING`,
        [sku, color, storage, priceAdjustment, stockQuantity, productSlug],
      );
    }
    await client.query("COMMIT");
    console.log(`Initialized PostgreSQL catalog with ${products.length} products.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function initializeDatabase() {
  const schema = await readFile(path.join(backendDirectory, "sql", "schema.sql"), "utf8");
  await pool.query(schema);
  const client = await pool.connect();
  try {
    await seedDatabase(client);
  } finally {
    client.release();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try {
    await initializeDatabase();
    console.log("PostgreSQL database is ready.");
  } catch (error) {
    console.error(`PostgreSQL setup failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
