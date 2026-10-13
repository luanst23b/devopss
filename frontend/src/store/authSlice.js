import { createSlice } from "@reduxjs/toolkit";

function readUser() {
  try {
    return JSON.parse(localStorage.getItem("techzone-user") || "null");
  } catch {
    return null;
  }
}

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: localStorage.getItem("techzone-token"),
    user: readUser(),
  },
  reducers: {
    setSession(state, action) {
      state.token = action.payload.token;
      state.user = action.payload.user;
      localStorage.setItem("techzone-token", state.token);
      localStorage.setItem("techzone-user", JSON.stringify(state.user));
    },
    signOut(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem("techzone-token");
      localStorage.removeItem("techzone-user");
    },
  },
});

export const { setSession, signOut } = authSlice.actions;
export default authSlice.reducer;
