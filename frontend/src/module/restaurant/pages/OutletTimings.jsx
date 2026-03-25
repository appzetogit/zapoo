import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import Lenis from "lenis";
import { ArrowLeft, ChevronUp, ChevronDown, Clock, Edit2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { MobileTimePicker } from "@mui/x-date-pickers/MobileTimePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { useCompanyName } from "@/lib/hooks/useCompanyName";
import { restaurantAPI } from "@/lib/api";
import { getUserIdFromToken } from "@/lib/utils/auth";
const STORAGE_KEY = "restaurant_outlet_timings";

// Helper function to convert "HH:mm" string to Date object
const stringToTime = timeString => {
  if (!timeString || !timeString.includes(":")) {
    return new Date(2000, 0, 1, 9, 0); // Default to 9:00 AM
  }
  const [hours, minutes] = timeString.split(":").map(Number);
  // Ensure valid hours (0-23) and minutes (0-59)
  const validHours = Math.max(0, Math.min(23, hours || 9));
  const validMinutes = Math.max(0, Math.min(59, minutes || 0));
  return new Date(2000, 0, 1, validHours, validMinutes);
};

// Helper function to convert Date object to "HH:mm" string
const timeToString = date => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "09:00";
  }
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

// Format time from 24-hour to 12-hour format for display
const formatTime12Hour = time24 => {
  if (!time24) return "09:00 AM";
  const [hours, minutes] = time24.split(":").map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours12}:${minutesStr} ${period}`;
};

const toHHmmFromAny = (input) => {
  if (!input || typeof input !== "string") return "09:00";
  const s = input.trim();
  // Already "HH:mm"
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [hRaw, mRaw] = s.split(":");
    const h = Math.max(0, Math.min(23, Number(hRaw)));
    const m = Math.max(0, Math.min(59, Number(mRaw)));
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  // "hh:mm AM/PM" (with optional spaces)
  const m = s.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (m) {
    let hh = Number(m[1]);
    const mm = Number(m[2]);
    const period = String(m[3]).toLowerCase();
    hh = Math.max(1, Math.min(12, hh || 9));
    const mins = Math.max(0, Math.min(59, mm || 0));
    let h24 = hh % 12;
    if (period === "pm") h24 += 12;
    return `${String(h24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }
  return "09:00";
};

const timingsArrayToDaysObject = (timings) => {
  const base = getDefaultDays();
  if (!Array.isArray(timings)) return base;
  const out = { ...base };
  for (const t of timings) {
    const day = t?.day;
    if (!day || typeof day !== "string") continue;
    if (!out[day]) continue;
    out[day] = {
      isOpen: t?.isOpen !== undefined ? Boolean(t.isOpen) : true,
      openingTime: toHHmmFromAny(t?.openingTime),
      closingTime: toHHmmFromAny(t?.closingTime),
    };
  }
  return out;
};

const daysObjectToTimingsArray = (daysObj) => {
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return dayOrder.map((day) => {
    const d = daysObj?.[day] || {};
    return {
      day,
      isOpen: d?.isOpen !== undefined ? Boolean(d.isOpen) : true,
      openingTime: toHHmmFromAny(d?.openingTime),
      closingTime: toHHmmFromAny(d?.closingTime),
    };
  });
};

