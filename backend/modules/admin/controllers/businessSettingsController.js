import BusinessSettings from "../models/BusinessSettings.js";
import {
  successResponse,
  errorResponse,
} from "../../../shared/utils/response.js";
import { asyncHandler } from "../../../shared/middleware/asyncHandler.js";
import { uploadToCloudinary } from "../../../shared/utils/cloudinaryService.js";
import { initializeCloudinary } from "../../../config/cloudinary.js";

/**
 * Get Business Settings (Public - for favicon, logo, company name)
 * GET /api/business-settings/public
 */
export const getBusinessSettingsPublic = asyncHandler(async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();

    // Return only public-facing data with defaults if not set
    return successResponse(
      res,
      200,
      "Business settings retrieved successfully",
      {
        companyName: settings?.companyName || "Appzeto Food",
        logo: settings?.logo || { url: "", publicId: "" },
        maxDeliveryRange: settings?.maxDeliveryRange ?? 20,
        withdrawalWindows: settings?.withdrawalWindows || null,
      },
    );
  } catch (error) {
    console.error("Error fetching public business settings:", error);
    // Return default values instead of error
    return successResponse(
      res,
      200,
      "Business settings retrieved successfully",
      {
        companyName: "Appzeto Food",
        logo: { url: "", publicId: "" },
        maxDeliveryRange: 20,
        withdrawalWindows: null,
      },
    );
  }
});

/**
 * Get Business Settings (Admin - full data)
 * GET /api/admin/business-settings
 */
export const getBusinessSettings = asyncHandler(async (req, res) => {
  try {
    const settings = await BusinessSettings.getSettings();
    return successResponse(
      res,
      200,
      "Business settings retrieved successfully",
      settings,
    );
  } catch (error) {
    console.error("Error fetching business settings:", error);
    return errorResponse(res, 500, "Failed to fetch business settings");
  }
});

/**
 * Update Business Settings
 * PUT /api/admin/business-settings
 */
