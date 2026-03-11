import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { normalizePhoneNumber } from "../../../shared/utils/phoneUtils.js";

const locationSchema = new mongoose.Schema({
  latitude: Number,
  longitude: Number,
  // GeoJSON coordinates [longitude, latitude] for spatial queries
  coordinates: {
    type: [Number],
    default: undefined,
  },
  // Live address from Google Maps reverse geocoding
  formattedAddress: String,
  // Stored address fields
  address: String, // Full address string
  addressLine1: String,
  addressLine2: String,
  area: String,
  city: String,
  state: String,
  landmark: String,
  // Canonical postal field. Legacy fields pincode/postalCode remain for backward compatibility.
  zipCode: String,
  pincode: String,
  postalCode: String,
  street: String,
});

const deliveryTimingsSchema = new mongoose.Schema({
  openingTime: String,
  closingTime: String,
});

const orderValueSlabSchema = new mongoose.Schema({
  label: {
    type: String,
    trim: true,
  },
  minOrderValue: {
    type: Number,
    required: true,
    min: 0,
  },
  maxOrderValue: {
    type: Number,
    default: null,
    min: 0,
  }
}, { _id: true });

const customerDeliveryRateSchema = new mongoose.Schema({
  distanceSlabId: {
    type: String,
    required: true,
    trim: true,
  },
  orderValueSlabId: {
    type: String,
    required: true,
    trim: true,
  },
  perKmRate: {
    type: Number,
    required: true,
    min: 0,
  }
}, { _id: true });

