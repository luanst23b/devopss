import { query } from "../db.js";
import { authenticate } from "./auth.js";

export function requireAdmin(req, res, next) {
  authenticate(req, res, async () => {
    try {
      const users = await query("SELECT role FROM dbo.users WHERE id = ?", [req.user.id]);
      if (users[0]?.role !== "admin") {
        return res.status(403).json({ message: "Bạn không có quyền truy cập trang quản trị." });
      }
      next();
    } catch (error) {
      next(error);
    }
  });
}
