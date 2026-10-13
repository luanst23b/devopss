import { Router } from "express";
import { execute, pool, query, sql } from "../db.js";
import { authenticate } from "../middleware/auth.js";
import { cancelOrder } from "../services/orderCancellation.js";

export const orderRouter = Router();

const vouchers = [
  { code: "TECHZONE10", type: "percent", value: 10, minimumOrder: 1_000_000, maximumDiscount: 1_000_000, title: "Giảm 10%, tối đa 1 triệu", description: "Áp dụng cho đơn từ 1.000.000đ" },
  { code: "TECHZONE200", type: "fixed", value: 200_000, minimumOrder: 2_000_000, maximumDiscount: 200_000, title: "Giảm ngay 200.000đ", description: "Áp dụng cho đơn từ 2.000.000đ" },
  { code: "WELCOME5", type: "percent", value: 5, minimumOrder: 500_000, maximumDiscount: 500_000, title: "Khách mới giảm 5%", description: "Giảm tối đa 500.000đ cho đơn từ 500.000đ" },
];

function getVoucherDiscount(code, subtotal) {
  const voucher = vouchers.find((item) => item.code === String(code || "").trim().toUpperCase());
  if (!voucher) return null;
  if (!Number.isFinite(subtotal) || subtotal < voucher.minimumOrder) {
    return { voucher, error: `Mã ${voucher.code} áp dụng cho đơn từ ${new Intl.NumberFormat("vi-VN").format(voucher.minimumOrder)}đ.` };
  }
  const amount = voucher.type === "percent"
    ? Math.min(Math.round(subtotal * voucher.value / 100), voucher.maximumDiscount)
    : voucher.value;
  return { voucher, amount: Math.min(amount, subtotal) };
}

orderRouter.get("/vouchers", (_req, res) => {
  res.json({ items: vouchers.map(({ code, title, description, minimumOrder }) => ({ code, title, description, minimumOrder })) });
});

orderRouter.post("/vouchers/validate", authenticate, (req, res) => {
  const subtotal = Number(req.body.subtotal);
  const result = getVoucherDiscount(req.body.code, subtotal);
  if (!result) return res.status(400).json({ message: "Mã voucher không hợp lệ hoặc đã hết hạn." });
  if (result.error) return res.status(400).json({ message: result.error });
  res.json({
    voucher: { code: result.voucher.code, title: result.voucher.title },
    subtotal,
    discount: result.amount,
    total: Math.max(0, subtotal - result.amount),
  });
});

