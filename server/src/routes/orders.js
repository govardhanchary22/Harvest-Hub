import { Router } from "express";
import mongoose from "mongoose";
import rateLimit from "express-rate-limit";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many order attempts. Please try again later." },
});

function customerOnly(req, res, next) {
  if (req.user.role !== "customer") {
    return res.status(403).json({ message: "Only customer accounts can place orders." });
  }
  return next();
}

function farmerOnly(req, res, next) {
  if (req.user.role !== "farmer") {
    return res.status(403).json({ message: "Only farmer accounts can manage customer orders." });
  }
  return next();
}

function serializeOrder(order) {
  return {
    id: order.id || order._id?.toString(),
    productName: order.productName,
    category: order.category,
    location: order.location,
    quantity: order.quantity,
    unit: order.unit,
    unitPricePaise: order.unitPricePaise,
    amountPaise: order.amountPaise,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    transactionReference: order.transactionReference,
    paymentSubmittedAt: order.paymentSubmittedAt,
    stockFulfilled: order.stockFulfilled,
    notificationReadAt: order.notificationReadAt,
    createdAt: order.createdAt,
    customer: order.customer,
  };
}

router.use(authenticate);

router.post("/", orderLimiter, customerOnly, async (req, res, next) => {
  try {
    const { productId, quantity } = req.body;
    const parsedQuantity = Number(quantity);
    if (
      typeof productId !== "string" ||
      !mongoose.isValidObjectId(productId) ||
      !Number.isFinite(parsedQuantity) ||
      parsedQuantity <= 0 ||
      Math.round(parsedQuantity * 100) !== parsedQuantity * 100
    ) {
      return res.status(400).json({ message: "Choose a valid product quantity." });
    }

    const product = await Product.findById(productId).populate("farmer", "name upiId");
    if (!product || !product.farmer) {
      return res.status(404).json({ message: "This listing is no longer available." });
    }
    if (product.farmer.id === req.user.id) {
      return res.status(400).json({ message: "You cannot order from your own listing." });
    }
    if (!product.farmer.upiId) {
      return res.status(409).json({ message: "This farmer has not set up UPI payments yet." });
    }
    if (product.quantity <= 0 || parsedQuantity > product.quantity) {
      return res.status(409).json({ message: "There is not enough stock for that quantity." });
    }

    const unitPricePaise = Math.round(product.price * 100);
    const amountPaise = Math.round(unitPricePaise * parsedQuantity);
    if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
      return res.status(400).json({ message: "This listing has an invalid price." });
    }

    const order = await Order.create({
      customer: req.user.id,
      farmer: product.farmer.id,
      product: product.id,
      productName: product.name,
      category: product.category,
      unit: product.unit,
      location: product.location,
      quantity: parsedQuantity,
      unitPricePaise,
      amountPaise,
      farmerUpiId: product.farmer.upiId,
      paymentStatus: "awaiting_payment",
    });

    return res.status(201).json({
      orderId: order.id,
      productName: order.productName,
      farmerName: product.farmer.name,
      farmerUpiId: order.farmerUpiId,
      quantity: order.quantity,
      unit: order.unit,
      amountPaise: order.amountPaise,
      currency: order.currency,
      paymentStatus: order.paymentStatus,
    });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/payment-submitted", customerOnly, async (req, res, next) => {
  try {
    const { transactionReference } = req.body;
    if (
      transactionReference !== undefined &&
      (typeof transactionReference !== "string" ||
        transactionReference.trim().length < 4 ||
        transactionReference.trim().length > 64 ||
        !/^[a-zA-Z0-9-]+$/.test(transactionReference.trim()))
    ) {
      return res.status(400).json({ message: "Enter a valid UPI transaction reference, or leave it blank." });
    }

    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        customer: req.user.id,
        paymentStatus: "awaiting_payment",
      },
      {
        $set: {
          paymentStatus: "awaiting_confirmation",
          transactionReference: transactionReference?.trim() || null,
          paymentSubmittedAt: new Date(),
          notificationReadAt: null,
        },
      },
      { new: true, runValidators: true },
    );
    if (!order) {
      return res.status(404).json({ message: "Pending UPI order not found." });
    }
    return res.json({ order: serializeOrder(order) });
  } catch (error) {
    return next(error);
  }
});

