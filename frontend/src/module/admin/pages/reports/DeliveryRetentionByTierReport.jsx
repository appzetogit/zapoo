import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, ArrowLeft, Layers } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { adminAPI } from "@/lib/api";
import { toast } from "sonner";

const PERIOD_OPTIONS = [
  { value: "overall", label: "Overall" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
];

export default function DeliveryRetentionByTierReport() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [period, setPeriod] = useState(searchParams.get("period") || "overall");
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({ totalRetention: 0, totalOrders: 0 });

  useEffect(() => {
    const queryPeriod = searchParams.get("period") || "overall";
    setPeriod(queryPeriod);
  }, [searchParams]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const params = period === "overall" ? {} : { period };
        const res = await adminAPI.getDeliveryRetentionByTier(params);
        const payload = res?.data?.data || {};
        setRows(Array.isArray(payload.tiers) ? payload.tiers : []);
        setSummary(payload.summary || { totalRetention: 0, totalOrders: 0 });
      } catch (error) {
        console.error("Failed to fetch delivery retention by tier:", error);
        toast.error(error?.response?.data?.message || "Failed to load delivery retention report");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [period]);

  const hasRows = useMemo(() => rows.length > 0, [rows]);

  return (
    <div className="px-4 pb-10 lg:px-6 pt-4 space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 md:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Dashboard Drilldown</p>
            <h1 className="text-2xl font-semibold text-slate-900">Delivery Retention By Tier</h1>
            <p className="text-sm text-slate-600">Admin collection from delivery split, grouped tier-wise.</p>
          </div>
          <div className="flex items-center gap-3">
            <Select
              value={period}
              onValueChange={(value) => {
                const next = new URLSearchParams(searchParams);
                if (value === "overall") next.delete("period");
                else next.set("period", value);
                setSearchParams(next, { replace: true });
              }}
            >
              <SelectTrigger className="min-w-[160px] border-slate-300 bg-white text-slate-900">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent className="border-slate-200 bg-white text-slate-900">
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="border-slate-300"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Total Retention</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">₹{Number(summary.totalRetention || 0).toLocaleString("en-IN")}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <p className="text-xs uppercase tracking-[0.14em] text-slate-500">Orders Counted</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{Number(summary.totalOrders || 0).toLocaleString("en-IN")}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-2">
          <Layers className="h-4 w-4 text-slate-600" />
          <p className="text-sm font-semibold text-slate-800">Tier-wise Collection</p>
        </div>

        {loading ? (
          <div className="p-10 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
          </div>
        ) : !hasRows ? (
          <div className="p-10 text-sm text-slate-500 text-center">No tier-wise delivery retention data found for this period.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left text-xs font-semibold text-slate-600 uppercase tracking-[0.12em] px-5 py-3">Tier</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-[0.12em] px-5 py-3">Orders</th>
                  <th className="text-right text-xs font-semibold text-slate-600 uppercase tracking-[0.12em] px-5 py-3">Admin Collection (₹)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={`${row.tierId}-${idx}`} className="border-t border-slate-100">
                    <td className="px-5 py-3 text-sm text-slate-900">{row.tierName || "Unknown Tier"}</td>
                    <td className="px-5 py-3 text-sm text-slate-700 text-right">{Number(row.orderCount || 0).toLocaleString("en-IN")}</td>
                    <td className="px-5 py-3 text-sm font-semibold text-slate-900 text-right">₹{Number(row.totalRetention || 0).toLocaleString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
