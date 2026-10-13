import { Heart, ShoppingCart } from "lucide-react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addOrRequireLogin } from "../utils/cartAuth.js";

const currency = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);

export default function ProductCard({ product }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const token = useSelector((state) => state.auth.token);
  const discount = product.salePrice ? Math.round((1 - product.salePrice / product.price) * 100) : 0;

  return (
    <article className="product-card group relative flex flex-col rounded-2xl border border-zinc-100 bg-white p-3 shadow-card">
      {discount > 0 && <span className="sale-badge absolute left-3 top-3 z-10 rounded-full bg-brand px-2.5 py-1 text-xs font-bold text-white">-{discount}%</span>}
      <button aria-label="Thêm vào yêu thích" className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-zinc-500 hover:text-brand"><Heart size={17} /></button>
      <Link to={`/product/${product.id}`} className="product-image flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-zinc-50">
        <img src={product.image} alt={product.name} className="h-full w-full object-contain p-4 transition duration-300 group-hover:scale-105" loading="lazy" />
      </Link>
      <div className="flex flex-1 flex-col pt-3">
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand">{product.brandName || product.categoryName}</p>
        <Link to={`/product/${product.id}`} className="line-clamp-2 min-h-11 text-sm font-semibold leading-5 text-ink hover:text-brand">{product.name}</Link>
        {product.shortDescription && <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-4 text-zinc-500">{product.shortDescription}</p>}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-base font-extrabold text-brand">{currency(product.salePrice || product.price)}</span>
        </div>
        {product.salePrice && <span className="text-xs text-zinc-400 line-through">{currency(product.price)}</span>}
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className={`text-xs font-medium ${product.stockQuantity > 0 ? "text-green-700" : "text-zinc-400"}`}>{product.stockQuantity > 0 ? "Còn hàng" : "Hết hàng"}</span>
          <button disabled={product.stockQuantity <= 0} aria-label={`Thêm ${product.name} vào giỏ`} onClick={() => addOrRequireLogin({ product: { ...product, price: product.salePrice || product.price }, token, dispatch, navigate })} className="rounded-xl bg-red-50 p-2.5 text-brand transition hover:bg-brand hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><ShoppingCart size={17} /></button>
        </div>
      </div>
    </article>
  );
}
