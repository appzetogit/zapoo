import { useEffect, useState } from "react";
import { subscriptionAPI } from "@/lib/api";

function getExpiryInfo(endDate) {
  if (!endDate) return null;
  const now = new Date();
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;

  const isExpired = end.getTime() <= now.getTime();

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfEndDay = new Date(end);
  startOfEndDay.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((startOfEndDay.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));

  return { isExpired, daysLeft: Math.max(0, daysLeft) };
}

export default function useSubscriptionExpiryNotice() {
  const [state, setState] = useState({
    isVisible: false,
    isExpired: false,
    daysLeft: null,
    type: "subscription",
    planName: "",
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    const fetchNotice = async () => {
      try {
        const res = await subscriptionAPI.getMySubscription();
        if (cancelled) return;

        const subscription = res?.data?.data;
        const queuedSubscription = res?.data?.queuedSubscription;

        const hasQueuedPending =
          queuedSubscription?.status === "pending" && queuedSubscription?.planId;

        if (!subscription || !subscription.endDate || hasQueuedPending) {
          setState((prev) => ({
            ...prev,
            isVisible: false,
            loading: false,
          }));
          return;
        }

        const expiryInfo = getExpiryInfo(subscription.endDate);
        if (!expiryInfo) {
          setState((prev) => ({
            ...prev,
            isVisible: false,
            loading: false,
          }));
          return;
        }

        const { isExpired, daysLeft } = expiryInfo;
        const shouldShow = isExpired || daysLeft <= 3;
        const paymentId = String(subscription?.paymentId || "").toUpperCase();
        const type = paymentId.startsWith("TRIAL_") ? "trial" : "subscription";

        setState({
          isVisible: shouldShow,
          isExpired,
          daysLeft,
          type,
          planName: subscription?.planId?.name || "current plan",
          loading: false,
        });
      } catch (_) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            isVisible: false,
            loading: false,
          }));
        }
      }
    };

    fetchNotice();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
