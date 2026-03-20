import { Lock, Crown, Sparkles, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import RestaurantNavbar from "./RestaurantNavbar";
import BottomNavOrders from "./BottomNavOrders";

const featureLabels = {
  order_management: "Order Management",
  menu_control: "Menu Management",
  basic_reports: "Reports",
  marketing_tools: "Marketing Tools",
  advanced_analytics: "Advanced Analytics",
  advanced_marketing_tools: "Advanced Marketing Tools",
  relationship_manager: "Relationship Manager",
};

export default function FeatureLockedScreen({ requiredFeature }) {
  const navigate = useNavigate();
  const label = featureLabels[requiredFeature] || "This Feature";

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <div className="sticky top-0 z-40 bg-white">
        <RestaurantNavbar />
      </div>

      <div className="flex-1 px-4 py-6 pb-24 bg-gradient-to-b from-slate-50 via-blue-50/50 to-indigo-50 flex items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white/95 shadow-xl overflow-hidden">
          <div className="relative px-6 pt-7 pb-5 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
            <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-white/10 blur-xl" />
            <div className="absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-blue-300/20 blur-xl" />

            <div className="relative flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
                <Lock className="w-6 h-6" />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold bg-white/15 border border-white/20 mb-1">
                  <Crown className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                  Premium Access
                </div>
                <h2 className="text-lg font-bold leading-tight">{label} is locked</h2>
              </div>
            </div>
          </div>

          <div className="px-6 py-6">
            <p className="text-sm text-slate-600 leading-relaxed">
              Your current plan doesn&apos;t include this feature. Upgrade to unlock it instantly and continue without limits.
            </p>

            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/70 p-3">
              <div className="flex items-center gap-2 text-blue-800 text-xs font-semibold mb-2">
                <Sparkles className="w-4 h-4" />
                What you get after upgrade
              </div>
              <div className="text-xs text-blue-700 space-y-1">
                <div>• Full access to restricted tools</div>
                <div>• Better growth and analytics visibility</div>
                <div>• Continuous feature access without interruption</div>
              </div>
            </div>

            <div className="mt-5 space-y-2">
              <button
                onClick={() => navigate("/restaurant/subscription")}
                className="w-full rounded-2xl bg-slate-900 text-white py-3 text-sm font-semibold hover:bg-black transition-colors inline-flex items-center justify-center gap-2"
              >
                View subscription plans
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate(-1)}
                className="w-full rounded-2xl border border-slate-200 bg-white text-slate-700 py-3 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      </div>

      <BottomNavOrders />
    </div>
  );
}
