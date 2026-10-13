import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ChevronRight,
  Headphones,
  Laptop,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Tablet,
  Truck,
  WalletCards,
  Watch,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { api } from "../api.js";
import { demoProducts } from "../data/demoProducts.js";

const currency = (amount) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(Number(amount) || 0);

const categories = [
  { label: "Điện thoại", icon: Smartphone, slug: "dien-thoai", color: "from-fuchsia-500/25 to-rose-500/10", glow: "hover:border-fuchsia-300/70 hover:shadow-fuchsia-500/20" },
  { label: "Laptop", icon: Laptop, slug: "laptop", color: "from-cyan-400/25 to-blue-500/10", glow: "hover:border-cyan-300/70 hover:shadow-cyan-500/20" },
  { label: "Tablet", icon: Tablet, slug: "tablet", color: "from-violet-500/25 to-indigo-500/10", glow: "hover:border-violet-300/70 hover:shadow-violet-500/20" },
  { label: "Đồng hồ", icon: Watch, slug: "dong-ho", color: "from-pink-500/25 to-rose-500/10", glow: "hover:border-pink-300/70 hover:shadow-pink-500/20" },
  { label: "Phụ kiện", icon: Headphones, slug: "phu-kien", color: "from-amber-400/25 to-orange-500/10", glow: "hover:border-amber-300/70 hover:shadow-amber-500/20" },
];

const promotionImages = {
  hero: "https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1500&q=85",
  laptop: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=850&q=85",
  accessory: "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?auto=format&fit=crop&w=850&q=85",
};

function ProductSection({ eyebrow, title, slug, products, accent = "from-red-500/15" }) {
  if (!products.length) return null;
  return <section className="mt-16">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[.24em] text-red-300">{eyebrow}</p><h2 className="mt-1.5 text-2xl font-black tracking-tight text-white sm:text-3xl">{title}</h2></div>
      <Link to={`/products?category=${slug}`} className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[.04] px-4 py-2.5 text-xs font-bold text-white/70 transition hover:border-red-300/50 hover:bg-red-500/10 hover:text-white">Xem tất cả <ChevronRight size={15} className="transition group-hover:translate-x-0.5" /></Link>
    </div>
    <div className={`rounded-[26px] border border-white/[.08] bg-gradient-to-br ${accent} to-transparent p-3 sm:p-4`}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-4">
        {products.map((product) => <ProductCard key={product.id} product={product} />)}
      </div>
    </div>
  </section>;
}

function FlashSaleCard({ product }) {
  const discount = Math.max(1, Math.round((1 - Number(product.salePrice) / Number(product.price)) * 100));
  return <Link to={`/product/${product.id}`} className="group relative flex min-w-[190px] flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-zinc-800/90 to-zinc-950 p-3 transition duration-300 hover:-translate-y-1 hover:border-red-400/60 hover:shadow-[0_12px_34px_rgba(239,68,68,.18)] sm:min-w-0">
    <span className="absolute right-3 top-3 z-10 rounded-lg bg-gradient-to-r from-red-600 to-pink-500 px-2 py-1 text-[10px] font-black text-white shadow-lg">-{discount}%</span>
    <div className="mb-3 flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl bg-black/35 p-2"><img src={product.image} alt={product.name} loading="lazy" className="h-full w-full object-contain transition duration-500 group-hover:scale-110" /></div>
    <p className="flash-sale-card-name line-clamp-2 min-h-10 text-xs font-bold leading-5 text-white/90">{product.name}</p>
    <div className="mt-auto pt-3"><p className="text-sm font-black text-red-300">{currency(product.salePrice)}</p><p className="flash-sale-original-price mt-0.5 text-[10px] text-white/40 line-through">{currency(product.price)}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><span className="block h-full w-3/4 rounded-full bg-gradient-to-r from-orange-400 to-red-500" /></div><p className="mt-1 text-[9px] font-semibold uppercase tracking-wider text-white/60">Ưu đãi trong ngày</p></div>
  </Link>;
}

