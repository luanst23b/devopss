import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Link, Navigate } from "react-router-dom";
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, PackageCheck, RefreshCw, ShieldCheck, Truck, XCircle } from "lucide-react";
import { api } from "../api.js";

const currency = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value) || 0);
const statusInfo = {
  pending: { label: "Chờ xác nhận", icon: Clock3, color: "text-amber-700 bg-amber-50", step: 0 },
  confirmed: { label: "Đã xác nhận", icon: CheckCircle2, color: "text-blue-700 bg-blue-50", step: 1 },
  shipping: { label: "Đang giao", icon: Truck, color: "text-violet-700 bg-violet-50", step: 2 },
  completed: { label: "Đã hoàn thành", icon: PackageCheck, color: "text-emerald-700 bg-emerald-50", step: 3 },
  cancelled: { label: "Đã hủy", icon: XCircle, color: "text-red-700 bg-red-50", step: -1 },
};
const progressLabels = ["Đặt hàng", "Xác nhận", "Đang giao", "Hoàn thành"];

function formatDate(value) {
  return new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function OrdersPage() {
  const token = useSelector((state) => state.auth.token);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyOrder, setBusyOrder] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api("/orders/mine");
      setOrders(Array.isArray(result.items)
        ? result.items.map((order) => ({ ...order, details: Array.isArray(order.details) ? order.details : [] }))
        : []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOrders(); }, [loadOrders]);

  async function cancelOrder(order) {
    if (!window.confirm(`Bạn có chắc muốn hủy đơn hàng #${order.id}?`)) return;
    setBusyOrder(order.id);
    setError("");
    setNotice("");
    try {
      const result = await api(`/orders/${order.id}/cancel`, { method: "PATCH" });
      setNotice(result.message);
      await loadOrders();
    } catch (cancelError) {
      setError(cancelError.message);
    } finally {
      setBusyOrder(null);
    }
  }

  if (!token) return <Navigate to="/login?returnTo=%2Forders" replace />;

  return <main className="relative isolate min-h-[60vh] overflow-hidden px-4 py-7 sm:py-11">
    <div className="pointer-events-none absolute -left-40 top-64 -z-10 h-96 w-96 rounded-full bg-red-100/60 blur-3xl" />
    <div className="pointer-events-none absolute -right-40 top-[45rem] -z-10 h-96 w-96 rounded-full bg-blue-100/50 blur-3xl" />
    <div className="mx-auto max-w-5xl">
    <section className="relative mb-8 flex min-h-56 flex-wrap items-end justify-between gap-5 overflow-hidden rounded-[28px] bg-zinc-950 bg-cover bg-center px-6 py-7 text-white shadow-xl shadow-zinc-900/15 sm:min-h-64 sm:px-9 sm:py-9"
      style={{ backgroundImage: "linear-gradient(90deg, rgba(9,9,11,.96) 0%, rgba(24,24,27,.84) 48%, rgba(24,24,27,.36) 100%), url('https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1800&q=85')" }}>
      <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full border border-white/10" />
      <div className="absolute -right-2 -top-16 h-48 w-48 rounded-full border border-white/10" />
      <div className="relative z-10 max-w-xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.17em] text-white/80 backdrop-blur-md"><PackageCheck size={14} /> Tài khoản TechZone</span>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Theo dõi đơn hàng</h1>
        <p className="mt-2 max-w-md text-sm leading-6 text-white/70">Cập nhật hành trình đơn hàng và xem lại sản phẩm bạn đã chọn mua.</p>
        <div className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-emerald-200"><ShieldCheck size={15} /> Thông tin đơn hàng được bảo mật</div>
      </div>
      <button onClick={loadOrders} disabled={loading} className="relative z-10 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:border-white/40 hover:bg-white/20 disabled:opacity-50"><RefreshCw size={15} className={loading ? "animate-spin" : ""} /> Làm mới</button>
      <div className="absolute inset-0 -z-0 bg-gradient-to-t from-black/25 to-transparent" />
    </section>
    {error && <div role="alert" className="mb-4 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"><AlertCircle size={17} />{error}</div>}
    {notice && <div role="status" className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}
    {loading ? <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-zinc-500"><LoaderCircle className="animate-spin" size={19} />Đang tải đơn hàng...</div>
      : orders.length === 0 ? <section className="rounded-3xl border border-zinc-100 bg-white px-6 py-14 text-center shadow-card"><PackageCheck className="mx-auto text-zinc-300" size={42} /><h2 className="mt-4 text-xl font-black">Bạn chưa có đơn hàng nào</h2><p className="mt-2 text-sm text-zinc-500">Đơn hàng đã đặt sẽ xuất hiện tại đây để bạn tiện theo dõi.</p><Link to="/products" className="mt-6 inline-flex rounded-xl bg-brand px-5 py-3 text-sm font-bold text-white transition hover:bg-red-700">Khám phá sản phẩm</Link></section>
        : <div className="space-y-5">{orders.map((order) => {
          const status = statusInfo[order.status] || statusInfo.pending;
          const StatusIcon = status.icon;
          return <article key={order.id} className="group overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-[0_10px_35px_rgba(24,24,27,.07)] backdrop-blur-sm transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(24,24,27,.11)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 bg-gradient-to-r from-white via-white to-zinc-50 px-5 py-4 sm:px-6">
              <div><p className="font-extrabold text-zinc-900">Đơn hàng <span className="text-brand">#{order.id}</span></p><p className="mt-1 text-xs text-zinc-500">Đặt lúc {formatDate(order.createdAt)}</p></div>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${status.color}`}><StatusIcon size={15} />{status.label}</span>
            </div>
            <div className="px-4 py-5 sm:px-6 sm:py-6">
              {order.status === "cancelled"
                ? <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700"><XCircle size={17} />Đơn hàng đã được hủy.</div>
                : <div className="mb-5 grid grid-cols-4">{progressLabels.map((label, index) => {
                  const complete = index <= status.step;
                  return <div key={label} className="relative text-center">
                    {index > 0 && <span className={`absolute left-0 right-1/2 top-3 h-0.5 ${index <= status.step ? "bg-emerald-500" : "bg-zinc-200"}`} />}
                    {index < progressLabels.length - 1 && <span className={`absolute left-1/2 right-0 top-3 h-0.5 ${index < status.step ? "bg-emerald-500" : "bg-zinc-200"}`} />}
                    <span className={`relative mx-auto flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ${complete ? "bg-emerald-500 text-white" : "bg-zinc-100 text-zinc-400"}`}>{complete ? <CheckCircle2 size={15} /> : index + 1}</span>
                    <span className={`mt-2 block text-[10px] font-semibold sm:text-xs ${complete ? "text-emerald-700" : "text-zinc-400"}`}>{label}</span>
                  </div>;
                })}</div>}
              <div className="overflow-hidden rounded-2xl border border-zinc-100 bg-white">
                <div className="flex items-center justify-between bg-zinc-50/80 px-4 py-2.5"><span className="text-[10px] font-bold uppercase tracking-[.14em] text-zinc-500">Sản phẩm đã mua</span><span className="text-[10px] font-semibold text-zinc-400">{(order.details || []).length} mặt hàng</span></div>
                {(order.details || []).map((detail, index) => <div key={`${order.id}-${detail.productId}-${index}`} className="flex items-center gap-3 border-t border-zinc-100 px-3 py-3.5 transition hover:bg-zinc-50/70 sm:gap-4 sm:px-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-100 bg-white p-1.5 shadow-sm sm:h-[72px] sm:w-[72px]"><img src={detail.image} alt={detail.productName} className="h-full w-full object-contain" /></div>
                  <div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-bold leading-5 text-zinc-800">{detail.productName}</p><p className="mt-1 text-xs text-zinc-400">Đơn giá {currency(detail.unitPrice)}</p></div>
                  <div className="shrink-0 text-right"><span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-bold text-zinc-600">× {detail.quantity}</span><p className="mt-1.5 text-xs font-extrabold text-zinc-800">{currency(detail.unitPrice * detail.quantity)}</p></div>
                </div>)}
                {(order.details || []).length === 0 && <p className="px-3 py-4 text-xs text-zinc-500">Chi tiết mặt hàng chưa có sẵn cho đơn này.</p>}
              </div>
              <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
                <div className="text-xs leading-5 text-zinc-500"><p>Người nhận: <span className="font-semibold text-zinc-700">{order.shippingFullName} · {order.shippingPhone}</span></p><p>Địa chỉ: {order.shippingAddress}</p><p>Thanh toán: {order.paymentMethod.toUpperCase()}</p></div>
                <div className="flex items-center gap-3"><p className="text-right text-xs text-zinc-500">Tổng thanh toán<span className="mt-1 block text-lg font-black text-brand">{currency(order.total)}</span></p>
                  {["pending", "confirmed"].includes(order.status) && <button onClick={() => cancelOrder(order)} disabled={busyOrder === order.id} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50">{busyOrder === order.id ? <LoaderCircle size={14} className="animate-spin" /> : <XCircle size={14} />} Hủy đơn</button>}
                </div>
              </div>
              {["pending", "confirmed"].includes(order.status) && <p className="mt-3 text-[11px] text-zinc-400">Bạn có thể hủy đơn trước khi đơn được chuyển sang trạng thái đang giao.</p>}
            </div>
          </article>;
        })}</div>}
    </div>
  </main>;
}
