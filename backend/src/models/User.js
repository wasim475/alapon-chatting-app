import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import validator from "validator";

const profileSchema = new mongoose.Schema(
  {
    avatar: { type: String, default: "" },
    coverPhoto: { type: String, default: "" },
    bio: { type: String, maxlength: 240, default: "" },
    work: { type: String, maxlength: 120, default: "" },
    education: { type: String, maxlength: 120, default: "" },
    location: { type: String, maxlength: 120, default: "" },
    website: { type: String, default: "" },
  },
  { _id: false },
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      maxlength: 80,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      validate: [validator.isEmail, "Please provide a valid email"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: 8,
      select: false,
    },
    profile: { type: profileSchema, default: () => ({}) },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    blockedUsers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    role: { type: String, enum: ["user", "admin"], default: "user" },
    isVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    passwordChangedAt: { type: Date, select: false },
    passwordResetToken: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
  },
  { timestamps: true },
);

userSchema.index({ name: "text", email: "text" });

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeObject = function toSafeObject() {
  const user = this.toObject();
  delete user.password;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  return user;
};

export default mongoose.model("User", userSchema);
