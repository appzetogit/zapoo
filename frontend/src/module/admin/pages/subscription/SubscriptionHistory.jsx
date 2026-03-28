import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, CreditCard, IndianRupee, Loader2, RefreshCw, Search } from "lucide-react";
import { subscriptionAPI, tierAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const PERIOD_OPTIONS = [
  { value: "overall", label: "Overall" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" }
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "completed", label: "Completed" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
  { value: "refunded", label: "Refunded" },
  { value: "all", label: "All statuses" }
];

const formatCurrency = (value) => `₹${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2
})}`;

const formatDateTime = (value) => {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const getStatusBadgeClasses = (status) => {
  switch ((status || "").toLowerCase()) {
    case "completed":
      return "bg-green-100 text-green-700 hover:bg-green-100";
    case "pending":
      return "bg-amber-100 text-amber-700 hover:bg-amber-100";
    case "failed":
      return "bg-red-100 text-red-700 hover:bg-red-100";
    case "refunded":
      return "bg-blue-100 text-blue-700 hover:bg-blue-100";
    default:
      return "bg-slate-100 text-slate-700 hover:bg-slate-100";
  }
};

export default function SubscriptionHistory() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [pagination, setPagination] = useState({
    page: Number(searchParams.get("page") || 1),
    limit: Number(searchParams.get("limit") || 20),
    total: 0,
    totalPages: 1
  });
  const [summary, setSummary] = useState({
    totalSales: 0,
    totalCollection: 0
  });

  const filters = useMemo(() => ({
    tierId: searchParams.get("tierId") || "all",
    planId: searchParams.get("planId") || "all",
    period: searchParams.get("period") || "overall",
    paymentStatus: searchParams.get("paymentStatus") || "completed",
    search: searchParams.get("search") || "",
    page: Number(searchParams.get("page") || 1),
    limit: Number(searchParams.get("limit") || 20)
  }), [searchParams]);

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const [tiersRes, plansRes] = await Promise.all([
          tierAPI.getAllTiers(),
          subscriptionAPI.getAdminPlans()
        ]);
        if (tiersRes.data?.success && Array.isArray(tiersRes.data.data)) {
          setTiers(tiersRes.data.data);
        }
        if (plansRes.data?.success && Array.isArray(plansRes.data.data)) {
          setPlans(plansRes.data.data);
        }
      } catch (error) {
        console.error("Error loading subscription history metadata:", error);
      }
    };
    loadMeta();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        setLoading(true);
        const params = {
          page: filters.page,
          limit: filters.limit,
          period: filters.period,
          paymentStatus: filters.paymentStatus,
          ...(filters.search ? { search: filters.search } : {}),
          ...(filters.tierId !== "all" ? { tierId: filters.tierId } : {}),
          ...(filters.planId !== "all" ? { planId: filters.planId } : {})
        };
        const response = await subscriptionAPI.getSubscriptionHistory(params);
        if (response.data?.success) {
          setRows(response.data.data || []);
          setPagination(response.data.pagination || {
            page: 1,
            limit: filters.limit,
            total: 0,
            totalPages: 1
          });
          setSummary(response.data.summary || { totalSales: 0, totalCollection: 0 });
        }
      } catch (error) {
        console.error("Error loading subscription history:", error);
        setRows([]);
        setSummary({ totalSales: 0, totalCollection: 0 });
      } finally {
        setLoading(false);
      }
    };
    loadHistory();
  }, [filters]);

  const updateQuery = (updates, resetPage = false) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "" || value === "all") {
        next.delete(key);
      } else {
        next.set(key, String(value));
      }
    });
    if (resetPage) {
      next.set("page", "1");
    }
    setSearchParams(next);
  };

  const handleRefresh = () => {
    updateQuery({ page: filters.page });
  };

  return (
    <div className="p-4 lg:p-6 space-y-6 bg-slate-50 min-h-screen">
      <Card className="border-neutral-200 bg-white shadow-sm">
        <CardHeader className="flex flex-col gap-4 border-b border-neutral-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">Subscription revenue</p>
            <CardTitle className="mt-2 text-2xl font-semibold text-neutral-900">Subscription purchase history</CardTitle>
            <p className="mt-2 text-sm text-neutral-500">
              Complete plan purchase history with restaurant, tier, amount and payment details.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-neutral-300" onClick={handleRefresh} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Total collection</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">{formatCurrency(summary.totalCollection)}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700">
                  <IndianRupee className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Filtered sales</p>
                  <p className="mt-2 text-3xl font-semibold text-neutral-900">{summary.totalSales}</p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
                  <CreditCard className="h-6 w-6" />
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-neutral-500">Current period</p>
                  <p className="mt-2 text-xl font-semibold capitalize text-neutral-900">
                    {PERIOD_OPTIONS.find((option) => option.value === filters.period)?.label || "Overall"}
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
                  <CalendarDays className="h-6 w-6" />
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="relative xl:col-span-2">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") updateQuery({ search: searchInput }, true);
                }}
                placeholder="Search restaurant, code, email, phone, payment id"
                className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 text-sm text-neutral-900 outline-none transition focus:border-neutral-400 focus:ring-2 focus:ring-neutral-200"
              />
            </div>
            <Select value={filters.tierId} onValueChange={(value) => updateQuery({ tierId: value }, true)}>
              <SelectTrigger className="h-11 rounded-xl border-neutral-300 bg-white text-neutral-900">
                <SelectValue placeholder="All tiers" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                <SelectItem value="all">All tiers</SelectItem>
                {tiers.map((tier) => (
                  <SelectItem key={tier._id} value={tier._id}>
                    {tier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.planId} onValueChange={(value) => updateQuery({ planId: value }, true)}>
              <SelectTrigger className="h-11 rounded-xl border-neutral-300 bg-white text-neutral-900">
                <SelectValue placeholder="All plans" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                <SelectItem value="all">All plans</SelectItem>
                {plans.map((plan) => (
                  <SelectItem key={plan._id} value={plan._id}>
                    {plan.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.period} onValueChange={(value) => updateQuery({ period: value }, true)}>
              <SelectTrigger className="h-11 rounded-xl border-neutral-300 bg-white text-neutral-900">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                {PERIOD_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Select value={filters.paymentStatus} onValueChange={(value) => updateQuery({ paymentStatus: value }, true)}>
              <SelectTrigger className="h-11 rounded-xl border-neutral-300 bg-white text-neutral-900 md:max-w-[220px]">
                <SelectValue placeholder="Payment status" />
              </SelectTrigger>
              <SelectContent className="border-neutral-200 bg-white text-neutral-900">
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" className="h-11 rounded-xl border-neutral-300" onClick={() => updateQuery({ search: searchInput }, true)}>
              Apply search
            </Button>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-neutral-300"
              onClick={() => {
                setSearchInput("");
                setSearchParams(new URLSearchParams());
              }}
            >
              Reset filters
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-neutral-50">
                  <tr>
                    {["Purchased on", "Restaurant", "Plan", "Tier", "Collected amount", "Payment", "Status"].map((label) => (
                      <th key={label} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-neutral-500">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin" />
                          Loading subscription history...
                        </div>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-16 text-center text-neutral-500">
                        No subscription purchase history found for the current filters.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row._id} className="align-top hover:bg-neutral-50/70">
                        <td className="px-4 py-4 text-sm text-neutral-700">{formatDateTime(row.purchaseDate)}</td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-neutral-900">{row.restaurantName || "Unknown restaurant"}</div>
                          <div className="mt-1 text-xs text-neutral-500">{row.restaurantCode || "—"}</div>
                          <div className="mt-1 text-xs text-neutral-500">{row.restaurantEmail || row.restaurantPhone || "—"}</div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-neutral-900">{row.planName || "Unknown plan"}</div>
                          <div className="mt-1 text-xs text-neutral-500">{row.durationInDays ? `${row.durationInDays} days` : "—"}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-neutral-700">{row.tierName || "No tier"}</td>
                        <td className="px-4 py-4 text-sm font-semibold text-neutral-900">{formatCurrency(row.amount)}</td>
                        <td className="px-4 py-4">
                          <div className="text-sm text-neutral-700">{row.razorpayPaymentId || "—"}</div>
                          <div className="mt-1 text-xs text-neutral-500">{row.razorpayOrderId || "—"}</div>
                        </td>
                        <td className="px-4 py-4">
                          <Badge className={getStatusBadgeClasses(row.paymentStatus)}>
                            {row.paymentStatus || "unknown"}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-4 text-sm text-neutral-600 md:flex-row md:items-center md:justify-between">
            <p>
              Showing page <span className="font-semibold text-neutral-900">{pagination.page}</span> of{" "}
              <span className="font-semibold text-neutral-900">{pagination.totalPages || 1}</span> with{" "}
              <span className="font-semibold text-neutral-900">{pagination.total}</span> total sales.
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-xl border-neutral-300"
                onClick={() => updateQuery({ page: Math.max(1, pagination.page - 1) })}
                disabled={pagination.page <= 1 || loading}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                className="rounded-xl border-neutral-300"
                onClick={() => updateQuery({ page: Math.min(pagination.totalPages || 1, pagination.page + 1) })}
                disabled={pagination.page >= (pagination.totalPages || 1) || loading}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
