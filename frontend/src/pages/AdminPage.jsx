import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { 
  ArrowUpRight, BadgeCheck, Box, CheckCircle2, ChevronRight, ClipboardList, 
  Edit3, ExternalLink, Filter, LayoutDashboard, LoaderCircle, LogOut, 
  PackageCheck, Plus, RefreshCw, Search, ShoppingBag, TrendingUp, Trash2, 
  Users, Wallet, X, AlertCircle, Clock, Truck, XCircle
} from "lucide-react";
import { api } from "../api.js";
import { signOut } from "../store/authSlice.js";

const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(value) || 0);
const shortDate = (value) => new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));

const statusConfig = {
  pending: { label: "Chờ xác nhận", icon: Clock, color: "bg-amber-50 text-amber-700 border-amber-200" },
  confirmed: { label: "Đã xác nhận", icon: CheckCircle2, color: "bg-blue-50 text-blue-700 border-blue-200" },
  shipping: { label: "Đang giao", icon: Truck, color: "bg-purple-50 text-purple-700 border-purple-200" },
  completed: { label: "Hoàn thành", icon: PackageCheck, color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Đã hủy", icon: XCircle, color: "bg-rose-50 text-rose-700 border-rose-200" },
};

const allowedTransitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipping", "cancelled"],
  shipping: ["completed"],
  completed: [],
  cancelled: [],
};

const emptyProduct = {
  name: "", slug: "", categoryId: "", brandName: "", price: "", salePrice: "",
  stockQuantity: 0, image: "", shortDescription: "", description: "", isFeatured: false,
  specifications: "{\n  \"Màn hình\": \"\",\n  \"CPU\": \"\",\n  \"RAM\": \"\",\n  \"Dung lượng\": \"\"\n}",
};

