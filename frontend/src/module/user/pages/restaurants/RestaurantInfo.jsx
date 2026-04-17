import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MapPin, Phone, Clock, BadgeInfo, CalendarDays, FileText } from "lucide-react";
import { restaurantAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const formatTimeLabel = (value) => {
  if (!value) return "";
  try {
    const [hours, minutes] = String(value).split(":").map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return String(value);
    const d = new Date();
    d.setHours(hours, minutes, 0, 0);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return String(value);
  }
};

const formatYear = (value) => {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.getFullYear().toString();
};

export default function RestaurantInfo() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        const response = await restaurantAPI.getRestaurantById(slug);
        const data = response?.data?.data?.restaurant || response?.data?.data || null;
        setRestaurant(data);
      } catch (error) {
        console.error("Failed to load restaurant info:", error);
        toast.error("Failed to load restaurant info");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchRestaurant();
    }
  }, [slug]);

  const phoneNumber = useMemo(() => {
    const raw = restaurant?.phone || restaurant?.ownerPhone || restaurant?.primaryContactNumber || "";
    return String(raw).replace(/\D/g, "");
  }, [restaurant]);

  const legalName = restaurant?.onboarding?.step3?.gst?.legalName || restaurant?.ownerName || restaurant?.name || "";
  const fssaiNumber = restaurant?.onboarding?.step3?.fssai?.registrationNumber || "";
  const sinceYear = formatYear(restaurant?.createdAt);
  const closingTime = formatTimeLabel(restaurant?.deliveryTimings?.closingTime);
  const openingTime = formatTimeLabel(restaurant?.deliveryTimings?.openingTime);
  const isOpenNow = restaurant?.isAcceptingOrders !== false;

  return (
    <div className="min-h-screen bg-[#f8f5ef] dark:bg-[#0a0a0a]">
      <div className="sticky top-0 z-20 bg-white/95 dark:bg-[#111111]/95 backdrop-blur border-b border-black/10 dark:border-white/10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-base font-semibold text-gray-900 dark:text-white">Restaurant info</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Quick details about this restaurant</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        <section className="bg-white dark:bg-[#151515] rounded-3xl p-5 shadow-sm border border-black/5 dark:border-white/5">
          {loading ? (
            <div className="h-44 rounded-2xl bg-gray-100 dark:bg-[#222] animate-pulse" />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="h-20 w-20 rounded-2xl bg-gray-100 dark:bg-[#222] overflow-hidden shrink-0">
                  {restaurant?.profileImage?.url ? (
                    <img src={restaurant.profileImage.url} alt={restaurant?.name || "Restaurant"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <BadgeInfo className="h-8 w-8 text-gray-400" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                    {restaurant?.name || "Restaurant"}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {restaurant?.cuisines?.length ? restaurant.cuisines.join(", ") : "Food & dining"}
                  </p>
                  <div className="mt-2 flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                    <MapPin className="h-4 w-4" />
                    <span>{restaurant?.location?.area || restaurant?.location?.city || "Location unavailable"}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={phoneNumber ? `tel:${phoneNumber}` : undefined}
                  onClick={e => {
                    if (!phoneNumber) e.preventDefault();
                  }}
                  className={`flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${phoneNumber ? "border-emerald-500 text-emerald-700 dark:text-emerald-300" : "border-gray-200 text-gray-400 pointer-events-none"}`}
                >
                  <Phone className="h-4 w-4" />
                  <span>Call</span>
                </a>
                <a
                  href={restaurant?.location?.formattedAddress || restaurant?.location?.address || restaurant?.location?.area ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(restaurant?.location?.formattedAddress || restaurant?.location?.address || restaurant?.location?.area)}` : undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300"
                >
                  <MapPin className="h-4 w-4" />
                  <span>Direction</span>
                </a>
              </div>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-black/5 dark:border-white/5 p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-gray-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {isOpenNow ? `Open now` : "Closed now"}
                {closingTime ? ` · Closes ${closingTime}` : ""}
              </p>
              {openingTime && (
                <p className="text-xs text-gray-500 dark:text-gray-400">Opens {openingTime}</p>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-black/5 dark:border-white/5 p-4 flex items-center gap-3">
            <BadgeInfo className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Dine-in and delivery available</p>
            </div>
          </div>

          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-black/5 dark:border-white/5 p-4 flex items-center gap-3">
            <CalendarDays className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Live on Zapoo since {sinceYear || "recently"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-black/5 dark:border-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Legal Name</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{legalName || "N/A"}</p>
          </div>
          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-black/5 dark:border-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">FSSAI Lic No</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{fssaiNumber || "N/A"}</p>
          </div>
          <div className="bg-white dark:bg-[#151515] rounded-2xl border border-black/5 dark:border-white/5 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">Owner Name</p>
            <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-white">{restaurant?.ownerName || "N/A"}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
