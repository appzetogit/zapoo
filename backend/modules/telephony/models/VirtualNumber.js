import mongoose from "mongoose";

const virtualNumberSchema = new mongoose.Schema(
  {
    number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    city: {
      type: String,
      required: true,
      index: true,
      trim: true,
      lowercase: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("VirtualNumber", virtualNumberSchema);

