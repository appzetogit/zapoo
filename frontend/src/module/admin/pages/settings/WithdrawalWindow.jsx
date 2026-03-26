import { useEffect, useMemo, useState } from "react";
import { Info, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { adminAPI } from "@/lib/api";

const formatDateLabel = (date) =>
  date
    ? new Date(date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const toDateKey = (date) => {
  if (!date) return "";
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const fromDateKey = (key) => {
  if (!key) return null;
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

const startOfMonth = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const endOfMonth = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);

const buildMonthGrid = (date) => {
  const start = startOfMonth(date);
  const end = endOfMonth(date);
  const days = [];
  const leading = start.getDay(); // Sunday = 0
  for (let i = 0; i < leading; i += 1) days.push(null);
  for (let d = 1; d <= end.getDate(); d += 1) {
    days.push(new Date(start.getFullYear(), start.getMonth(), d));
  }
  return days;
};

const nextSunday = () => {
  const today = startOfToday();
  const day = today.getDay(); // 0 = Sun
  const diff = day === 0 ? 0 : 7 - day;
  return addDays(today, diff);
};

const nextRestaurantWithdrawalDate = () => {
  const today = startOfToday();
  for (let i = 0; i <= 31; i += 1) {
    const d = addDays(today, i);
    if (d.getDate() % 3 === 0) return d;
  }
  return today;
};

export default function WithdrawalWindow() {
  const [loading, setLoading] = useState(true);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingRestaurant, setSavingRestaurant] = useState(false);
  const [deliveryWindow, setDeliveryWindow] = useState({ openDates: [], closedDates: [] });
  const [restaurantWindow, setRestaurantWindow] = useState({ openDates: [], closedDates: [] });
  const [monthDate] = useState(() => startOfMonth(startOfToday()));
  const [activeSection, setActiveSection] = useState("delivery");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const response = await adminAPI.getBusinessSettings();
      const settings = response?.data?.data || response?.data;
      const deliveryCfg = settings?.withdrawalWindows?.delivery;
      const restaurantCfg = settings?.withdrawalWindows?.restaurant;
      const normalize = (cfg) => {
        if (!cfg) return { openDates: [], closedDates: [] };
        const normalizeList = (list) =>
          (list || [])
            .map((d) => {
              if (typeof d === "string") {
                // If it's a plain YYYY-MM-DD, parse as local day
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                  return toDateKey(fromDateKey(d));
                }
                // Otherwise, treat as ISO or other date string
                return toDateKey(d);
              }
              return toDateKey(d);
            })
            .filter(Boolean);
        const openDates = normalizeList(cfg.openDates);
        const closedDates = normalizeList(cfg.closedDates);
        if ((!openDates.length && !closedDates.length) && cfg.mode && cfg.overrideDate) {
          const legacyKey = toDateKey(cfg.overrideDate);
          if (cfg.mode === "open" && legacyKey) openDates.push(legacyKey);
          if (cfg.mode === "closed" && legacyKey) closedDates.push(legacyKey);
        }
        return { openDates, closedDates };
      };
      setDeliveryWindow(normalize(deliveryCfg));
      setRestaurantWindow(normalize(restaurantCfg));
    } catch (error) {
      console.error("Error fetching withdrawal window:", error);
      toast.error(error?.response?.data?.message || "Failed to load withdrawal window");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (target) => {
    try {
      if (target === "delivery") setSavingDelivery(true);
      if (target === "restaurant") setSavingRestaurant(true);
      const dataToSend = {
        withdrawalWindows: {
          delivery: {
            openDates: deliveryWindow.openDates || [],
            closedDates: deliveryWindow.closedDates || [],
          },
          restaurant: {
            openDates: restaurantWindow.openDates || [],
            closedDates: restaurantWindow.closedDates || [],
          },
        },
      };
      await adminAPI.updateBusinessSettings(dataToSend, {});
      toast.success("Withdrawal window saved successfully");
    } catch (error) {
      console.error("Error saving withdrawal window:", error);
      toast.error(error?.response?.data?.message || "Failed to save withdrawal window");
    } finally {
      if (target === "delivery") setSavingDelivery(false);
      if (target === "restaurant") setSavingRestaurant(false);
    }
  };

  const upcomingDeliveryDate = useMemo(() => nextSunday(), []);
  const upcomingRestaurantDate = useMemo(() => nextRestaurantWithdrawalDate(), []);
  const monthDays = useMemo(() => buildMonthGrid(monthDate), [monthDate]);
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#FF5200]" />
      </div>
    );
  }

  const Section = ({
    title,
    defaultRule,
    upcomingDate,
    windowState,
    setWindowState,
    isDefaultOpen,
    onSave,
    saving
  }) => {
    const [action, setAction] = useState("open");
    const openDates = windowState.openDates || [];
    const closedDates = windowState.closedDates || [];
    const today = startOfToday();
    const isSameDay = (a, b) =>
      a && b &&
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate();

    const handleDateClick = (date) => {
      if (!date) return;
      const dateKey = toDateKey(date);
      setWindowState((prev) => {
        const nextOpen = new Set(prev.openDates || []);
        const nextClosed = new Set(prev.closedDates || []);
        if (action === "open") {
          if (nextOpen.has(dateKey)) {
            nextOpen.delete(dateKey);
          } else {
            nextOpen.add(dateKey);
            nextClosed.delete(dateKey);
          }
        } else {
          if (nextClosed.has(dateKey)) {
            nextClosed.delete(dateKey);
          } else {
            nextClosed.add(dateKey);
            nextOpen.delete(dateKey);
          }
        }
        return { openDates: Array.from(nextOpen), closedDates: Array.from(nextClosed) };
      });
    };

    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="px-6 py-5 border-b border-slate-100 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-2">{title}</h3>
            <p className="text-xs text-slate-500">{defaultRule}</p>
            <p className="text-xs text-slate-600 mt-2">
            Upcoming withdrawal date: <span className="font-semibold">{formatDateLabel(upcomingDate)}</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setAction("open")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${action === "open" ? "bg-green-600 text-white border-green-600" : "text-slate-600 border-slate-200"}`}
            >
              Mark open
            </button>
            <button
              type="button"
              onClick={() => setAction("closed")}
              className={`px-3 py-1.5 text-xs font-semibold rounded-full border ${action === "closed" ? "bg-red-600 text-white border-red-600" : "text-slate-600 border-slate-200"}`}
            >
              Mark closed
            </button>
          </div>
        </div>

        <div className="px-6 py-6 space-y-5">
          <div>
            <div className="grid grid-cols-7 gap-3 text-[11px] text-slate-500 mb-3">
              {weekdayLabels.map((label) => (
                <div key={label} className="text-center">{label}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-3">
              {monthDays.map((date, idx) => {
                if (!date) {
                  return <div key={`empty-${idx}`} className="h-11" />;
                }
                const isDefaultDay = isDefaultOpen(date);
                const dateKey = toDateKey(date);
                const isOpenSelected = openDates.includes(dateKey);
                const isClosedSelected = closedDates.includes(dateKey);
                const isToday = isSameDay(today, date);
                const isPast = date < today && !isToday;
                const baseClasses = "h-11 rounded-lg border text-xs font-semibold flex items-center justify-center cursor-pointer transition-colors";
                const defaultClasses = isDefaultDay ? "bg-amber-200 border-amber-400 text-amber-900" : "bg-white border-slate-200 text-slate-700";
                const todayClasses = isToday ? "ring-1 ring-slate-400" : "";
                const selectedClasses = isOpenSelected
                  ? "bg-green-200 border-green-500 text-green-900"
                  : isClosedSelected
                    ? "bg-red-200 border-red-500 text-red-900"
                    : "";
                const disabledClasses = isPast ? "opacity-50 cursor-not-allowed bg-slate-50 text-slate-400" : "";
                return (
                  <button
                    key={date.toISOString()}
                    type="button"
                    onClick={() => !isPast && handleDateClick(date)}
                    disabled={isPast}
                    aria-disabled={isPast}
                    className={`${baseClasses} ${selectedClasses || defaultClasses} ${todayClasses} ${disabledClasses}`}
                    title={date.toLocaleDateString("en-IN")}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Default rule dates are highlighted. Click any date to mark open/closed for 24 hours.
            </p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            onClick={fetchSettings}
            className="px-4 py-2 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
            disabled={saving}
          >
            Reset
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#FF5200] rounded-lg hover:bg-[#e64900] disabled:opacity-60"
            disabled={saving}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900">Withdrawal window</h1>
          <p className="text-xs lg:text-sm text-slate-500 mt-1">
            Manage delivery and restaurant withdrawal schedules.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveSection("delivery")}
            className={`px-4 py-2 text-xs font-semibold rounded-full border ${activeSection === "delivery" ? "bg-[#FF5200] text-white border-[#FF5200]" : "text-slate-600 border-slate-200 bg-white"}`}
          >
            Delivery
          </button>
          <button
            type="button"
            onClick={() => setActiveSection("restaurant")}
            className={`px-4 py-2 text-xs font-semibold rounded-full border ${activeSection === "restaurant" ? "bg-[#FF5200] text-white border-[#FF5200]" : "text-slate-600 border-slate-200 bg-white"}`}
          >
            Restaurant
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-start gap-3 max-w-md">
          <div className="mt-0.5">
            <Info className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xs lg:text-sm text-slate-700">
            <p className="font-semibold text-amber-700 mb-0.5">Note</p>
            <p>Select a date to force open or close that day. Default rule dates stay highlighted.</p>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {activeSection === "delivery" && (
          <Section
            title="Delivery window"
            defaultRule="Withdrawals allowed only on Sundays."
            upcomingDate={upcomingDeliveryDate}
            windowState={deliveryWindow}
            setWindowState={setDeliveryWindow}
            isDefaultOpen={(date) => date.getDay() === 0}
            onSave={() => handleSave("delivery")}
            saving={savingDelivery}
          />
        )}
        {activeSection === "restaurant" && (
          <Section
            title="Restaurant window"
          defaultRule="Withdrawals allowed only on calendar days 3, 6, 9, 12..."
          upcomingDate={upcomingRestaurantDate}
          windowState={restaurantWindow}
          setWindowState={setRestaurantWindow}
          isDefaultOpen={(date) => date.getDate() % 3 === 0}
          onSave={() => handleSave("restaurant")}
          saving={savingRestaurant}
        />
        )}
      </div>
    </div>
  );
}
