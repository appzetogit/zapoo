import { useState, useMemo, useEffect } from "react";
import apiClient from "@/lib/api";
import { Search, Download, ChevronDown, Bell, Edit, Trash2, Upload, Settings, Image as ImageIcon } from "lucide-react";

// Using placeholders for notification images
const notificationImage1 = "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&h=400&fit=crop";
const notificationImage2 = "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&h=400&fit=crop";
const notificationImage3 = "https://images.unsplash.com/photo-1556910096-6f5e72db6803?w=800&h=400&fit=crop";
const notificationImages = {
  15: notificationImage1,
  17: notificationImage2,
  18: notificationImage3
};
export default function PushNotification() {
  const [formData, setFormData] = useState({
    title: "",
    zone: "All",
    sendTo: "Customer",
    description: ""
  });
  const [notifications, setNotifications] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);

  // Fetch notifications from backend
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const res = await apiClient.get("/admin/notifications/broadcast/history");
      // Map backend fields to local state if needed, or just use them
      setNotifications(res.data.data.notifications || []);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const filteredNotifications = useMemo(() => {
    if (!searchQuery.trim()) {
      return notifications;
    }
    const query = searchQuery.toLowerCase().trim();
    return notifications.filter(notification =>
      notification.title?.toLowerCase().includes(query) ||
      notification.description?.toLowerCase().includes(query)
    );
  }, [notifications, searchQuery]);
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        window.alert("Image size must be less than 2MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.description.trim()) {
      window.alert("Please enter both title and description.");
      return;
    }

    // Map UI "Send To" selection to backend targetRole
    let targetRole = "all";
    if (formData.sendTo === "Customer") {
      targetRole = "customer";
    } else if (formData.sendTo === "Delivery Man") {
      targetRole = "delivery";
    } else if (formData.sendTo === "Restaurant") {
      targetRole = "restaurant";
    }

    try {
      setIsSubmitting(true);

      const payload = new FormData();
      payload.append("title", formData.title.trim());
      payload.append("body", formData.description.trim());
      payload.append("targetRole", targetRole);
      payload.append("data", JSON.stringify({
        zone: formData.zone || "All",
      }));

      if (imageFile) {
        payload.append("image", imageFile);
      }

      await apiClient.post("/admin/notifications/broadcast", payload, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      window.alert("Notification sent successfully!");
      handleReset();
      fetchNotifications(); // Refresh history list
    } catch (err) {
      console.error("Failed to send notification:", err);
      window.alert(
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        "Failed to send notification. Please check the console for details.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleReset = () => {
    setFormData({
      title: "",
      zone: "All",
      sendTo: "Customer",
      description: ""
    });
    setImageFile(null);
    setImagePreview(null);
  };
  const handleToggleStatus = async (id, currentStatus) => {
    // Optional: add a backend toggle if needed, or local only for UI feel
    setNotifications(notifications.map(n => n._id === id ? { ...n, isActive: !n.isActive } : n));
  };
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this notification history record?")) {
      try {
        await apiClient.delete(`/admin/notifications/broadcast/${id}`);
        fetchNotifications();
      } catch (err) {
        console.error("Failed to delete notification:", err);
        window.alert("Failed to delete notification record.");
      }
    }
  };
  return <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
    <div className="max-w-7xl mx-auto">
      {/* Create New Notification Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <Bell className="w-5 h-5 text-[#FF5200]" />
          <h1 className="text-2xl font-bold text-slate-900">Notification</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Title
              </label>
              <input type="text" value={formData.title} onChange={e => handleInputChange("title", e.target.value)} placeholder="Ex: Notification Title" className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm" />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Zone
              </label>
              <select value={formData.zone} onChange={e => handleInputChange("zone", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm">
                <option value="All">All</option>
                <option value="Asia">Asia</option>
                <option value="Europe">Europe</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Send To
              </label>
              <select value={formData.sendTo} onChange={e => handleInputChange("sendTo", e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm">
                <option value="Customer">Customer</option>
                <option value="Delivery Man">Delivery Man</option>
                <option value="Restaurant">Restaurant</option>
              </select>
            </div>
          </div>

          {/* Notification Banner Upload */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-3">
              Notification banner
            </label>
            <input
              type="file"
              id="notification-image"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            <label
              htmlFor="notification-image"
              className="relative block border-2 border-dashed border-slate-300 rounded-lg p-4 text-center hover:border-[#FF5200] transition-colors cursor-pointer min-h-[160px] flex flex-col items-center justify-center overflow-hidden"
            >
              {imagePreview ? (
                <div className="absolute inset-0 w-full h-full">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-contain bg-slate-50" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                    <p className="text-white text-xs font-medium">Click to change image</p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm font-medium text-[#FF5200] mb-1">Upload Image</p>
                  <p className="text-xs text-slate-500 max-w-xs mx-auto">
                    Image format - jpg png jpeg gif webp. Max size 2 MB. Ratio - 3:1 recommended.
                  </p>
                </>
              )}
            </label>
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Description
            </label>
            <textarea value={formData.description} onChange={e => handleInputChange("description", e.target.value)} placeholder="Ex: Notification Descriptions" rows={4} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm resize-none" />
          </div>

          <div className="flex items-center justify-end gap-4">
            <button type="button" onClick={handleReset} className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all">
              Reset
            </button>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#FF5200] text-white hover:bg-[#E64A00] disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-md"
              >
                {isSubmitting ? "Sending..." : "Send Notification"}
              </button>
              <button className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Notification List Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">Notification List</h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredNotifications.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <input type="text" placeholder="Search by title" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
              <Download className="w-4 h-4" />
              <span>Export</span>
              <ChevronDown className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Title</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Description</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Image</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Zone</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Target</th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                    Loading notifications...
                  </td>
                </tr>
              ) : filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-10 text-center text-slate-500">
                    No notifications found
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notification, index) => (
                  <tr key={notification._id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{index + 1}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-slate-900">{notification.title}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs overflow-hidden text-ellipsis whitespace-nowrap text-sm text-slate-600">
                        {notification.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {notification.imageUrl ? (
                        <div className="w-16 h-10 rounded overflow-hidden bg-slate-100 border border-slate-200 shadow-sm">
                          <img
                            src={notification.imageUrl}
                            alt={notification.title}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                        </div>
                      ) : (
                        <div className="w-16 h-10 rounded bg-slate-50 flex items-center justify-center border border-slate-100 border-dashed">
                          <ImageIcon className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-slate-700">All</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 capitalize">
                        {(notification.target || 'all').replace('all_', '')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(notification._id, notification.isActive)}
                        className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${notification.isActive !== false ? "bg-[#FF5200]" : "bg-slate-300"}`}
                      >
                        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${notification.isActive !== false ? "translate-x-5.5" : "translate-x-1"}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button onClick={() => handleDelete(notification._id)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50 hover:text-red-600 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>;
}