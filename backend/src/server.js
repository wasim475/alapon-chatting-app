import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { registerSocketHandlers } from "./socket/index.js";

dotenv.config();
 
const port = process.env.PORT || 5000;
const server = http.createServer(app);

const normalizeOrigin = (value) =>
  typeof value === "string" ? value.replace(/\/+$/, "") : value;

const allowedOrigins = [
  ...(process.env.CLIENT_URL || "")
    .split(",")
    .map(normalizeOrigin)
    .filter(Boolean),
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

app.set("io", io);
registerSocketHandlers(io);

connectDB()
  .then(() => {
    server.listen(port, () => {
      console.log(`API running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database connection failed", error);
    process.exit(1);
  });
