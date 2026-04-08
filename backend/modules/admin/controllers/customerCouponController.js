import AdminCoupon from "../models/AdminCoupon.js";
import Order from "../../order/models/Order.js";
import { successResponse, errorResponse } from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { resolveLocaleFromRequest } from "../../../shared/i18n/localeResolver.js";
import { normalizeLocale } from "../../../shared/i18n/localeConstants.js";
import { resolveLocalizedText, toLocalizedText } from "../../../shared/i18n/localizedText.js";
import { buildLocalizedText } from "../../../shared/i18n/translationService.js";

const normalizeCouponCode = (code = "") => String(code || "").trim().toUpperCase();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const normalizeMaxDiscountAmount = (value) => {
  const parsed = toNumberOrNull(value);
  return parsed !== null && parsed > 0 ? parsed : null;
};

const getDerivedStatus = (coupon) => {
  const now = new Date();
  if (coupon.status === "cancelled") return "cancelled";
  if (coupon.status === "paused") return "paused";
  if (coupon.status === "draft") return "draft";
  if (coupon.validUntil && new Date(coupon.validUntil) < now) return "expired";
  return coupon.status;
};

const mergeLocalizedValue = (existingValue, localizedOverride, fallback = "") => {
  const merged = toLocalizedText(existingValue, fallback);
  if (localizedOverride && typeof localizedOverride === "object") {
    for (const locale of ["en", "hi", "bn"]) {
      if (typeof localizedOverride[locale] === "string") {
        merged[locale] = localizedOverride[locale];
      }
    }
  }
  return merged;
};

const maybeTranslate = async (localizedValue, sourceLocale, autoTranslate, explicitOverrides = null) => {
  if (sourceLocale === "en" && autoTranslate && localizedValue.en) {
    try {
      const translated = await buildLocalizedText(localizedValue.en);
      if (!explicitOverrides?.hi) localizedValue.hi = translated.hi || localizedValue.hi;
      if (!explicitOverrides?.bn) localizedValue.bn = translated.bn || localizedValue.bn;
    } catch (error) {
      console.warn(`[i18n] Coupon translation failed: ${error.message}`);
    }
  }
  return localizedValue;
};

const resolveCouponForLocale = (coupon, locale) => ({
  ...coupon,
  title: resolveLocalizedText(coupon.localizedTitle, locale, coupon.title || ""),
  description: resolveLocalizedText(coupon.localizedDescription, locale, coupon.description || ""),
});

export const createCustomerCoupon = asyncHandler(async (req, res) => {
  const {
    code,
    title,
    description = "",
    discountType,
    discountValue,
    maxDiscountAmount = null,
    minOrderValue = 0,
    eligibilityType = "all_users",
    validFrom,
    validUntil = null,
    status = "active",
    localizedTitle,
    localizedDescription,
    locale,
    autoTranslate = true,
  } = req.body;

  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode || !title || !discountType) {
    return errorResponse(res, 400, "Code, title, and discount type are required");
  }

  const parsedDiscountValue = Number(discountValue);
  if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
    return errorResponse(res, 400, "Discount value must be greater than 0");
  }

  if (discountType === "percentage" && parsedDiscountValue > 100) {
    return errorResponse(res, 400, "Percentage discount cannot exceed 100");
  }

  const parsedMinOrderValue = Number(minOrderValue || 0);
  if (!Number.isFinite(parsedMinOrderValue) || parsedMinOrderValue < 0) {
    return errorResponse(res, 400, "Minimum order value must be 0 or more");
  }

  const parsedMaxDiscount = normalizeMaxDiscountAmount(maxDiscountAmount);
  if (maxDiscountAmount !== null && maxDiscountAmount !== undefined && maxDiscountAmount !== "" && Number(maxDiscountAmount) < 0) {
    return errorResponse(res, 400, "Maximum discount amount cannot be negative");
  }

  const validFromDate = validFrom ? new Date(validFrom) : new Date();
  const validUntilDate = validUntil ? new Date(validUntil) : null;

  if (Number.isNaN(validFromDate.getTime())) {
    return errorResponse(res, 400, "Valid from date is invalid");
  }

  if (validUntilDate && Number.isNaN(validUntilDate.getTime())) {
    return errorResponse(res, 400, "Valid until date is invalid");
  }

  if (validUntilDate && validUntilDate < validFromDate) {
    return errorResponse(res, 400, "Valid until date must be after valid from date");
  }

  const existingCoupon = await AdminCoupon.findOne({ code: normalizedCode }).lean();
  if (existingCoupon) {
    return errorResponse(res, 400, "Coupon code already exists");
  }

  const sourceLocale = normalizeLocale(locale || "en");
  let nextLocalizedTitle = mergeLocalizedValue(localizedTitle, localizedTitle, String(title).trim());
  let nextLocalizedDescription = mergeLocalizedValue(
    localizedDescription,
    localizedDescription,
    String(description || "").trim()
  );
  nextLocalizedTitle[sourceLocale] = String(title).trim();
  nextLocalizedDescription[sourceLocale] = String(description || "").trim();
  if (!nextLocalizedTitle.en) nextLocalizedTitle.en = String(title).trim();
  if (!nextLocalizedDescription.en) nextLocalizedDescription.en = String(description || "").trim();
  nextLocalizedTitle = await maybeTranslate(nextLocalizedTitle, sourceLocale, autoTranslate, localizedTitle);
  nextLocalizedDescription = await maybeTranslate(
    nextLocalizedDescription,
    sourceLocale,
    autoTranslate,
    localizedDescription
  );

  const coupon = await AdminCoupon.create({
    code: normalizedCode,
    title: nextLocalizedTitle.en,
    localizedTitle: nextLocalizedTitle,
    description: nextLocalizedDescription.en,
    localizedDescription: nextLocalizedDescription,
    discountType,
    discountValue: parsedDiscountValue,
    maxDiscountAmount: parsedMaxDiscount,
    minOrderValue: parsedMinOrderValue,
    eligibilityType,
    status,
    validFrom: validFromDate,
    validUntil: validUntilDate,
    createdBy: req.user?._id || null,
    updatedBy: req.user?._id || null,
  });

  const requestLocale = resolveLocaleFromRequest(req);
  return successResponse(res, 201, "Customer coupon created successfully", {
    coupon: resolveCouponForLocale(coupon.toObject(), requestLocale),
  });
});

