import mongoose from "mongoose";

export const PRODUCT_CATEGORIES = [
  "Vegetables",
  "Fruits",
  "Grains",
  "Dairy",
  "Herbs",
  "Other",
];

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    category: { type: String, enum: PRODUCT_CATEGORIES, required: true },
    description: { type: String, trim: true, maxlength: 500, default: "" },
    quantity: { type: Number, required: true, min: 0.01 },
    unit: { type: String, required: true, trim: true, maxlength: 24 },
    price: { type: Number, required: true, min: 0.01 },
    location: { type: String, required: true, trim: true, maxlength: 120 },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
  },
  { timestamps: true },
);

productSchema.index({ category: 1, createdAt: -1 });

export default mongoose.model("Product", productSchema);
