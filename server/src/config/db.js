import mongoose from "mongoose";

export async function connectDatabase(uri) {
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  await mongoose.connect(uri);
  const orders = mongoose.connection.collection("orders");
  let indexes;
  try {
    indexes = await orders.indexes();
  } catch (error) {
    if (error.code !== 26 && error.codeName !== "NamespaceNotFound") throw error;
    indexes = [];
  }
  const legacyPaymentIndex = indexes.find(
    (index) => index.unique && index.key?.razorpayOrderId,
  );
  if (legacyPaymentIndex) {
    await orders.dropIndex(legacyPaymentIndex.name);
    console.info("Removed obsolete Razorpay order index.");
  }
  console.info("Connected to MongoDB.");
}