orderRouter.post("/", authenticate, async (req, res, next) => {
  const { items, shippingAddress, paymentMethod = "cod", voucherCode } = req.body;
  if (!Array.isArray(items) || items.length === 0 || !shippingAddress?.fullName || !shippingAddress?.phone || !shippingAddress?.address) {
    return res.status(400).json({ message: "Giỏ hàng hoặc thông tin giao hàng chưa hợp lệ." });
  }
  if (!["cod", "vnpay", "momo"].includes(paymentMethod)) {
    return res.status(400).json({ message: "Phương thức thanh toán không được hỗ trợ." });
  }

  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  let transactionFinished = false;
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    transactionStarted = true;
    const orderLines = [];
    let total = 0;

    for (const item of items) {
      const quantity = Number.parseInt(item.quantity, 10);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
        throw Object.assign(new Error("Số lượng sản phẩm không hợp lệ."), { status: 400 });
      }

      const rows = item.variantId
        ? await query(
          `SELECT v.id, v.product_id, v.stock_quantity, v.price_adjustment,
                  p.price, p.sale_price
           FROM dbo.product_variants v WITH (UPDLOCK, ROWLOCK)
           JOIN dbo.products p WITH (UPDLOCK, ROWLOCK) ON p.id = v.product_id
           WHERE v.id = ? AND v.is_active = 1 AND p.is_active = 1`,
          [item.variantId],
          transaction,
        )
        : await query(
          `SELECT p.id, p.stock_quantity, p.price, p.sale_price,
                  CASE WHEN EXISTS (
                    SELECT 1 FROM dbo.product_variants v WHERE v.product_id = p.id AND v.is_active = 1
                  ) THEN CAST(1 AS bit) ELSE CAST(0 AS bit) END AS has_variants
           FROM dbo.products p WITH (UPDLOCK, ROWLOCK)
           WHERE p.id = ? AND p.is_active = 1`,
          [item.productId],
          transaction,
        );
      const stock = rows[0];
      if (!stock || stock.stock_quantity < quantity) {
        throw Object.assign(new Error("Một sản phẩm trong giỏ đã hết hàng hoặc không đủ số lượng."), { status: 409 });
      }
      if (!item.variantId && stock.has_variants) {
        throw Object.assign(new Error("Vui lòng chọn màu sắc hoặc phiên bản sản phẩm."), { status: 400 });
      }

      const unitPrice = Number(stock.sale_price ?? stock.price) + Number(stock.price_adjustment || 0);
      orderLines.push({ productId: stock.product_id || stock.id, variantId: item.variantId || null, quantity, unitPrice });
      total += unitPrice * quantity;

      if (item.variantId) {
        const variantUpdate = await execute(
          `UPDATE dbo.product_variants
           SET stock_quantity = stock_quantity - ?
           WHERE id = ? AND stock_quantity >= ?`,
          [quantity, item.variantId, quantity],
          transaction,
        );
        const productUpdate = await execute(
          `UPDATE dbo.products
           SET stock_quantity = stock_quantity - ?
           WHERE id = ? AND stock_quantity >= ?`,
          [quantity, stock.product_id, quantity],
          transaction,
        );
        if (variantUpdate.rowsAffected[0] !== 1 || productUpdate.rowsAffected[0] !== 1) {
          throw Object.assign(new Error("Một sản phẩm trong giỏ đã hết hàng hoặc không đủ số lượng."), { status: 409 });
        }
      } else {
        const productUpdate = await execute(
          `UPDATE dbo.products
           SET stock_quantity = stock_quantity - ?
           WHERE id = ? AND stock_quantity >= ?`,
          [quantity, item.productId, quantity],
          transaction,
        );
        if (productUpdate.rowsAffected[0] !== 1) {
          throw Object.assign(new Error("Một sản phẩm trong giỏ đã hết hàng hoặc không đủ số lượng."), { status: 409 });
        }
      }
    }

    const subtotal = total;
    let discount = 0;
    let appliedVoucher = null;
    if (voucherCode) {
      const voucherResult = getVoucherDiscount(voucherCode, subtotal);
      if (!voucherResult) {
        throw Object.assign(new Error("Mã voucher không hợp lệ hoặc đã hết hạn."), { status: 400 });
      }
      if (voucherResult.error) {
        throw Object.assign(new Error(voucherResult.error), { status: 400 });
      }
      discount = voucherResult.amount;
      appliedVoucher = voucherResult.voucher.code;
      total = Math.max(0, subtotal - discount);
    }

    const orderResult = await execute(
      `INSERT INTO dbo.orders
       (user_id, total_amount, status, payment_method, shipping_full_name, shipping_phone, shipping_address, shipping_note)
       OUTPUT INSERTED.id AS id
       VALUES (?, ?, 'pending', ?, ?, ?, ?, ?)`,
      [req.user.id, total, paymentMethod, shippingAddress.fullName.trim(), shippingAddress.phone.trim(),
        shippingAddress.address.trim(), shippingAddress.note?.trim() || null],
      transaction,
    );
    const orderId = orderResult.recordset[0].id;
    for (const line of orderLines) {
      await execute(
        `INSERT INTO dbo.order_details (order_id, product_id, variant_id, quantity, unit_price)
         VALUES (?, ?, ?, ?, ?)`,
        [orderId, line.productId, line.variantId, line.quantity, line.unitPrice],
        transaction,
      );
    }
    await execute(
      "INSERT INTO dbo.payments (order_id, provider, amount, status) VALUES (?, ?, ?, ?)",
      [orderId, paymentMethod, total, paymentMethod === "cod" ? "pending" : "initiated"],
      transaction,
    );
    await transaction.commit();
    transactionFinished = true;
    res.status(201).json({
      order: { id: orderId, subtotal, discount, voucherCode: appliedVoucher, total, status: "pending", paymentMethod },
      payment: paymentMethod === "cod"
        ? null
        : { mode: "mock", message: `Thanh toán ${paymentMethod.toUpperCase()} đang ở chế độ mô phỏng.`, checkoutUrl: `/api/payments/mock/${orderId}` },
    });
  } catch (error) {
    if (transactionStarted && !transactionFinished) await transaction.rollback().catch(() => {});
    next(error);
  }
});

orderRouter.get("/mine", authenticate, async (req, res, next) => {
  try {
    const orders = await query(
      `SELECT TOP (50) id, total_amount AS total, status,
              payment_method AS paymentMethod, created_at AS createdAt,
              shipping_full_name AS shippingFullName, shipping_phone AS shippingPhone,
              shipping_address AS shippingAddress
       FROM dbo.orders
       WHERE user_id = ?
       ORDER BY created_at DESC`,
      [req.user.id],
    );
    if (!orders.length) return res.json({ items: [] });
    const placeholders = orders.map(() => "?").join(", ");
    const details = await query(
      `SELECT d.order_id AS orderId, d.product_id AS productId,
              d.quantity, d.unit_price AS unitPrice, p.name AS productName,
              p.main_image AS image
       FROM dbo.order_details d
       JOIN dbo.products p ON p.id = d.product_id
       WHERE d.order_id IN (${placeholders})
       ORDER BY d.order_id DESC, d.id`,
      orders.map((order) => order.id),
    );
    const detailsByOrder = new Map();
    for (const detail of details) {
      const orderDetails = detailsByOrder.get(String(detail.orderId)) || [];
      orderDetails.push(detail);
      detailsByOrder.set(String(detail.orderId), orderDetails);
    }
    res.json({
      items: orders.map((order) => ({
        ...order,
        details: detailsByOrder.get(String(order.id)) || [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

orderRouter.patch("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    const result = await cancelOrder(req.params.id, req.user.id);
    res.status(result.status).json({ message: result.message });
  } catch (error) {
    next(error);
  }
});
