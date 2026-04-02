import { useEffect, useMemo, useState } from "react";
import { Search, Plus, TicketPercent } from "lucide-react";
import { adminAPI } from "@/lib/api";

const INITIAL_FORM = {
  code: "",
  title: "",
  description: "",
  discountType: "percentage",
  discountValue: "",
  maxDiscountAmount: "",
  minOrderValue: "",
  eligibilityType: "first_delivered_order",
  validFrom: "",
  validUntil: "",
  status: "active",
};

export default function Coupons() {
  const [activeTab, setActiveTab] = useState("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurantOffers, setRestaurantOffers] = useState([]);
  const [customerCoupons, setCustomerCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(INITIAL_FORM);

  const fetchRestaurantOffers = async () => {
    const response = await adminAPI.getAllOffers({});
    return response?.data?.data?.offers || [];
  };

  const fetchCustomerCoupons = async () => {
    const response = await adminAPI.getCustomerCoupons({});
    return response?.data?.data?.coupons || [];
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [offers, coupons] = await Promise.all([
        fetchRestaurantOffers(),
        fetchCustomerCoupons(),
      ]);

      setRestaurantOffers(offers);
      setCustomerCoupons(coupons);
    } catch (err) {
      console.error("Error fetching coupons data:", err);
      setError(err?.response?.data?.message || "Failed to fetch coupons data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredRestaurantOffers = useMemo(() => {
    if (!searchQuery.trim()) return restaurantOffers;
    const query = searchQuery.toLowerCase().trim();
    return restaurantOffers.filter((offer) =>
      offer.restaurantName?.toLowerCase().includes(query) ||
      offer.dishName?.toLowerCase().includes(query) ||
      offer.couponCode?.toLowerCase().includes(query)
    );
  }, [restaurantOffers, searchQuery]);

  const filteredCustomerCoupons = useMemo(() => {
    if (!searchQuery.trim()) return customerCoupons;
    const query = searchQuery.toLowerCase().trim();
    return customerCoupons.filter((coupon) =>
      coupon.code?.toLowerCase().includes(query) ||
      coupon.title?.toLowerCase().includes(query) ||
      coupon.description?.toLowerCase().includes(query)
    );
  }, [customerCoupons, searchQuery]);

  const handleInputChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      await adminAPI.createCustomerCoupon({
        ...form,
        code: form.code.trim().toUpperCase(),
        discountValue: Number(form.discountValue),
        maxDiscountAmount: form.maxDiscountAmount === "" ? null : Number(form.maxDiscountAmount),
        minOrderValue: form.minOrderValue === "" ? 0 : Number(form.minOrderValue),
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || null,
      });

      setForm(INITIAL_FORM);
      const coupons = await fetchCustomerCoupons();
      setCustomerCoupons(coupons);
      setActiveTab("admin");
    } catch (err) {
      console.error("Error creating customer coupon:", err);
      setError(err?.response?.data?.message || "Failed to create customer coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (couponId, nextStatus) => {
    try {
      await adminAPI.updateCustomerCouponStatus(couponId, nextStatus);
      const coupons = await fetchCustomerCoupons();
      setCustomerCoupons(coupons);
    } catch (err) {
      console.error("Error updating coupon status:", err);
      setError(err?.response?.data?.message || "Failed to update coupon status");
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Coupons & Offers</h1>
              <p className="text-sm text-slate-500 mt-1">
                Manage admin coupons separately from restaurant-created offers.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === "admin" ? "bg-[#FF5200] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Admin Coupons
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("restaurant")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === "restaurant" ? "bg-[#FF5200] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                Restaurant Offers
              </button>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "admin" ? "Search by code, title, or description..." : "Search by restaurant, dish, or coupon code..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {activeTab === "admin" && (
          <>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Plus className="h-5 w-5 text-[#FF5200]" />
                <h2 className="text-lg font-bold text-slate-900">Create Customer Coupon</h2>
              </div>

              <form onSubmit={handleCreateCoupon} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <Field label="Coupon Code">
                  <input value={form.code} onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())} className="field" placeholder="FIRST20" required />
                </Field>
                <Field label="Title">
                  <input value={form.title} onChange={(e) => handleInputChange("title", e.target.value)} className="field" placeholder="20% off on first order" required />
                </Field>
                <Field label="Eligibility">
                  <select value={form.eligibilityType} onChange={(e) => handleInputChange("eligibilityType", e.target.value)} className="field">
                    <option value="first_delivered_order">First delivered order only</option>
                    <option value="all_users">All users</option>
                  </select>
                </Field>
                <Field label="Discount Type">
                  <select value={form.discountType} onChange={(e) => handleInputChange("discountType", e.target.value)} className="field">
                    <option value="percentage">Percentage</option>
                    <option value="flat">Flat amount</option>
                  </select>
                </Field>
                <Field label={form.discountType === "percentage" ? "Discount %" : "Discount Amount"}>
                  <input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => handleInputChange("discountValue", e.target.value)} className="field" placeholder={form.discountType === "percentage" ? "20" : "100"} required />
                </Field>
                <Field label="Max Discount Amount">
                  <input type="number" min="0" step="0.01" value={form.maxDiscountAmount} onChange={(e) => handleInputChange("maxDiscountAmount", e.target.value)} className="field" placeholder="Optional" />
                </Field>
                <Field label="Minimum Order Value">
                  <input type="number" min="0" step="0.01" value={form.minOrderValue} onChange={(e) => handleInputChange("minOrderValue", e.target.value)} className="field" placeholder="0" />
                </Field>
                <Field label="Valid From">
                  <input type="datetime-local" value={form.validFrom} onChange={(e) => handleInputChange("validFrom", e.target.value)} className="field" />
                </Field>
                <Field label="Valid Until">
                  <input type="datetime-local" value={form.validUntil} onChange={(e) => handleInputChange("validUntil", e.target.value)} className="field" />
                </Field>
                <div className="md:col-span-2 xl:col-span-3">
                  <Field label="Description">
                    <textarea value={form.description} onChange={(e) => handleInputChange("description", e.target.value)} className="field min-h-[96px]" placeholder="Shown to users in the cart coupon section" />
                  </Field>
                </div>
                <div className="md:col-span-2 xl:col-span-3 flex justify-end">
                  <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-[#FF5200] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    <TicketPercent className="h-4 w-4" />
                    {submitting ? "Creating..." : "Create Coupon"}
                  </button>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">Admin Coupons</h2>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                  {filteredCustomerCoupons.length} {filteredCustomerCoupons.length === 1 ? "coupon" : "coupons"}
                </span>
              </div>

              {loading ? (
                <LoadingState text="Loading customer coupons..." />
              ) : filteredCustomerCoupons.length === 0 ? (
                <EmptyState text="No admin coupons created yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {["Code", "Title", "Eligibility", "Discount", "Min Order", "Delivered Uses", "Status", "Valid Until"].map((label) => (
                          <th key={label} className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredCustomerCoupons.map((coupon) => (
                        <tr key={coupon._id} className="hover:bg-slate-50">
                          <td className="px-4 py-4 text-sm font-mono font-semibold text-[#FF5200]">{coupon.code}</td>
                          <td className="px-4 py-4">
                            <div className="text-sm font-medium text-slate-900">{coupon.title}</div>
                            {coupon.description && <div className="text-xs text-slate-500 mt-1">{coupon.description}</div>}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {coupon.eligibilityType === "first_delivered_order" ? "First delivered order" : "All users"}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {coupon.discountType === "percentage"
                              ? `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (max Rs ${coupon.maxDiscountAmount})` : ""}`
                              : `Rs ${coupon.discountValue}`}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">Rs {coupon.minOrderValue || 0}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{coupon.deliveredUses || 0}</td>
                          <td className="px-4 py-4">
                            <select
                              value={coupon.status}
                              onChange={(e) => handleStatusChange(coupon._id, e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                            >
                              <option value="draft">Draft</option>
                              <option value="active">Active</option>
                              <option value="paused">Paused</option>
                              <option value="expired">Expired</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {coupon.validUntil ? new Date(coupon.validUntil).toLocaleString() : "No expiry"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === "restaurant" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900">Restaurant Offers & Coupons</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredRestaurantOffers.length} {filteredRestaurantOffers.length === 1 ? "offer" : "offers"}
              </span>
            </div>

            {loading ? (
              <LoadingState text="Loading restaurant offers..." />
            ) : filteredRestaurantOffers.length === 0 ? (
              <EmptyState text="No restaurant offers found" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {["SI", "Restaurant", "Dish", "Coupon Code", "Discount", "Price", "Status", "Valid Until"].map((label) => (
                        <th key={label} className="px-6 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">{label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-100">
                    {filteredRestaurantOffers.map((offer) => (
                      <tr key={`${offer.offerId}-${offer.dishId}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-700">{offer.sl}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-900">{offer.restaurantName}</td>
                        <td className="px-6 py-4 text-sm text-slate-700">{offer.dishName}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-mono font-semibold text-[#FF5200] bg-orange-50 px-2 py-1 rounded">{offer.couponCode}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {offer.discountType === "flat-price"
                            ? `Rs ${offer.originalPrice - offer.discountedPrice} OFF`
                            : `${offer.discountPercentage}% OFF`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 line-through">Rs {offer.originalPrice}</span>
                            <span className="text-sm font-semibold text-green-600">Rs {offer.discountedPrice}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${offer.status === "active" ? "bg-green-100 text-green-700" : offer.status === "paused" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>
                            {offer.status || "Inactive"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : "No expiry"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .field {
          width: 100%;
          border: 1px solid rgb(203 213 225);
          border-radius: 0.75rem;
          padding: 0.625rem 0.875rem;
          font-size: 0.875rem;
          background: white;
          color: rgb(15 23 42);
        }
        .field:focus {
          outline: none;
          border-color: #FF5200;
          box-shadow: 0 0 0 2px rgba(255, 82, 0, 0.12);
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-2">{label}</span>
      {children}
    </label>
  );
}

function LoadingState({ text }) {
  return (
    <div className="text-center py-16">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#FF5200]" />
      <p className="text-sm text-slate-500 mt-4">{text}</p>
    </div>
  );
}

function EmptyState({ text }) {
  return (
    <div className="text-center py-16">
      <p className="text-lg font-semibold text-slate-700 mb-1">{text}</p>
    </div>
  );
}
