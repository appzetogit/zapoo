import { useCallback, useEffect, useMemo, useState } from "react";
import { Save, Loader2, DollarSign, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAPI, tierAPI } from "@/lib/api";
import { toast } from "sonner";

const emptyDistanceSlab = {
  minKm: "",
  maxKm: "",
  adminPerKmRate: 0,
  isBaseSlab: false,
  isActive: true,
};

const buildSlabName = (minKm, maxKm) => {
  const min = Number(minKm);
  const max = maxKm === "" || maxKm === null || maxKm === undefined ? null : Number(maxKm);
  if (max === null) return `${min}+ km`;
  return `${min}-${max} km`;
};

export default function FeeSettings() {
  const [feeSettings, setFeeSettings] = useState({
    deliveryFee: 25,
    freeDeliveryThreshold: 149,
    platformFee: 5,
    gstRate: 5,
    recommendedItemFee: 0,
  });
  const [tiers, setTiers] = useState([]);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [selectedTierSlabs, setSelectedTierSlabs] = useState([]);
  const [selectedTierPlatformFee, setSelectedTierPlatformFee] = useState(5);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDistanceSlab, setNewDistanceSlab] = useState(emptyDistanceSlab);

  const selectedTier = useMemo(
    () => tiers.find((t) => String(t._id) === String(selectedTierId)) || null,
    [tiers, selectedTierId],
  );

  const sortedDistanceSlabs = useMemo(
    () =>
      [...(selectedTierSlabs || [])].sort(
        (a, b) => Number(a.minKm || 0) - Number(b.minKm || 0),
      ),
    [selectedTierSlabs],
  );

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [feeRes, tierRes] = await Promise.all([
        adminAPI.getFeeSettings(),
        tierAPI.getAllTiers(),
      ]);

      const data = feeRes?.data?.data?.feeSettings;
      if (data) {
        setFeeSettings({
          deliveryFee: data.deliveryFee ?? 25,
          freeDeliveryThreshold: data.freeDeliveryThreshold ?? 149,
          platformFee: data.platformFee ?? 5,
          gstRate: data.gstRate ?? 5,
          recommendedItemFee: data.recommendedItemFee ?? 0,
        });
      }

      const fetchedTiers = Array.isArray(tierRes?.data?.data) ? tierRes.data.data : [];
      setTiers(fetchedTiers);

      if (fetchedTiers.length > 0) {
        const initialTierId = selectedTierId && fetchedTiers.some((t) => String(t._id) === String(selectedTierId))
          ? selectedTierId
          : String(fetchedTiers[0]._id);
        setSelectedTierId(initialTierId);

        const tier = fetchedTiers.find((t) => String(t._id) === String(initialTierId));
        setSelectedTierSlabs(Array.isArray(tier?.deliveryPricing?.distanceSlabs) ? tier.deliveryPricing.distanceSlabs : []);
        setSelectedTierPlatformFee(
          tier?.platformFee ?? data?.platformFee ?? 5,
        );
      } else {
        setSelectedTierId("");
        setSelectedTierSlabs([]);
        setSelectedTierPlatformFee(data?.platformFee ?? 5);
      }
    } catch (error) {
      console.error("Error fetching fee settings/tier data:", error);
      toast.error("Failed to load fee settings");
    } finally {
      setLoading(false);
    }
  }, [selectedTierId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedTierId) {
      setSelectedTierSlabs([]);
      setSelectedTierPlatformFee(feeSettings.platformFee ?? 5);
      return;
    }
    const tier = tiers.find((t) => String(t._id) === String(selectedTierId));
    setSelectedTierSlabs(Array.isArray(tier?.deliveryPricing?.distanceSlabs) ? tier.deliveryPricing.distanceSlabs : []);
    setSelectedTierPlatformFee(tier?.platformFee ?? feeSettings.platformFee ?? 5);
  }, [selectedTierId, tiers, feeSettings.platformFee]);

  const hasOverlap = (candidate, slabs, skipId = null, skipIndex = -1) => {
    const cMin = Number(candidate.minKm);
    const cMax = candidate.maxKm === null || candidate.maxKm === "" ? Infinity : Number(candidate.maxKm);

    return slabs.some((s, idx) => {
      if (skipIndex >= 0 && idx === skipIndex) return false;
      if (skipId && String(s._id) === String(skipId)) return false;
      const sMin = Number(s.minKm);
      const sMax = s.maxKm === null || s.maxKm === undefined ? Infinity : Number(s.maxKm);
      return cMin < sMax && sMin < cMax;
    });
  };

  const validateDistanceSlab = (slab, slabs, skipId = null, skipIndex = -1) => {
    if (slab.minKm === "" || Number(slab.minKm) < 0) return "Min km must be 0 or more";
    if (slab.maxKm !== "" && slab.maxKm !== null && Number(slab.maxKm) <= Number(slab.minKm)) {
      return "Max km must be greater than min km";
    }
    if (Number(slab.adminPerKmRate ?? 0) < 0) return "Admin per km rate must be 0 or more";
    if (hasOverlap(slab, slabs, skipId, skipIndex)) return "Distance slab overlaps with an existing slab";
    return null;
  };

  const handleAddDistanceSlab = () => {
    const error = validateDistanceSlab(newDistanceSlab, selectedTierSlabs);
    if (error) {
      toast.error(error);
      return;
    }

    if (newDistanceSlab.isBaseSlab) {
      const hasBase = selectedTierSlabs.some((s) => s.isBaseSlab);
      if (hasBase) {
        toast.error("Only one base slab is allowed");
        return;
      }
    }

    setSelectedTierSlabs((prev) => [
      ...prev,
      {
        name: buildSlabName(newDistanceSlab.minKm, newDistanceSlab.maxKm),
        minKm: Number(newDistanceSlab.minKm),
        maxKm: newDistanceSlab.maxKm === "" ? null : Number(newDistanceSlab.maxKm),
        adminPerKmRate: newDistanceSlab.isBaseSlab ? 0 : Number(newDistanceSlab.adminPerKmRate ?? 0),
        isBaseSlab: Boolean(newDistanceSlab.isBaseSlab),
        isActive: Boolean(newDistanceSlab.isActive),
      },
    ]);

    setNewDistanceSlab(emptyDistanceSlab);
  };

  const handleRemoveDistanceSlab = (index) => {
    setSelectedTierSlabs((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleBaseSlab = (index, checked) => {
    setSelectedTierSlabs((prev) =>
      prev.map((s, i) => {
        if (i === index) {
          return {
            ...s,
            isBaseSlab: Boolean(checked),
            adminPerKmRate: checked ? 0 : s.adminPerKmRate,
          };
        }
        if (checked) {
          return { ...s, isBaseSlab: false };
        }
        return s;
      }),
    );
  };

  const handleDistanceSlabFieldChange = (index, field, value) => {
    setSelectedTierSlabs((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)),
    );
  };

  const handleSave = async () => {
    try {
      if (!selectedTierId) {
        toast.error("Please select a tier");
        return;
      }

      setSaving(true);

      if (!selectedTierSlabs.length) {
        toast.error("Add at least one distance slab for selected tier");
        return;
      }

      const baseCount = selectedTierSlabs.filter((s) => s.isBaseSlab).length;
      if (baseCount !== 1) {
        toast.error("Exactly one base slab is required for selected tier");
        return;
      }

      for (let i = 0; i < selectedTierSlabs.length; i += 1) {
        const slab = selectedTierSlabs[i];
        const error = validateDistanceSlab(slab, selectedTierSlabs, slab._id, i);
        if (error) {
          toast.error(`${slab.name || "Slab"}: ${error}`);
          return;
        }
      }

      const globalPayload = {
        deliveryFee: Number(feeSettings.deliveryFee),
        freeDeliveryThreshold: Number(feeSettings.freeDeliveryThreshold),
        platformFee: Number(feeSettings.platformFee),
        gstRate: Number(feeSettings.gstRate),
        recommendedItemFee: Number(feeSettings.recommendedItemFee || 0),
        isActive: true,
      };

      const tierSlabsPayload = selectedTierSlabs.map((slab) => ({
        ...(slab._id ? { _id: slab._id } : {}),
        name: slab.name || buildSlabName(slab.minKm, slab.maxKm),
        minKm: Number(slab.minKm),
        maxKm: slab.maxKm === "" || slab.maxKm === null ? null : Number(slab.maxKm),
        adminPerKmRate: slab.isBaseSlab ? 0 : Number(slab.adminPerKmRate || 0),
        isBaseSlab: slab.isBaseSlab === true,
        isActive: slab.isActive !== false,
      }));

      const [globalRes] = await Promise.all([
        adminAPI.createOrUpdateFeeSettings(globalPayload),
        tierAPI.updateTier(selectedTierId, {
          distanceSlabs: tierSlabsPayload,
          platformFee: Number(selectedTierPlatformFee),
          recommendedItemFee: Number(feeSettings.recommendedItemFee || 0),
          baseFee: Number(feeSettings.deliveryFee),
          freeDeliveryThreshold: Number(feeSettings.freeDeliveryThreshold),
        }),
      ]);

      if (globalRes?.data?.success) {
        toast.success("Tier-based delivery settings saved successfully");
        await loadData();
      } else {
        toast.error(globalRes?.data?.message || "Failed to save fee settings");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900">Delivery Pricing Controls</h1>
        </div>
        <p className="text-sm text-slate-600">
          Configure global fees and tier-based distance slabs.
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">Fee Configuration</h2>
              <p className="text-sm text-slate-500 mt-1">
                Distance slabs are now managed per tier.
              </p>
            </div>
            <Button onClick={handleSave} disabled={saving || loading} className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Settings
                </>
              )}
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-green-600" />
            </div>
          ) : (
            <>
              <div className="mb-4">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Select Tier</label>
                <select
                  value={selectedTierId}
                  onChange={(e) => setSelectedTierId(e.target.value)}
                  className="w-full md:w-72 px-3 py-2 border border-slate-300 rounded-lg"
                >
                  {tiers.map((tier) => (
                    <option key={tier._id} value={tier._id}>
                      {tier.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-semibold text-slate-900">Distance Slabs (Tier-Based)</h3>
                <p className="text-sm text-slate-500 mt-1 mb-4">
                  Editing slabs for: <span className="font-semibold">{selectedTier?.name || "N/A"}</span>
                </p>

                {sortedDistanceSlabs.length > 0 && (
                  <div className="mb-4 overflow-x-auto">
                    <table className="w-full border border-slate-200 rounded-lg">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Min Km</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Max Km</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Admin Per Km</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Base</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 border-b border-slate-200">Active</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700 border-b border-slate-200">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedDistanceSlabs.map((slab) => {
                          const index = selectedTierSlabs.findIndex((s) => String(s._id || `${s.name}-${s.minKm}`) === String(slab._id || `${slab.name}-${slab.minKm}`));
                          return (
                            <tr key={slab._id || `${slab.name}-${slab.minKm}`} className="hover:bg-slate-50">
                              <td className="px-4 py-3 border-b border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={slab.minKm}
                                  onChange={(e) => handleDistanceSlabFieldChange(index, "minKm", e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                                />
                              </td>
                              <td className="px-4 py-3 border-b border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={slab.maxKm ?? ""}
                                  onChange={(e) => handleDistanceSlabFieldChange(index, "maxKm", e.target.value)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded"
                                  placeholder="No limit"
                                />
                              </td>
                              <td className="px-4 py-3 border-b border-slate-100">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.1"
                                  value={slab.adminPerKmRate}
                                  onChange={(e) => handleDistanceSlabFieldChange(index, "adminPerKmRate", e.target.value)}
                                  disabled={Boolean(slab.isBaseSlab)}
                                  className="w-full px-2 py-1 text-sm border border-slate-300 rounded disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                                />
                              </td>
                              <td className="px-4 py-3 border-b border-slate-100">
                                <input
                                  type="checkbox"
                                  checked={Boolean(slab.isBaseSlab)}
                                  onChange={(e) => handleToggleBaseSlab(index, e.target.checked)}
                                />
                              </td>
                              <td className="px-4 py-3 border-b border-slate-100">
                                <input
                                  type="checkbox"
                                  checked={slab.isActive !== false}
                                  onChange={(e) => handleDistanceSlabFieldChange(index, "isActive", e.target.checked)}
                                />
                              </td>
                              <td className="px-4 py-3 border-b border-slate-100 text-center">
                                <button onClick={() => handleRemoveDistanceSlab(index)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors" type="button">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-700 mb-3">Add New Distance Slab</h4>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newDistanceSlab.minKm}
                      onChange={(e) => setNewDistanceSlab((prev) => ({ ...prev, minKm: e.target.value }))}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      placeholder="Min km"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newDistanceSlab.maxKm}
                      onChange={(e) => setNewDistanceSlab((prev) => ({ ...prev, maxKm: e.target.value }))}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg"
                      placeholder="Max km"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.1"
                      value={newDistanceSlab.adminPerKmRate}
                      onChange={(e) => setNewDistanceSlab((prev) => ({ ...prev, adminPerKmRate: e.target.value }))}
                      disabled={Boolean(newDistanceSlab.isBaseSlab)}
                      className="px-3 py-2 text-sm border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 disabled:cursor-not-allowed"
                      placeholder="Admin per km"
                    />
                    <label className="text-sm flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newDistanceSlab.isBaseSlab}
                        onChange={(e) =>
                          setNewDistanceSlab((prev) => ({
                            ...prev,
                            isBaseSlab: e.target.checked,
                            adminPerKmRate: e.target.checked ? 0 : prev.adminPerKmRate,
                          }))
                        }
                      />
                      Base slab
                    </label>
                    <Button type="button" onClick={handleAddDistanceSlab} className="bg-green-600 hover:bg-green-700 text-white text-sm flex items-center justify-center gap-2">
                      <Plus className="w-4 h-4" />
                      Add
                    </Button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-200 pt-6 mt-6">
                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Default Delivery Fee (Rs)</label>
                  <input
                    type="number"
                    value={feeSettings.deliveryFee}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, deliveryFee: e.target.value }))}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Platform Fee (Selected Tier, Rs)</label>
                  <input
                    type="number"
                    value={selectedTierPlatformFee}
                    onChange={(e) => setSelectedTierPlatformFee(e.target.value)}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">GST Rate (%)</label>
                  <input
                    type="number"
                    value={feeSettings.gstRate}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, gstRate: e.target.value }))}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-semibold text-slate-700">Recommended Item Fee (Rs)</label>
                  <input
                    type="number"
                    value={feeSettings.recommendedItemFee}
                    onChange={(e) => setFeeSettings((prev) => ({ ...prev, recommendedItemFee: e.target.value }))}
                    min="0"
                    step="1"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
