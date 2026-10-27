import { Router } from "express";
import { execute, query } from "../db.js";
import { requireAdmin } from "../middleware/admin.js";
import { cancelOrder } from "../services/orderCancellation.js";

export const adminRouter = Router();
adminRouter.use(requireAdmin);

adminRouter.get("/summary", async (req, res, next) => {
  try {
    const periodDays = req.query.period === "30d" ? 30 : 7;
    const daysBack = periodDays - 1;
    const [products] = await query(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active FROM dbo.products",
    );
    const [orders] = await query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending
       FROM dbo.orders
       WHERE created_at >= DATEADD(day, -CAST(? AS int), CONVERT(date, SYSUTCDATETIME()))`,
      [daysBack],
    );
    const [customers] = await query("SELECT COUNT(*) AS total FROM dbo.users WHERE role = 'customer'");
    const [revenue] = await query(
      `SELECT COALESCE(SUM(total_amount), 0) AS total
       FROM dbo.orders
       WHERE status IN ('confirmed', 'shipping', 'completed')
         AND created_at >= DATEADD(day, -CAST(? AS int), CONVERT(date, SYSUTCDATETIME()))`,
      [daysBack],
    );
    const trend = await query(
      `SELECT CONVERT(char(10), CONVERT(date, created_at), 23) AS [date],
              COUNT(*) AS orders,
              COALESCE(SUM(CASE WHEN status IN ('confirmed', 'shipping', 'completed')
                                THEN total_amount ELSE 0 END), 0) AS revenue
       FROM dbo.orders
       WHERE created_at >= DATEADD(day, -CAST(? AS int), CONVERT(date, SYSUTCDATETIME()))
       GROUP BY CONVERT(date, created_at)
       ORDER BY CONVERT(date, created_at)`,
      [daysBack],
    );
    res.json({
      products: { total: products.total, active: products.active || 0 },
      orders: { total: orders.total, pending: orders.pending || 0 },
      customers: customers.total,
      revenue: revenue.total,
      periodDays,
      trend,
    });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/catalog-options", async (_req, res, next) => {
  try {
    const [categories, brands] = await Promise.all([
      query("SELECT id, name FROM dbo.categories WHERE is_active = 1 ORDER BY sort_order, name"),
      query("SELECT id, name FROM dbo.brands ORDER BY name"),
    ]);
    res.json({ categories, brands });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/products", async (_req, res, next) => {
  try {
    const items = await query(
      `SELECT p.id, p.slug, p.name, p.short_description AS shortDescription,
              p.price, p.sale_price AS salePrice, p.stock_quantity AS stockQuantity,
              p.main_image AS image, p.is_featured AS isFeatured, p.is_active AS isActive,
              p.category_id AS categoryId, p.brand_id AS brandId,
              c.name AS categoryName, b.name AS brandName
       FROM dbo.products p
       LEFT JOIN dbo.categories c ON c.id = p.category_id
       LEFT JOIN dbo.brands b ON b.id = p.brand_id
       ORDER BY p.is_active DESC, p.updated_at DESC, p.id DESC`,
    );
    res.json({ items });
  } catch (error) {
    next(error);
  }
});

adminRouter.post("/products", async (req, res, next) => {
  try {
    const product = validateProduct(req.body);
    if (product.error) return res.status(400).json({ message: product.error });
    const brandId = await resolveBrand(product.brandName);
    const result = await execute(
      `INSERT INTO dbo.products
       (category_id, brand_id, slug, name, short_description, description, price, sale_price,
        stock_quantity, specifications, main_image, is_featured, is_active)
       OUTPUT INSERTED.id AS id
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, TRUE)`,
      [product.categoryId, brandId, product.slug, product.name, product.shortDescription,
        product.description, product.price, product.salePrice, product.stockQuantity,
        JSON.stringify(product.specifications), product.image, product.isFeatured],
    );
    const id = result.recordset[0].id;
    if (product.image) {
        await execute(
          "INSERT INTO dbo.product_images (product_id, image_url, alt_text, sort_order) VALUES (?, ?, ?, 0)",
          [id, product.image, product.name],
        );
    }
    res.status(201).json({ id });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Slug sản phẩm đã tồn tại." });
    }
    next(error);
  }
});

adminRouter.put("/products/:id", async (req, res, next) => {
  try {
    const product = validateProduct(req.body);
    if (product.error) return res.status(400).json({ message: product.error });
    const brandId = await resolveBrand(product.brandName);
    const result = await execute(
      `UPDATE dbo.products
       SET category_id = ?, brand_id = ?, slug = ?, name = ?, short_description = ?,
           description = ?, price = ?, sale_price = ?, stock_quantity = ?, specifications = ?::jsonb,
           main_image = ?, is_featured = ?, updated_at = SYSUTCDATETIME()
       WHERE id = ?`,
      [product.categoryId, brandId, product.slug, product.name, product.shortDescription,
        product.description, product.price, product.salePrice, product.stockQuantity,
        JSON.stringify(product.specifications), product.image, product.isFeatured, req.params.id],
    );
    if (result.rowsAffected[0] !== 1) return res.status(404).json({ message: "Không tìm thấy sản phẩm." });
    if (product.image) {
      const imageUpdate = await execute(
        `UPDATE dbo.product_images SET image_url = ?, alt_text = ?
         WHERE id = (SELECT id FROM dbo.product_images WHERE product_id = ? ORDER BY sort_order, id LIMIT 1)`,
        [product.image, product.name, req.params.id],
      );
      if (imageUpdate.rowsAffected[0] === 0) {
        await execute(
          "INSERT INTO dbo.product_images (product_id, image_url, alt_text, sort_order) VALUES (?, ?, ?, 0)",
          [req.params.id, product.image, product.name],
        );
      }
    }
    res.json({ message: "Đã cập nhật sản phẩm." });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Slug sản phẩm đã tồn tại." });
    }
    next(error);
  }
});

adminRouter.delete("/products/:id", async (req, res, next) => {
  try {
    const result = await execute(
      "UPDATE dbo.products SET is_active = 0, updated_at = SYSUTCDATETIME() WHERE id = ? AND is_active = 1",
      [req.params.id],
    );
    if (result.rowsAffected[0] !== 1) return res.status(404).json({ message: "Không tìm thấy sản phẩm đang hoạt động." });
    res.json({ message: "Đã ẩn sản phẩm khỏi cửa hàng." });
  } catch (error) {
    next(error);
  }
});

adminRouter.get("/orders", async (_req, res, next) => {
  try {
    const items = await query(
      `SELECT TOP (100) o.id, o.total_amount AS total, o.status,
              o.payment_method AS paymentMethod, o.shipping_full_name AS customerName,
              o.shipping_phone AS phone, o.shipping_address AS address,
              o.created_at AS createdAt, u.email
       FROM dbo.orders o JOIN dbo.users u ON u.id = o.user_id
       ORDER BY o.created_at DESC`,
    );
    if (!items.length) return res.json({ items: [] });
    const placeholders = items.map(() => "?").join(", ");
    const details = await query(
      `SELECT d.order_id AS orderId, d.quantity, d.unit_price AS unitPrice,
              p.name AS productName
       FROM dbo.order_details d JOIN dbo.products p ON p.id = d.product_id
       WHERE d.order_id IN (${placeholders}) ORDER BY d.order_id DESC, d.id`,
      items.map((item) => item.id),
    );
    const byOrder = new Map();
    for (const detail of details) {
      const lines = byOrder.get(String(detail.orderId)) || [];
      lines.push(detail);
      byOrder.set(String(detail.orderId), lines);
    }
    res.json({ items: items.map((item) => ({ ...item, details: byOrder.get(String(item.id)) || [] })) });
  } catch (error) {
    next(error);
  }
});

adminRouter.patch("/orders/:id/status", async (req, res, next) => {
  const transitions = {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipping", "cancelled"],
    shipping: ["completed"],
    completed: [],
    cancelled: [],
  };
  try {
    const { status } = req.body;
    if (!Object.hasOwn(transitions, status)) {
      return res.status(400).json({ message: "Trạng thái đơn hàng không hợp lệ." });
    }
    if (status === "cancelled") {
      const cancellation = await cancelOrder(req.params.id);
      return res.status(cancellation.status).json({ message: cancellation.message });
    }
    const orders = await query("SELECT status FROM dbo.orders WHERE id = ?", [req.params.id]);
    if (!orders[0]) return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    if (!transitions[orders[0].status].includes(status)) {
      return res.status(409).json({ message: "Không thể chuyển đơn hàng sang trạng thái này." });
    }
    const update = await execute(
      "UPDATE dbo.orders SET status = ?, updated_at = SYSUTCDATETIME() WHERE id = ? AND status = ?",
      [status, req.params.id, orders[0].status],
    );
    if (update.rowsAffected[0] !== 1) {
      return res.status(409).json({ message: "Đơn hàng đã thay đổi trạng thái. Vui lòng tải lại danh sách." });
    }
    res.json({ message: "Đã cập nhật trạng thái đơn hàng." });
  } catch (error) {
    next(error);
  }
});

function validateProduct(input = {}) {
  const name = String(input.name || "").trim();
  const slug = String(input.slug || "").trim().toLowerCase();
  const categoryId = Number(input.categoryId);
  const price = Number(input.price);
  const salePrice = input.salePrice === "" || input.salePrice == null ? null : Number(input.salePrice);
  const stockQuantity = Number(input.stockQuantity);
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { error: "Vui lòng nhập tên và slug hợp lệ (chữ thường, số, dấu gạch ngang)." };
  }
  if (!Number.isInteger(categoryId) || categoryId < 1 || !Number.isFinite(price) || price < 0
    || (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice > price))
    || !Number.isInteger(stockQuantity) || stockQuantity < 0) {
    return { error: "Danh mục, giá bán, giá khuyến mãi hoặc tồn kho không hợp lệ." };
  }
  let specifications = {};
  try {
    specifications = typeof input.specifications === "string"
      ? JSON.parse(input.specifications || "{}")
      : input.specifications || {};
  } catch {
    return { error: "Thông số kỹ thuật phải có định dạng JSON hợp lệ." };
  }
  if (!specifications || typeof specifications !== "object" || Array.isArray(specifications)) {
    return { error: "Thông số kỹ thuật phải là một đối tượng JSON." };
  }
  return {
    name,
    slug,
    categoryId,
    price,
    salePrice,
    stockQuantity,
    specifications,
    brandName: String(input.brandName || "").trim(),
    shortDescription: String(input.shortDescription || "").trim() || null,
    description: String(input.description || "").trim() || null,
    image: String(input.image || "").trim() || null,
    isFeatured: Boolean(input.isFeatured),
  };
}

async function resolveBrand(name) {
  if (!name) return null;
  const slug = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!slug) throw Object.assign(new Error("Tên thương hiệu không hợp lệ."), { status: 400 });
  const existing = await query("SELECT id FROM dbo.brands WHERE slug = ?", [slug]);
  if (existing[0]) return existing[0].id;
  const inserted = await execute(
    "INSERT INTO dbo.brands (name, slug) OUTPUT INSERTED.id AS id VALUES (?, ?)",
    [name, slug],
  );
  return inserted.recordset[0].id;
}
