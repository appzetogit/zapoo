import { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";

export default function WithdrawalWindow() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    mode: "default",
    startDate: "",
    endDate: "",
    message: "",
  });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;
      if (settings?.withdrawalWindow) {
        setFormData({
          mode: settings.withdrawalWindow.mode || "default",
          startDate: settings.withdrawalWindow.startDate
            ? new Date(settings.withdrawalWindow.startDate).toISOString().slice(0, 10)
            : "",
          endDate: settings.withdrawalWindow.endDate
            ? new Date(settings.withdrawalWindow.endDate).toISOString().slice(0, 10)
            : "",
          message: settings.withdrawalWindow.message || "",
        });
      }
    } catch (error) {
      console.error("Error fetching withdrawal window:", error);
      toast.error(error?.response?.data?.message || "Failed to load withdrawal window");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const dataToSend = {
        withdrawalWindow: {
          mode: formData.mode,
          startDate: formData.startDate || null,
          endDate: formData.endDate || null,
          message: formData.message || "",
        },
      };
      await adminAPI.updateBusinessSettings(dataToSend, {});
      toast.success("Withdrawal window saved successfully");
    } catch (error) {
      console.error("Error saving withdrawal window:", error);
      toast.error(error?.response?.data?.message || "Failed to save withdrawal window");
    } finally {
      setSaving(false);
    }
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
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Withdrawal window</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Override withdrawal days for festival or special cases.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 max-w-md">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700">
            <p className="font-semibold text-amber-700 mb-0.5">Note</p>
            <p>Use Force Open/Closed with a date range to override default rules.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-4 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <span>Window configuration</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Window mode
              </label>
              <select
                value={formData.mode}
                onChange={(e) => handleInputChange("mode", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
              >
                <option value="default">Default schedule</option>
                <option value="open">Force open</option>
                <option value="closed">Force closed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Start date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange("startDate", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                End date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange("endDate", e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
              />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Optional message (for push notification)
            </label>
            <input
              type="text"
              placeholder="Festival special: withdrawal window open today"
              value={formData.message}
              onChange={(e) => handleInputChange("message", e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              You can use this message in push notifications when you open/close the window.
            </p>
          </div>
        </div>

        <div className="px-4 py-4 flex items-center justify-end gap-3">
          <button
            onClick={fetchSettings}
            className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            disabled={saving}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#FF5200] rounded-lg hover:bg-[#e64900]"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
