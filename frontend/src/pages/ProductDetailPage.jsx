import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useParams } from "react-router-dom";
import { Check, Minus, Plus, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import { api } from "../api.js";
import { demoProducts } from "../data/demoProducts.js";
import { addOrRequireLogin } from "../utils/cartAuth.js";

const currency = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);

export default function ProductDetailPage() {
  const { id } = useParams();
  const dispatch = useDispatch();
  const token = useSelector((state) => state.auth.token);
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [imageIndex, setImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [variant, setVariant] = useState(null);

  useEffect(() => {
    let active = true;
    api(`/products/${id}`).then(({ product: value }) => { if (active) setProduct(value); }).catch((apiError) => {
      const demo = demoProducts.find((item) => String(item.id) === id);
      const demoVariants = {
        1: [
          { id: "demo-iphone-natural", color: "Titan tự nhiên", storage: "256GB", priceAdjustment: 0, stockQuantity: 8 },
          { id: "demo-iphone-black", color: "Titan đen", storage: "256GB", priceAdjustment: 0, stockQuantity: 6 },
        ],
        2: [
          { id: "demo-samsung-gray", color: "Titanium Gray", storage: "256GB", priceAdjustment: 0, stockQuantity: 9 },
        ],
      };
      if (active && demo) setProduct({
        ...demo,
        images: [{ url: demo.image, alt: demo.name }],
        variants: demoVariants[demo.id] || [],
      });
      else if (active) setError(apiError.message);
    });
    return () => { active = false; };
  }, [id]);

  if (error) return <main className="mx-auto max-w-7xl px-4 py-16 text-center text-zinc-600">{error}</main>;
  if (!product) return <main className="mx-auto max-w-7xl px-4 py-16 text-center text-zinc-500">Đang tải sản phẩm...</main>;

  const currentImage = product.images?.[imageIndex]?.url || product.image;
  const currentPrice = (product.salePrice || product.price) + (variant?.priceAdjustment || 0);
  const availableStock = variant?.stockQuantity ?? product.stockQuantity;
  const highlights = product.features?.length
    ? product.features
    : Object.entries(product.specifications || {}).slice(0, 4).map(([name, value]) => `${name}: ${value}`);
  const cartProduct = { ...product, price: currentPrice, variantId: variant?.id || null, variantLabel: variant ? [variant.color, variant.storage].filter(Boolean).join(" · ") : "" };

  function add(buyNow = false) {
    if (availableStock <= 0) {
      setNotice("Sản phẩm hiện đã hết hàng.");
      return;
    }
    if (product.variants?.length > 0 && !variant) {
      setNotice("Vui lòng chọn phiên bản sản phẩm trước khi mua.");
      return;
    }
    if (quantity > availableStock) {
      setNotice(`Chỉ còn ${availableStock} sản phẩm trong kho.`);
      return;
    }
    setNotice("");
    addOrRequireLogin({ product: cartProduct, quantity, buyNow, token, dispatch, navigate });
  }

  return <main className="mx-auto max-w-7xl px-4 py-7">
    <p className="mb-5 text-sm text-zinc-500">Trang chủ / {product.categoryName} / <span className="text-zinc-800">{product.name}</span></p>
    <div className="grid gap-8 lg:grid-cols-2">
      <section>
        <div className="flex aspect-square items-center justify-center rounded-3xl bg-white p-8 shadow-card"><img src={currentImage} alt={product.name} className="h-full w-full object-contain" /></div>
        {product.images?.length > 1 && <div className="mt-3 flex gap-3">{product.images.map((image, index) => <button key={image.url} onClick={() => setImageIndex(index)} className={`h-20 w-20 rounded-xl border p-2 ${index === imageIndex ? "border-brand" : "border-zinc-200"}`}><img src={image.url} alt={image.alt || product.name} className="h-full w-full object-contain" /></button>)}</div>}
      </section>
      <section>
        <p className="text-sm font-bold uppercase tracking-wide text-brand">{product.brandName}</p>
        <h1 className="mt-2 text-3xl font-black leading-tight text-zinc-900">{product.name}</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-500">{product.shortDescription || product.description}</p>
        <div className="mt-5 rounded-2xl bg-red-50 p-5">
          <div className="flex items-baseline gap-3"><span className="text-3xl font-black text-brand">{currency(currentPrice)}</span>{product.salePrice && <span className="text-sm text-zinc-400 line-through">{currency(product.price)}</span>}</div>
          <p className={`mt-2 text-xs font-medium ${availableStock > 0 ? "text-green-700" : "text-red-700"}`}><Check size={14} className="mr-1 inline" /> Giá đã bao gồm VAT · {availableStock > 0 ? `Còn ${availableStock} sản phẩm` : "Tạm hết hàng"}</p>
        </div>
        {product.variants?.length > 0 && <div className="mt-5"><h2 className="mb-3 text-sm font-bold">Phiên bản</h2><div className="flex flex-wrap gap-2">{product.variants.map((item) => <button key={item.id} disabled={!item.stockQuantity} onClick={() => { setVariant(item); setNotice(""); }} className={`rounded-xl border px-4 py-3 text-left text-sm disabled:opacity-40 ${variant?.id === item.id ? "border-brand bg-red-50 text-brand" : "border-zinc-200"}`}><span className="block font-semibold">{[item.color, item.storage].filter(Boolean).join(" · ") || item.sku}</span><span className="text-xs">{currency((product.salePrice || product.price) + item.priceAdjustment)}</span></button>)}</div></div>}
        {notice && <p role="alert" className="mt-3 text-sm text-red-600">{notice}</p>}
        <div className="mt-6 flex items-center gap-3"><span className="text-sm font-bold">Số lượng</span><div className="flex items-center rounded-xl border border-zinc-200"><button aria-label="Giảm số lượng" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="p-3"><Minus size={15} /></button><span className="min-w-8 text-center text-sm font-bold">{quantity}</span><button aria-label="Tăng số lượng" onClick={() => setQuantity((value) => Math.min(20, availableStock, value + 1))} className="p-3"><Plus size={15} /></button></div></div>
        <div className="mt-5 grid grid-cols-2 gap-3"><button disabled={availableStock <= 0} onClick={() => add(true)} className="rounded-xl bg-brand px-4 py-4 text-sm font-extrabold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-zinc-400">MUA NGAY</button><button disabled={availableStock <= 0} onClick={() => add()} className="flex items-center justify-center gap-2 rounded-xl border-2 border-brand px-4 py-4 text-sm font-bold text-brand hover:bg-red-50 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:text-zinc-400"><ShoppingCart size={18} /> Thêm giỏ hàng</button></div>
        <div className="mt-6 space-y-3 rounded-2xl border border-zinc-100 bg-white p-4 text-sm text-zinc-600"><p><ShieldCheck className="mr-2 inline text-green-600" size={17} />Chính hãng, bảo hành theo tiêu chuẩn nhà sản xuất</p><p><Truck className="mr-2 inline text-brand" size={17} />Giao hàng nhanh, kiểm tra khi nhận hàng</p></div>
      </section>
    </div>
    <section className="mt-10 rounded-2xl bg-white p-6 shadow-card"><h2 className="text-xl font-black">Thông số kỹ thuật</h2><div className="mt-4 divide-y divide-zinc-100">{Object.entries(product.specifications || {}).map(([key, value]) => <div key={key} className="grid grid-cols-2 gap-3 py-3 text-sm"><span className="text-zinc-500">{key}</span><span className="font-medium text-zinc-900">{String(value)}</span></div>)}</div></section>
    {highlights.length > 0 && <section className="mt-6 rounded-2xl bg-white p-6 shadow-card"><h2 className="text-xl font-black">Thông tin nổi bật</h2><ul className="mt-4 grid gap-3 sm:grid-cols-2">{highlights.map((feature) => <li key={feature} className="text-sm text-zinc-700"><Check className="mr-2 inline text-green-600" size={16} />{feature}</li>)}</ul></section>}
    <section className="mt-6 rounded-2xl bg-white p-6 shadow-card"><h2 className="text-xl font-black">Mô tả sản phẩm</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-zinc-600">{product.description || product.shortDescription}</p></section>
  </main>;
}
