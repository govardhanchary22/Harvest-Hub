import { Router } from "express";
import Product, { PRODUCT_CATEGORIES } from "../models/Product.js";
import { authenticate, requireFarmer } from "../middleware/auth.js";

const router = Router();

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function productInput(body) {
  const { name, category, description, quantity, unit, price, location } = body;
  if (
    typeof name !== "string" ||
    !name.trim() ||
    typeof category !== "string" ||
    !PRODUCT_CATEGORIES.includes(category) ||
    typeof unit !== "string" ||
    !unit.trim() ||
    typeof location !== "string" ||
    !location.trim() ||
    !Number.isFinite(Number(quantity)) ||
    Number(quantity) <= 0 ||
    !Number.isFinite(Number(price)) ||
    Number(price) <= 0 ||
    (description !== undefined && typeof description !== "string")
  ) {
    return null;
  }
  return {
    name: name.trim(),
    category,
    description: (description ?? "").trim(),
    quantity: Number(quantity),
    unit: unit.trim(),
    price: Number(price),
    location: location.trim(),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { search, category, location } = req.query;
    const filter = {};
    if (category && PRODUCT_CATEGORIES.includes(category)) {
      filter.category = category;
    }
    if (typeof search === "string" && search.trim()) {
      const term = new RegExp(escapeRegex(search.trim().slice(0, 80)), "i");
      filter.$or = [{ name: term }, { description: term }, { category: term }];
    }
    if (typeof location === "string" && location.trim()) {
      filter.location = new RegExp(escapeRegex(location.trim().slice(0, 80)), "i");
    }
    const products = await Product.find(filter)
      .populate("farmer", "name upiId")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
});

router.get("/mine", authenticate, requireFarmer, async (req, res, next) => {
  try {
    const products = await Product.find({ farmer: req.user.id })
      .populate("farmer", "name upiId")
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ products });
  } catch (error) {
    return next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id).populate("farmer", "name upiId").lean();
    if (!product) {
      return res.status(404).json({ message: "Product not found." });
    }
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

router.post("/", authenticate, requireFarmer, async (req, res, next) => {
  try {
    const input = productInput(req.body);
    if (!input) {
      return res.status(400).json({ message: "Enter a valid product, quantity, price, and location." });
    }
    const product = await Product.create({ ...input, farmer: req.user.id });
    await product.populate("farmer", "name upiId");
    return res.status(201).json({ product });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", authenticate, requireFarmer, async (req, res, next) => {
  try {
    const input = productInput(req.body);
    if (!input) {
      return res.status(400).json({ message: "Enter a valid product, quantity, price, and location." });
    }
    const product = await Product.findOneAndUpdate(
      { _id: req.params.id, farmer: req.user.id },
      input,
      { new: true, runValidators: true },
    ).populate("farmer", "name upiId");
    if (!product) {
      return res.status(404).json({ message: "Listing not found or you do not own it." });
    }
    return res.json({ product });
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", authenticate, requireFarmer, async (req, res, next) => {
  try {
    const product = await Product.findOneAndDelete({
      _id: req.params.id,
      farmer: req.user.id,
    });
    if (!product) {
      return res.status(404).json({ message: "Listing not found or you do not own it." });
    }
    return res.status(204).end();
  } catch (error) {
    return next(error);
  }
});

export default router;
