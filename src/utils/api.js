import axios from "axios";

const BASE_URL = "https://whisperbox.koyeb.app";
const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("wb_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const register = (username, password, publicKey) =>
  api.post("/auth/register", {
    username,
    display_name: username,
    password,
    public_key: publicKey,
    wrapped_private_key: "none",
    pbkdf2_salt: "none"
  });

export const login = (username, password) =>
  api.post("/auth/login", { username, password });

export const getProfile = () => api.get("/auth/me");
export const logout = () => api.post("/auth/logout");

export const searchUsers = (query) =>
  api.get("/users/search", { params: { q: query } });

export const getUserPublicKey = (userId) =>
  api.get(`/users/${userId}/public-key`);

export const listConversations = () => api.get("/conversations");

export const getConversation = (userId) =>
  api.get(`/messages/${userId}`);

export const sendMessage = (toUserId, encryptedPayload) =>
  api.post("/messages", {
    to: toUserId,
    payload: {
      ciphertext: encryptedPayload.ciphertext,
      iv: encryptedPayload.iv,
      encryptedKey: encryptedPayload.encrypted_key_for_recipient,
      encryptedKeyForSelf: encryptedPayload.encrypted_key_for_sender,
    }
  });

export default api;
