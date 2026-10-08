import express from "express";
import cors from "cors";
import helmet from "helmet";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.js";
import productRoutes from "./routes/products.js";
import orderRoutes from "./routes/orders.js";
import { errorHandler, notFound } from "./middleware/errors.js";

const app = express();
const clientDist = resolve(dirname(fileURLToPath(import.meta.url)), "../../client/dist");

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "https://images.unsplash.com"],
      },
    },
  }),
);
app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "20kb" }));

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api", notFound);
app.use(express.static(clientDist, { index: false }));
app.get(/.*/, (req, res, next) => {
  if (!req.accepts("html")) {
    return notFound(req, res);
  }
  return res.sendFile(resolve(clientDist, "index.html"), (error) => {
    if (error) next(error);
  });
});
app.use(errorHandler);

export default app;
