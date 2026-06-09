import { useEffect, useMemo, useState } from "react";
import { Search, Plus, TicketPercent, Pencil, X } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { useTranslation } from "react-i18next";

const INITIAL_FORM = {
  code: "",
  title: "",
  description: "",
  localizedTitle: { en: "", hi: "", bn: "" },
  localizedDescription: { en: "", hi: "", bn: "" },
  discountType: "percentage",
  discountValue: "",
  maxDiscountAmount: "",
  minOrderValue: "",
  perUserLimit: "",
  globalUsageLimit: "",
  eligibilityType: "first_delivered_order",
  validFrom: "",
  validUntil: "",
  status: "active",
};

const getInitialForm = () => ({
  ...INITIAL_FORM,
  localizedTitle: { ...INITIAL_FORM.localizedTitle },
  localizedDescription: { ...INITIAL_FORM.localizedDescription },
});

export default function Coupons() {
  const { t } = useTranslation();
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [activeTab, setActiveTab] = useState("admin");
  const [searchQuery, setSearchQuery] = useState("");
  const [restaurantOffers, setRestaurantOffers] = useState([]);
  const [customerCoupons, setCustomerCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(getInitialForm);
  const [editingCouponId, setEditingCouponId] = useState(null);

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
      setError(err?.response?.data?.message || t("admin.coupons.errors.fetchData"));
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

  const handleLocalizedInputChange = (field, value) => {
    const localizedKey = field === "title" ? "localizedTitle" : "localizedDescription";
    setForm((prev) => {
      const nextLocalized = {
        en: prev[localizedKey]?.en || prev[field] || "",
        hi: prev[localizedKey]?.hi || "",
        bn: prev[localizedKey]?.bn || "",
        [activeLanguage]: value,
      };
      return {
        ...prev,
        [localizedKey]: nextLocalized,
        [field]: nextLocalized.en,
      };
    });
  };

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setError(null);

      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        title: (form.localizedTitle?.en || form.title || "").trim(),
        description: (form.localizedDescription?.en || form.description || "").trim(),
        localizedTitle: form.localizedTitle,
        localizedDescription: form.localizedDescription,
        locale: activeLanguage,
        autoTranslate: activeLanguage === "en",
        discountValue: Number(form.discountValue),
        maxDiscountAmount: form.maxDiscountAmount === "" ? null : Number(form.maxDiscountAmount),
        minOrderValue: form.minOrderValue === "" ? 0 : Number(form.minOrderValue),
        perUserLimit: Number(form.perUserLimit),
        globalUsageLimit: Number(form.globalUsageLimit),
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || null,
      };

      if (editingCouponId) {
        await adminAPI.updateCustomerCoupon(editingCouponId, payload);
      } else {
        await adminAPI.createCustomerCoupon(payload);
      }

      setForm(getInitialForm());
      setEditingCouponId(null);
      const coupons = await fetchCustomerCoupons();
      setCustomerCoupons(coupons);
      setActiveTab("admin");
    } catch (err) {
      console.error("Error saving customer coupon:", err);
      setError(err?.response?.data?.message || t("admin.coupons.errors.saveCoupon"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditCoupon = (coupon) => {
    setEditingCouponId(coupon._id);
    setForm({
      code: coupon.code || "",
      title: coupon.title || "",
      description: coupon.description || "",
      localizedTitle: {
        en: coupon.localizedTitle?.en || coupon.title || "",
        hi: coupon.localizedTitle?.hi || "",
        bn: coupon.localizedTitle?.bn || "",
      },
      localizedDescription: {
        en: coupon.localizedDescription?.en || coupon.description || "",
        hi: coupon.localizedDescription?.hi || "",
        bn: coupon.localizedDescription?.bn || "",
      },
      discountType: coupon.discountType || "percentage",
      discountValue: coupon.discountValue ?? "",
      maxDiscountAmount: coupon.maxDiscountAmount ?? "",
      minOrderValue: coupon.minOrderValue ?? "",
      perUserLimit: coupon.perUserLimit ?? "",
      globalUsageLimit: coupon.globalUsageLimit ?? "",
      eligibilityType: coupon.eligibilityType || "first_delivered_order",
      validFrom: coupon.validFrom ? new Date(coupon.validFrom).toISOString().slice(0, 16) : "",
      validUntil: coupon.validUntil ? new Date(coupon.validUntil).toISOString().slice(0, 16) : "",
      status: coupon.status || "active",
    });
    setActiveTab("admin");
  };

  const handleCancelEdit = () => {
    setEditingCouponId(null);
    setForm(getInitialForm());
  };

  const handleStatusChange = async (couponId, nextStatus) => {
    try {
      await adminAPI.updateCustomerCouponStatus(couponId, nextStatus);
      const coupons = await fetchCustomerCoupons();
      setCustomerCoupons(coupons);
    } catch (err) {
      console.error("Error updating coupon status:", err);
      setError(err?.response?.data?.message || t("admin.coupons.errors.updateStatus"));
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{t("admin.coupons.title")}</h1>
              <p className="text-sm text-slate-500 mt-1">
                {t("admin.coupons.subtitle")}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("admin")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === "admin" ? "bg-[#FF5200] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {t("admin.coupons.tabs.adminCoupons")}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("restaurant")}
                className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === "restaurant" ? "bg-[#FF5200] text-white" : "bg-slate-100 text-slate-700"}`}
              >
                {t("admin.coupons.tabs.restaurantOffers")}
              </button>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={activeTab === "admin" ? t("admin.coupons.search.adminPlaceholder") : t("admin.coupons.search.restaurantPlaceholder")}
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
                <h2 className="text-lg font-bold text-slate-900">{editingCouponId ? t("admin.coupons.form.editTitle") : t("admin.coupons.form.createTitle")}</h2>
              </div>

              <form onSubmit={handleCreateCoupon} className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                <div className="md:col-span-2 xl:col-span-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {[
                      { code: "en", label: t("common.languageNames.en") },
                      { code: "hi", label: t("common.languageNames.hi") },
                      { code: "bn", label: t("common.languageNames.bn") },
                    ].map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => setActiveLanguage(lang.code)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold ${
                          activeLanguage === lang.code
                            ? "bg-[#FF5200] text-white"
                            : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        {lang.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Field label={t("admin.coupons.form.fields.couponCode")}>
                  <input value={form.code} onChange={(e) => handleInputChange("code", e.target.value.toUpperCase())} className="field" placeholder={t("admin.coupons.form.placeholders.couponCode")} required />
                </Field>
                <Field label={t("admin.coupons.form.fields.title")}>
                  <input
                    value={form.localizedTitle?.[activeLanguage] || ""}
                    onChange={(e) => handleLocalizedInputChange("title", e.target.value)}
                    className="field"
                    placeholder={t("admin.coupons.form.placeholders.title")}
                    required={activeLanguage === "en"}
                  />
                </Field>
                <Field label={t("admin.coupons.form.fields.eligibility")}>
                  <select value={form.eligibilityType} onChange={(e) => handleInputChange("eligibilityType", e.target.value)} className="field">
                    <option value="first_delivered_order">{t("admin.coupons.eligibility.firstDeliveredOnly")}</option>
                    <option value="all_users">{t("admin.coupons.eligibility.allUsers")}</option>
                  </select>
                </Field>
                <Field label={t("admin.coupons.form.fields.discountType")}>
                  <select value={form.discountType} onChange={(e) => handleInputChange("discountType", e.target.value)} className="field">
                    <option value="percentage">{t("admin.coupons.discountType.percentage")}</option>
                    <option value="flat">{t("admin.coupons.discountType.flat")}</option>
                  </select>
                </Field>
                <Field label={form.discountType === "percentage" ? t("admin.coupons.form.fields.discountPercent") : t("admin.coupons.form.fields.discountAmount")}>
                  <input type="number" min="0" step="0.01" value={form.discountValue} onChange={(e) => handleInputChange("discountValue", e.target.value)} className="field" placeholder={form.discountType === "percentage" ? t("admin.coupons.form.placeholders.discountPercent") : t("admin.coupons.form.placeholders.discountAmount")} required />
                </Field>
                <Field label={t("admin.coupons.form.fields.maxDiscountAmount")}>
                  <input type="number" min="0" step="0.01" value={form.maxDiscountAmount} onChange={(e) => handleInputChange("maxDiscountAmount", e.target.value)} className="field" placeholder={t("admin.coupons.form.placeholders.optional")} />
                </Field>
                <Field label={t("admin.coupons.form.fields.minOrderValue", "Min Order Value")}>
                  <input type="number" min="0" step="0.01" value={form.minOrderValue} onChange={(e) => handleInputChange("minOrderValue", e.target.value)} className="field" placeholder="0" />
                </Field>
                <Field label="Per User Limit">
                  <input type="number" min="1" step="1" value={form.perUserLimit} onChange={(e) => handleInputChange("perUserLimit", e.target.value)} className="field" placeholder="e.g. 1" required />
                </Field>
                <Field label="Global Usage Limit">
                  <input type="number" min="1" step="1" value={form.globalUsageLimit} onChange={(e) => handleInputChange("globalUsageLimit", e.target.value)} className="field" placeholder="e.g. 100" required />
                </Field>
                <Field label={t("admin.coupons.form.fields.validFrom")}>
                  <input type="datetime-local" value={form.validFrom} onChange={(e) => handleInputChange("validFrom", e.target.value)} className="field" />
                </Field>
                <Field label={t("admin.coupons.form.fields.validUntil")}>
                  <input type="datetime-local" value={form.validUntil} onChange={(e) => handleInputChange("validUntil", e.target.value)} className="field" />
                </Field>
                <div className="md:col-span-2 xl:col-span-3">
                  <Field label={t("admin.coupons.form.fields.description")}>
                    <textarea
                      value={form.localizedDescription?.[activeLanguage] || ""}
                      onChange={(e) => handleLocalizedInputChange("description", e.target.value)}
                      className="field min-h-[96px]"
                      placeholder={t("admin.coupons.form.placeholders.description")}
                    />
                  </Field>
                </div>
                <div className="md:col-span-2 xl:col-span-3 flex justify-end">
                  <div className="flex items-center gap-3">
                    {editingCouponId && (
                      <button
                        type="button"
                        onClick={handleCancelEdit}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <X className="h-4 w-4" />
                        {t("admin.coupons.form.cancelEdit")}
                      </button>
                    )}
                    <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-[#FF5200] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    <TicketPercent className="h-4 w-4" />
                    {submitting ? t("admin.coupons.form.saving") : editingCouponId ? t("admin.coupons.form.saveChanges") : t("admin.coupons.form.createCta")}
                  </button>
                  </div>
                </div>
              </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900">{t("admin.coupons.tabs.adminCoupons")}</h2>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                  {filteredCustomerCoupons.length} {filteredCustomerCoupons.length === 1 ? t("admin.coupons.count.coupon") : t("admin.coupons.count.coupons")}
                </span>
              </div>

              {loading ? (
                <LoadingState text={t("admin.coupons.loading.customerCoupons")} />
              ) : filteredCustomerCoupons.length === 0 ? (
                <EmptyState text={t("admin.coupons.empty.adminCoupons")} />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {[
                          t("admin.coupons.table.code"),
                          t("admin.coupons.table.title"),
                          t("admin.coupons.table.eligibility"),
                          t("admin.coupons.table.discount"),
                          t("admin.coupons.table.minOrder", "Min Order"),
                          "Per User Limit",
                          "Global Limit",
                          t("admin.coupons.table.deliveredUses", "Delivered Uses"),
                          t("admin.coupons.table.status"),
                          t("admin.coupons.table.validUntil"),
                          t("admin.coupons.table.actions"),
                        ].map((label) => (
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
                            {coupon.eligibilityType === "first_delivered_order" ? t("admin.coupons.eligibility.firstDelivered") : t("admin.coupons.eligibility.allUsers")}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {coupon.discountType === "percentage"
                              ? `${coupon.discountValue}%${coupon.maxDiscountAmount ? ` (${t("admin.coupons.table.max")} ${t("admin.coupons.currency.rs")} ${coupon.maxDiscountAmount})` : ""}`
                              : `${t("admin.coupons.currency.rs")} ${coupon.discountValue}`}
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">{t("admin.coupons.currency.rs")} {coupon.minOrderValue || 0}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{coupon.perUserLimit}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{coupon.globalUsageCount || 0} / {coupon.globalUsageLimit}</td>
                          <td className="px-4 py-4 text-sm text-slate-700">{coupon.deliveredUses || 0}</td>
                          <td className="px-4 py-4">
                            <select
                              value={coupon.status}
                              onChange={(e) => handleStatusChange(coupon._id, e.target.value)}
                              className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm"
                            >
                              <option value="draft">{t("admin.coupons.status.draft")}</option>
                              <option value="active">{t("admin.coupons.status.active")}</option>
                              <option value="paused">{t("admin.coupons.status.paused")}</option>
                              <option value="expired">{t("admin.coupons.status.expired")}</option>
                              <option value="cancelled">{t("admin.coupons.status.cancelled")}</option>
                            </select>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            {coupon.validUntil ? new Date(coupon.validUntil).toLocaleString() : t("admin.coupons.table.noExpiry")}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              onClick={() => handleEditCoupon(coupon)}
                              className="inline-flex items-center gap-2 rounded-lg border border-[#FF5200] px-3 py-1.5 text-sm font-semibold text-[#FF5200] hover:bg-[#FF5200]/5"
                            >
                              <Pencil className="h-4 w-4" />
                              {t("admin.coupons.actions.edit")}
                            </button>
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
              <h2 className="text-xl font-bold text-slate-900">{t("admin.coupons.restaurantTable.title")}</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredRestaurantOffers.length} {filteredRestaurantOffers.length === 1 ? t("admin.coupons.count.offer") : t("admin.coupons.count.offers")}
              </span>
            </div>

            {loading ? (
              <LoadingState text={t("admin.coupons.loading.restaurantOffers")} />
            ) : filteredRestaurantOffers.length === 0 ? (
              <EmptyState text={t("admin.coupons.empty.restaurantOffers")} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {[
                        t("admin.coupons.restaurantTable.si"),
                        t("admin.coupons.restaurantTable.restaurant"),
                        t("admin.coupons.restaurantTable.dish"),
                        t("admin.coupons.restaurantTable.couponCode"),
                        t("admin.coupons.restaurantTable.discount"),
                        t("admin.coupons.restaurantTable.price"),
                        t("admin.coupons.restaurantTable.status"),
                        t("admin.coupons.restaurantTable.validUntil"),
                      ].map((label) => (
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
                            ? `${t("admin.coupons.currency.rs")} ${offer.originalPrice - offer.discountedPrice} ${t("admin.coupons.common.off")}`
                            : `${offer.discountPercentage}% ${t("admin.coupons.common.off")}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-400 line-through">{t("admin.coupons.currency.rs")} {offer.originalPrice}</span>
                            <span className="text-sm font-semibold text-green-600">{t("admin.coupons.currency.rs")} {offer.discountedPrice}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${offer.status === "active" ? "bg-green-100 text-green-700" : offer.status === "paused" ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-700"}`}>
                            {offer.status || t("admin.coupons.status.inactive")}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {offer.endDate ? new Date(offer.endDate).toLocaleDateString() : t("admin.coupons.table.noExpiry")}
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
