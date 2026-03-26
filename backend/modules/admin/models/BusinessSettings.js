import mongoose from "mongoose";

const businessSettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      required: true,
      trim: true,
      default: "Zapoo",
    },
    email: {
      type: String,
      required: false,
      trim: true,
      lowercase: true,
      default: "info@zapoo.com",
    },
    region: {
      type: String,
      required: true,
      enum: ["India", "UK", "US"],
      default: "India",
    },
    phone: {
      countryCode: {
        type: String,
        required: false,
        default: "+91",
      },
      number: {
        type: String,
        required: false,
        trim: true,
        default: "",
      },
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    logo: {
      url: {
        type: String,
        default: "",
      },
      publicId: {
        type: String,
        default: "",
      },
    },

    maintenanceMode: {
      isEnabled: {
        type: Boolean,
        default: false,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
    },
    // Global Delivery Partner cash limit (applies to all delivery partners)
    // Used for "Available cash limit" in delivery Pocket/Wallet UI.
    deliveryCashLimit: {
      type: Number,
      default: 750,
      min: 0,
    },
    // Minimum amount above which delivery boy can withdraw. Withdrawal allowed only when withdrawable amount >= this.
    deliveryWithdrawalLimit: {
      type: Number,
      default: 100,
      min: 0,
    },
    // Maximum delivery range (km) a restaurant can set. Used as the geo-query cap.
    maxDeliveryRange: {
      type: Number,
      default: 20,
      min: 1,
    },
    // Maximum notification requests a restaurant can submit per day
    restaurantNotificationDailyLimit: {
      type: Number,
      default: 2,
      min: 0,
    },
    // Withdrawal window overrides (separate for delivery + restaurant)
    withdrawalWindows: {
      delivery: {
        openDates: {
          type: [Date],
          default: [],
        },
        closedDates: {
          type: [Date],
          default: [],
        },
      },
      restaurant: {
        openDates: {
          type: [Date],
          default: [],
        },
        closedDates: {
          type: [Date],
          default: [],
        },
      },
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

// Indexes
businessSettingsSchema.index({ createdAt: -1 });

// Ensure only one document exists
businessSettingsSchema.statics.getSettings = async function () {
  try {
    let settings = await this.findOne();
    if (!settings) {
      settings = await this.create({
        companyName: "Zapoo",
        region: "India",
        email: "info@zapoo.com",
        phone: {
          countryCode: "+91",
          number: "",
        },
        deliveryCashLimit: 750,
        deliveryWithdrawalLimit: 100,
      });
    }
    if (!settings.withdrawalWindows) {
      settings.withdrawalWindows = {
        delivery: { openDates: [], closedDates: [] },
        restaurant: { openDates: [], closedDates: [] },
      };
      await settings.save();
    } else {
      let changed = false;
      if (!settings.withdrawalWindows.delivery) {
        settings.withdrawalWindows.delivery = { openDates: [], closedDates: [] };
        changed = true;
      } else {
        if (!Array.isArray(settings.withdrawalWindows.delivery.openDates)) {
          settings.withdrawalWindows.delivery.openDates = [];
          changed = true;
        }
        if (!Array.isArray(settings.withdrawalWindows.delivery.closedDates)) {
          settings.withdrawalWindows.delivery.closedDates = [];
          changed = true;
        }
      }
      if (!settings.withdrawalWindows.restaurant) {
        settings.withdrawalWindows.restaurant = { openDates: [], closedDates: [] };
        changed = true;
      } else {
        if (!Array.isArray(settings.withdrawalWindows.restaurant.openDates)) {
          settings.withdrawalWindows.restaurant.openDates = [];
          changed = true;
        }
        if (!Array.isArray(settings.withdrawalWindows.restaurant.closedDates)) {
          settings.withdrawalWindows.restaurant.closedDates = [];
          changed = true;
        }
      }
      if (changed) await settings.save();
    }
    return settings;
  } catch (error) {
    console.error("Error in getSettings:", error);
    // If creation fails, try to return existing or create minimal document
    let settings = await this.findOne();
    if (!settings) {
      // Create with minimal required fields
      settings = new this({
        companyName: "Zapoo",
        region: "India",
        email: "info@zapoo.com",
        phone: {
          countryCode: "+91",
          number: "",
        },
        deliveryCashLimit: 750,
        deliveryWithdrawalLimit: 100,
      });
      await settings.save();
    }
    return settings;
  }
};

export default mongoose.model("BusinessSettings", businessSettingsSchema);