export default function HomePage() {
  const [products, setProducts] = useState(demoProducts);
  const [seconds, setSeconds] = useState(4 * 60 * 60 + 38 * 60 + 12);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    api("/products?limit=100")
      .then((result) => {
        if (active && Array.isArray(result.items) && result.items.length) {
          setProducts(result.items);
          setNotice("");
        }
      })
      .catch(() => {
        if (active) setNotice("Đang hiển thị sản phẩm minh họa. Kết nối API để đồng bộ kho hàng.");
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((value) => value > 0 ? value - 1 : 4 * 60 * 60), 1000);
    return () => clearInterval(timer);
  }, []);

  const sections = useMemo(() => categories.map((category) => ({
    ...category,
    products: products.filter((product) => product.categoryName === category.label),
  })), [products]);
  const deals = useMemo(() => products.filter((product) => Number(product.salePrice) > 0 && Number(product.salePrice) < Number(product.price)).slice(0, 5), [products]);
  const timer = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((value) => String(value).padStart(2, "0"));

  return <main className="tz-home relative isolate min-h-screen overflow-hidden bg-[#07070a] px-4 pb-16 text-white sm:px-6 lg:px-8">
    <div className="pointer-events-none absolute -left-56 top-0 -z-10 h-[650px] w-[650px] rounded-full bg-red-700/20 blur-[150px]" />
    <div className="pointer-events-none absolute right-0 top-72 -z-10 h-[600px] w-[600px] rounded-full bg-violet-800/15 blur-[150px]" />
    <div className="pointer-events-none absolute -bottom-36 left-1/3 -z-10 h-[560px] w-[560px] rounded-full bg-orange-800/10 blur-[140px]" />
    <div className="mx-auto max-w-[1400px]">
      {notice && <div role="status" className="mb-4 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-3 text-xs font-medium text-amber-100">{notice}</div>}

      <section className="grid gap-4 pt-5 lg:grid-cols-12">
        <div className="hero-banner relative isolate flex min-h-[390px] overflow-hidden rounded-[28px] border border-white/10 bg-zinc-950 bg-cover bg-center p-7 sm:min-h-[440px] sm:p-11 lg:col-span-8"
          style={{ backgroundImage: `linear-gradient(90deg, rgba(6,6,10,.97) 0%, rgba(8,7,14,.83) 42%, rgba(8,7,14,.22) 100%), url('${promotionImages.hero}')` }}>
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_70%_50%,rgba(236,72,153,.18),transparent_40%)]" />
          <div className="hero-copy relative z-10 flex max-w-xl flex-col justify-center">
            <span className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.22em] text-red-200"><Sparkles size={13} /> TechZone deals</span>
            <h1 className="text-5xl font-black leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"><span className="text-rose-300">Nâng tầm</span><br /><span className="mt-2 inline-block bg-gradient-to-r from-white via-rose-100 to-orange-200 bg-clip-text text-transparent">chất sống số</span></h1>
            <p className="mt-5 max-w-md text-sm leading-6 text-white/65 sm:text-base">Khám phá điện thoại, laptop và phụ kiện công nghệ chính hãng cùng ưu đãi hấp dẫn mỗi ngày.</p>
            <Link to="/products" className="group mt-7 inline-flex w-fit items-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-orange-500 px-6 py-3.5 text-sm font-black text-white shadow-[0_0_30px_rgba(239,68,68,.3)] transition hover:scale-[1.03] hover:shadow-[0_0_42px_rgba(249,115,22,.42)]">Khám phá ngay <ArrowRight size={17} className="transition group-hover:translate-x-1" /></Link>
          </div>
          <div className="absolute bottom-7 right-7 hidden h-28 w-28 flex-col items-center justify-center rounded-full border border-white/20 bg-black/50 shadow-[0_0_40px_rgba(244,63,94,.18)] backdrop-blur-md sm:flex"><span className="text-[10px] font-semibold text-white/60">Ưu đãi đến</span><span className="text-3xl font-black text-white">30%</span></div>
          <div className="hero-orbit absolute -right-24 top-10 -z-10 h-80 w-80 rounded-full border-[30px] border-white/[.06] sm:right-8 sm:h-[360px] sm:w-[360px]" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1">
          <Link to="/products?category=laptop" className="group relative min-h-44 overflow-hidden rounded-[24px] border border-orange-300/25 bg-zinc-950">
            <img src={promotionImages.laptop} alt="" className="absolute inset-0 h-full w-full object-cover opacity-55 transition duration-700 group-hover:scale-105 group-hover:opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/75 to-transparent" />
            <div className="relative flex h-full min-h-44 flex-col justify-center p-6"><span className="text-[10px] font-black uppercase tracking-[.2em] text-orange-200">Laptop & tablet</span><h2 className="mt-2 max-w-[210px] text-xl font-black">Mỏng nhẹ, hiệu năng cao</h2><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-orange-200">Khám phá <ArrowRight size={14} /></span></div>
          </Link>
          <Link to="/products?category=phu-kien" className="group relative min-h-44 overflow-hidden rounded-[24px] border border-cyan-300/25 bg-zinc-950">
            <img src={promotionImages.accessory} alt="" className="absolute inset-0 h-full w-full object-cover opacity-50 transition duration-700 group-hover:scale-105 group-hover:opacity-70" />
            <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/75 to-transparent" />
            <div className="relative flex h-full min-h-44 flex-col justify-center p-6"><span className="text-[10px] font-black uppercase tracking-[.2em] text-cyan-200">Phụ kiện chính hãng</span><h2 className="mt-2 max-w-[210px] text-xl font-black">Nâng cấp góc công nghệ</h2><span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-cyan-200">Mua ngay <ArrowRight size={14} /></span></div>
          </Link>
        </div>
      </section>

      <section aria-label="Danh mục sản phẩm" className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {categories.map(({ label, icon: Icon, slug, color, glow }) => <Link key={slug} to={`/products?category=${slug}`} className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br ${color} px-4 py-4 shadow-lg shadow-black/20 backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-xl ${glow}`}>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-black/30 text-white shadow-[0_0_22px_rgba(255,255,255,.08)]"><Icon size={20} /></span>
          <span className="min-w-0"><span className="block text-[10px] font-medium text-white/50">Khám phá</span><span className="mt-0.5 block truncate text-sm font-extrabold text-white">{label}</span></span>
          <ChevronRight className="ml-auto shrink-0 text-white/50 transition group-hover:translate-x-1 group-hover:text-white" size={17} />
        </Link>)}
      </section>

      <section className="flash-sale-panel mt-8 overflow-hidden rounded-[26px] border border-red-400/30 bg-[#11090d] p-4 shadow-[0_16px_60px_rgba(127,29,29,.16)] sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-3"><span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_0_24px_rgba(239,68,68,.35)]"><Zap size={23} fill="white" /></span><div><h2 className="flash-sale-title text-2xl font-black italic tracking-tight sm:text-3xl">FLASH <span>SALE</span></h2><p className="text-[10px] font-semibold uppercase tracking-[.15em] text-white/45">Giờ vàng giá sốc</p></div></div>
            <div className="flex items-center gap-1.5">{timer.map((part, index) => <span key={index} className="flex items-center gap-1.5"><span className="rounded-lg border border-white/10 bg-black/60 px-2.5 py-2 font-mono text-lg font-black text-white">{part}</span>{index < timer.length - 1 && <span className="font-bold text-red-400">:</span>}</span>)}</div>
          </div>
          <div className="hidden items-center gap-4 xl:flex"><span className="flex items-center gap-2 text-xs font-bold text-white/65"><Truck size={17} className="text-orange-300" /> Giao nhanh</span><span className="flex items-center gap-2 text-xs font-bold text-white/65"><ShieldCheck size={17} className="text-orange-300" /> Bảo hành VIP</span><span className="flex items-center gap-2 text-xs font-bold text-white/65"><WalletCards size={17} className="text-orange-300" /> Trả góp 0%</span></div>
        </div>
        {deals.length > 0
          ? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">{deals.map((product) => <FlashSaleCard key={product.id} product={product} />)}</div>
          : <p className="mt-4 rounded-xl bg-white/5 px-4 py-6 text-center text-sm text-white/50">Chưa có chương trình giảm giá. Xem toàn bộ sản phẩm đang bán.</p>}
      </section>

      {sections.map(({ label, slug, products: sectionProducts }, index) => <ProductSection
        key={slug}
        eyebrow={["Được yêu thích", "Hiệu năng cho mọi nhu cầu", "Giải trí & sáng tạo", "Công nghệ trên cổ tay", "Hoàn thiện trải nghiệm"][index]}
        title={`${label} nổi bật`}
        slug={slug}
        products={sectionProducts}
        accent={["from-fuchsia-500/10", "from-cyan-500/10", "from-violet-500/10", "from-pink-500/10", "from-amber-500/10"][index]}
      />)}

      <section className="mt-14 overflow-hidden rounded-[28px] border border-white/10 bg-gradient-to-r from-zinc-900 via-zinc-900/80 to-red-950/50 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[.22em] text-red-300">Còn nhiều điều để khám phá</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">Khám phá toàn bộ cửa hàng</h2><p className="mt-2 text-sm text-white/55">Duyệt tất cả sản phẩm, thương hiệu và ưu đãi mới nhất tại TechZone.</p></div>
          <Link to="/products" className="group inline-flex w-fit shrink-0 items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-black text-zinc-950 transition hover:bg-red-100">Xem tất cả sản phẩm <ArrowDownRight size={17} className="transition group-hover:translate-x-0.5 group-hover:translate-y-0.5" /></Link>
        </div>
      </section>
    </div>
  </main>;
}
