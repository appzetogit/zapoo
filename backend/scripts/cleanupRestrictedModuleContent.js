import dotenv from "dotenv";
import mongoose from "mongoose";
import RefundPolicy from "../modules/admin/models/RefundPolicy.js";
import ShippingPolicy from "../modules/admin/models/ShippingPolicy.js";
import CancellationPolicy from "../modules/admin/models/CancellationPolicy.js";
import CodeOfConduct from "../modules/admin/models/CodeOfConduct.js";

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
if (!uri) {
  console.error("Missing MongoDB URI. Set MONGODB_URI in backend/.env");
  process.exit(1);
}

async function removeDisallowedModules(Model, name, allowedModules) {
  const deleteResult = await Model.deleteMany({
    targetModule: { $nin: allowedModules },
  });
  console.log(
    `[cleanup] ${name}: removed ${deleteResult.deletedCount} disallowed document(s)`,
  );
}

async function run() {
  await mongoose.connect(uri);
  console.log("[cleanup] connected to MongoDB");

  await removeDisallowedModules(RefundPolicy, "RefundPolicy", ["user"]);
  await removeDisallowedModules(ShippingPolicy, "ShippingPolicy", ["user"]);
  await removeDisallowedModules(CancellationPolicy, "CancellationPolicy", ["user"]);
  await removeDisallowedModules(CodeOfConduct, "CodeOfConduct", ["restaurant"]);

  await mongoose.disconnect();
  console.log("[cleanup] done");
}

run().catch(async (error) => {
  console.error("[cleanup] failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});

