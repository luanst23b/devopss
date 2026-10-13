import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { setSession } from "../store/authSlice.js";
import { api } from "../api.js";
import { completePendingCartIntent, safeReturnTo } from "../utils/cartAuth.js";

export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      dispatch(setSession(await api("/auth/register", { method: "POST", body: JSON.stringify(form) })));
      const hasPendingCartIntent = completePendingCartIntent(dispatch);
      navigate(safeReturnTo(params.get("returnTo"), hasPendingCartIntent ? "/cart" : "/"));
    } catch (registerError) {
      setError(registerError.message);
    } finally {
      setBusy(false);
    }
  }
  return <main className="mx-auto max-w-md px-4 py-14"><div className="rounded-3xl bg-white p-7 shadow-card sm:p-9"><p className="text-sm font-bold uppercase tracking-widest text-brand">Thành viên TechZone</p><h1 className="mt-2 text-3xl font-black">Tạo tài khoản</h1><form onSubmit={submit} className="mt-6 space-y-4">{[["fullName", "Họ và tên"], ["email", "Email"], ["phone", "Số điện thoại"], ["password", "Mật khẩu (tối thiểu 8 ký tự)"]].map(([name, placeholder]) => <input key={name} required={name !== "phone"} type={name === "email" ? "email" : name === "password" ? "password" : "text"} minLength={name === "password" ? 8 : undefined} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} placeholder={placeholder} className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand" />)}{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-brand py-3.5 font-bold text-white disabled:opacity-60">{busy ? "Đang tạo tài khoản..." : "Đăng ký"}</button></form><p className="mt-5 text-center text-sm text-zinc-500">Đã có tài khoản? <Link to={`/login${params.get("returnTo") ? `?returnTo=${encodeURIComponent(params.get("returnTo"))}` : ""}`} className="font-bold text-brand">Đăng nhập</Link></p></div></main>;
}
