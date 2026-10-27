import { Router } from "express";
import { query } from "../db.js";

export const productRouter = Router();

productRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;
    
    // Đổi sang cú pháp boolean cho PostgreSQL
    const clauses = ["p.is_active = true"];
    const params = [];
    let paramIndex = 1;

    if (req.query.q) {
      clauses.push(`(p.name ILIKE $${paramIndex} OR p.description ILIKE $${paramIndex + 1} OR b.name ILIKE $${paramIndex + 2})`);
      const keyword = `%${String(req.query.q).trim()}%`;
      params.push(keyword, keyword, keyword);
      paramIndex += 3;
    }
    if (req.query.category) {
      clauses.push(`c.slug = $${paramIndex}`);
      params.push(String(req.query.category));
      paramIndex++;
    }
    if (req.query.brand) {
      clauses.push(`b.slug = $${paramIndex}`);
      params.push(String(req.query.brand));
      paramIndex++;
    }
    if (req.query.minPrice !== undefined) {
      clauses.push(`COALESCE(p.sale_price, p.price) >= $${paramIndex}`);
      params.push(Math.max(0, Number(req.query.minPrice) || 0));
      paramIndex++;
    }
    if (req.query.maxPrice !== undefined) {
      clauses.push(`COALESCE(p.sale_price, p.price) <= $${paramIndex}`);
      params.push(Math.max(0, Number(req.query.maxPrice) || 0));
      paramIndex++;
    }

    const where = clauses.join(" AND ");
    const sort = req.query.sort === "price-asc"
      ? "COALESCE(p.sale_price, p.price) ASC"
      : req.query.sort === "price-desc"
        ? "COALESCE(p.sale_price, p.price) DESC"
        : "p.is_featured DESC, p.created_at DESC";

    // 1. Đếm tổng số lượng sản phẩm (bỏ dbo.)
    const countResult = await query(
      `SELECT COUNT(*) AS total FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id WHERE ${where}`,
      params,
    );
    
    // Lấy danh sách sản phẩm dùng LIMIT $x OFFSET $y
    const productParams = [...params, limit, offset];
    const productsResult = await query(
      `SELECT p.id, p.slug, p.name, p.price, p.sale_price AS "salePrice",
              p.stock_quantity AS "stockQuantity", p.main_image AS image,
              p.short_description AS "shortDescription", p.is_featured AS "isFeatured",
              c.name AS "categoryName", b.name AS "brandName"
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE ${where}
       ORDER BY ${sort}
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      productParams,
    );

    // Xử lý dữ liệu trả về từ PG Pool
    const products = productsResult.rows || productsResult;
    const countRow = countResult.rows ? countResult.rows[0] : countResult[0];
    const total = Number.parseInt(countRow?.total || 0, 10);

    res.json({ 
      items: products, 
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } 
    });
  } catch (error) {
    next(error);
  }
});

productRouter.get("/suggestions", async (req, res, next) => {
  try {
    const search = String(req.query.q || "").trim();
    if (search.length < 2) return res.json({ items: [] });
    
    // Đổi SELECT TOP (6) sang LIMIT 6 chuẩn PostgreSQL
    const result = await query(
      `SELECT id, slug, name, main_image AS image,
              COALESCE(sale_price, price) AS price
       FROM products
       WHERE is_active = true AND name ILIKE $1
       ORDER BY is_featured DESC, name
       LIMIT 6`,
      [`%${search}%`],
    );
    
    const items = result.rows || result;
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

productRouter.get("/:id", async (req, res, next) => {
  try {
    const result = await query(
      `SELECT p.id, p.slug, p.name, p.price, p.sale_price AS "salePrice",
              p.stock_quantity AS "stockQuantity", p.description,
              p.short_description AS "shortDescription", p.specifications,
              p.main_image AS image, b.name AS "brandName", c.name AS "categoryName"
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1 AND p.is_active = true`,
      [req.params.id],
    );
    
    const rows = result.rows || result;
    if (!rows[0]) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });

    const imagesResult = await query(
      `SELECT id, image_url AS url, alt_text AS alt
       FROM product_images WHERE product_id = $1 ORDER BY sort_order, id`,
      [req.params.id],
    );
    
    const variantsResult = await query(
      `SELECT id, sku, color, storage, price_adjustment AS "priceAdjustment",
              stock_quantity AS "stockQuantity"
       FROM product_variants
       WHERE product_id = $1 AND is_active = true ORDER BY id`,
      [req.params.id],
    );

    const images = imagesResult.rows || imagesResult;
    const variants = variantsResult.rows || variantsResult;

    res.json({
      product: {
        ...rows[0],
        specifications: typeof rows[0].specifications === "string"
          ? JSON.parse(rows[0].specifications)
          : rows[0].specifications,
        images,
        variants,
      },
    });
  } catch (error) {
    next(error);
  }
});