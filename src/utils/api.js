import axios from "axios";

const BASE_URL = "https://whisperbox.koyeb.app";
const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("wb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const register = (username, password, publicKey) =>
  api.post("/auth/register", { username, password, public_key: publicKey });

export const login = (username, password) =>
  api.post("/auth/login", { username, password });

export const getProfile = () => api.get("/auth/me");
export const logout = () => api.post("/auth/logout");

export const searchUsers = (query) =>
  api.get("/users/search", { params: { q: query } });

export const getUserPublicKey = (username) =>
  api.get(`/users/${username}/public-key`);

export const listConversations = () => api.get("/messages/conversations");

export const getConversation = (username) =>
  api.get(`/messages/conversation/${username}`);

export const sendMessage = (recipientUsername, encryptedPayload) =>
  api.post("/messages/send", {
    recipient_username: recipientUsername,
    encrypted_payload: JSON.stringify(encryptedPayload),
  });

export default api;
