import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    farmer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    productName: { type: String, required: true },
    category: { type: String, required: true },
    unit: { type: String, required: true },
    location: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0.01 },
    unitPricePaise: { type: Number, required: true, min: 1 },
    amountPaise: { type: Number, required: true, min: 1 },
    currency: { type: String, enum: ["INR"], default: "INR" },
    farmerUpiId: { type: String, required: true },
    paymentStatus: {
      type: String,
      enum: ["awaiting_payment", "awaiting_confirmation", "processing", "paid", "rejected", "cancelled"],
      default: "awaiting_payment",
      index: true,
    },
    transactionReference: { type: String, default: null, maxlength: 64 },
    paymentSubmittedAt: { type: Date, default: null },
    notificationReadAt: { type: Date, default: null },
    stockFulfilled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

orderSchema.index({ farmer: 1, paymentStatus: 1, createdAt: -1 });
orderSchema.index({ customer: 1, createdAt: -1 });

export default mongoose.model("Order", orderSchema);