export const getCustomerCoupons = asyncHandler(async (req, res) => {
  const locale = resolveLocaleFromRequest(req);
  const {
    page = 1,
    limit = 50,
    search,
    status,
  } = req.query;

  const query = {};
  if (status && status !== "all") {
    query.status = status;
  }
  if (search) {
    query.$or = [
      { code: { $regex: search.trim(), $options: "i" } },
      { title: { $regex: search.trim(), $options: "i" } },
      { description: { $regex: search.trim(), $options: "i" } },
      { "localizedTitle.en": { $regex: search.trim(), $options: "i" } },
      { "localizedTitle.hi": { $regex: search.trim(), $options: "i" } },
      { "localizedTitle.bn": { $regex: search.trim(), $options: "i" } },
      { "localizedDescription.en": { $regex: search.trim(), $options: "i" } },
      { "localizedDescription.hi": { $regex: search.trim(), $options: "i" } },
      { "localizedDescription.bn": { $regex: search.trim(), $options: "i" } },
    ];
  }

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const [coupons, total] = await Promise.all([
    AdminCoupon.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean(),
    AdminCoupon.countDocuments(query),
  ]);

  const couponIds = coupons.map((coupon) => coupon.code).filter(Boolean);
  const usageAgg = couponIds.length > 0
    ? await Order.aggregate([
      {
        $match: {
          "pricing.couponCode": { $in: couponIds },
          status: "delivered",
        }
      },
      {
        $group: {
          _id: "$pricing.couponCode",
          deliveredUses: { $sum: 1 },
        }
      }
    ])
    : [];

  const usageMap = new Map(usageAgg.map((entry) => [String(entry._id), entry.deliveredUses || 0]));

  const formattedCoupons = coupons.map((coupon) => ({
    ...resolveCouponForLocale(coupon, locale),
    effectiveStatus: getDerivedStatus(coupon),
    deliveredUses: usageMap.get(coupon.code) || 0,
  }));

  return successResponse(res, 200, "Customer coupons retrieved successfully", {
    coupons: formattedCoupons,
    pagination: {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      pages: Math.ceil(total / parseInt(limit, 10)),
    }
  });
});