const restaurantSchema = new mongoose.Schema(
  {
    restaurantId: {
      type: String,
      unique: true,
    },
    // Authentication fields
    email: {
      type: String,
      required: function () {
        return !this.phone && !this.googleId;
      },
      lowercase: true,
      trim: true,
      sparse: true, // Allow multiple null values in unique index
    },
    phone: {
      type: String,
      required: function () {
        return !this.email && !this.googleId;
      },
      trim: true,
    },
    phoneVerified: {
      type: Boolean,
      default: false,
    },
    password: {
      type: String,
      select: false, // Don't return password by default
    },
    googleId: {
      type: String,
    },
    googleEmail: {
      type: String,
      sparse: true,
    },
    signupMethod: {
      type: String,
      enum: ["google", "phone", "email"],
      default: null,
    },
    // Owner information (now stored directly in restaurant)
    ownerName: {
      type: String,
      required: true,
    },
    ownerEmail: {
      type: String,
      default: "",
    },
    ownerPhone: {
      type: String,
      required: function () {
        return !!this.phone;
      },
    },
    // Restaurant basic info
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    primaryContactNumber: String,
    location: locationSchema,
    profileImage: {
      url: String,
      publicId: String,
    },
    menuImages: [
      {
        url: String,
        publicId: String,
      },
    ],
    cuisines: [String],
    deliveryTimings: deliveryTimingsSchema,
    openDays: [String],
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isAcceptingOrders: {
      type: Boolean,
      default: true,
    },
    // Additional display data for user module
    estimatedDeliveryTime: {
      type: String,
      default: "25-30 mins",
    },
    distance: {
      type: String,
      default: "1.2 km",
    },
    priceRange: {
      type: String,
      enum: ["$", "$$", "$$$", "$$$$"],
      default: "$$",
    },
    featuredDish: {
      type: String,
      default: "",
    },
    featuredPrice: {
      type: Number,
      default: 249,
    },
    offer: {
      type: String,
      default: "Flat ₹50 OFF above ₹199",
    },
    deliveryRange: {
      type: Number,
      default: 5, // Default 5km
      min: [1, "Delivery range must be at least 1km"],
      max: [20, "Delivery range cannot exceed 20km"],
    },
    // Numeric helper fields for optimized DB-level filtering
    avgDeliveryTime: {
      type: Number,
      default: 30,
      index: true
    },
    avgDistanceValue: {
      type: Number,
      default: 1.2,
      index: true
    },
    avgPriceValue: {
      type: Number,
      default: 200,
      index: true
    },
    // Onboarding fields (merged from RestaurantOnboarding)
    onboarding: {
      step1: {
        restaurantName: String,
        ownerName: String,
        ownerEmail: String,
        ownerPhone: String,
        primaryContactNumber: String,
        location: locationSchema,
      },
      step2: {
        menuImageUrls: [
          {
            url: String,
            publicId: String,
          },
        ],
        profileImageUrl: {
          url: String,
          publicId: String,
        },
        cuisines: [String],
        deliveryTimings: {
          openingTime: String,
          closingTime: String,
        },
        openDays: [String],
      },
      step3: {
        pan: {
          panNumber: String,
          nameOnPan: String,
          image: {
            url: String,
            publicId: String,
          },
        },
        gst: {
          isRegistered: {
            type: Boolean,
            default: false,
          },
          gstNumber: String,
          legalName: String,
          address: String,
          image: {
            url: String,
            publicId: String,
          },
        },
        fssai: {
          registrationNumber: String,
          expiryDate: Date,
          image: {
            url: String,
            publicId: String,
          },
        },
        bank: {
          accountNumber: String,
          ifscCode: String,
          accountHolderName: String,
          accountType: String,
        },
      },
      step4: {
        estimatedDeliveryTime: String,
        distance: String,
        priceRange: String,
        featuredDish: String,
        featuredPrice: Number,
        offer: String,
      },
      completedSteps: {
        type: Number,
        default: 0,
      },
    },
    // Approval/Rejection fields
    rejectionReason: {
      type: String,
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    businessModel: {
      type: String,
      enum: ["Commission Base", "Subscription Base"],
      default: "Subscription Base", // Changed default to SaaS
    },
    // Subscription details
    subscription: {
      planId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubscriptionPlan",
        default: null,
      },
      startDate: {
        type: Date,
        default: null,
      },
      endDate: {
        type: Date,
        default: null,
      },
      status: {
        type: String,
        enum: ["active", "expired", "cancelled", "inactive", "grace_period"],
        default: "inactive",
      },
      autoRenew: {
        type: Boolean,
        default: true,
      },
      paymentId: {
        type: String,
        default: null,
      },
      features: [String], // Snapshot of features at time of subscription
    },
    // Zone mapping
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
      default: null,
    },
    deliveryPricingConfig: {
      isEnabled: {
        type: Boolean,
        default: false,
      },
      orderValueSlabs: {
        type: [orderValueSlabSchema],
        default: [],
      },
      customerDeliveryRates: {
        type: [customerDeliveryRateSchema],
        default: [],
      },
      lastUpdatedAt: {
        type: Date,
        default: null,
      }
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for authentication, discovery and geo queries
restaurantSchema.index({ "location.coordinates": "2dsphere" });

// Fast listing and visibility filters
restaurantSchema.index({ isActive: 1, isAcceptingOrders: 1 });
restaurantSchema.index({ isActive: 1, createdAt: -1 });

// Zone-based regional queries
restaurantSchema.index({ zoneId: 1, isActive: 1 });
restaurantSchema.index({ zoneId: 1, createdAt: -1 });

// Subscription and Admin management
restaurantSchema.index({ "subscription.planId": 1, "subscription.status": 1 });
restaurantSchema.index({ "subscription.status": 1, createdAt: -1 });

// Hash password before saving
restaurantSchema.pre("save", async function (next) {
  // Generate restaurantId FIRST (before any validation)
  if (!this.restaurantId) {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    this.restaurantId = `REST-${timestamp}-${random}`;
  }

  // Normalize phone number if it exists and is modified
  if (this.isModified("phone") && this.phone) {
    const normalized = normalizePhoneNumber(this.phone);
    if (normalized) {
      this.phone = normalized;
    }
  }

  // Normalize ownerPhone if it exists and is modified
  if (this.isModified("ownerPhone") && this.ownerPhone) {
    const normalized = normalizePhoneNumber(this.ownerPhone);
    if (normalized) {
      this.ownerPhone = normalized;
    }
  }

  // Normalize primaryContactNumber if it exists and is modified
  if (this.isModified("primaryContactNumber") && this.primaryContactNumber) {
    const normalized = normalizePhoneNumber(this.primaryContactNumber);
    if (normalized) {
      this.primaryContactNumber = normalized;
    }
  }

  // Generate slug from name (always generate if name exists and slug doesn't)
  if (this.name && !this.slug) {
    let baseSlug = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    // Ensure slug is not empty
    if (!baseSlug) {
      baseSlug = `restaurant-${this.restaurantId}`;
    }

    this.slug = baseSlug;
  }

  // CRITICAL: For phone signups, ensure email field is completely unset (not null/undefined)
  // This prevents duplicate key errors on sparse unique index
  if (
    this.phone &&
    !this.email &&
    (this.signupMethod === "phone" || !this.signupMethod)
  ) {
    // Explicitly ensure email is undefined (not null) to prevent MongoDB from indexing it
    // Mongoose will omit undefined fields but will include null fields
    if (this.email === null || this.email === undefined) {
      // Explicitly unset the email field to prevent MongoDB from indexing it
      // Mongoose will omit undefined fields during save
      this.set('email', undefined);
    }
  }

  // Normalize location postal fields: ensure canonical zipCode is always populated
  if (this.location) {
    const loc = this.location;
    const canonicalZip =
      loc.zipCode ||
      loc.pincode ||
      loc.postalCode ||
      (Array.isArray(loc.coordinates) && loc.coordinates.length === 2
        ? loc.zipCode
        : undefined);
    if (canonicalZip) {
      this.location.zipCode = canonicalZip;
    }
  }

  // Normalize onboarding.step1 location postal fields if present
  if (this.onboarding?.step1?.location) {
    const stepLoc = this.onboarding.step1.location;
    const canonicalZip =
      stepLoc.zipCode || stepLoc.pincode || stepLoc.postalCode;
    if (canonicalZip) {
      this.onboarding.step1.location.zipCode = canonicalZip;
    }
  }

  // Hash password if it's modified
  if (this.isModified("password") && this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // Set default ownerEmail if not set and phone exists
  if (!this.ownerEmail && this.phone && !this.email) {
    this.ownerEmail = `${this.phone.replace(/\D/g, "")}@restaurant.appzeto.com`;
  }

  // Set ownerEmail from email if email exists and ownerEmail not set
  if (this.email && !this.ownerEmail) {
    this.ownerEmail = this.email;
  }

  // Populate numeric helper fields for optimized filtering
  // 1. Parse delivery time (e.g., "25-30 mins" -> 27.5)
  if (this.estimatedDeliveryTime) {
    const numbers = this.estimatedDeliveryTime.match(/\d+/g);
    if (numbers && numbers.length > 0) {
      if (numbers.length === 2) {
        this.avgDeliveryTime = (parseInt(numbers[0]) + parseInt(numbers[1])) / 2;
      } else {
        this.avgDeliveryTime = parseInt(numbers[0]);
      }
    }
  }

  // 2. Parse distance (e.g., "1.2 km" -> 1.2) - Note: This is an reference field, real distance is geo-calculated
  if (this.distance) {
    const distMatch = this.distance.match(/(\d+\.?\d*)/);
    if (distMatch) {
      this.avgDistanceValue = parseFloat(distMatch[1]);
    }
  }

  // 3. Map price range to numeric value for filtering
  const priceMap = { "$": 100, "$$": 250, "$$$": 500, "$$$$": 1000 };
  if (this.priceRange && priceMap[this.priceRange]) {
    this.avgPriceValue = priceMap[this.priceRange];
  }

  next();
});

// Method to compare password
restaurantSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model("Restaurant", restaurantSchema);
