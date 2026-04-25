import { useState, useRef, useEffect } from "react";
import { Info, Phone, Upload, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";
import { clearCache, updateTitle } from "@/lib/utils/businessSettings";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const STATE_REGEX = /^[A-Za-z]+(?:[ ]+[A-Za-z]+)*$/;
const PINCODE_REGEX = /^[1-9][0-9]{5}$/;
const INDIAN_PHONE_REGEX = /^[6-9][0-9]{9}$/;

const toTitleCase = (value) =>
  value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

export default function BusinessSetup() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const logoInputRef = useRef(null);

  const [formData, setFormData] = useState({
    companyName: "",
    email: "",
    phoneCountryCode: "+91",
    phoneNumber: "",
    address: "",
    state: "",
    pincode: "",
    region: "",
    maxDeliveryRange: 20,
  });

  useEffect(() => {
    fetchBusinessSettings();
  }, []);

  const fetchBusinessSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;

      if (settings) {
        setFormData({
          companyName: settings.companyName || "",
          email: settings.email || "",
          phoneCountryCode: "+91",
          phoneNumber: String(settings.phone?.number || "").replace(/\D/g, "").slice(0, 10),
          address: settings.address || "",
          state: settings.state || "",
          pincode: String(settings.pincode || "").replace(/\D/g, "").slice(0, 6),
          region: settings.region || "India",
          maxDeliveryRange: settings.maxDeliveryRange ?? 20,
        });

        if (settings.logo?.url) {
          setLogoPreview(settings.logo.url);
        }
      }
    } catch (error) {
      console.error("Error fetching business settings:", error);
      toast.error(error?.response?.data?.message || "Failed to load business settings");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    if (field === "phoneCountryCode") {
      setFormData((prev) => ({ ...prev, phoneCountryCode: "+91" }));
      return;
    }

    if (field === "phoneNumber") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 10);
      const normalizedPhone = digitsOnly.replace(/^[0-5]+/, "").slice(0, 10);
      setFormData((prev) => ({ ...prev, phoneNumber: normalizedPhone }));
      return;
    }

    if (field === "pincode") {
      const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
      setFormData((prev) => ({ ...prev, pincode: digitsOnly }));
      return;
    }

    if (field === "state") {
      const normalizedState = value
        .replace(/[^A-Za-z\s]/g, "")
        .replace(/\s{2,}/g, " ")
        .replace(/^\s+/, "");

      setFormData((prev) => ({ ...prev, state: normalizedState }));
      return;
    }

    if (field === "email") {
      setFormData((prev) => ({ ...prev, email: value.trim().toLowerCase() }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      if (!formData.companyName.trim()) {
        toast.error("Company name is required");
        return;
      }
      if (!formData.email.trim()) {
        toast.error("Email is required");
        return;
      }
      if (!EMAIL_REGEX.test(formData.email.trim())) {
        toast.error("Please enter a valid email address");
        return;
      }
      if (!formData.phoneNumber.trim()) {
        toast.error("Phone number is required");
        return;
      }
      if (!INDIAN_PHONE_REGEX.test(formData.phoneNumber.trim())) {
        toast.error("Please enter a valid 10-digit Indian mobile number");
        return;
      }
      if (formData.state.trim() && !STATE_REGEX.test(formData.state.trim())) {
        toast.error("State should contain only letters and spaces");
        return;
      }
      if (formData.pincode.trim() && !PINCODE_REGEX.test(formData.pincode.trim())) {
        toast.error("Pincode must be a valid 6-digit Indian pincode");
        return;
      }

      setSaving(true);

      const dataToSend = {
        companyName: formData.companyName.trim(),
        email: formData.email.trim(),
        phoneCountryCode: "+91",
        phoneNumber: formData.phoneNumber.trim(),
        address: formData.address.trim(),
        state: toTitleCase(formData.state.trim()),
        pincode: formData.pincode.trim(),
        region: formData.region,
        maxDeliveryRange: Number(formData.maxDeliveryRange) || 20,
      };

      const files = {};
      if (logoFile) {
        files.logo = logoFile;
      }

      const response = await adminAPI.updateBusinessSettings(dataToSend, files);
      const updatedSettings = response?.data?.data || response?.data;

      if (updatedSettings) {
        clearCache();

        if (updatedSettings.logo?.url) {
          setLogoPreview(updatedSettings.logo.url);
          setLogoFile(null);
        }
        if (updatedSettings.companyName) {
          updateTitle(updatedSettings.companyName);
        }
      }

      toast.success("Business settings saved successfully");
      window.dispatchEvent(new Event("businessSettingsUpdated"));
    } catch (error) {
      console.error("Error saving business settings:", error);
      toast.error(error?.response?.data?.message || "Failed to save business settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    fetchBusinessSettings();
    setLogoFile(null);
    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
    toast.info("Form reset to saved values");
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF5200]" />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Business setup</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Manage your company information, general configuration and business rules.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 max-w-md">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700">
            <p className="font-semibold text-amber-700 mb-0.5">Note</p>
            <p>Don&apos;t forget to click the &quot;Save Information&quot; button below to save changes.</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200">
          <div className="px-4 py-4 border-b border-slate-100">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span>Company Information</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Company name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Your Company Name"
                  value={formData.companyName}
                  onChange={(e) => handleInputChange("companyName", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  pattern="^[^\s@]+@[^\s@]+\.[^\s@]{2,}$"
                  placeholder="Enter Your Email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Region <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.region}
                  onChange={(e) => handleInputChange("region", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                >
                  <option value="India">India</option>
                  <option value="UK">UK</option>
                  <option value="US">US</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Phone <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  <div className="relative w-24">
                    <div className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-lg bg-slate-50 text-slate-700">
                      +91
                    </div>
                    <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  </div>
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]{10}"
                    minLength={10}
                    maxLength={10}
                    placeholder="Ex: 9876543210"
                    title="Enter a valid 10-digit Indian mobile number starting with 6-9"
                    value={formData.phoneNumber}
                    onChange={(e) => handleInputChange("phoneNumber", e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                  />
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Address</label>
                <textarea
                  rows={2}
                  placeholder="Enter Your Address"
                  value={formData.address}
                  onChange={(e) => handleInputChange("address", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">State</label>
                <input
                  type="text"
                  maxLength={50}
                  placeholder="Ex: Rajasthan"
                  value={formData.state}
                  onChange={(e) => handleInputChange("state", e.target.value)}
                  onBlur={(e) => handleInputChange("state", toTitleCase(e.target.value))}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Pincode</label>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="Enter 6-digit pincode"
                  value={formData.pincode}
                  onChange={(e) => handleInputChange("pincode", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Max Delivery Range (km)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  placeholder="e.g. 20"
                  value={formData.maxDeliveryRange}
                  onChange={(e) => handleInputChange("maxDeliveryRange", e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Maximum radius (km) a restaurant can set for its delivery range.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Logo</label>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
                    if (!allowedTypes.includes(file.type)) {
                      toast.error("Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.");
                      return;
                    }

                    const maxSize = 5 * 1024 * 1024;
                    if (file.size > maxSize) {
                      toast.error("File size exceeds 5MB limit.");
                      return;
                    }

                    setLogoFile(file);
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setLogoPreview(reader.result);
                    };
                    reader.readAsDataURL(file);
                  }}
                  className="hidden"
                />
                <div
                  onClick={() => logoInputRef.current?.click()}
                  className="border border-dashed border-slate-300 rounded-lg bg-slate-50/60 h-28 flex items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors relative overflow-hidden"
                >
                  {logoPreview ? (
                    <>
                      <img src={logoPreview} alt="Logo preview" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLogoPreview(null);
                          setLogoFile(null);
                          if (logoInputRef.current) {
                            logoInputRef.current.value = "";
                          }
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <Upload className="w-5 h-5 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-400">Click to upload logo</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="px-4 py-4 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-[11px] text-slate-500">
                Changes will only be applied after clicking the <span className="font-semibold">Save Information</span> button.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#FF5200] text-white hover:bg-[#E64A00] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Information"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