export const updateBusinessSettings = asyncHandler(async (req, res) => {
  try {
    let {
      companyName,
      email,
      phoneCountryCode,
      phoneNumber,
      address,
      state,
      pincode,
      region,
      maintenanceMode,
      maxDeliveryRange,
      withdrawalWindows,
    } = req.body;
    if (typeof withdrawalWindows === "string") {
      try {
        withdrawalWindows = JSON.parse(withdrawalWindows);
      } catch (_) {
        withdrawalWindows = null;
      }
    }
    if (typeof maintenanceMode === "string") {
      try {
        maintenanceMode = JSON.parse(maintenanceMode);
      } catch (_) {
        maintenanceMode = undefined;
      }
    }

    // Get existing settings
    let settings = await BusinessSettings.findOne();
    if (!settings) {
      settings = new BusinessSettings();
    }

    // Update basic fields
    if (companyName !== undefined) settings.companyName = companyName;
    if (email !== undefined) settings.email = email;

    // Initialize phone object if it doesn't exist
    if (!settings.phone) {
      settings.phone = {
        countryCode: "+91",
        number: "",
      };
    }

    if (phoneCountryCode !== undefined)
      settings.phone.countryCode = phoneCountryCode;
    if (phoneNumber !== undefined) settings.phone.number = phoneNumber;
    if (address !== undefined) settings.address = address;
    if (state !== undefined) settings.state = state;
    if (pincode !== undefined) settings.pincode = pincode;
    if (region !== undefined) settings.region = region;
    if (maxDeliveryRange !== undefined) {
      const parsed = Number(maxDeliveryRange);
      if (Number.isFinite(parsed) && parsed >= 1) settings.maxDeliveryRange = parsed;
    }
    if (withdrawalWindows !== undefined && withdrawalWindows !== null) {
      const parseYmd = (value) => {
        if (!value) return null;
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
          return new Date(value.getFullYear(), value.getMonth(), value.getDate());
        }
        if (typeof value === "string") {
          const parts = value.split("-").map(Number);
          if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
            const [y, m, d] = parts;
            return new Date(y, m - 1, d);
          }
          const d = new Date(value);
          if (!Number.isNaN(d.getTime())) {
            return new Date(d.getFullYear(), d.getMonth(), d.getDate());
          }
        }
        return null;
      };
      const uniqueDates = (dates) => {
        const seen = new Set();
        const result = [];
        (dates || []).forEach((d) => {
          const dateOnly = parseYmd(d);
          if (!dateOnly) return;
          const key = `${dateOnly.getFullYear()}-${dateOnly.getMonth()}-${dateOnly.getDate()}`;
          if (!seen.has(key)) {
            seen.add(key);
            result.push(dateOnly);
          }
        });
        return result;
      };
      const sanitize = (windowCfg) => {
        if (!windowCfg) return { openDates: [], closedDates: [] };
        const openDates = uniqueDates(windowCfg.openDates);
        const closedDates = uniqueDates(windowCfg.closedDates);
        // Backward compatibility: map legacy mode/overrideDate into arrays
        if ((!openDates.length && !closedDates.length) && windowCfg.mode && windowCfg.overrideDate) {
          const legacyDate = parseYmd(windowCfg.overrideDate);
          if (legacyDate) {
            if (windowCfg.mode === "open") openDates.push(legacyDate);
            if (windowCfg.mode === "closed") closedDates.push(legacyDate);
          }
        }
        return { openDates, closedDates };
      };
      const deliveryCfg = sanitize(withdrawalWindows.delivery);
      const restaurantCfg = sanitize(withdrawalWindows.restaurant);
      settings.withdrawalWindows = {
        delivery: deliveryCfg,
        restaurant: restaurantCfg,
      };
    }
    if (maintenanceMode !== undefined) {
      settings.maintenanceMode.isEnabled = maintenanceMode.isEnabled || false;
      if (maintenanceMode.startDate) {
        settings.maintenanceMode.startDate = new Date(
          maintenanceMode.startDate,
        );
      }
      if (maintenanceMode.endDate) {
        settings.maintenanceMode.endDate = new Date(maintenanceMode.endDate);
      }
    }

    // Handle logo upload
    if (req.files && req.files.logo && req.files.logo.length > 0) {
      try {
        await initializeCloudinary();
        const logoFile = req.files.logo[0];

        // Validate file type
        const allowedMimeTypes = [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
        ];
        if (!allowedMimeTypes.includes(logoFile.mimetype)) {
          return errorResponse(
            res,
            400,
            "Invalid logo file type. Allowed: JPEG, PNG, WEBP",
          );
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (logoFile.size > maxSize) {
          return errorResponse(res, 400, "Logo file size exceeds 5MB limit");
        }

        // Delete old logo from Cloudinary if exists
        if (settings.logo.publicId) {
          try {
            const { cloudinary } =
              await import("../../../config/cloudinary.js");
            await cloudinary.uploader.destroy(settings.logo.publicId);
          } catch (deleteError) {
            console.warn("Failed to delete old logo:", deleteError);
          }
        }

        // Upload new logo
        const logoResult = await uploadToCloudinary(logoFile.buffer, {
          folder: "appzeto/business/logo",
          resource_type: "image",
          transformation: [
            { width: 500, height: 500, crop: "limit" },
            { quality: "auto" },
          ],
        });

        settings.logo = {
          url: logoResult.secure_url,
          publicId: logoResult.public_id,
        };
      } catch (logoError) {
        console.error("Error uploading logo:", logoError);
        return errorResponse(res, 500, "Failed to upload logo");
      }
    }



    // Set updated by
    if (req.admin && req.admin._id) {
      settings.updatedBy = req.admin._id;
    }

    await settings.save();

    return successResponse(
      res,
      200,
      "Business settings updated successfully",
      settings,
    );
  } catch (error) {
    console.error("Error updating business settings:", error);
    return errorResponse(res, 500, "Failed to update business settings");
  }
});