router.post("/:id/cancel", customerOnly, async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        customer: req.user.id,
        paymentStatus: { $in: ["awaiting_payment", "awaiting_confirmation"] },
      },
      { $set: { paymentStatus: "cancelled" } },
      { new: true },
    );
    if (!order) {
      return res.status(404).json({ message: "Open UPI order not found." });
    }
    return res.json({ cancelled: true });
  } catch (error) {
    return next(error);
  }
});

router.get("/farmer", farmerOnly, async (req, res, next) => {
  try {
    const orders = await Order.find({
      farmer: req.user.id,
      paymentStatus: { $in: ["awaiting_payment", "awaiting_confirmation", "paid", "rejected"] },
    })
      .populate("customer", "name email")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    return res.json({
      orders: orders.map((order) => ({
        ...serializeOrder(order),
        customer: order.customer
          ? { id: order.customer._id, name: order.customer.name, email: order.customer.email }
          : { id: null, name: "Deleted account", email: "" },
      })),
    });
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/status", farmerOnly, async (req, res, next) => {
  try {
    const { status } = req.body;
    if (!["paid", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Choose whether to confirm or reject this order." });
    }

    const order = await Order.findOne({
      _id: req.params.id,
      farmer: req.user.id,
      paymentStatus: "awaiting_confirmation",
    });
    if (!order) {
      return res.status(404).json({ message: "No customer payment report is waiting for confirmation." });
    }

    if (status === "rejected") {
      const rejected = await Order.findOneAndUpdate(
        { _id: order.id, farmer: req.user.id, paymentStatus: "awaiting_confirmation" },
        { $set: { paymentStatus: "rejected" } },
        { new: true },
      );
      if (!rejected) {
        return res.status(409).json({ message: "This order was already updated." });
      }
      return res.json({ order: serializeOrder(rejected) });
    }

    const claimedOrder = await Order.findOneAndUpdate(
      { _id: order.id, farmer: req.user.id, paymentStatus: "awaiting_confirmation" },
      { $set: { paymentStatus: "processing" } },
      { new: true },
    );
    if (!claimedOrder) {
      return res.status(409).json({ message: "This order is already being updated." });
    }

    let updatedProduct;
    try {
      updatedProduct = await Product.findOneAndUpdate(
        { _id: claimedOrder.product, quantity: { $gte: claimedOrder.quantity } },
        { $inc: { quantity: -claimedOrder.quantity } },
        { new: true },
      );
      const paidOrder = await Order.findOneAndUpdate(
        { _id: claimedOrder.id, farmer: req.user.id, paymentStatus: "processing" },
        { $set: { paymentStatus: "paid", stockFulfilled: Boolean(updatedProduct) } },
        { new: true },
      );
      if (!paidOrder) {
        if (updatedProduct) {
          await Product.updateOne(
            { _id: updatedProduct.id },
            { $inc: { quantity: claimedOrder.quantity } },
          );
        }
        return res.status(409).json({ message: "This order could not be confirmed. Please retry." });
      }
      return res.json({ order: serializeOrder(paidOrder) });
    } catch (error) {
      if (updatedProduct) {
        await Product.updateOne(
          { _id: updatedProduct.id },
          { $inc: { quantity: claimedOrder.quantity } },
        );
      }
      await Order.updateOne(
        { _id: claimedOrder.id, farmer: req.user.id, paymentStatus: "processing" },
        { $set: { paymentStatus: "awaiting_confirmation" } },
      );
      throw error;
    }
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id/read", farmerOnly, async (req, res, next) => {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        farmer: req.user.id,
        paymentStatus: { $in: ["awaiting_payment", "awaiting_confirmation", "paid", "rejected"] },
      },
      { $set: { notificationReadAt: new Date() } },
      { new: true },
    );
    if (!order) {
      return res.status(404).json({ message: "Customer order not found." });
    }
    return res.json({ notificationReadAt: order.notificationReadAt });
  } catch (error) {
    return next(error);
  }
});

export default router;
