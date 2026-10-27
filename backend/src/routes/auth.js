import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { execute, query } from "../db.js";
import { authenticate } from "../middleware/auth.js";

export const authRouter = Router();

authRouter.post("/register", async (req, res, next) => {
  try {
    const { fullName, email, password, phone } = req.body;
    if (!fullName?.trim() || !email?.trim() || !password || password.length < 8) {
      return res.status(400).json({ message: "Vui lòng nhập họ tên, email và mật khẩu tối thiểu 8 ký tự." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await execute(
      `INSERT INTO users (full_name, email, password_hash, phone)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [fullName.trim(), email.trim().toLowerCase(), passwordHash, phone?.trim() || null],
    );
    res.status(201).json(await createSession(result.recordset[0].id));
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Email này đã được sử dụng." });
    }
    next(error);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const rows = await query(
      "SELECT id, full_name, email, password_hash, role FROM users WHERE email = $1",
      [email?.trim().toLowerCase() || ""],
    );
    if (!rows[0] || !(await bcrypt.compare(password || "", rows[0].password_hash))) {
      return res.status(401).json({ message: "Email hoặc mật khẩu không chính xác." });
    }
    res.json(sessionResponse(rows[0]));
  } catch (error) {
    next(error);
  }
});

authRouter.get("/me", authenticate, async (req, res, next) => {
  try {
    const rows = await query(
      "SELECT id, full_name AS fullName, email, phone, role FROM users WHERE id = $1",
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ message: "Không tìm thấy tài khoản." });
    res.json({ user: rows[0] });
  } catch (error) {
    next(error);
  }
});

async function createSession(userId) {
  const rows = await query(
    "SELECT id, full_name, email, role FROM users WHERE id = $1",
    [userId],
  );
  return sessionResponse(rows[0]);
}

function sessionResponse(user) {
  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "1d" },
  );
  return {
    token,
    user: { id: user.id, fullName: user.full_name, email: user.email, role: user.role },
  };
}