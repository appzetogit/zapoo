import apiClient, { API_ENDPOINTS, deliveryAPI, zoneAPI, uploadAPI, notificationAPI } from "@/lib/api/index.js";

export const publicAPI = {
  getPrivacy: () => apiClient.get(API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC, { params: { userType: "delivery" } }),
};

export const publicGetOnce = (url, options = {}) => {
  const { noCache, ...config } = options || {};
  const finalConfig = { ...(config || {}) };
  if (noCache) {
    finalConfig.params = {
      ...(finalConfig.params || {}),
      _ts: Date.now(),
    };
  }
  return apiClient.get(url, finalConfig);
};

const compatDeliveryAPI = {
  ...deliveryAPI,
  // V2 compatibility alias used by legacy hooks
  getMe: () => deliveryAPI.getCurrentDelivery(),
  register: async (formData) => {
    if (!(formData instanceof FormData)) {
      throw new Error("Invalid registration payload");
    }

    const detailsPayload = {
      name: (formData.get("name") || "").toString().trim(),
      email: (formData.get("email") || "").toString().trim(),
      address: (formData.get("address") || "").toString().trim(),
      city: (formData.get("city") || "").toString().trim(),
      state: (formData.get("state") || "").toString().trim(),
      vehicleType: (formData.get("vehicleType") || "bike").toString().trim(),
      vehicleName: (formData.get("vehicleName") || "").toString().trim(),
      vehicleNumber: (formData.get("vehicleNumber") || "").toString().trim(),
      panNumber: (formData.get("panNumber") || "").toString().trim(),
      aadharNumber: (formData.get("aadharNumber") || "").toString().trim(),
    };

    await deliveryAPI.submitSignupDetails(detailsPayload);

    const uploadDoc = async (fieldName) => {
      const file = formData.get(fieldName);
      if (!file || typeof file === "string") {
        throw new Error(`${fieldName} is required`);
      }
      const uploadRes = await uploadAPI.uploadMedia(file, { folder: "delivery/documents" });
      const data = uploadRes?.data?.data || uploadRes?.data || {};
      return {
        url: data.url,
        publicId: data.publicId,
      };
    };

    const [profilePhoto, aadharPhoto, panPhoto, drivingLicensePhoto] = await Promise.all([
      uploadDoc("profilePhoto"),
      uploadDoc("aadharPhoto"),
      uploadDoc("panPhoto"),
      uploadDoc("drivingLicensePhoto"),
    ]);

    return deliveryAPI.submitSignupDocuments({
      profilePhoto,
      aadharPhoto,
      panPhoto,
      drivingLicensePhoto,
    });
  },
  completeProfile: async (formData) => {
    return compatDeliveryAPI.register(formData);
  },
  getActiveEarningAddons: async () => ({
    data: {
      success: true,
      data: {
        activeOffer: null,
      },
    },
  }),
  // Keep V2 profile screen stable even when referral endpoint is unavailable in this backend.
  getReferralStats: async () => ({
    data: {
      success: true,
      data: {
        stats: {
          rewardAmount: 0,
        },
      },
    },
  }),
};

export { API_ENDPOINTS, zoneAPI, uploadAPI, notificationAPI };
export { compatDeliveryAPI as deliveryAPI };
export default apiClient;
