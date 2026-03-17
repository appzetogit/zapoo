import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isModuleAuthenticated } from "@/lib/utils/auth";
import { restaurantAPI } from "@/lib/api";
import FeatureLockedScreen from "@/module/restaurant/components/FeatureLockedScreen";
import NoPlanPopup from "@/module/restaurant/components/NoPlanPopup";

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module
 */
export default function ProtectedRoute({ children, requiredRole, loginPath }) {
  const location = useLocation();
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [hasActiveSubscription, setHasActiveSubscription] = useState(true);
  const [featureLock, setFeatureLock] = useState(null);
  const planFeatureDefaults = useMemo(
    () => ({
      BASIC: ["order_management", "menu_control", "basic_reports", "marketing_tools"],
      EXECUTIVE: ["order_management", "menu_control", "basic_reports", "relationship_manager"],
      GROWTH: [
        "order_management",
        "menu_control",
        "basic_reports",
        "marketing_tools",
        "advanced_analytics",
        "advanced_marketing_tools",
        "relationship_manager",
      ],
    }),
    []
  );

  const gatedRestaurantPaths = useMemo(
    () => [
      "/restaurant/orders",
      "/restaurant/hub-menu",
      "/restaurant/hub-growth",
      "/restaurant/download-report",
      "/restaurant/to-hub",
      "/restaurant/advertisements",
      "/restaurant/notify-customers",
    ],
    []
  );

  const allowedWithoutSubscription = useMemo(
    () => ["/restaurant/subscription", "/restaurant/onboarding", "/restaurant/details", "/restaurant/edit"],
    []
  );

  useEffect(() => {
    if (requiredRole !== "restaurant") return;

    const path = location.pathname;
    const isAllowedPath = allowedWithoutSubscription.some((prefix) => path.startsWith(prefix));
    const needsSubscription = gatedRestaurantPaths.some((prefix) => path.startsWith(prefix));

    if (!needsSubscription || isAllowedPath) {
      setHasActiveSubscription(true);
      return;
    }

    let isMounted = true;
    setSubscriptionLoading(true);
    restaurantAPI
      .getCurrentRestaurant()
      .then((response) => {
        if (!isMounted) return;
        const restaurant = response?.data?.data?.restaurant;
        const subscription = restaurant?.subscription;
        const isActive = subscription?.status === "active";
        const isDateValid = subscription?.endDate ? new Date(subscription.endDate) > new Date() : false;
        const isSubActive = Boolean(isActive && isDateValid);
        setHasActiveSubscription(isSubActive);

        const featureMap = [
          { prefix: "/restaurant", feature: "order_management", exact: true },
          { prefix: "/restaurant/orders", feature: "order_management" },
          { prefix: "/restaurant/hub-menu", feature: "menu_control" },
          { prefix: "/restaurant/download-report", feature: "basic_reports" },
          { prefix: "/restaurant/hub-growth", feature: "marketing_tools" },
          { prefix: "/restaurant/advertisements", feature: "marketing_tools" },
          { prefix: "/restaurant/notify-customers", feature: "marketing_tools" },
          { prefix: "/restaurant/rm", feature: "relationship_manager" },
        ];
        const match = featureMap.find((item) => {
          if (item.exact) return path === item.prefix;
          return path.startsWith(item.prefix);
        });
        const planName = String(subscription?.planId?.name || "").toUpperCase();
        const mergedFeatures = new Set([
          ...(subscription?.features || []),
          ...(subscription?.planId?.features || []),
          ...(planFeatureDefaults[planName] || []),
        ]);

        if (isSubActive && match && !mergedFeatures.has(match.feature)) {
          setFeatureLock(match.feature);
        } else {
          setFeatureLock(null);
        }
      })
      .catch(() => {
        if (isMounted) {
          setHasActiveSubscription(false);
          setFeatureLock(null);
        }
      })
      .finally(() => {
        if (isMounted) {
          setSubscriptionLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [allowedWithoutSubscription, gatedRestaurantPaths, location.pathname, planFeatureDefaults, requiredRole]);

  // Check if user is authenticated for the required module using module-specific token
  if (!requiredRole) {
    return children;
  }

  const isAuthenticated = isModuleAuthenticated(requiredRole);

  if (!isAuthenticated) {
    if (loginPath) {
      return <Navigate to={loginPath} state={{ from: location.pathname }} replace />;
    }

    const roleLoginPaths = {
      admin: "/admin/login",
      restaurant: "/restaurant/login",
      delivery: "/delivery/sign-in",
      user: "/auth/sign-in",
    };

    const redirectPath = roleLoginPaths[requiredRole] || "/";
    return <Navigate to={redirectPath} replace />;
  }

  if (requiredRole === "restaurant" && subscriptionLoading) {
    return (
      <div className="theme-blue h-full w-full min-h-screen flex items-center justify-center">
        <div className="text-sm text-gray-600">Checking subscription...</div>
      </div>
    );
  }

  if (requiredRole === "restaurant") {
    const path = location.pathname;
    const isAllowedPath = allowedWithoutSubscription.some((prefix) => path.startsWith(prefix));
    const needsSubscription = gatedRestaurantPaths.some((prefix) => path.startsWith(prefix));
    if (featureLock) {
      return <FeatureLockedScreen requiredFeature={featureLock} />;
    }
  }

  if (requiredRole === "restaurant") {
    const path = location.pathname;
    const isOnboarding = path.startsWith("/restaurant/onboarding");

    return (
      <div className="theme-blue h-full w-full">
        {children}
        {!isOnboarding && <NoPlanPopup />}
      </div>
    );
  }

  return children;
}
