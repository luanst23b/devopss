import { addToCart } from "../store/cartSlice.js";

const PENDING_CART_KEY = "techzone-pending-cart-intent";

export function safeReturnTo(value, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : fallback;
}

export function addOrRequireLogin({ product, quantity = 1, buyNow = false, token, dispatch, navigate }) {
  if (!token) {
    localStorage.setItem(PENDING_CART_KEY, JSON.stringify({ product, quantity, buyNow }));
    navigate("/login?returnTo=%2Fcart");
    return false;
  }

  for (let index = 0; index < quantity; index += 1) {
    dispatch(addToCart(product));
  }
  if (buyNow) navigate("/cart");
  return true;
}

export function completePendingCartIntent(dispatch) {
  let intent;
  try {
    intent = JSON.parse(localStorage.getItem(PENDING_CART_KEY) || "null");
  } catch {
    localStorage.removeItem(PENDING_CART_KEY);
    return false;
  }
  if (!intent?.product || !Number.isInteger(intent.quantity) || intent.quantity < 1 || intent.quantity > 20) {
    localStorage.removeItem(PENDING_CART_KEY);
    return false;
  }

  localStorage.removeItem(PENDING_CART_KEY);
  for (let index = 0; index < intent.quantity; index += 1) {
    dispatch(addToCart(intent.product));
  }
  return true;
}
