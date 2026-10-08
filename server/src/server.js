import "dotenv/config";
import app from "./app.js";
import { connectDatabase } from "./config/db.js";

const port = Number(process.env.PORT) || 5000;

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be configured with at least 32 characters.");
}

try {
  await connectDatabase(process.env.MONGODB_URI);
  app.listen(port, () => {
    console.info(`Harvest Hub API listening on port ${port}.`);
  });
} catch (error) {
  console.error("Unable to start the API:", error.message);
  process.exitCode = 1;
}
