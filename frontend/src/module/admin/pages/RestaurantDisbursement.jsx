import { useEffect, useMemo, useState } from "react";
import { Building, Loader2 } from "lucide-react";
import { adminAPI } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const formatDateTime = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("en-IN");
};

export default function RestaurantDisbursement() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [settlements, setSettlements] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);

  const totalPayable = useMemo(
    () =>
      settlements.reduce(
        (sum, s) => sum + Number(s?.restaurantEarning?.netEarning || 0),
        0,
      ),
    [settlements],
  );

  const loadSettlements = async () => {
    try {
      setLoading(true);
      const res = await adminAPI.getRestaurantSettlements();
      setSettlements(res?.data?.data?.settlements || []);
      setSelectedIds([]);
    } catch (error) {
      console.error("Failed to fetch restaurant settlements:", error);
      toast.error("Failed to load restaurant settlements");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, []);

  const toggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleAll = () => {
    if (selectedIds.length === settlements.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(settlements.map((s) => String(s._id)));
    }
  };

  const markProcessed = async () => {
    if (!selectedIds.length) {
      toast.error("Select at least one settlement");
      return;
    }
    try {
      setSubmitting(true);
      const res = await adminAPI.markSettlementsProcessed(selectedIds, "restaurant");
      if (res?.data?.success) {
        toast.success("Selected settlements marked as processed");
        loadSettlements();
      } else {
        toast.error(res?.data?.message || "Failed to mark processed");
      }
    } catch (error) {
      console.error("Failed to mark settlements:", error);
      toast.error(error.response?.data?.message || "Failed to mark processed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-blue-600" />
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Restaurant Disbursement</h1>
                <p className="text-sm text-slate-500">
                  Pending settlements eligible after 3-day window
                </p>
              </div>
            </div>
            <Button onClick={markProcessed} disabled={submitting || !selectedIds.length}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Mark Processed
            </Button>
          </div>
          <p className="text-sm text-slate-600 mt-3">
            Total payable now: Rs {totalPayable.toFixed(2)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" />
            </div>
          ) : settlements.length === 0 ? (
            <div className="p-8 text-center text-slate-500">No pending restaurant settlements found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm">
                      <input
                        type="checkbox"
                        checked={selectedIds.length === settlements.length && settlements.length > 0}
                        onChange={toggleAll}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Order</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Restaurant</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Net Earning</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Payable To Admin</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Eligible At</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {settlements.map((s) => (
                    <tr key={s._id} className="border-t border-slate-100">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(String(s._id))}
                          onChange={() => toggleRow(String(s._id))}
                        />
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">{s.orderNumber || "-"}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {s.restaurantId?.name || s.restaurantName || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        Rs {Number(s.restaurantEarning?.netEarning || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        Rs {Number(s.restaurantEarning?.payableToAdmin || 0).toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {formatDateTime(s.settlementWindows?.restaurantEligibleAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-800">
                        {s.restaurantEarning?.status || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
