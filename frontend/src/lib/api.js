import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "https://alapon-chatting-app.onrender.com/api/v1",
  withCredentials: true
});
