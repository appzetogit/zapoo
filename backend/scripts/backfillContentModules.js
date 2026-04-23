import dotenv from "dotenv";
import mongoose from "mongoose";
import TermsAndCondition from "../modules/admin/models/TermsAndCondition.js";
import PrivacyPolicy from "../modules/admin/models/PrivacyPolicy.js";
import RefundPolicy from "../modules/admin/models/RefundPolicy.js";
import ShippingPolicy from "../modules/admin/models/ShippingPolicy.js";
import CancellationPolicy from "../modules/admin/models/CancellationPolicy.js";
import About from "../modules/admin/models/About.js";
import CodeOfConduct from "../modules/admin/models/CodeOfConduct.js";
import { toLocalizedText } from "../shared/i18n/localizedText.js";
import {
  CONTENT_MODULES,
  DEFAULT_CONTENT_MODULE,
} from "../modules/admin/constants/contentModules.js";

dotenv.config();

const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.DB_URI;
if (!uri) {
  console.error("Missing MongoDB URI. Set MONGODB_URI in backend/.env");
  process.exit(1);
}

const TARGET_MODULES = CONTENT_MODULES.filter((module) => module !== DEFAULT_CONTENT_MODULE);

function emptyPolicyPayload(title, content, targetModule) {
  return {
    title,
    localizedTitle: toLocalizedText(title, title),
    content,
    localizedContent: toLocalizedText(content, ""),
    targetModule,
    isActive: true,
  };
}

async function ensurePolicyDocs(Model, { title, content, name, modules = TARGET_MODULES }) {
  const normalizeResult = await Model.updateMany(
    {
      $or: [{ targetModule: { $exists: false } }, { targetModule: null }, { targetModule: "" }],
    },
    {
      $set: { targetModule: DEFAULT_CONTENT_MODULE },
    },
  );
  console.log(
    `[module-backfill] ${name}: normalized ${normalizeResult.modifiedCount} user document(s)`,
  );

  for (const module of modules) {
    const existing = await Model.findOne({ isActive: true, targetModule: module }).lean();
    if (!existing) {
      await Model.create(emptyPolicyPayload(title, content, module));
      console.log(`[module-backfill] ${name}: created default document for ${module}`);
    }
  }
}

async function ensureAboutDocs() {
  const normalizeResult = await About.updateMany(
    {
      $or: [{ targetModule: { $exists: false } }, { targetModule: null }, { targetModule: "" }],
    },
    {
      $set: { targetModule: DEFAULT_CONTENT_MODULE },
    },
  );
  console.log(
    `[module-backfill] About: normalized ${normalizeResult.modifiedCount} user document(s)`,
  );

  for (const module of TARGET_MODULES) {
    const existing = await About.findOne({ isActive: true, targetModule: module }).lean();
    if (!existing) {
      const description = "";
      await About.create({
        appName: "Appzeto Food",
        version: "1.0.0",
        description,
        localizedDescription: toLocalizedText(description, description),
        logo: "",
        features: [],
        stats: [],
        targetModule: module,
        isActive: true,
      });
      console.log(`[module-backfill] About: created default document for ${module}`);
    }
  }
}

async function ensureCodeOfConductDocs() {
  const deleteResult = await CodeOfConduct.deleteMany({
    targetModule: { $in: ["user", "delivery"] },
  });
  if (deleteResult.deletedCount > 0) {
    console.log(
      `[module-backfill] CodeOfConduct: removed ${deleteResult.deletedCount} non-restaurant document(s)`,
    );
  }

  const normalizeResult = await CodeOfConduct.updateMany(
    {
      $or: [{ targetModule: { $exists: false } }, { targetModule: null }, { targetModule: "" }],
    },
    {
      $set: { targetModule: "restaurant" },
    },
  );
  console.log(
    `[module-backfill] CodeOfConduct: normalized ${normalizeResult.modifiedCount} document(s)`,
  );

  const existingRestaurant = await CodeOfConduct.findOne({
    isActive: true,
    targetModule: "restaurant",
  }).lean();

  if (!existingRestaurant) {
    await CodeOfConduct.create(
      emptyPolicyPayload(
        "Code of Conduct",
        '<p>No code of conduct available at the moment.</p>',
        "restaurant",
      ),
    );
    console.log("[module-backfill] CodeOfConduct: created default document for restaurant");
  }
}

async function run() {
  await mongoose.connect(uri);
  console.log("[module-backfill] connected to MongoDB");

  await ensurePolicyDocs(TermsAndCondition, {
    name: "TermsAndCondition",
    title: "Terms and Conditions",
    content: '<p>No terms and conditions available at the moment.</p>',
  });
  await ensurePolicyDocs(PrivacyPolicy, {
    name: "PrivacyPolicy",
    title: "Privacy Policy",
    content: '<p>No privacy policy available at the moment.</p>',
  });
  await ensurePolicyDocs(RefundPolicy, {
    name: "RefundPolicy",
    title: "Refund Policy",
    content: '<p>No refund policy available at the moment.</p>',
    modules: [],
  });
  await ensurePolicyDocs(ShippingPolicy, {
    name: "ShippingPolicy",
    title: "Shipping Policy",
    content: '<p>No shipping policy available at the moment.</p>',
    modules: [],
  });
  await ensurePolicyDocs(CancellationPolicy, {
    name: "CancellationPolicy",
    title: "Cancellation Policy",
    content: '<p>No cancellation policy available at the moment.</p>',
    modules: [],
  });
  await ensureCodeOfConductDocs();
  await ensureAboutDocs();

  await mongoose.disconnect();
  console.log("[module-backfill] done");
}

run().catch(async (error) => {
  console.error("[module-backfill] failed:", error);
  try {
    await mongoose.disconnect();
  } catch (_) {
    // ignore
  }
  process.exit(1);
});