export const updateCustomerCoupon = asyncHandler(async (req, res) => {
  const requestLocale = resolveLocaleFromRequest(req);
  const { id } = req.params;
  const coupon = await AdminCoupon.findById(id);
  if (!coupon) {
    return errorResponse(res, 404, "Customer coupon not found");
  }

  const {
    code,
    title,
    description,
    discountType,
    discountValue,
    maxDiscountAmount,
    minOrderValue,
    eligibilityType,
    validFrom,
    validUntil,
    localizedTitle,
    localizedDescription,
    locale,
    autoTranslate = true,
  } = req.body;
  const sourceLocale = normalizeLocale(locale || "en");

  if (code !== undefined) {
    const normalizedCode = normalizeCouponCode(code);
    if (!normalizedCode) {
      return errorResponse(res, 400, "Coupon code is required");
    }
    if (normalizedCode !== coupon.code) {
      const existingCoupon = await AdminCoupon.findOne({ code: normalizedCode, _id: { $ne: id } }).lean();
      if (existingCoupon) {
        return errorResponse(res, 400, "Coupon code already exists");
      }
      coupon.code = normalizedCode;
    }
  }

  if (title !== undefined || localizedTitle !== undefined) {
    let nextLocalizedTitle = mergeLocalizedValue(
      coupon.localizedTitle,
      localizedTitle,
      coupon.title || ""
    );
    if (title !== undefined) nextLocalizedTitle[sourceLocale] = String(title).trim();
    if (!nextLocalizedTitle.en) nextLocalizedTitle.en = coupon.title || String(title || "").trim();
    nextLocalizedTitle = await maybeTranslate(nextLocalizedTitle, sourceLocale, autoTranslate, localizedTitle);
    coupon.localizedTitle = nextLocalizedTitle;
    coupon.title = nextLocalizedTitle.en;
  }
  if (description !== undefined || localizedDescription !== undefined) {
    let nextLocalizedDescription = mergeLocalizedValue(
      coupon.localizedDescription,
      localizedDescription,
      coupon.description || ""
    );
    if (description !== undefined) nextLocalizedDescription[sourceLocale] = String(description || "").trim();
    if (!nextLocalizedDescription.en) {
      nextLocalizedDescription.en = coupon.description || String(description || "").trim();
    }
    nextLocalizedDescription = await maybeTranslate(
      nextLocalizedDescription,
      sourceLocale,
      autoTranslate,
      localizedDescription
    );
    coupon.localizedDescription = nextLocalizedDescription;
    coupon.description = nextLocalizedDescription.en;
  }
  if (discountType !== undefined) coupon.discountType = discountType;

  if (discountValue !== undefined) {
    const parsedDiscountValue = Number(discountValue);
    if (!Number.isFinite(parsedDiscountValue) || parsedDiscountValue <= 0) {
      return errorResponse(res, 400, "Discount value must be greater than 0");
    }
    if ((discountType || coupon.discountType) === "percentage" && parsedDiscountValue > 100) {
      return errorResponse(res, 400, "Percentage discount cannot exceed 100");
    }
    coupon.discountValue = parsedDiscountValue;
  }

  if (maxDiscountAmount !== undefined) {
    const parsedMaxDiscount = normalizeMaxDiscountAmount(maxDiscountAmount);
    if (maxDiscountAmount !== null && maxDiscountAmount !== undefined && maxDiscountAmount !== "" && Number(maxDiscountAmount) < 0) {
      return errorResponse(res, 400, "Maximum discount amount cannot be negative");
    }
    coupon.maxDiscountAmount = parsedMaxDiscount;
  }

  if (minOrderValue !== undefined) {
    const parsedMinOrderValue = Number(minOrderValue || 0);
    if (!Number.isFinite(parsedMinOrderValue) || parsedMinOrderValue < 0) {
      return errorResponse(res, 400, "Minimum order value must be 0 or more");
    }
    coupon.minOrderValue = parsedMinOrderValue;
  }

  if (eligibilityType !== undefined) coupon.eligibilityType = eligibilityType;

  if (validFrom !== undefined) {
    const validFromDate = new Date(validFrom);
    if (Number.isNaN(validFromDate.getTime())) {
      return errorResponse(res, 400, "Valid from date is invalid");
    }
    coupon.validFrom = validFromDate;
  }

  if (validUntil !== undefined) {
    const validUntilDate = validUntil ? new Date(validUntil) : null;
    if (validUntilDate && Number.isNaN(validUntilDate.getTime())) {
      return errorResponse(res, 400, "Valid until date is invalid");
    }
    coupon.validUntil = validUntilDate;
  }

  if (coupon.validUntil && coupon.validFrom && coupon.validUntil < coupon.validFrom) {
    return errorResponse(res, 400, "Valid until date must be after valid from date");
  }

  coupon.updatedBy = req.user?._id || null;
  await coupon.save();

  return successResponse(res, 200, "Customer coupon updated successfully", {
    coupon: resolveCouponForLocale(coupon.toObject(), requestLocale),
  });
});

export const updateCustomerCouponStatus = asyncHandler(async (req, res) => {
  const requestLocale = resolveLocaleFromRequest(req);
  const { id } = req.params;
  const { status } = req.body;

  if (!status || !["draft", "active", "paused", "expired", "cancelled"].includes(status)) {
    return errorResponse(res, 400, "Valid coupon status is required");
  }

  const coupon = await AdminCoupon.findByIdAndUpdate(
    id,
    {
      status,
      updatedBy: req.user?._id || null,
    },
    { new: true }
  );

  if (!coupon) {
    return errorResponse(res, 404, "Customer coupon not found");
  }

  return successResponse(res, 200, "Customer coupon status updated successfully", {
    coupon: resolveCouponForLocale(coupon.toObject(), requestLocale),
  });
});
