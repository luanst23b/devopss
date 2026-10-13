import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { LogOut, PackageCheck, ShieldCheck, ShoppingBag, UserRound } from "lucide-react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import HomePage from "./pages/HomePage.jsx";
import ProductListPage from "./pages/ProductListPage.jsx";
import ProductDetailPage from "./pages/ProductDetailPage.jsx";
import CartPage from "./pages/CartPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import AdminPage from "./pages/AdminPage.jsx";
import OrdersPage from "./pages/OrdersPage.jsx";
import { signOut } from "./store/authSlice.js";

function AccountPage() {
  const user = useSelector((state) => state.auth.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  if (!user) return <Navigate to="/login" replace />;
  const initials = user.fullName.split(/\s+/).map((part) => part[0]).slice(-2).join("").toUpperCase();
  return <main className="mx-auto max-w-5xl px-4 py-10 sm:py-16"><div className="overflow-hidden rounded-3xl border border-zinc-100 bg-white shadow-card"><div className="bg-gradient-to-r from-zinc-950 via-zinc-900 to-red-950 px-6 py-8 text-white sm:px-9"><div className="flex flex-wrap items-center gap-4"><span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-400 to-rose-700 text-xl font-black shadow-lg shadow-red-950/30">{initials}</span><div><p className="text-xs font-semibold uppercase tracking-[.2em] text-white/50">Tài khoản TechZone</p><h1 className="mt-1 text-2xl font-black">Xin chào, {user.fullName}</h1><p className="mt-1 text-sm text-white/60">{user.email}</p></div><span className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold"><ShieldCheck size={15} />{user.role === "admin" ? "Quản trị viên" : "Khách hàng"}</span></div></div><div className="grid gap-6 p-6 sm:grid-cols-[1fr_280px] sm:p-9"><section><h2 className="text-lg font-extrabold">Thông tin tài khoản</h2><p className="mt-1 text-sm text-zinc-500">Quản lý trải nghiệm mua sắm của bạn tại TechZone.</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-zinc-100 p-4"><UserRound size={18} className="text-brand" /><p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Họ và tên</p><p className="mt-1 font-bold text-zinc-800">{user.fullName}</p></div><div className="rounded-2xl border border-zinc-100 p-4"><PackageCheck size={18} className="text-brand" /><p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Email đăng nhập</p><p className="mt-1 break-all font-bold text-zinc-800">{user.email}</p></div></div></section><aside className="flex flex-col gap-2 rounded-2xl bg-zinc-50 p-4"><Link to="/products" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-zinc-700 transition hover:bg-white hover:text-brand"><ShoppingBag size={17} /> Tiếp tục mua sắm</Link><Link to="/orders" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-zinc-700 transition hover:bg-white hover:text-brand"><PackageCheck size={17} /> Theo dõi đơn hàng</Link>{user.role === "admin" && <Link to="/admin" className="flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-bold text-zinc-700 transition hover:bg-white hover:text-brand"><ShieldCheck size={17} /> Trang quản trị</Link>}<button onClick={() => { dispatch(signOut()); navigate("/login", { replace: true }); }} className="mt-auto flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-3 text-sm font-bold text-red-600 transition hover:border-red-200 hover:bg-red-50"><LogOut size={17} /> Đăng xuất</button></aside></div></div></main>;
}

export default function App() {
  return <div className="min-h-screen bg-canvas text-ink"><Header /><Routes><Route path="/" element={<HomePage />} /><Route path="/products" element={<ProductListPage />} /><Route path="/product/:id" element={<ProductDetailPage />} /><Route path="/cart" element={<CartPage />} /><Route path="/orders" element={<OrdersPage />} /><Route path="/login" element={<LoginPage />} /><Route path="/register" element={<RegisterPage />} /><Route path="/account" element={<AccountPage />} /><Route path="/admin" element={<AdminPage />} /><Route path="*" element={<main className="py-24 text-center"><h1 className="text-2xl font-black">Không tìm thấy trang</h1></main>} /></Routes><Footer /></div>;
}
