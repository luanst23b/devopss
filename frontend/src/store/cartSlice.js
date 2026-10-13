import { createSlice } from "@reduxjs/toolkit";

const storedItems = (() => {
  try {
    return JSON.parse(localStorage.getItem("techzone-cart") || "[]");
  } catch {
    return [];
  }
})();

const cartSlice = createSlice({
  name: "cart",
  initialState: { items: storedItems },
  reducers: {
    addToCart(state, action) {
      const product = action.payload;
      const key = `${product.id}-${product.variantId || "base"}`;
      const existing = state.items.find((item) => item.key === key);
      if (existing) existing.quantity = Math.min(existing.quantity + 1, 20);
      else state.items.push({ ...product, key, quantity: 1 });
      localStorage.setItem("techzone-cart", JSON.stringify(state.items));
    },
    setQuantity(state, action) {
      const item = state.items.find((entry) => entry.key === action.payload.key);
      if (item) item.quantity = Math.max(1, Math.min(20, action.payload.quantity));
      localStorage.setItem("techzone-cart", JSON.stringify(state.items));
    },
    removeFromCart(state, action) {
      state.items = state.items.filter((item) => item.key !== action.payload);
      localStorage.setItem("techzone-cart", JSON.stringify(state.items));
    },
    clearCart(state) {
      state.items = [];
      localStorage.removeItem("techzone-cart");
    },
  },
});

export const { addToCart, setQuantity, removeFromCart, clearCart } = cartSlice.actions;
export const selectCartCount = (state) => state.cart.items.reduce((sum, item) => sum + item.quantity, 0);
export const selectCartTotal = (state) => state.cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0);
export default cartSlice.reducer;
