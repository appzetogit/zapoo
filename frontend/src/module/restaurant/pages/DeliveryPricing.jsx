import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Trash2, Save, Layers } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { restaurantAPI } from "@/lib/api";

const createClientId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(12);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  const timestampHex = Math.floor(Date.now() / 1000).toString(16).padStart(8, "0");
  const randomHex = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${timestampHex}${randomHex}`;
};

const normalizeNumberInput = (value) => {
  const sanitized = String(value ?? "").replace(/[^0-9.]/g, "");
  const parts = sanitized.split(".");
  return parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : sanitized;
};

const formatDistanceRange = (slab) => {
  const min = Number(slab?.minKm || 0);
  const max = slab?.maxKm === null || slab?.maxKm === undefined ? null : Number(slab.maxKm);
  return max === null ? `${min}+ km` : `${min} - ${max} km`;
};

const formatCurrency = (value) => `Rs ${Number(value || 0).toFixed(2)}`;

const getAdminReferencePrice = (distanceSlab, tier) => {
  if (distanceSlab?.isBaseSlab) {
    return Number(tier?.baseFee || 0);
  }
  return Number(distanceSlab?.adminPerKmRate || 0);
};

const buildSlabLabel = (slab) => {
  const min = Number(slab.minOrderValue || 0);
  const max = slab.maxOrderValue === "" || slab.maxOrderValue === null || slab.maxOrderValue === undefined
    ? null
    : Number(slab.maxOrderValue);
  return max === null ? `Above Rs ${min}` : `Rs ${min} - Rs ${max}`;
};

export default function DeliveryPricing() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tier, setTier] = useState(null);
  const [distanceSlabs, setDistanceSlabs] = useState([]);
  const [orderValueSlabs, setOrderValueSlabs] = useState([]);
  const [rateMap, setRateMap] = useState({});

  const activeDistanceSlabs = useMemo(
    () => distanceSlabs.filter((slab) => slab?.isActive !== false),
    [distanceSlabs]
  );

  useEffect(() => {
    const fetchPricing = async () => {
      try {
        setLoading(true);
        const response = await restaurantAPI.getDeliveryPricing();
        const data = response?.data?.data || {};
        const config = data.deliveryPricingConfig || {};
        const fetchedDistanceSlabs = Array.isArray(data.distanceSlabs) ? data.distanceSlabs : [];
        const fetchedOrderSlabs = Array.isArray(config.orderValueSlabs) ? config.orderValueSlabs : [];
        const fetchedRates = Array.isArray(config.customerDeliveryRates) ? config.customerDeliveryRates : [];

        setTier(data.tier || null);
        setDistanceSlabs(fetchedDistanceSlabs);
        setOrderValueSlabs(
          fetchedOrderSlabs.length > 0
            ? fetchedOrderSlabs.map((slab) => ({
                _id: String(slab._id || createClientId()),
                minOrderValue: String(slab.minOrderValue ?? 0),
                maxOrderValue:
                  slab.maxOrderValue === null || slab.maxOrderValue === undefined
                    ? ""
                    : String(slab.maxOrderValue),
              }))
            : [
                {
                  _id: createClientId(),
                  minOrderValue: "0",
                  maxOrderValue: "",
                },
              ]
        );

        const nextRateMap = {};
        fetchedRates.forEach((rate) => {
          const key = `${String(rate.orderValueSlabId)}::${String(rate.distanceSlabId)}`;
          nextRateMap[key] = String(rate.perKmRate ?? 0);
        });
        setRateMap(nextRateMap);
      } catch (error) {
        console.error("Error loading delivery pricing:", error);
        toast.error(error?.response?.data?.message || "Failed to load delivery setup");
      } finally {
        setLoading(false);
      }
    };

    fetchPricing();
  }, []);

  const updateOrderSlab = (slabId, field, value) => {
    setOrderValueSlabs((prev) =>
      prev.map((slab) => (slab._id === slabId ? { ...slab, [field]: normalizeNumberInput(value) } : slab))
    );
  };

  const addOrderSlab = () => {
    setOrderValueSlabs((prev) => [
      ...prev,
      {
        _id: createClientId(),
        minOrderValue: "",
        maxOrderValue: "",
      },
    ]);
  };

  const removeOrderSlab = (slabId) => {
    setOrderValueSlabs((prev) => prev.filter((slab) => slab._id !== slabId));
    setRateMap((prev) => {
      const next = { ...prev };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${slabId}::`)) {
          delete next[key];
        }
      });
      return next;
    });
  };

  const setRateValue = (orderValueSlabId, distanceSlabId, value) => {
    const key = `${orderValueSlabId}::${distanceSlabId}`;
    setRateMap((prev) => ({
      ...prev,
      [key]: normalizeNumberInput(value),
    }));
  };

  const handleSave = async () => {
    if (activeDistanceSlabs.length === 0) {
      toast.error("No active distance slabs found for your assigned tier");
      return;
    }

    if (orderValueSlabs.length === 0) {
      toast.error("Add at least one order value slab");
      return;
    }

    const normalizedOrderSlabs = [];
    for (let index = 0; index < orderValueSlabs.length; index += 1) {
      const slab = orderValueSlabs[index];
      const minOrderValue = Number(slab.minOrderValue);
      const maxOrderValue =
        slab.maxOrderValue === "" || slab.maxOrderValue === null || slab.maxOrderValue === undefined
          ? null
          : Number(slab.maxOrderValue);

      if (!Number.isFinite(minOrderValue) || minOrderValue < 0) {
        toast.error(`Invalid minimum order value in slab ${index + 1}`);
        return;
      }
      if (maxOrderValue !== null && (!Number.isFinite(maxOrderValue) || maxOrderValue <= minOrderValue)) {
        toast.error(`Maximum order value must be greater than minimum in slab ${index + 1}`);
        return;
      }

      normalizedOrderSlabs.push({
        _id: slab._id,
        label: buildSlabLabel({ minOrderValue, maxOrderValue }),
        minOrderValue,
        maxOrderValue,
      });
    }

    const customerDeliveryRates = [];
    for (const orderSlab of normalizedOrderSlabs) {
      for (const distanceSlab of activeDistanceSlabs) {
        const key = `${orderSlab._id}::${String(distanceSlab._id)}`;
        const perKmRate = Number(rateMap[key] || 0);
        if (!Number.isFinite(perKmRate) || perKmRate < 0) {
          toast.error(`Invalid rate for ${buildSlabLabel(orderSlab)} and ${formatDistanceRange(distanceSlab)}`);
          return;
        }
        customerDeliveryRates.push({
          orderValueSlabId: orderSlab._id,
          distanceSlabId: String(distanceSlab._id),
          perKmRate,
        });
      }
    }

    try {
      setSaving(true);
      await restaurantAPI.updateDeliveryPricing({
        isEnabled: true,
        orderValueSlabs: normalizedOrderSlabs,
        customerDeliveryRates,
      });
      toast.success("Delivery setup updated successfully");
    } catch (error) {
      console.error("Error saving delivery pricing:", error);
      toast.error(error?.response?.data?.message || "Failed to save delivery setup");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/restaurant/explore")}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-gray-900">Delivery setup</h1>
            <p className="text-[11px] sm:text-xs text-gray-500">Set customer delivery rates by order amount and distance slabs</p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        <div className="grid gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <Layers className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm text-gray-500">Assigned tier</p>
                <p className="text-base font-semibold text-gray-900 mt-1">
                  {loading ? "Loading..." : tier?.name || "Not assigned"}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Base fee: Rs {Number(tier?.baseFee || 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm space-y-4">
          <div className="flex items-start sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Order value slabs</h2>
              <p className="text-xs text-gray-500 mt-1">Create the bill amount ranges you want to price separately.</p>
            </div>
            <Button type="button" onClick={addOrderSlab} className="hidden sm:inline-flex gap-2 shrink-0 h-10 px-3 sm:px-4">
              <Plus className="w-4 h-4" />
              <span>Add slab</span>
            </Button>
          </div>

          <div className="space-y-3">
            {orderValueSlabs.map((slab, index) => (
              <div key={slab._id} className="border border-gray-200 rounded-xl p-3">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-sm font-semibold text-gray-900">Slab {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeOrderSlab(slab._id)}
                    disabled={orderValueSlabs.length === 1}
                    className="h-9 w-9 rounded-lg border border-red-200 text-red-600 flex items-center justify-center hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed"
                    title={`Remove slab ${index + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr] gap-3">
                  <div>
                  <label className="block text-xs text-gray-500 mb-1">Min order value</label>
                  <input
                    value={slab.minOrderValue}
                    onChange={(e) => updateOrderSlab(slab._id, "minOrderValue", e.target.value)}
                    placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Max order value</label>
                  <input
                    value={slab.maxOrderValue}
                    onChange={(e) => updateOrderSlab(slab._id, "maxOrderValue", e.target.value)}
                    placeholder="Leave blank for open ended"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                </div>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={addOrderSlab}
            className="sm:hidden w-full h-11 rounded-xl border-dashed border-gray-300 text-gray-700 gap-2"
          >
            <Plus className="w-4 h-4" />
            Add more pricing slab
          </Button>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 sm:p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Rate matrix</h2>
            <p className="text-xs text-gray-500 mt-1">
              Fill customer per-km rate for each order-value slab against each admin-defined distance slab.
            </p>
          </div>

          {activeDistanceSlabs.length === 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
              No active distance slabs are available for your assigned tier. Ask admin to configure tier delivery slabs first.
            </div>
          ) : (
            <>
              <div className="space-y-3 md:hidden">
                {orderValueSlabs.map((orderSlab) => (
                  <div key={orderSlab._id} className="rounded-xl border border-gray-200 p-3">
                    <div className="mb-3">
                      <p className="text-sm font-semibold text-gray-900">{buildSlabLabel(orderSlab)}</p>
                      <p className="text-xs text-gray-500 mt-1">Per-km customer charge</p>
                    </div>
                    <div className="space-y-3">
                      {activeDistanceSlabs.map((distanceSlab) => {
                        const cellKey = `${orderSlab._id}::${String(distanceSlab._id)}`;
                        return (
                          <div key={cellKey} className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                            <div className="mb-2">
                              <p className="text-xs font-semibold text-gray-900">{formatDistanceRange(distanceSlab)}</p>
                              <p className="text-[11px] text-gray-500 mt-1">
                                Admin tier price: {formatCurrency(getAdminReferencePrice(distanceSlab, tier))}
                              </p>
                            </div>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rs</span>
                              <input
                                value={rateMap[cellKey] ?? ""}
                                onChange={(e) => setRateValue(orderSlab._id, String(distanceSlab._id), e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white z-10 text-left text-xs font-semibold text-gray-500 p-3 border-b border-gray-200 min-w-[220px]">
                      Order value slab
                    </th>
                    {activeDistanceSlabs.map((distanceSlab) => (
                      <th
                        key={String(distanceSlab._id)}
                        className="text-left text-xs font-semibold text-gray-500 p-3 border-b border-gray-200 min-w-[170px]"
                      >
                        <div>{formatDistanceRange(distanceSlab)}</div>
                        <div className="text-[11px] font-normal text-gray-400 mt-1">
                          Admin: {formatCurrency(getAdminReferencePrice(distanceSlab, tier))}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {orderValueSlabs.map((orderSlab) => (
                    <tr key={orderSlab._id}>
                      <td className="sticky left-0 bg-white z-10 p-3 border-b border-gray-100 align-top">
                        <div className="text-sm font-medium text-gray-900">{buildSlabLabel(orderSlab)}</div>
                        <div className="text-xs text-gray-500 mt-1">Per-km customer charge</div>
                      </td>
                      {activeDistanceSlabs.map((distanceSlab) => {
                        const cellKey = `${orderSlab._id}::${String(distanceSlab._id)}`;
                        return (
                          <td key={cellKey} className="p-3 border-b border-gray-100 align-top">
                            <p className="text-[11px] text-gray-500 mb-2">
                              Admin tier price: {formatCurrency(getAdminReferencePrice(distanceSlab, tier))}
                            </p>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Rs</span>
                              <input
                                value={rateMap[cellKey] ?? ""}
                                onChange={(e) => setRateValue(orderSlab._id, String(distanceSlab._id), e.target.value)}
                                placeholder="0"
                                className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              />
                            </div>
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

        <div className="sticky bottom-0 bg-gray-50/95 backdrop-blur py-3">
          <Button
            type="button"
            onClick={handleSave}
            disabled={loading || saving}
            className="w-full h-12 rounded-xl gap-2 bg-gray-900 hover:bg-gray-800 text-white shadow-lg"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
