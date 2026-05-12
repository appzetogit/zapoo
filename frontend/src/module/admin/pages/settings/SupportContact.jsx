import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { API_ENDPOINTS } from "@/lib/api/config";

export default function SupportContact() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    phone: "",
  });

  useEffect(() => {
    const fetchSupportContact = async () => {
      try {
        setLoading(true);
        const response = await api.get(API_ENDPOINTS.ADMIN.SUPPORT);
        if (response.data?.success) {
          const payload = response.data.data || {};
          setFormData({
            email: payload.email || "",
            phone: payload.phone || "",
          });
        }
      } catch (error) {
        console.error("Error loading support contact:", error);
        toast.error("Failed to load support contact");
      } finally {
        setLoading(false);
      }
    };

    fetchSupportContact();
  }, []);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        email: formData.email?.trim(),
        phone: formData.phone?.trim(),
      };

      const response = await api.put(API_ENDPOINTS.ADMIN.SUPPORT, payload);
      if (response.data?.success) {
        const next = response.data.data || payload;
        setFormData({
          email: next.email || "",
          phone: next.phone || "",
        });
        toast.success("Support contact updated successfully");
      }
    } catch (error) {
      console.error("Error updating support contact:", error);
      toast.error(error.response?.data?.message || "Failed to update support contact");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Support Contact</h1>
          <p className="text-sm text-slate-600 mt-1">
            Manage one shared support email and phone number for user, restaurant, and delivery support pages.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="support-email">
              Support Email
            </label>
            <input
              id="support-email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="support@zapoo.com"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2" htmlFor="support-phone">
              Support Phone Number
            </label>
            <input
              id="support-phone"
              type="text"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="8919142335"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
