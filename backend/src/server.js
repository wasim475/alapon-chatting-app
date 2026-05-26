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

const clientOrigin = normalizeOrigin(process.env.CLIENT_URL);

const io = new Server(server, {
  cors: {
    origin: clientOrigin,
    credentials: true
  }
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
