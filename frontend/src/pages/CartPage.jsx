import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Minus, Plus, Tag, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react"; // Import thư viện tạo QR
import { clearCart, removeFromCart, selectCartTotal, setQuantity } from "../store/cartSlice.js";
import { api } from "../api.js";

const currency = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);

export default function CartPage() {
  const items = useSelector((state) => state.cart.items);
  const total = useSelector(selectCartTotal);
  const token = useSelector((state) => state.auth.token);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  
  const [form, setForm] = useState({ fullName: "", phone: "", address: "", note: "", paymentMethod: "cod" });
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voucherOptions, setVoucherOptions] = useState([]);
  const [voucherCode, setVoucherCode] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherMessage, setVoucherMessage] = useState("");
  const [validatingVoucher, setValidatingVoucher] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(total);

  // State quản lý hiển thị QR Code
  const [qrData, setQrData] = useState(null);

  useEffect(() => {
    let active = true;
    api("/orders/vouchers")
      .then((result) => { if (active) setVoucherOptions(result.items || []); })
      .catch(() => { if (active) setVoucherMessage("Không tải được danh sách voucher. Bạn vẫn có thể nhập mã nếu đã biết."); });
    return () => { active = false; };
  }, []);

  async function applyVoucher(code = voucherCode) {
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setVoucherMessage("Vui lòng nhập mã voucher.");
      return;
    }
    setValidatingVoucher(true);
    setVoucherMessage("");
    try {
      const result = await api("/orders/vouchers/validate", {
        method: "POST",
        body: JSON.stringify({ code: normalizedCode, subtotal: total }),
      });
      setVoucherCode(result.voucher.code);
      setAppliedVoucher(result);
      setVoucherMessage(`Đã áp dụng ${result.voucher.code}, giảm ${currency(result.discount)}.`);
    } catch (error) {
      setAppliedVoucher(null);
      setVoucherMessage(error.message || "Không thể áp dụng voucher.");
    } finally {
      setValidatingVoucher(false);
    }
  }

  const activeVoucher = appliedVoucher?.subtotal === total ? appliedVoucher : null;
  const payableTotal = activeVoucher?.total ?? total;

  async function checkout(event) {
    event.preventDefault();
    if (!token) return navigate("/login?returnTo=%2Fcart");
    setSubmitting(true);
    setMessage("");

    try {
      const result = await api("/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({ productId: item.id, variantId: item.variantId, quantity: item.quantity })),
          shippingAddress: form,
          paymentMethod: form.paymentMethod, 
          voucherCode: activeVoucher?.voucher.code,
        }),
      });

      if (form.paymentMethod === "momo" || form.paymentMethod === "vnpay") {
        // Nếu là thanh toán online, lấy chuỗi dữ liệu (hoặc URL) từ Backend để vẽ QR
        if (result.payment?.checkoutUrl) {
          setPaymentAmount(result.order.total);
          setQrData(result.payment.checkoutUrl);
        } else {
          setMessage("Lỗi: Không lấy được dữ liệu tạo QR từ hệ thống.");
        }
      } else {
        // Nếu là COD, hoàn tất luôn
        dispatch(clearCart());
        setMessage(`Đặt hàng thành công! Mã đơn #${result.order.id}. Shop sẽ liên hệ xác nhận đơn hàng.`);
      }
    } catch (error) {
      setMessage(error.message || "Có lỗi xảy ra khi đặt hàng.");
    } finally {
      setSubmitting(false);
    }
  }

  // Hàm xử lý sau khi người dùng xác nhận đã quét mã xong
  function handlePaymentDone() {
    setQrData(null);
    dispatch(clearCart());
    setMessage("Đã ghi nhận yêu cầu đặt hàng. Hệ thống đang chờ MoMo xác nhận thanh toán của bạn.");
    // Trong thực tế, lúc này Frontend có thể gọi API kiểm tra trạng thái đơn hàng (polling)
    // hoặc đợi Webhook từ MoMo bắn về Backend để tự động cập nhật trạng thái.
  }

  if (!token) return <Navigate to="/login?returnTo=%2Fcart" replace />;

  return (
    <main className="mx-auto min-h-[45vh] max-w-7xl px-4 py-8 relative">
      <h1 className="mb-6 text-3xl font-black">Giỏ hàng của bạn</h1>
      
      {message && (
        <div role="status" className="mb-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          {message}
        </div>
      )}

      {/* --- MODAL HIỂN THỊ MÃ QR THÔNG MINH --- */}
      {qrData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="flex justify-end">
              <button onClick={() => setQrData(null)} className="p-1 text-zinc-400 hover:text-red-500">
                <X size={24} />
              </button>
            </div>
            
            <img 
              src="https://upload.wikimedia.org/wikipedia/vi/f/fe/MoMo_Logo.png" 
              alt="MoMo" 
              className="mx-auto h-12 object-contain mb-4"
            />
            <h3 className="mb-2 text-lg font-bold">Quét mã để thanh toán</h3>
            <p className="mb-6 text-sm text-zinc-500">
              Mở ứng dụng MoMo trên điện thoại và quét mã QR bên dưới.
            </p>
            
            {/* Vẽ mã QR trực tiếp từ dữ liệu payUrl */}
            <div className="mx-auto flex justify-center rounded-2xl border p-4 w-max shadow-inner">
              <QRCodeSVG value={qrData} size={200} />
            </div>

            <p className="mt-4 text-xl font-black text-brand">{currency(paymentAmount)}</p>

            <button 
              onClick={handlePaymentDone}
              className="mt-6 w-full rounded-xl bg-brand py-3 font-bold text-white hover:bg-red-700"
            >
              Tôi đã thanh toán
            </button>
          </div>
        </div>
      )}
      {/* ------------------------------------- */}

      {!items.length ? (
        <div className="rounded-2xl bg-white p-12 text-center shadow-card">
          <p className="text-zinc-500">Giỏ hàng đang trống.</p>
          <Link to="/products" className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 font-bold text-white">
            Tiếp tục mua sắm
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          {/* ... [Phần render danh sách sản phẩm giữ nguyên như cũ] ... */}
          <section className="space-y-3">
            {items.map((item) => (
              <article key={item.key} className="flex gap-4 rounded-2xl bg-white p-4 shadow-card">
                <img src={item.image} alt={item.name} className="h-24 w-24 rounded-xl bg-zinc-50 object-contain p-2" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link to={`/product/${item.id}`} className="line-clamp-2 font-bold hover:text-brand">
                    {item.name}
                  </Link>
                  {item.variantLabel && <span className="mt-1 text-xs text-zinc-500">{item.variantLabel}</span>}
                  <p className="mt-2 font-extrabold text-brand">{currency(item.price)}</p>
                  <div className="mt-auto flex items-center justify-between pt-3">
                    <div className="flex items-center rounded-lg border">
                      <button aria-label="Giảm số lượng" onClick={() => dispatch(setQuantity({ key: item.key, quantity: item.quantity - 1 }))} className="p-2">
                        <Minus size={14} />
                      </button>
                      <span className="min-w-7 text-center text-sm">{item.quantity}</span>
                      <button aria-label="Tăng số lượng" onClick={() => dispatch(setQuantity({ key: item.key, quantity: item.quantity + 1 }))} className="p-2">
                        <Plus size={14} />
                      </button>
                    </div>
                    <button aria-label="Xóa sản phẩm" onClick={() => dispatch(removeFromCart(item.key))} className="text-zinc-400 hover:text-brand">
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </section>

          {/* ... [Phần render Form giao hàng giữ nguyên như cũ] ... */}
          <aside className="h-fit rounded-2xl bg-white p-5 shadow-card">
            <h2 className="text-lg font-black">Thông tin giao hàng</h2>
            <form onSubmit={checkout} className="mt-4 space-y-3">
              {["fullName", "phone", "address"].map((field) => (
                <input 
                  key={field} 
                  required 
                  value={form[field]} 
                  onChange={(event) => setForm({ ...form, [field]: event.target.value })} 
                  placeholder={{ fullName: "Họ và tên người nhận", phone: "Số điện thoại", address: "Địa chỉ giao hàng" }[field]} 
                  className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-brand" 
                />
              ))}
              <textarea 
                value={form.note} 
                onChange={(event) => setForm({ ...form, note: event.target.value })} 
                placeholder="Ghi chú (không bắt buộc)" 
                rows="2" 
                className="w-full rounded-xl border border-zinc-200 px-4 py-3 text-sm outline-none focus:border-brand" 
              />
              
              <div className="space-y-2 pt-2">
                <span className="text-sm font-semibold">Phương thức thanh toán</span>
                <select 
                  value={form.paymentMethod} 
                  onChange={(event) => setForm({ ...form, paymentMethod: event.target.value })} 
                  className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm"
                >
                  <option value="cod">Thanh toán khi nhận hàng (COD)</option>
                  <option value="momo">Thanh toán qua Ví MoMo</option>
                </select>
              </div>

              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="flex items-center gap-2 text-sm font-bold text-zinc-800"><Tag size={16} className="text-amber-600" /> Mã giảm giá</div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={voucherCode}
                    onChange={(event) => setVoucherCode(event.target.value.toUpperCase())}
                    placeholder="Nhập mã voucher"
                    aria-label="Mã voucher"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm uppercase outline-none focus:border-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => applyVoucher()}
                    disabled={validatingVoucher || !voucherCode.trim()}
                    className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-brand disabled:opacity-50"
                  >
                    {validatingVoucher ? "Đang kiểm tra" : activeVoucher ? "Áp dụng lại" : "Áp dụng"}
                  </button>
                </div>
                {voucherOptions.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
                  {voucherOptions.map((voucher) => <button
                    key={voucher.code}
                    type="button"
                    title={voucher.description}
                    onClick={() => { setVoucherCode(voucher.code); applyVoucher(voucher.code); }}
                    className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[10px] font-bold text-amber-800 transition hover:border-amber-400 hover:bg-amber-100"
                  >{voucher.code}</button>)}
                </div>}
                {voucherMessage && <p role="status" className={`mt-2 text-xs ${activeVoucher ? "text-green-700" : "text-zinc-600"}`}>{voucherMessage}</p>}
                {appliedVoucher && !activeVoucher && <p className="mt-2 text-xs font-medium text-amber-800">Giỏ hàng đã thay đổi; hãy áp dụng lại voucher để cập nhật mức giảm.</p>}
              </section>

              <div className="space-y-2 border-t pt-4 text-sm">
                <div className="flex justify-between text-zinc-600"><span>Tạm tính</span><span>{currency(total)}</span></div>
                {activeVoucher && <div className="flex justify-between font-semibold text-green-700"><span>Voucher ({activeVoucher.voucher.code})</span><span>-{currency(activeVoucher.discount)}</span></div>}
                <div className="flex justify-between pt-1">
                  <span className="font-bold text-zinc-900">Tổng thanh toán</span>
                  <span className="text-xl font-black text-brand">{currency(payableTotal)}</span>
                </div>
              </div>
              <button 
                disabled={submitting} 
                className="w-full rounded-xl bg-brand py-4 font-extrabold text-white hover:bg-red-700 disabled:opacity-60"
              >
                {submitting ? "Đang xử lý..." : "ĐẶT HÀNG & THANH TOÁN"}
              </button>
            </form>
          </aside>
        </div>
      )}
    </main>
  );
}