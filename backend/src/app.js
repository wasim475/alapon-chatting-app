import cookieParser from "cookie-parser";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import mongoSanitize from "express-mongo-sanitize";
import helmet from "helmet";
import hpp from "hpp";
import morgan from "morgan";
import xss from "xss-clean";
import { errorHandler, notFound } from "./middleware/errorMiddleware.js";
import { apiLimiter } from "./middleware/rateLimiter.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import friendRoutes from "./routes/friendRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import postRoutes from "./routes/postRoutes.js";
import userRoutes from "./routes/userRoutes.js";

dotenv.config();

const app = express();

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

app.use(helmet());
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(cookieParser());
app.use(mongoSanitize());
app.use(xss());
app.use(hpp());
app.use(apiLimiter);

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "alapon-api" });
});

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/friends", friendRoutes);
app.use("/api/v1/posts", postRoutes);
app.use("/api/v1/chats", chatRoutes);
app.use("/api/v1/notifications", notificationRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
