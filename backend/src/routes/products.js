import { Router } from "express";
import { query } from "../db.js";

export const productRouter = Router();

productRouter.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const offset = (page - 1) * limit;
    const clauses = ["p.is_active = 1"];
    const params = [];

    if (req.query.q) {
      clauses.push("(p.name LIKE ? OR p.description LIKE ? OR b.name LIKE ?)");
      const keyword = `%${String(req.query.q).trim()}%`;
      params.push(keyword, keyword, keyword);
    }
    if (req.query.category) {
      clauses.push("c.slug = ?");
      params.push(String(req.query.category));
    }
    if (req.query.brand) {
      clauses.push("b.slug = ?");
      params.push(String(req.query.brand));
    }
    if (req.query.minPrice !== undefined) {
      clauses.push("COALESCE(p.sale_price, p.price) >= ?");
      params.push(Math.max(0, Number(req.query.minPrice) || 0));
    }
    if (req.query.maxPrice !== undefined) {
      clauses.push("COALESCE(p.sale_price, p.price) <= ?");
      params.push(Math.max(0, Number(req.query.maxPrice) || 0));
    }

    const where = clauses.join(" AND ");
    const sort = req.query.sort === "price-asc"
      ? "COALESCE(p.sale_price, p.price) ASC"
      : req.query.sort === "price-desc"
        ? "COALESCE(p.sale_price, p.price) DESC"
        : "p.is_featured DESC, p.created_at DESC";
    const [count] = await query(
      `SELECT COUNT(*) AS total FROM dbo.products p
       LEFT JOIN dbo.categories c ON c.id = p.category_id
       LEFT JOIN dbo.brands b ON b.id = p.brand_id WHERE ${where}`,
      params,
    );
    const products = await query(
      `SELECT p.id, p.slug, p.name, p.price, p.sale_price AS salePrice,
              p.stock_quantity AS stockQuantity, p.main_image AS image,
              p.short_description AS shortDescription, p.is_featured AS isFeatured,
              c.name AS categoryName, b.name AS brandName
       FROM dbo.products p
       LEFT JOIN dbo.categories c ON c.id = p.category_id
       LEFT JOIN dbo.brands b ON b.id = p.brand_id
       WHERE ${where}
       ORDER BY ${sort}
       OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
      [...params, offset, limit],
    );
    const total = count?.total ?? 0;
    res.json({ items: products, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (error) {
    next(error);
  }
});

productRouter.get("/suggestions", async (req, res, next) => {
  try {
    const search = String(req.query.q || "").trim();
    if (search.length < 2) return res.json({ items: [] });
    const items = await query(
      `SELECT TOP (6) id, slug, name, main_image AS image,
              COALESCE(sale_price, price) AS price
       FROM dbo.products
       WHERE is_active = 1 AND name LIKE ?
       ORDER BY is_featured DESC, name`,
      [`%${search}%`],
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

productRouter.get("/:id", async (req, res, next) => {
  try {
    const rows = await query(
      `SELECT p.id, p.slug, p.name, p.price, p.sale_price AS salePrice,
              p.stock_quantity AS stockQuantity, p.description,
              p.short_description AS shortDescription, p.specifications,
              p.main_image AS image, b.name AS brandName, c.name AS categoryName
       FROM dbo.products p
       LEFT JOIN dbo.brands b ON b.id = p.brand_id
       LEFT JOIN dbo.categories c ON c.id = p.category_id
       WHERE p.id = ? AND p.is_active = 1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    const images = await query(
      `SELECT id, image_url AS url, alt_text AS alt
       FROM dbo.product_images WHERE product_id = ? ORDER BY sort_order, id`,
      [req.params.id],
    );
    const variants = await query(
      `SELECT id, sku, color, storage, price_adjustment AS priceAdjustment,
              stock_quantity AS stockQuantity
       FROM dbo.product_variants
       WHERE product_id = ? AND is_active = 1 ORDER BY id`,
      [req.params.id],
    );
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
