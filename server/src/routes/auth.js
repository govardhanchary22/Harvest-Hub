import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import User from "../models/User.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many sign-in attempts. Please try again later." },
});

function createToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

function userResponse(user, token) {
  return {
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      upiId: user.role === "farmer" ? user.upiId || "" : undefined,
    },
  };
}

router.post("/register", authLimiter, async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (
      typeof name !== "string" ||
      name.trim().length < 2 ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" ||
      password.length < 8 ||
      !["farmer", "customer"].includes(role)
    ) {
      return res.status(400).json({
        message: "Enter a name, valid email, password of at least 8 characters, and account type.",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (await User.exists({ email: normalizedEmail })) {
      return res.status(409).json({ message: "An account with this email already exists." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role,
    });
    return res.status(201).json(userResponse(user, createToken(user)));
  } catch (error) {
    return next(error);
  }
});

router.post("/login", authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({ message: "Enter your email and password." });
    }

    const user = await User.findOne({ email: email.trim().toLowerCase() }).select("+passwordHash");
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: "Email or password is incorrect." });
    }

    return res.json(userResponse(user, createToken(user)));
  } catch (error) {
    return next(error);
  }
});

router.get("/me", authenticate, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      upiId: req.user.role === "farmer" ? req.user.upiId || "" : undefined,
    },
  });
});

router.put("/farmer-payment", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "farmer") {
      return res.status(403).json({ message: "Only farmers can update payment details." });
    }

    const { upiId } = req.body;
    if (
      typeof upiId !== "string" ||
      upiId.length > 100 ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._-]{1,63}@[a-zA-Z][a-zA-Z0-9]{1,31}$/.test(upiId.trim())
    ) {
      return res.status(400).json({ message: "Enter a valid UPI ID, such as farmer@upi." });
    }

    req.user.upiId = upiId.trim().toLowerCase();
    await req.user.save();
    return res.json({ user: { id: req.user.id, upiId: req.user.upiId } });
  } catch (error) {
    return next(error);
  }
});

export default router;