function slugify(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/đ/g, "d").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function AdminPage() {
  const user = useSelector((state) => state.auth.user);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("7d");
  const [summary, setSummary] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [slugEdited, setSlugEdited] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [stats, productResult, orderResult, options] = await Promise.all([
        api(`/admin/summary?period=${period}`),
        api("/admin/products"),
        api("/admin/orders"),
        api("/admin/catalog-options"),
      ]);
      setSummary(stats);
      setProducts(productResult.items || []);
      setOrders(orderResult.items || []);
      setCategories(options.categories || []);
      setBrands(options.brands || []);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const filteredProducts = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    return products.filter((product) => !needle || `${product.name} ${product.brandName || ""}`.toLocaleLowerCase("vi").includes(needle));
  }, [products, search]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === "all") return orders;
    return orders.filter(order => order.status === orderFilter);
  }, [orders, orderFilter]);

  // Phân tích chỉ số nâng cao
  const analytics = useMemo(() => {
    if (!summary) return null;
    const totalOrders = summary.orders?.total || 0;
    const revenue = summary.revenue || 0;
    const completedOrders = orders.filter(o => o.status === "completed").length;
    const cancelledOrders = orders.filter(o => o.status === "cancelled").length;
    
    return {
      aov: totalOrders > 0 ? revenue / totalOrders : 0,
      completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
      cancellationRate: totalOrders > 0 ? Math.round((cancelledOrders / totalOrders) * 100) : 0,
    };
  }, [summary, orders]);

  function openProduct(product = null) {
    setError("");
    setNotice("");
    setSlugEdited(Boolean(product));
    setForm(product ? {
      ...product,
      categoryId: String(product.categoryId),
      price: String(product.price),
      salePrice: product.salePrice == null ? "" : String(product.salePrice),
      stockQuantity: String(product.stockQuantity),
      specifications: JSON.stringify(product.specifications || {}, null, 2),
    } : { ...emptyProduct, categoryId: String(categories[0]?.id || "") });
    setDialog(product ? "edit" : "create");
  }

  async function submitProduct(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      let parsedSpecs = {};
      try {
        parsedSpecs = JSON.parse(form.specifications);
      } catch (e) {
        throw new Error("Cấu trúc JSON thông số kỹ thuật không hợp lệ.");
      }

      const payload = {
        ...form,
        categoryId: Number(form.categoryId),
        price: Number(form.price),
        salePrice: form.salePrice === "" ? null : Number(form.salePrice),
        stockQuantity: Number(form.stockQuantity),
        specifications: parsedSpecs,
      };

      await api(dialog === "edit" ? `/admin/products/${form.id}` : "/admin/products", {
        method: dialog === "edit" ? "PUT" : "POST",
        body: JSON.stringify(payload),
      });

      setDialog(null);
      setNotice(dialog === "edit" ? "Đã cập nhật sản phẩm thành công." : "Đã thêm sản phẩm mới vào hệ thống.");
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  }

  async function archiveProduct(product) {
    if (!window.confirm(`Ẩn sản phẩm “${product.name}” khỏi cửa hàng?`)) return;
    setError("");
    try {
      await api(`/admin/products/${product.id}`, { method: "DELETE" });
      setNotice("Đã ẩn sản phẩm khỏi danh mục hiển thị.");
      await load();
    } catch (actionError) {
      setError(actionError.message);
    }
  }

  async function updateOrder(orderId, status) {
    setError("");
    try {
      await api(`/admin/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice(`Đã cập nhật đơn hàng #${orderId}.`);
      await load();
    } catch (actionError) {
      setError(actionError.message);
      await load();
    }
  }

  function logout() {
    dispatch(signOut());
    navigate("/login", { replace: true });
  }

  if (!token || user?.role !== "admin") {
    return (
      <main className="mx-auto flex min-h-[70vh] max-w-md items-center justify-center px-4 py-16">
        <div className="w-full rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-xl">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
            <BadgeCheck size={32} />
          </span>
          <h1 className="mt-6 text-2xl font-black text-slate-900">Khu vực quản trị viên</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            Vui lòng đăng nhập tài khoản Admin để truy cập dashboard quản lý.
          </p>
          <Link to="/login?returnTo=%2Fadmin" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-rose-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-rose-200 transition hover:bg-rose-700">
            Đăng nhập ngay
          </Link>
        </div>
      </main>
    );
  }

  const navItems = [
    { id: "overview", label: "Tổng quan & Analytics", icon: LayoutDashboard },
    { id: "products", label: "Kho sản phẩm", icon: Box },
    { id: "orders", label: "Quản lý đơn hàng", icon: ClipboardList },
  ];

  return (
    <div className="flex min-h-screen bg-slate-50/60 font-sans text-slate-800 antialiased">
      {/* SIDEBAR NAVIGATION */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-slate-800/20 bg-slate-900 px-4 py-6 text-slate-300">
        <Link to="/" className="mb-8 px-3">
          <span className="text-xl font-black tracking-tight text-white">TECH<span className="text-rose-500">ZONE</span></span>
          <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-slate-400">Management Suite</span>
        </Link>

        <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Menu quản trị</p>
        <nav className="space-y-1">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setTab(id); setError(""); setNotice(""); }}
              className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-xs font-bold transition ${
                tab === id 
                  ? "bg-rose-600 text-white shadow-md shadow-rose-900/30" 
                  : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
              }`}
            >
              <Icon size={18} />
              {label}
              {id === "orders" && summary?.orders?.pending > 0 && (
                <span className="ml-auto rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-slate-950">
                  {summary.orders.pending}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* USER PROFILE IN SIDEBAR */}
        <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-800/50 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-xs font-black text-white">
              {user.fullName ? user.fullName.charAt(0).toUpperCase() : "A"}
            </span>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{user.fullName}</p>
              <p className="truncate text-[10px] text-slate-400">{user.email}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-slate-700/60 pt-2.5">
            <Link to="/" className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold text-slate-400 transition hover:bg-slate-700/50 hover:text-white">
              Cửa hàng <ExternalLink size={12} />
            </Link>
            <button onClick={logout} className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-semibold text-rose-400 transition hover:bg-rose-500/10">
              <LogOut size={12} /> Đăng xuất
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="ml-64 flex-1 px-8 py-7">
        {/* TOP BAR */}
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>Admin</span> <ChevronRight size={12} /> <span className="capitalize">{tab}</span>
            </div>
            <h1 className="mt-1 text-2xl font-black text-slate-900">
              {navItems.find((item) => item.id === tab)?.label}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <span className="px-3 text-xs font-bold text-slate-400">Kỳ báo cáo:</span>
              <button onClick={() => setPeriod("7d")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${period === "7d" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}>
                7 Ngày
              </button>
              <button onClick={() => setPeriod("30d")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${period === "30d" ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"}`}>
                30 Ngày
              </button>
            </div>
            <button onClick={load} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
            </button>
          </div>
        </header>

        {/* ALERTS */}
        {error && (
          <div role="alert" className="mb-6 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 p-4 text-xs font-bold text-rose-800">
            <AlertCircle size={18} className="shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}
        {notice && (
          <div role="status" className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4 text-xs font-bold text-emerald-800">
            <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />
            <span>{notice}</span>
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[50vh] items-center justify-center text-slate-400">
            <LoaderCircle className="animate-spin text-rose-600" size={28} />
            <span className="ml-3 text-sm font-bold text-slate-600">Đang đồng bộ dữ liệu...</span>
          </div>
        ) : (
          <>
            {/* OVERVIEW TAB */}
            {tab === "overview" && summary && (
              <div className="space-y-6">
                {/* METRICS GRID */}
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Doanh thu ({period})</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                        <Wallet size={20} />
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-black text-slate-900">{money(summary.revenue)}</p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <TrendingUp size={13} /> AOV: {money(analytics.aov)} / đơn
                    </p>
                  </article>

                  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Đơn hàng</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                        <ShoppingBag size={20} />
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-black text-slate-900">{summary.orders.total}</p>
                    <p className="mt-1 text-[11px] font-bold text-amber-600">
                      {summary.orders.pending} đơn cần xử lý ngay
                    </p>
                  </article>

                  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Sản phẩm kích hoạt</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <Box size={20} />
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-black text-slate-900">{summary.products.active} <span className="text-sm font-bold text-slate-400">/ {summary.products.total}</span></p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Đang niêm yết bán
                    </p>
                  </article>

                  <article className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tỷ lệ hoàn thành</span>
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
                        <PackageCheck size={20} />
                      </span>
                    </div>
                    <p className="mt-3 text-2xl font-black text-slate-900">{analytics.completionRate}%</p>
                    <p className="mt-1 text-[11px] font-semibold text-slate-500">
                      Tỷ lệ hủy: {analytics.cancellationRate}%
                    </p>
                  </article>
                </div>

                {/* TREND CHART & ANALYTICS */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm lg:col-span-2">
                    <div className="mb-6 flex items-center justify-between">
                      <div>
                        <h2 className="text-base font-black text-slate-900">Doanh thu & Số lượng đơn hàng</h2>
                        <p className="text-xs font-semibold text-slate-400">Biến động chi tiết theo từng ngày</p>
                      </div>
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-extrabold text-emerald-700">
                        +{money(summary.revenue)}
                      </span>
                    </div>
                    <InteractiveTrendChart trend={summary.trend || []} period={period} />
                  </section>

                  {/* QUICK STATS / STATUS BREAKDOWN */}
                  <section className="flex flex-col justify-between rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                    <div>
                      <h2 className="text-base font-black text-slate-900">Phân bổ đơn hàng</h2>
                      <p className="text-xs font-semibold text-slate-400">Theo trạng thái xử lý hiện tại</p>

                      <div className="mt-6 space-y-4">
                        {Object.entries(statusConfig).map(([key, config]) => {
                          const count = orders.filter(o => o.status === key).length;
                          const pct = orders.length > 0 ? Math.round((count / orders.length) * 100) : 0;
                          const Icon = config.icon;
                          return (
                            <div key={key} className="space-y-1.5">
                              <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-2 font-bold text-slate-700">
                                  <Icon size={14} className="text-slate-400" /> {config.label}
                                </span>
                                <span className="font-extrabold text-slate-900">{count} <span className="text-[10px] text-slate-400">({pct}%)</span></span>
                              </div>
                              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${config.color.split(" ")[0].replace("bg-", "bg-").replace("-50", "-500")}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-6 rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-700">💡 Gợi ý vận hành</p>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                        {summary.orders.pending > 0 
                          ? `Có ${summary.orders.pending} đơn hàng đang chờ xác nhận. Hãy xử lý ngay để giữ tỷ lệ hài lòng cao.`
                          : "Tất cả đơn hàng hiện tại đã được xử lý đúng tiến độ!"}
                      </p>
                    </div>
                  </section>
                </div>

                {/* RECENT ORDERS TABLE */}
                <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between">
                    <div>
                      <h2 className="text-base font-black text-slate-900">Đơn hàng mới nhất</h2>
                      <p className="text-xs font-semibold text-slate-400">Top 5 đơn vừa phát sinh trong hệ thống</p>
                    </div>
                    <button onClick={() => setTab("orders")} className="flex items-center gap-1 text-xs font-extrabold text-rose-600 hover:text-rose-700">
                      Xem toàn bộ đơn <ArrowUpRight size={14} />
                    </button>
                  </div>
                  <OrderTable orders={orders.slice(0, 5)} onStatusChange={updateOrder} />
                </section>
              </div>
            )}

            {/* PRODUCTS TAB */}
            {tab === "products" && (
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div className="relative min-w-[280px] flex-1 sm:max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Tìm theo tên sản phẩm, hãng..."
                      className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-xs font-medium outline-none transition focus:border-rose-500 focus:ring-2 focus:ring-rose-100"
                    />
                  </div>
                  <button
                    onClick={() => openProduct()}
                    className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-200 transition hover:bg-rose-700"
                  >
                    <Plus size={16} /> Thêm sản phẩm mới
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="rounded-l-xl px-4 py-3.5">Sản phẩm</th>
                        <th className="px-4 py-3.5">Danh mục</th>
                        <th className="px-4 py-3.5">Giá niêm yết / Khuyến mãi</th>
                        <th className="px-4 py-3.5 text-center">Tồn kho</th>
                        <th className="px-4 py-3.5 text-center">Trạng thái</th>
                        <th className="rounded-r-xl px-4 py-3.5 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredProducts.map((product) => (
                        <tr key={product.id} className="transition hover:bg-slate-50/60">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <img src={product.image || "https://placehold.co/80x80?text=Tech"} alt="" className="h-11 w-11 rounded-lg border border-slate-100 bg-white object-contain p-1" />
                              <div>
                                <p className="max-w-xs truncate font-bold text-slate-800">{product.name}</p>
                                <p className="mt-0.5 text-[11px] text-slate-400">{product.brandName || "Không phân hãng"}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 font-semibold text-slate-600">{product.categoryName}</td>
                          <td className="whitespace-nowrap px-4 py-3.5">
                            <p className="font-extrabold text-slate-900">{money(product.salePrice || product.price)}</p>
                            {product.salePrice && <p className="text-[10px] text-slate-400 line-through">{money(product.price)}</p>}
                          </td>
                          <td className="px-4 py-3.5 text-center font-bold text-slate-700">{product.stockQuantity}</td>
                          <td className="px-4 py-3.5 text-center">
                            <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-extrabold ${product.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                              {product.isActive ? "Đang bán" : "Đã ẩn"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex justify-end gap-1.5">
                              <button title="Chỉnh sửa" onClick={() => openProduct(product)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600">
                                <Edit3 size={14} />
                              </button>
                              {product.isActive && (
                                <button title="Ẩn khỏi cửa hàng" onClick={() => archiveProduct(product)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600">
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!filteredProducts.length && (
                    <div className="py-12 text-center text-xs font-semibold text-slate-400">
                      Không tìm thấy sản phẩm nào phù hợp.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ORDERS TAB */}
            {tab === "orders" && (
              <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-base font-black text-slate-900">Danh sách đơn hàng ({filteredOrders.length})</h2>
                    <p className="text-xs font-semibold text-slate-400">Quản lý và cập nhật tiến độ giao hàng</p>
                  </div>

                  {/* FILTER BY STATUS */}
                  <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50/50 p-1">
                    <button onClick={() => setOrderFilter("all")} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${orderFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                      Tất cả ({orders.length})
                    </button>
                    {Object.entries(statusConfig).map(([key, cfg]) => (
                      <button key={key} onClick={() => setOrderFilter(key)} className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${orderFilter === key ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
                        {cfg.label} ({orders.filter(o => o.status === key).length})
                      </button>
                    ))}
                  </div>
                </div>

                <OrderTable orders={filteredOrders} onStatusChange={updateOrder} />
              </section>
            )}
          </>
        )}
      </main>

      {/* MODAL EDIT / CREATE PRODUCT */}
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs" onMouseDown={(e) => { if (e.target === e.currentTarget) setDialog(null); }}>
          <form onSubmit={submitProduct} className="my-auto w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            <div className="mb-6 flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-rose-600">Product Manager</span>
                <h2 className="text-xl font-black text-slate-900">{dialog === "edit" ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm mới"}</h2>
              </div>
              <button type="button" onClick={() => setDialog(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X size={20} />
              </button>
            </div>

            {error && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}

            <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-2 text-xs sm:grid-cols-2">
              <Field label="Tên sản phẩm" required>
                <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, ...(!slugEdited ? { slug: slugify(e.target.value) } : {}) })} className="admin-input" />
              </Field>

              <Field label="Đường dẫn (slug)" required>
                <input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(e) => { setSlugEdited(true); setForm({ ...form, slug: e.target.value }); }} className="admin-input" />
              </Field>

              <Field label="Danh mục" required>
                <select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="admin-input">
                  <option value="">Chọn danh mục</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>

              <Field label="Thương hiệu">
                <input list="admin-brands" value={form.brandName || ""} onChange={(e) => setForm({ ...form, brandName: e.target.value })} className="admin-input" />
                <datalist id="admin-brands">{brands.map((b) => <option key={b.id} value={b.name} />)}</datalist>
              </Field>

              <Field label="Giá niêm yết (₫)" required>
                <input type="number" min="0" required value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="admin-input" />
              </Field>

              <Field label="Giá khuyến mãi (₫)">
                <input type="number" min="0" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} className="admin-input" />
              </Field>

              <Field label="Tồn kho" required>
                <input type="number" min="0" required value={form.stockQuantity} onChange={(e) => setForm({ ...form, stockQuantity: e.target.value })} className="admin-input" />
              </Field>

              <Field label="URL Ảnh chính">
                <input type="url" value={form.image || ""} onChange={(e) => setForm({ ...form, image: e.target.value })} className="admin-input" placeholder="https://..." />
              </Field>

              <Field label="Mô tả ngắn" wide>
                <input value={form.shortDescription || ""} onChange={(e) => setForm({ ...form, shortDescription: e.target.value })} className="admin-input" />
              </Field>

              <div className="sm:col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                  <input type="checkbox" checked={Boolean(form.isFeatured)} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} className="h-4 w-4 rounded border-slate-300 accent-rose-600" />
                  Sản phẩm nổi bật (Hiển thị ưu tiên ở Trang chủ)
                </label>
              </div>

              <Field label="Mô tả chi tiết" wide>
                <textarea rows="3" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} className="admin-input" />
              </Field>

              <Field label="Thông số kỹ thuật (Định dạng JSON)" wide>
                <textarea rows="5" value={form.specifications} onChange={(e) => setForm({ ...form, specifications: e.target.value })} className="admin-input font-mono text-[11px]" />
              </Field>
            </div>

            <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
              <button type="button" onClick={() => setDialog(null)} className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">
                Hủy
              </button>
              <button disabled={saving} className="rounded-xl bg-rose-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-200 disabled:opacity-60">
                {saving ? "Đang lưu..." : "Lưu sản phẩm"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, wide, children }) {
  return (
    <label className={`space-y-1 text-xs font-bold text-slate-600 ${wide ? "sm:col-span-2" : ""}`}>
      <span>{label}{required && <span className="text-rose-500"> *</span>}</span>
      {children}
    </label>
  );
}

function OrderTable({ orders, onStatusChange }) {
  if (!orders.length) return <p className="py-10 text-center text-xs font-semibold text-slate-400">Không có đơn hàng nào.</p>;

  return (
    <div className="space-y-3">
      {orders.map((order) => {
        const config = statusConfig[order.status] || statusConfig.pending;
        const StatusIcon = config.icon;

        return (
          <article key={order.id} className="rounded-2xl border border-slate-100 bg-slate-50/40 p-4 transition hover:bg-slate-50">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-black text-slate-900">Đơn hàng #{order.id}</span>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${config.color}`}>
                    <StatusIcon size={12} /> {config.label}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {order.customerName} · <span className="text-slate-400">{order.phone}</span> · <span className="text-slate-400">{order.email}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-slate-400">{order.address}</p>
              </div>

              <div className="flex items-center gap-4">
                <span className="text-base font-black text-rose-600">{money(order.total)}</span>
                <select
                  aria-label={`Trạng thái đơn #${order.id}`}
                  value={order.status}
                  onChange={(e) => onStatusChange(order.id, e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none shadow-xs"
                >
                  {Object.entries(statusConfig).map(([val, cfg]) => (
                    <option 
                      key={val} 
                      value={val} 
                      disabled={val !== order.status && !allowedTransitions[order.status]?.includes(val)}
                    >
                      {cfg.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {order.details?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-200/60 pt-3">
                {order.details.map((detail, idx) => (
                  <span key={idx} className="rounded-lg bg-white border border-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                    {detail.productName} × <strong className="text-slate-900">{detail.quantity}</strong>
                  </span>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

// BIỂU ĐỒ DOANH THU CÓ INTERACTIVE HOVER TOOLTIP
function InteractiveTrendChart({ trend, period }) {
  const [hovered, setHovered] = useState(null);
  const count = period === "7d" ? 7 : 30;
  const today = new Date();
  const byDate = new Map(trend.map((row) => [String(row.date).slice(0, 10), row]));

  const points = Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - (count - index - 1)));
    const key = date.toISOString().slice(0, 10);
    const row = byDate.get(key);
    return { date: key, revenue: Number(row?.revenue) || 0, orders: Number(row?.orders) || 0 };
  });

  const maxRevenue = Math.max(1, ...points.map((p) => p.revenue));
  const chartWidth = 760;
  const chartHeight = 220;
  const top = 15;
  const bottom = 35;
  const graphHeight = chartHeight - top - bottom;
  const slot = chartWidth / points.length;

  const revenuePoints = points.map((p, i) => {
    const x = slot * i + slot / 2;
    const y = top + graphHeight - (p.revenue / maxRevenue) * graphHeight;
    return { x, y, ...p };
  });

  const revenuePath = revenuePoints.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  const areaPath = `${revenuePath} L ${revenuePoints[revenuePoints.length - 1].x} ${top + graphHeight} L ${revenuePoints[0].x} ${top + graphHeight} Z`;

  return (
    <div>
      <div className="mb-4 flex items-center gap-6 text-[11px] font-bold text-slate-500">
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-rose-500" /> Doanh thu (₫)</span>
        <span className="flex items-center gap-2"><i className="h-3 w-3 rounded-full bg-blue-500" /> Số đơn hàng</span>
      </div>

      <div className="relative overflow-x-auto">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="h-60 w-full min-w-[600px]">
          <defs>
            <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((ratio, idx) => (
            <line key={idx} x1="0" x2={chartWidth} y1={top + graphHeight * ratio} y2={top + graphHeight * ratio} stroke="#f1f5f9" strokeDasharray="4 4" />
          ))}

          {/* Area Fill */}
          <path d={areaPath} fill="url(#roseGradient)" />

          {/* Line Path */}
          <path d={revenuePath} fill="none" stroke="#e11d48" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

          {/* Points & Hover handling */}
          {revenuePoints.map((p, i) => (
            <g key={p.date} onMouseEnter={() => setHovered(p)} onMouseLeave={() => setHovered(null)} className="cursor-pointer">
              <circle cx={p.x} cy={p.y} r={hovered?.date === p.date ? "6" : "4"} fill="#e11d48" stroke="#ffffff" strokeWidth="2" />
              {(period === "7d" || i % 5 === 0) && (
                <text x={p.x} y={chartHeight - 8} textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="bold">
                  {shortDate(p.date)}
                </text>
              )}
            </g>
          ))}
        </svg>

        {/* TOOLTIP POPUP */}
        {hovered && (
          <div className="pointer-events-none absolute top-2 right-4 rounded-xl border border-slate-100 bg-slate-900/90 p-3 text-white shadow-xl backdrop-blur-xs">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{shortDate(hovered.date)}</p>
            <p className="mt-0.5 text-xs font-black text-emerald-400">{money(hovered.revenue)}</p>
            <p className="text-[10px] font-semibold text-slate-300">{hovered.orders} đơn hàng</p>
          </div>
        )}
      </div>
    </div>
  );
}