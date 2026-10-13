import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.js";
import { productRouter } from "./routes/products.js";
import { orderRouter } from "./routes/orders.js";
import { paymentRouter } from "./routes/payments.js";
import { adminRouter } from "./routes/admin.js";

const app = express();
const port = Number(process.env.PORT || 4000);

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is required. Copy .env.example to .env and configure a secure secret.");
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", async (_req, res, next) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ok", database: "connected" });
  } catch (error) {
    next(error);
  }
});

app.use("/api/auth", authRouter);
app.use("/api/products", productRouter);
app.use("/api/orders", orderRouter);
app.use("/api/payments", paymentRouter);
app.use("/api/admin", adminRouter);

app.use((req, res) => res.status(404).json({ message: `Không tìm thấy ${req.method} ${req.path}` }));
app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(error.status || 500).json({
    message: error.status ? error.message : "Đã xảy ra lỗi máy chủ.",
  });
});

await pool.connect();
app.listen(port, () => console.log(`Tech Store API listening at http://localhost:${port}`));
