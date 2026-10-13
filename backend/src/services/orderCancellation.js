import { execute, pool, query, sql } from "../db.js";

export async function cancelOrder(orderId, ownerId = null) {
  if (!/^[1-9]\d*$/.test(String(orderId))) {
    return { status: 400, message: "Mã đơn hàng không hợp lệ." };
  }

  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  let transactionFinished = false;
  try {
    await transaction.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    transactionStarted = true;
    const orders = ownerId === null
      ? await query(
        "SELECT id, status FROM dbo.orders WITH (UPDLOCK, HOLDLOCK) WHERE id = ?",
        [orderId],
        transaction,
      )
      : await query(
        "SELECT id, status FROM dbo.orders WITH (UPDLOCK, HOLDLOCK) WHERE id = ? AND user_id = ?",
        [orderId, ownerId],
        transaction,
      );
    const order = orders[0];
    if (!order) {
      await transaction.rollback();
      transactionFinished = true;
      return { status: 404, message: ownerId === null ? "Không tìm thấy đơn hàng." : "Không tìm thấy đơn hàng của bạn." };
    }
    if (!["pending", "confirmed"].includes(order.status)) {
      await transaction.rollback();
      transactionFinished = true;
      return { status: 409, message: "Đơn hàng đã được giao đi hoặc đã kết thúc nên không thể hủy trực tuyến." };
    }

    const details = await query(
      `SELECT product_id AS productId, variant_id AS variantId, quantity
       FROM dbo.order_details
       WHERE order_id = ?`,
      [order.id],
      transaction,
    );
    for (const detail of details) {
      if (detail.variantId !== null) {
        await execute(
          "UPDATE dbo.product_variants SET stock_quantity = stock_quantity + ? WHERE id = ?",
          [detail.quantity, detail.variantId],
          transaction,
        );
      }
      await execute(
        "UPDATE dbo.products SET stock_quantity = stock_quantity + ?, updated_at = SYSUTCDATETIME() WHERE id = ?",
        [detail.quantity, detail.productId],
        transaction,
      );
    }

    const update = ownerId === null
      ? await execute(
        `UPDATE dbo.orders
         SET status = 'cancelled', updated_at = SYSUTCDATETIME()
         WHERE id = ? AND status IN ('pending', 'confirmed')`,
        [order.id],
        transaction,
      )
      : await execute(
        `UPDATE dbo.orders
         SET status = 'cancelled', updated_at = SYSUTCDATETIME()
         WHERE id = ? AND user_id = ? AND status IN ('pending', 'confirmed')`,
        [order.id, ownerId],
        transaction,
      );
    if (update.rowsAffected[0] !== 1) {
      await transaction.rollback();
      transactionFinished = true;
      return { status: 409, message: "Đơn hàng đã thay đổi trạng thái. Vui lòng tải lại danh sách đơn." };
    }

    await transaction.commit();
    transactionFinished = true;
    return {
      status: 200,
      message: "Đã hủy đơn hàng. Nếu bạn đã thanh toán trước, vui lòng liên hệ cửa hàng để được hỗ trợ hoàn tiền.",
    };
  } catch (error) {
    if (transactionStarted && !transactionFinished) await transaction.rollback().catch(() => {});
    throw error;
  }
}
