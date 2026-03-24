import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { restaurantAPI } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const generateObjectIdLike = () => {
  const ts = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const chars = "abcdef0123456789";
  let rest = "";
  for (let i = 0; i < 16; i += 1) {
    rest += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${ts}${rest}`;
};

const isObjectIdLike = (value) => /^[a-f\d]{24}$/i.test(String(value || ""));

const defaultOrderSlab = () => ({
  _id: generateObjectIdLike(),
  label: "",
  minOrderValue: 0,
  maxOrderValue: null,
});

const getRateKey = (distanceSlabId, orderValueSlabId) =>
  `${String(distanceSlabId)}::${String(orderValueSlabId)}`;

export default function DeliverySettings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tierInfo, setTierInfo] = useState(null);
  const [distanceSlabs, setDistanceSlabs] = useState([]);
  const [orderValueSlabs, setOrderValueSlabs] = useState([]);
  const [rateMap, setRateMap] = useState({});

  const activeDistanceSlabs = useMemo(
    () =>
      (distanceSlabs || [])
        .filter((s) => s.isActive !== false)
        .sort((a, b) => Number(a.minKm || 0) - Number(b.minKm || 0)),
    [distanceSlabs],
  );

  const seedRateMap = (distance, order, rates) => {
    const nextMap = {};
    (rates || []).forEach((r) => {
      nextMap[getRateKey(r.distanceSlabId, r.orderValueSlabId)] = Number(
        r.perKmRate || 0,
      );
    });

    distance.forEach((d) => {
      order.forEach((o) => {
        const key = getRateKey(d._id, o._id);
        if (nextMap[key] === undefined) nextMap[key] = 0;
      });
    });
    return nextMap;
  };

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await restaurantAPI.getDeliveryPricing();
      const payload = res?.data?.data || {};
      const cfg = payload.deliveryPricingConfig || {};
      setTierInfo(payload.tier || null);
      const fetchedDistanceSlabs = Array.isArray(payload.distanceSlabs)
        ? payload.distanceSlabs
        : [];
      const fetchedOrderSlabs =
        Array.isArray(cfg.orderValueSlabs) && cfg.orderValueSlabs.length
          ? cfg.orderValueSlabs
          : [];

      setDistanceSlabs(fetchedDistanceSlabs);

      if (fetchedOrderSlabs.length) {
        setOrderValueSlabs(
          fetchedOrderSlabs.map((s) => ({
            _id: String(s._id || generateObjectIdLike()),
            label: s.label || "",
            minOrderValue: Number(s.minOrderValue || 0),
            maxOrderValue:
              s.maxOrderValue === null || s.maxOrderValue === undefined
                ? null
                : Number(s.maxOrderValue),
          })),
        );
      } else {
        setOrderValueSlabs([
          { _id: generateObjectIdLike(), label: "50-149", minOrderValue: 50, maxOrderValue: 149 },
          { _id: generateObjectIdLike(), label: "149-299", minOrderValue: 149, maxOrderValue: 299 },
          { _id: generateObjectIdLike(), label: "Above 299", minOrderValue: 299, maxOrderValue: null },
        ]);
      }

      const finalOrderSlabs =
        fetchedOrderSlabs.length > 0
          ? fetchedOrderSlabs.map((s) => ({
            _id: String(s._id || generateObjectIdLike()),
            label: s.label || "",
            minOrderValue: Number(s.minOrderValue || 0),
            maxOrderValue:
              s.maxOrderValue === null || s.maxOrderValue === undefined
                ? null
                : Number(s.maxOrderValue),
          }))
          : [
            { _id: generateObjectIdLike(), label: "50-149", minOrderValue: 50, maxOrderValue: 149 },
            { _id: generateObjectIdLike(), label: "149-299", minOrderValue: 149, maxOrderValue: 299 },
            { _id: generateObjectIdLike(), label: "Above 299", minOrderValue: 299, maxOrderValue: null },
          ];

      setRateMap(
        seedRateMap(
          fetchedDistanceSlabs.filter((s) => s.isActive !== false),
          finalOrderSlabs,
          cfg.customerDeliveryRates || [],
        ),
      );
    } catch (error) {
      console.error("Failed to load delivery pricing:", error);
      toast.error("Failed to load delivery pricing");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const addOrderValueSlab = () => {
    const slab = defaultOrderSlab();
    const nextSlabs = [...orderValueSlabs, slab];
    setOrderValueSlabs(nextSlabs);
    const nextMap = { ...rateMap };
    activeDistanceSlabs.forEach((d) => {
      nextMap[getRateKey(d._id, slab._id)] = 0;
    });
    setRateMap(nextMap);
  };

  const removeOrderValueSlab = (idx) => {
    const slab = orderValueSlabs[idx];
    const nextSlabs = orderValueSlabs.filter((_, i) => i !== idx);
    setOrderValueSlabs(nextSlabs);

    const nextMap = { ...rateMap };
    activeDistanceSlabs.forEach((d) => {
      delete nextMap[getRateKey(d._id, slab._id)];
    });
    setRateMap(nextMap);
  };

  const updateOrderValueSlab = (idx, field, value) => {
    setOrderValueSlabs((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    );
  };

  const validateBeforeSave = () => {
    if (!activeDistanceSlabs.length) {
      return "No active distance slabs available. Ask admin to configure slabs.";
    }
    if (!orderValueSlabs.length) return "Add at least one order value slab.";

    for (const slab of orderValueSlabs) {
      if (!slab._id) return "Each order value slab must have an id.";
      if (Number(slab.minOrderValue) < 0) return "Order value slab min must be >= 0.";
      if (
        slab.maxOrderValue !== null &&
        slab.maxOrderValue !== "" &&
        Number(slab.maxOrderValue) <= Number(slab.minOrderValue)
      ) {
        return "Order value slab max must be greater than min (or empty).";
      }
    }

    for (const d of activeDistanceSlabs) {
      for (const o of orderValueSlabs) {
        const key = getRateKey(d._id, o._id);
        const rate = Number(rateMap[key] ?? 0);
        if (Number.isNaN(rate) || rate < 0) {
          return "Per-km rates must be 0 or more.";
        }
      }
    }

    return null;
  };

  const handleSave = async () => {
    try {
      const validationError = validateBeforeSave();
      if (validationError) {
        toast.error(validationError);
        return;
      }

      setSaving(true);
      const slabIdMap = new Map();
      const normalizedOrderValueSlabs = orderValueSlabs.map((s) => {
        const oldId = String(s._id || "");
        const nextId = isObjectIdLike(oldId) ? oldId : generateObjectIdLike();
        slabIdMap.set(oldId, nextId);
        return {
          _id: nextId,
          label: s.label || "",
          minOrderValue: Number(s.minOrderValue),
          maxOrderValue:
            s.maxOrderValue === null || s.maxOrderValue === ""
              ? null
              : Number(s.maxOrderValue),
        };
      });

      const payload = {
        orderValueSlabs: normalizedOrderValueSlabs,
        customerDeliveryRates: activeDistanceSlabs.flatMap((d) =>
          orderValueSlabs.map((o) => {
            const oldOrderSlabId = String(o._id || "");
            const mappedOrderSlabId = slabIdMap.get(oldOrderSlabId) || oldOrderSlabId;
            return {
              distanceSlabId: String(d._id),
              orderValueSlabId: String(mappedOrderSlabId),
              perKmRate: Number(rateMap[getRateKey(d._id, oldOrderSlabId)] || 0),
            };
          }),
        ),
      };

      const res = await restaurantAPI.updateDeliveryPricing(payload);
      if (res?.data?.success) {
        toast.success("Delivery pricing saved");
        loadData();
      } else {
        toast.error(res?.data?.message || "Failed to save delivery pricing");
      }
    } catch (error) {
      console.error("Failed to save delivery pricing:", error);
      toast.error(error.response?.data?.message || "Failed to save delivery pricing");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 md:pb-0">
      <div className="bg-white border-b border-slate-200 px-3 py-3 sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors" aria-label="Go back">
              <ArrowLeft className="w-5 h-5 text-slate-900" />
            </button>
            <div>
              <h1 className="text-lg font-bold text-slate-900">Delivery Pricing</h1>
              <p className="text-xs text-slate-500">Configure customer-facing per-km pricing matrix</p>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="hidden md:inline-flex bg-blue-600 hover:bg-blue-700 text-white h-9 px-3 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save
          </Button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-3 sm:p-4 space-y-4 sm:space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-sm font-medium text-slate-700">
            Customer delivery pricing uses your order-value slabs and per-km matrix.
          </p>
          {tierInfo?.name ? (
            <p className="text-xs text-slate-500 mt-2">
              Active tier: {tierInfo.name}
            </p>
          ) : null}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-slate-900">Order Value Slabs</h2>
            <Button variant="outline" onClick={addOrderValueSlab} className="h-9 px-3 text-sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Slab
            </Button>
          </div>
          <div className="space-y-3">
            {orderValueSlabs.map((slab, idx) => (
              <div key={slab._id} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end border border-slate-200 rounded-lg p-3 sm:p-4">
                <div>
                  <label className="text-xs text-slate-500">Label</label>
                  <input
                    type="text"
                    className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm"
                    value={slab.label}
                    onChange={(e) => updateOrderValueSlab(idx, "label", e.target.value)}
                    placeholder="e.g. 50-149"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Min Value (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm"
                    value={slab.minOrderValue}
                    onChange={(e) => updateOrderValueSlab(idx, "minOrderValue", e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Max Value (Rs)</label>
                  <input
                    type="number"
                    min="0"
                    className="w-full border border-slate-300 rounded px-3 py-2.5 text-sm"
                    value={slab.maxOrderValue ?? ""}
                    onChange={(e) => updateOrderValueSlab(idx, "maxOrderValue", e.target.value === "" ? null : e.target.value)}
                    placeholder="Leave empty for open ended"
                  />
                </div>
                <div className="md:col-span-2 flex justify-start md:justify-end">
                  <Button
                    variant="ghost"
                    className="text-red-600 hover:text-red-700 h-9 px-3 w-full sm:w-auto"
                    onClick={() => removeOrderValueSlab(idx)}
                    disabled={orderValueSlabs.length === 1}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h2 className="text-base font-semibold text-slate-900 mb-1">Per Km Pricing Matrix</h2>
          <p className="text-xs text-slate-500 mb-4">
            Distance slabs are admin-defined and read-only here.
          </p>

          {!activeDistanceSlabs.length ? (
            <p className="text-sm text-red-600">No active distance slabs available for your tier configuration.</p>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {activeDistanceSlabs.map((d) => (
                  <div key={d._id} className="border border-slate-200 rounded-lg p-3 sm:p-4">
                    <div className="mb-2">
                      <div className="font-medium text-slate-900 text-sm">{d.name}</div>
                      <div className="text-xs text-slate-500">
                        {d.minKm} to {d.maxKm === null ? "Open" : d.maxKm} km
                        {d.isBaseSlab ? " (Base slab)" : ""}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {orderValueSlabs.map((o) => {
                        const key = getRateKey(d._id, o._id);
                        return (
                          <div key={key} className="flex items-center gap-2">
                            <label className="text-xs text-slate-600 min-w-0 flex-1">
                              {o.label || "Unlabeled"} (Rs/km)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={rateMap[key] ?? 0}
                              onChange={(e) =>
                                setRateMap((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              className="w-24 sm:w-28 border border-slate-300 rounded px-2 py-2.5 text-sm"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="overflow-x-auto hidden md:block">
                <table className="w-full border border-slate-200 rounded-lg">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b">Distance Slab</th>
                    {orderValueSlabs.map((o) => (
                      <th key={o._id} className="px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b">
                        {o.label || "Unlabeled"} (Rs/km)
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {activeDistanceSlabs.map((d) => (
                    <tr key={d._id}>
                      <td className="px-3 py-2 text-sm border-b border-slate-100 align-top">
                        <div className="font-medium text-slate-900">{d.name}</div>
                        <div className="text-xs text-slate-500">
                          {d.minKm} to {d.maxKm === null ? "Open" : d.maxKm} km
                          {d.isBaseSlab ? " (Base slab)" : ""}
                        </div>
                      </td>
                      {orderValueSlabs.map((o) => {
                        const key = getRateKey(d._id, o._id);
                        return (
                          <td key={key} className="px-3 py-2 border-b border-slate-100">
                            <input
                              type="number"
                              min="0"
                              step="0.1"
                              value={rateMap[key] ?? 0}
                              onChange={(e) =>
                                setRateMap((prev) => ({
                                  ...prev,
                                  [key]: e.target.value,
                                }))
                              }
                              className="w-28 border border-slate-300 rounded px-2 py-2 text-sm"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Mobile save bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white p-3 md:hidden">
        <div className="max-w-3xl mx-auto">
          <Button onClick={handleSave} disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white h-11 text-sm font-medium">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Delivery Pricing
          </Button>
        </div>
      </div>
    </div>
  );
}
