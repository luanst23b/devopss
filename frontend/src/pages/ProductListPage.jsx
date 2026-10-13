import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import ProductCard from "../components/ProductCard.jsx";
import { api } from "../api.js";
import { demoProducts } from "../data/demoProducts.js";
import { normalizeText, slugify } from "../utils/text.js";
const PAGE_SIZE = 12;

export default function ProductListPage() {
  const [params, setParams] = useSearchParams();
  const [items, setItems] = useState(demoProducts);
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("featured");
  const [brand, setBrand] = useState(params.get("brand") || "");
  const [minPrice, setMinPrice] = useState(params.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") || "");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const query = params.get("q") || "";
  const category = params.get("category") || "";
  const brands = [...new Set(demoProducts.map((product) => product.brandName))].sort();

  useEffect(() => {
    let active = true;
    setVisibleCount(PAGE_SIZE);
    const search = new URLSearchParams({ limit: "48" });
    if (query) search.set("q", query);
    if (category) search.set("category", category);
    if (brand) search.set("brand", brand);
    if (minPrice) search.set("minPrice", minPrice);
    if (maxPrice) search.set("maxPrice", maxPrice);
    if (sort !== "featured") search.set("sort", sort);
    api(`/products?${search}`)
      .then((result) => { if (active) { setItems(result.items); setStatus(""); } })
      .catch((error) => {
        if (active) {
          const filtered = demoProducts.filter((product) =>
            (!query || normalizeText(product.name).includes(normalizeText(query))) &&
            (!category || slugify(product.categoryName || "") === slugify(category)) &&
            (!brand || slugify(product.brandName || "") === slugify(brand)) &&
            (!minPrice || (product.salePrice || product.price) >= Number(minPrice)) &&
            (!maxPrice || (product.salePrice || product.price) <= Number(maxPrice)),
          );
          if (sort === "price-asc") filtered.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
          if (sort === "price-desc") filtered.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
          setItems(filtered);
          setStatus(`${error.message} Đang hiển thị ${filtered.length} sản phẩm minh họa; hãy kiểm tra backend và SQL Server để tải kho hàng thật.`);
        }
      });
    return () => { active = false; };
  }, [query, category, brand, minPrice, maxPrice, sort]);

  function updateFilters(event) {
    event.preventDefault();
    setParams({
      ...(query ? { q: query } : {}),
      ...(category ? { category } : {}),
      ...(brand ? { brand } : {}),
      ...(minPrice ? { minPrice } : {}),
      ...(maxPrice ? { maxPrice } : {}),
    });
  }

  const visibleItems = items.slice(0, visibleCount);

  return <main className="mx-auto min-h-[45vh] max-w-7xl px-4 py-8">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-sm text-zinc-500">Trang chủ / Sản phẩm</p><h1 className="mt-2 text-3xl font-black">{query ? `Kết quả: “${query}”` : "Sản phẩm công nghệ"}</h1><p className="mt-2 text-sm text-zinc-500">{items.length} sản phẩm · Điện thoại, laptop, tablet, đồng hồ và phụ kiện chính hãng</p></div>
      <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"><option value="featured">Nổi bật</option><option value="price-asc">Giá tăng dần</option><option value="price-desc">Giá giảm dần</option></select>
    </div>
    {status && <p role="status" className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{status}</p>}
    <form onSubmit={updateFilters} className="mt-5 grid gap-3 rounded-2xl bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
      <label className="text-xs font-semibold text-zinc-500">Hãng sản xuất<select value={brand} onChange={(event) => setBrand(event.target.value)} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900"><option value="">Tất cả thương hiệu</option>{brands.map((name) => <option key={name} value={slugify(name)}>{name}</option>)}</select></label>
      <label className="text-xs font-semibold text-zinc-500">Giá từ (₫)<input type="number" min="0" value={minPrice} onChange={(event) => setMinPrice(event.target.value)} placeholder="0" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900" /></label>
      <label className="text-xs font-semibold text-zinc-500">Giá đến (₫)<input type="number" min="0" value={maxPrice} onChange={(event) => setMaxPrice(event.target.value)} placeholder="Không giới hạn" className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-sm text-zinc-900" /></label>
      <label className="text-xs font-semibold text-zinc-500">Danh mục<select value={category} onChange={(event) => setParams({ ...(event.target.value ? { category: event.target.value } : {}), ...(query ? { q: query } : {}) })} className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900"><option value="">Tất cả danh mục</option>{["Điện thoại", "Laptop", "Tablet", "Đồng hồ", "Phụ kiện"].map((name) => <option key={name} value={slugify(name)}>{name}</option>)}</select></label>
      <button className="self-end rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-white hover:bg-red-700">Lọc sản phẩm</button>
    </form>
    {items.length ? <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">{visibleItems.map((product) => <ProductCard key={product.id} product={product} />)}</div> : <div className="mt-10 rounded-2xl bg-white p-10 text-center text-zinc-500">Không tìm thấy sản phẩm phù hợp. Hãy đổi bộ lọc hoặc khoảng giá.</div>}
    {items.length > visibleCount && <div className="mt-7 text-center"><button onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-xl border border-zinc-300 bg-white px-6 py-3 text-sm font-bold hover:border-brand hover:text-brand">Xem thêm {Math.min(PAGE_SIZE, items.length - visibleCount)} sản phẩm</button></div>}
    <div className="mt-8 flex flex-wrap gap-2">{["Tất cả", "Điện thoại", "Laptop", "Tablet", "Đồng hồ", "Phụ kiện"].map((label) => <button key={label} onClick={() => setParams(label === "Tất cả" ? {} : { category: slugify(label), ...(query ? { q: query } : {}) })} className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm hover:border-brand hover:text-brand">{label}</button>)}</div>
  </main>;
}
