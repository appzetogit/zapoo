import { useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { restaurantAPI, subscriptionAPI } from "@/lib/api";

export default function NoPlanPopup() {
  const navigate = useNavigate();
  const location = useLocation();
  const [visible, setVisible] = useState(false);
  const [trialUsed, setTrialUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState("");
  const [suppressPopup, setSuppressPopup] = useState(false);

  const refreshState = useCallback(async () => {
    if (document.body.dataset.noPlanPopup === "suppress") {
      setSuppressPopup(true);
      setVisible(false);
      return;
    }
    setSuppressPopup(false);
    try {
      setLoading(true);
      const response = await restaurantAPI.getCurrentRestaurant();
      const restaurant = response?.data?.data?.restaurant || response?.data?.restaurant;
      const subscription = restaurant?.subscription;
      const isActive = subscription?.status === "active";
      const isDateValid = subscription?.endDate ? new Date(subscription.endDate) > new Date() : false;
      const hasActivePlan = Boolean(isActive && isDateValid);
      setTrialUsed(!!restaurant?.trialUsed);
      setVisible(!hasActivePlan);
    } catch {
      setVisible(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshState();
  }, [location.pathname, refreshState]);

  useEffect(() => {
    const handleToggle = () => {
      refreshState();
    };
    window.addEventListener("noPlanPopupToggle", handleToggle);
    return () => window.removeEventListener("noPlanPopupToggle", handleToggle);
  }, [refreshState]);

  const handleSeePlans = () => {
    navigate("/restaurant/subscription");
  };

  const handleClaimTrial = async () => {
    setClaiming(true);
    setError("");
    try {
      await subscriptionAPI.claimTrial();
      await refreshState();
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || err?.message || "Failed to activate free trial.";
      setError(message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading || suppressPopup || !visible) return null;

  return (
    <div className="fixed inset-x-4 bottom-[5.5rem] z-[9991] pointer-events-none">
      <div className="max-w-sm mx-auto pointer-events-auto">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-amber-50">
              <Crown className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-600">No Active Plan</p>
              <h3 className="text-base font-bold text-gray-900 mt-0.5">
                Unlock premium features for your restaurant
              </h3>
              <p className="text-xs text-gray-600 mt-1">
                Choose a plan to access Growth tools and advanced analytics.
              </p>
            </div>
          </div>

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSeePlans}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              See plans
            </button>
            {!trialUsed && (
              <button
                onClick={handleClaimTrial}
                disabled={claiming}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-gray-900 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {claiming ? "Activating..." : "Get 1 month free"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
