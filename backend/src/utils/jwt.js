import jwt from "jsonwebtoken";

export const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });

export const sendAuthCookie = (res, token) => {
  const days = Number(process.env.COOKIE_EXPIRES_DAYS || 7);

  res.cookie("jwt", token, {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax"
  });
};
