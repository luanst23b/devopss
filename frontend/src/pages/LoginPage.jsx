import { useState } from "react";
import { useDispatch } from "react-redux";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { setSession } from "../store/authSlice.js";
import { api } from "../api.js";
import { completePendingCartIntent, safeReturnTo } from "../utils/cartAuth.js";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      const session = await api("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      dispatch(setSession(session));
      const hasPendingCartIntent = completePendingCartIntent(dispatch);
      navigate(safeReturnTo(params.get("returnTo"), hasPendingCartIntent ? "/cart" : session.user.role === "admin" ? "/admin" : "/"));
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setBusy(false);
    }
  }

  const registerUrl = params.get("returnTo") ? `/register?returnTo=${encodeURIComponent(params.get("returnTo"))}` : "/register";
  return <main className="mx-auto max-w-md px-4 py-14"><div className="rounded-3xl bg-white p-7 shadow-card sm:p-9"><p className="text-sm font-bold uppercase tracking-widest text-brand">Chào mừng trở lại</p><h1 className="mt-2 text-3xl font-black">Đăng nhập</h1><form onSubmit={submit} className="mt-6 space-y-4"><input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand" /><input type="password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mật khẩu" className="w-full rounded-xl border px-4 py-3 outline-none focus:border-brand" />{error && <p role="alert" className="text-sm text-red-600">{error}</p>}<button disabled={busy} className="w-full rounded-xl bg-brand py-3.5 font-bold text-white disabled:opacity-60">{busy ? "Đang đăng nhập..." : "Đăng nhập"}</button></form><p className="mt-5 text-center text-sm text-zinc-500">Chưa có tài khoản? <Link to={registerUrl} className="font-bold text-brand">Đăng ký</Link></p></div></main>;
}
