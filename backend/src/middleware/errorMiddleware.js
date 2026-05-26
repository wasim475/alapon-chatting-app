import { AppError } from "../utils/AppError.js";

export const notFound = (req, _res, next) => {
  next(new AppError(`Route not found: ${req.originalUrl}`, 404));
};

export const errorHandler = (err, _req, res, _next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    status: err.status || "error",
    message:
      process.env.NODE_ENV === "production" && !err.isOperational
        ? "Something went wrong"
        : err.message
  });
};
