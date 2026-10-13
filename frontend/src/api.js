const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

export async function api(path, options = {}) {
  const token = localStorage.getItem("techzone-token");
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Không thể kết nối API. Hãy kiểm tra backend có đang chạy không.");
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || "Không thể kết nối đến máy chủ.");
  return body;
}
