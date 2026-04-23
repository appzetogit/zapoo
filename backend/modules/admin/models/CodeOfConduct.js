import mongoose from "mongoose";
import { localizedTextSchema } from "../../../shared/i18n/localizedText.js";
import { CONTENT_MODULES, DEFAULT_CONTENT_MODULE } from "../constants/contentModules.js";

const codeOfConductSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      default: "Code of Conduct",
      trim: true,
    },
    localizedTitle: {
      type: localizedTextSchema,
      default: () => ({ en: "Code of Conduct", hi: "", bn: "" }),
    },
    content: {
      type: String,
      required: true,
      default: "",
    },
    localizedContent: {
      type: localizedTextSchema,
      default: () => ({ en: "", hi: "", bn: "" }),
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    targetModule: {
      type: String,
      enum: CONTENT_MODULES,
      default: DEFAULT_CONTENT_MODULE,
      required: true,
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

codeOfConductSchema.index({ isActive: 1 });
codeOfConductSchema.index({ isActive: 1, targetModule: 1 });

export default mongoose.model("CodeOfConduct", codeOfConductSchema);

