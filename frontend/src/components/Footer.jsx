import { Link } from "react-router-dom";

export default function Footer() {
  return <footer className="mt-16 bg-zinc-950 text-zinc-300">
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-4">
      <div><div className="text-xl font-black text-white">TECH<span className="text-brand">ZONE</span></div><p className="mt-3 max-w-xs text-sm leading-6 text-zinc-400">Công nghệ chính hãng, giá tốt mỗi ngày. An tâm mua sắm cùng dịch vụ tận tâm.</p></div>
      <div><h3 className="font-bold text-white">Thông tin</h3><div className="mt-4 space-y-2 text-sm text-zinc-400"><p>Giới thiệu TechZone</p><p>Chính sách bảo hành</p><p>Chính sách đổi trả</p></div></div>
      <div><h3 className="font-bold text-white">Hỗ trợ khách hàng</h3><div className="mt-4 space-y-2 text-sm text-zinc-400"><p>Hotline: 1900 2091</p><p>Hướng dẫn mua hàng</p><Link to="/orders" className="block hover:text-white">Theo dõi đơn hàng</Link></div></div>
      <div><h3 className="font-bold text-white">Mua sắm</h3><div className="mt-4 space-y-2 text-sm text-zinc-400"><Link className="block hover:text-white" to="/products">Sản phẩm công nghệ</Link><Link className="block hover:text-white" to="/cart">Giỏ hàng</Link></div></div>
    </div>
    <div className="border-t border-white/10 py-4 text-center text-xs text-zinc-500">© 2026 TechZone. Demo thương mại điện tử.</div>
  </footer>;
}
