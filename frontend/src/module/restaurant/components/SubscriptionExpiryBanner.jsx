import { AlertTriangle, Clock3, Crown } from "lucide-react";

export default function SubscriptionExpiryBanner({
  daysLeft,
  isExpired,
  onBuyNow,
  type = "subscription",
  planName = "current plan",
}) {
  const isTrial = type === "trial";
  const title = isTrial
    ? isExpired
      ? "Your trial has expired"
      : "Your free trial is ending soon"
    : isExpired
      ? "Your plan has expired"
      : "Your plan is ending soon";

  const subtitle = isExpired
    ? "Buy a subscription plan to continue uninterrupted access."
    : daysLeft === 0
      ? `Expires today (${planName}). Buy a plan to continue.`
      : daysLeft === 1
        ? `Expires tomorrow (${planName}). Buy a plan to continue.`
        : `Expires in ${daysLeft} days (${planName}). Buy a plan to continue.`;

  return (
    <div
      className={`mt-3 mb-2 rounded-2xl border px-4 py-3 shadow-sm ${
        isExpired
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 rounded-lg p-2 ${
            isExpired ? "bg-red-100" : "bg-amber-100"
          }`}
        >
          {isExpired ? (
            <AlertTriangle className="w-4 h-4 text-red-600" />
          ) : (
            <Clock3 className="w-4 h-4 text-amber-600" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-900">{title}</p>
          <p className="text-xs text-gray-700 mt-1">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={onBuyNow}
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors ${
            isExpired ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          Buy Plan
        </button>
      </div>
    </div>
  );
}
