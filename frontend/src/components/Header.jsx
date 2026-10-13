import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, ShoppingBag, UserRound, Smartphone, Laptop, Watch, Headphones, Tablet, Menu, PackageCheck, X } from "lucide-react";
import { useSelector } from "react-redux";
import { selectCartCount } from "../store/cartSlice.js";
import { api } from "../api.js";
import { demoProducts } from "../data/demoProducts.js";
import { normalizeText } from "../utils/text.js";

const categories = [
  { label: "Điện thoại", icon: Smartphone, query: "dien-thoai" },
  { label: "Laptop", icon: Laptop, query: "laptop" },
  { label: "Tablet", icon: Tablet, query: "tablet" },
  { label: "Đồng hồ", icon: Watch, query: "dong-ho" },
  { label: "Phụ kiện", icon: Headphones, query: "phu-kien" },
];

export default function Header() {
  const count = useSelector(selectCartCount);
  const user = useSelector((state) => state.auth.user);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (query.trim().length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const result = await api(`/products/suggestions?q=${encodeURIComponent(query)}`);
        if (active) setSuggestions(result.items);
      } catch {
        if (active) {
          const normalized = normalizeText(query);
          setSuggestions(demoProducts.filter((product) => normalizeText(product.name).includes(normalized)).slice(0, 5));
        }
      }
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [query]);

  function search(event) {
    event.preventDefault();
    navigate(`/products?q=${encodeURIComponent(query)}`);
    setSuggestions([]);
  }

  return (
    <>
      <div className="bg-zinc-900 py-2 text-center text-xs font-medium text-white">Ưu đãi công nghệ mỗi ngày · Giao nhanh toàn quốc · Trả góp 0%</div>
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 lg:gap-8">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden" aria-label="Mở menu">{mobileOpen ? <X /> : <Menu />}</button>
          <Link to="/" className="shrink-0 text-2xl font-black tracking-tight text-brand">TECH<span className="text-zinc-900">ZONE</span><span className="ml-1 align-top text-[9px] text-zinc-400">™</span></Link>
          <form onSubmit={search} className="relative hidden flex-1 md:block">
            <div className="flex rounded-xl border border-zinc-200 bg-zinc-50 focus-within:border-brand focus-within:bg-white">
              <input value={query} onChange={(event) => setQuery(event.target.value)} onBlur={() => setTimeout(() => setSuggestions([]), 150)} placeholder="Bạn đang tìm sản phẩm nào?" className="w-full bg-transparent px-4 py-3 text-sm outline-none" />
              <button className="m-1 rounded-lg bg-brand px-4 text-white" aria-label="Tìm kiếm"><Search size={18} /></button>
            </div>
            {suggestions.length > 0 && <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-xl border bg-white shadow-xl">
              {suggestions.map((product) => <Link key={product.id} to={`/product/${product.id}`} className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-zinc-50"><img src={product.image} alt="" className="h-10 w-10 object-contain" /><span>{product.name}</span></Link>)}
            </div>}
          </form>
          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            {user?.role === "admin" && <Link to="/admin" className="hidden items-center gap-1.5 text-sm font-bold text-brand hover:text-red-700 sm:flex"><UserRound size={18} /> Quản trị</Link>}
            {user && <Link to="/orders" className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700 hover:text-brand" aria-label="Theo dõi đơn hàng"><PackageCheck size={20} /><span className="hidden lg:inline">Đơn hàng</span></Link>}
            <Link to={user ? "/cart" : "/login?returnTo=%2Fcart"} className="relative flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-brand"><ShoppingBag size={21} /><span className="hidden sm:inline">Giỏ hàng</span>{count > 0 && <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">{count}</span>}</Link>
            <Link to={user ? "/account" : "/login"} className="flex items-center gap-2 text-sm font-semibold text-zinc-700 hover:text-brand"><UserRound size={20} /><span className="hidden sm:inline">{user ? user.fullName.split(" ")[0] : "Tài khoản"}</span></Link>
          </div>
        </div>
        <nav className={`${mobileOpen ? "block" : "hidden"} border-t border-zinc-100 lg:block`}>
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-2 lg:flex-row lg:items-center lg:gap-7">
            {categories.map(({ label, icon: Icon, query: category }) => <Link key={label} to={`/products?category=${category}`} onClick={() => setMobileOpen(false)} className="flex items-center gap-2 py-2 text-sm font-medium text-zinc-600 hover:text-brand"><Icon size={17} />{label}</Link>)}
            <span className="ml-auto hidden text-xs font-semibold text-zinc-400 lg:block">Tư vấn mua hàng: 1900 2091</span>
          </div>
        </nav>
      </header>
    </>
  );
}