const getDefaultDays = () => ({
  Monday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  },
  Tuesday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  },
  Wednesday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  },
  Thursday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  },
  Friday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  },
  Saturday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  },
  Sunday: {
    isOpen: true,
    openingTime: "09:00",
    closingTime: "22:00"
  }
});
export default function OutletTimings() {
  const companyName = useCompanyName();
  const navigate = useNavigate();
  const [expandedDay, setExpandedDay] = useState("Monday");
  const isInternalUpdate = useRef(false);
  const skipNextPersistToBackend = useRef(false);
  const persistTimerRef = useRef(null);
  const [days, setDays] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Validate and ensure all days have proper structure
        const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
        const validated = {};
        dayNames.forEach(day => {
          if (parsed[day]) {
            // Migrate from old slot-based format to new time-based format
            if (parsed[day].slots && Array.isArray(parsed[day].slots) && parsed[day].slots.length > 0) {
              const firstSlot = parsed[day].slots[0];
              // Convert slot format to time format
              const parseSlotTime = (time, period) => {
                if (!time) return "09:00";
                const [hours, minutes] = time.split(":").map(Number);
                let hour24 = hours || 9;
                if (period === "pm" && hour24 !== 12) hour24 += 12;
                if (period === "am" && hour24 === 12) hour24 = 0;
                return `${hour24.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
              };
              validated[day] = {
                isOpen: parsed[day].isOpen !== undefined ? parsed[day].isOpen : true,
                openingTime: parseSlotTime(firstSlot.start, firstSlot.startPeriod || "am"),
                closingTime: parseSlotTime(firstSlot.end, firstSlot.endPeriod || "pm")
              };
            } else {
              validated[day] = {
                isOpen: parsed[day].isOpen !== undefined ? parsed[day].isOpen : true,
                openingTime: parsed[day].openingTime || "09:00",
                closingTime: parsed[day].closingTime || "22:00"
              };
            }
          } else {
            validated[day] = {
              isOpen: true,
              openingTime: "09:00",
              closingTime: "22:00"
            };
          }
        });
        return validated;
      }
    } catch (error) {
      console.error("Error loading outlet timings:", error);
    }
    return getDefaultDays();
  });

  // Hydrate from backend (source of truth) and sync local cache
  useEffect(() => {
    let mounted = true;
    const hydrate = async () => {
      try {
        // Avoid backend route conflict for authenticated GET.
        // Use public GET /restaurant/:restaurantId/outlet-timings instead.
        let restaurantId = null;

        const token =
          localStorage.getItem("restaurant_accessToken") ||
          localStorage.getItem("accessToken");
        if (token) {
          restaurantId = getUserIdFromToken(token);
        }

        if (!restaurantId) {
          // Fallback: try to fetch current restaurant (requires auth)
          try {
            const rRes = await restaurantAPI.getCurrentRestaurant();
            const restaurant =
              rRes?.data?.data?.restaurant || rRes?.data?.restaurant;
            restaurantId = restaurant?.id || restaurant?._id;
          } catch (e) {
            // ignore; we can still fall back to localStorage
          }
        }

        if (!restaurantId) return;

        const res = await restaurantAPI.getOutletTimingsByRestaurantId(restaurantId);
        const outletTimings =
          res?.data?.data?.outletTimings || res?.data?.outletTimings;

        const normalized = timingsArrayToDaysObject(outletTimings?.timings);
        if (!mounted) return;
        skipNextPersistToBackend.current = true;
        isInternalUpdate.current = true; // ensure localStorage sync + event fire
        setDays(normalized);
      } catch (e) {
        // Keep localStorage cache if backend fails (offline-safe)
      }
    };
    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  // Save to localStorage whenever days change (but only if it's an internal update)
  useEffect(() => {
    if (isInternalUpdate.current) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(days));
        // Dispatch event to notify other components
        window.dispatchEvent(new Event("outletTimingsUpdated"));
      } catch (error) {
        console.error("Error saving outlet timings:", error);
      }

      // Persist to backend (debounced). Skip once if this update came from backend hydration.
      const shouldSkip = skipNextPersistToBackend.current;
      skipNextPersistToBackend.current = false;
      if (!shouldSkip) {
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        persistTimerRef.current = setTimeout(async () => {
          try {
            const timingsPayload = daysObjectToTimingsArray(days);
            await restaurantAPI.upsertOutletTimings(timingsPayload);
          } catch (e) {
            // If backend fails, keep local changes cached; next successful save will sync.
          }
        }, 400);
      }

      isInternalUpdate.current = false;
    }
  }, [days]);

  useEffect(() => {
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, []);

  // Listen for updates from other components
  useEffect(() => {
    const handleUpdate = () => {
      if (!isInternalUpdate.current) {
        try {
          const saved = localStorage.getItem(STORAGE_KEY);
          if (saved) {
            const newDays = JSON.parse(saved);
            setDays(prevDays => {
              if (JSON.stringify(newDays) !== JSON.stringify(prevDays)) {
                return newDays;
              }
              return prevDays;
            });
          }
        } catch (error) {
          console.error("Error loading updated outlet timings:", error);
        }
      }
    };
    window.addEventListener("outletTimingsUpdated", handleUpdate);
    return () => window.removeEventListener("outletTimingsUpdated", handleUpdate);
  }, []);

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
    };
  }, []);
  const toggleDay = day => {
    setExpandedDay(expandedDay === day ? null : day);
  };
  const toggleDayOpen = day => {
    isInternalUpdate.current = true;
    setDays(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen
      }
    }));
  };
  const handleTimeChange = (day, timeType, newTime) => {
    if (!newTime) {
      console.warn('⚠️ No time value received in handleTimeChange');
      return;
    }
    isInternalUpdate.current = true;
    const timeString = timeToString(newTime);

    // Validate time string format
    if (!timeString || !timeString.includes(":")) {
      console.warn('⚠️ Invalid time string generated:', timeString);
      return;
    }
    setDays(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [timeType]: timeString
      }
    }));
  };
  const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return <LocalizationProvider dateAdapter={AdapterDateFns}>
      <div className="min-h-screen bg-white overflow-x-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/restaurant")} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Go back">
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">Outlet timings</h1>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-4 py-6">
          {/* Appzeto delivery Section Header */}
          <div className="mb-6">
            <div className="text-center mb-2">
              <h2 className="text-base font-semibold text-blue-600">{companyName} delivery</h2>
            </div>
            <div className="h-0.5 bg-blue-600"></div>
          </div>

          {/* Day-wise Accordion */}
          <div className="space-y-2">
            {dayNames.map((day, index) => {
            const dayData = days[day] || {
              isOpen: true,
              openingTime: "09:00",
              closingTime: "22:00"
            };
            const isExpanded = expandedDay === day;
            return <motion.div key={day} initial={{
              opacity: 0,
              y: 10
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.2,
              delay: index * 0.03
            }} className="bg-white border border-gray-200 rounded-sm overflow-hidden">
                  {/* Day Header */}
                  <div className={`w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-color transition-all ${isExpanded ? "bg-gray-100" : ""}`}>
                    <button onClick={() => toggleDay(day)} className="flex items-center gap-3 flex-1 text-left">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-700" /> : <ChevronDown className="w-5 h-5 text-gray-700" />}
                      <span className="text-base font-medium text-gray-900">{day}</span>
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-700">{dayData.isOpen ? "Open" : "Close"}</span>
                      <div onClick={e => e.stopPropagation()}>
                        <Switch checked={dayData.isOpen} onCheckedChange={() => toggleDayOpen(day)} className="data-[state=checked]:bg-green-500 data-[state=unchecked]:bg-gray-300" />
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && <motion.div initial={{
                  height: 0,
                  opacity: 0
                }} animate={{
                  height: "auto",
                  opacity: 1
                }} exit={{
                  height: 0,
                  opacity: 0
                }} transition={{
                  duration: 0.2
                }} className="overflow-hidden">
                        <div className="p-4 space-y-4 border-t border-gray-100">
                          {dayData.isOpen ? <>
                              {/* Opening Time */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  Opening time
                                </label>
                                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
                                  <MobileTimePicker value={stringToTime(dayData.openingTime)} onChange={newValue => {
                            if (newValue) {
                              handleTimeChange(day, "openingTime", newValue);
                            }
                          }} onAccept={newValue => {
                            if (newValue) {
                              handleTimeChange(day, "openingTime", newValue);
                            }
                          }} slotProps={{
                            textField: {
                              variant: "outlined",
                              size: "small",
                              placeholder: "Select opening time",
                              sx: {
                                "& .MuiOutlinedInput-root": {
                                  height: "36px",
                                  fontSize: "12px",
                                  backgroundColor: "white",
                                  "& fieldset": {
                                    borderColor: "#e5e7eb"
                                  },
                                  "&:hover fieldset": {
                                    borderColor: "#d1d5db"
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#000"
                                  }
                                },
                                "& .MuiInputBase-input": {
                                  padding: "8px 12px",
                                  fontSize: "12px"
                                }
                              }
                            }
                          }} format="hh:mm a" />
                                </div>
                                <p className="text-xs text-gray-500">
                                  Current: {formatTime12Hour(dayData.openingTime)}
                                </p>
                              </div>

                              {/* Closing Time */}
                              <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                  <Clock className="w-4 h-4" />
                                  Closing time
                                </label>
                                <div className="border border-gray-200 rounded-md px-3 py-2 bg-gray-50/60">
                                  <MobileTimePicker value={stringToTime(dayData.closingTime)} onChange={newValue => {
                            if (newValue) {
                              handleTimeChange(day, "closingTime", newValue);
                            }
                          }} onAccept={newValue => {
                            if (newValue) {
                              handleTimeChange(day, "closingTime", newValue);
                            }
                          }} slotProps={{
                            textField: {
                              variant: "outlined",
                              size: "small",
                              placeholder: "Select closing time",
                              sx: {
                                "& .MuiOutlinedInput-root": {
                                  height: "36px",
                                  fontSize: "12px",
                                  backgroundColor: "white",
                                  "& fieldset": {
                                    borderColor: "#e5e7eb"
                                  },
                                  "&:hover fieldset": {
                                    borderColor: "#d1d5db"
                                  },
                                  "&.Mui-focused fieldset": {
                                    borderColor: "#000"
                                  }
                                },
                                "& .MuiInputBase-input": {
                                  padding: "8px 12px",
                                  fontSize: "12px"
                                }
                              }
                            }
                          }} format="hh:mm a" />
                                </div>
                                <p className="text-xs text-gray-500">
                                  Current: {formatTime12Hour(dayData.closingTime)}
                                </p>
                              </div>
                            </> : <p className="text-sm text-gray-500 pl-6">This day is closed</p>}
                        </div>
                      </motion.div>}
                  </AnimatePresence>
                </motion.div>;
          })}
          </div>
        </div>
      </div>
    </LocalizationProvider>;
}