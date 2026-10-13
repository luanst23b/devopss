import { Router } from "express";
import { execute, pool, query, sql } from "../db.js";
import { authenticate } from "../middleware/auth.js";

export const paymentRouter = Router();

paymentRouter.post("/mock/:orderId/confirm", authenticate, async (req, res, next) => {
  const transaction = new sql.Transaction(pool);
  let transactionStarted = false;
  let transactionFinished = false;
  try {
    await transaction.begin();
    transactionStarted = true;
    const orders = await query(
      `SELECT id FROM dbo.orders WITH (UPDLOCK, ROWLOCK)
       WHERE id = ? AND user_id = ?`,
      [req.params.orderId, req.user.id],
      transaction,
    );
    if (!orders[0]) {
      await transaction.rollback();
      transactionFinished = true;
      return res.status(404).json({ message: "Không tìm thấy đơn hàng." });
    }
    await execute(
      "UPDATE dbo.payments SET status = 'paid', paid_at = SYSUTCDATETIME() WHERE order_id = ?",
      [orders[0].id],
      transaction,
    );
    await execute(
      "UPDATE dbo.orders SET status = 'confirmed' WHERE id = ?",
      [orders[0].id],
      transaction,
    );
    await transaction.commit();
    transactionFinished = true;
    res.json({ message: "Đã ghi nhận thanh toán mô phỏng.", orderId: orders[0].id, status: "confirmed" });
  } catch (error) {
    if (transactionStarted && !transactionFinished) await transaction.rollback().catch(() => {});
    next(error);
  }
});
