import { useEffect, useMemo, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import {
  isModuleAuthenticated,
  getDeliverySignupPendingStep,
  setDeliverySignupPendingStep,
  getDeliverySignupStepFromUser,
} from "@/lib/utils/auth";
import { restaurantAPI } from "@/lib/api";
import FeatureLockedScreen from "@/module/restaurant/components/FeatureLockedScreen";
import NoPlanPopup from "@/module/restaurant/components/NoPlanPopup";

/**
 * Role-based Protected Route Component
 * Only allows access if user is authenticated for the specific module
 */
export default function ProtectedRoute({ children, requiredRole, loginPath }) {
  const location = useLocation();
  const [subscriptionLoading, setSubscriptionLoading] = useState(requiredRole === "restaurant");
  const [hasActiveSubscription, setHasActiveSubscription] = useState(true);
  const [featureLock, setFeatureLock] = useState(null);

  const gatedRestaurantPaths = useMemo(
    () => [
      "/restaurant/orders",
      "/restaurant/hub-menu",
      "/restaurant/hub-growth",
      "/restaurant/hub-finance",
      "/restaurant/finance-details",
      "/restaurant/withdrawal-history",
      "/restaurant/delivery-pricing",
      "/restaurant/challenges",
      "/restaurant/download-report",
      "/restaurant/to-hub",
      "/restaurant/advertisements",
      "/restaurant/notify-customers",
    ],
    []
  );

  const allowedWithoutSubscription = useMemo(
    () => ["/restaurant/subscription", "/restaurant/subscription/checkout", "/restaurant/onboarding", "/restaurant/edit"],
    []
  );

  useEffect(() => {
    if (requiredRole !== "restaurant") return;

    const path = location.pathname;
    const isAllowedPath = allowedWithoutSubscription.some((prefix) => path.startsWith(prefix));
    const isRestaurantHome = path === "/restaurant";
    const needsSubscription =
      isRestaurantHome || gatedRestaurantPaths.some((prefix) => path.startsWith(prefix));

    if (!needsSubscription || isAllowedPath) {
      setHasActiveSubscription(true);
      setFeatureLock(null);
      setSubscriptionLoading(false);
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
          { prefix: "/restaurant/hub-finance", feature: "basic_reports" },
          { prefix: "/restaurant/finance-details", feature: "basic_reports" },
          { prefix: "/restaurant/withdrawal-history", feature: "basic_reports" },
          { prefix: "/restaurant/delivery-pricing", feature: "basic_reports" },
          { prefix: "/restaurant/challenges", feature: "basic_reports" },
          { prefix: "/restaurant/hub-growth", feature: "marketing_tools" },
          { prefix: "/restaurant/advertisements", feature: "advanced_marketing_tools" },
          { prefix: "/restaurant/notify-customers", feature: "marketing_tools" },
          { prefix: "/restaurant/rm", feature: "relationship_manager" },
        ];
        const match = featureMap.find((item) => {
          if (item.exact) return path === item.prefix;
          return path.startsWith(item.prefix);
        });
        const mergedFeatures = new Set([
          ...(subscription?.features || []),
          ...(subscription?.planId?.features || []),
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
  }, [allowedWithoutSubscription, gatedRestaurantPaths, location.pathname, requiredRole]);

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

  if (requiredRole === "delivery") {
    let pendingStep = getDeliverySignupPendingStep();
    if (!pendingStep) {
      try {
        const rawDeliveryUser = localStorage.getItem("delivery_user");
        const parsedDeliveryUser = rawDeliveryUser ? JSON.parse(rawDeliveryUser) : null;
        const derivedStep = getDeliverySignupStepFromUser(parsedDeliveryUser);
        if (derivedStep) {
          setDeliverySignupPendingStep(derivedStep);
          pendingStep = derivedStep;
        }
      } catch {
        pendingStep = null;
      }
    }

    if (pendingStep) {
      const targetPath =
        pendingStep === "documents" ? "/delivery/signup/documents" : "/delivery/signup/details";
      if (location.pathname !== targetPath) {
        return <Navigate to={targetPath} replace />;
      }
    }
  }

  if (requiredRole === "restaurant" && subscriptionLoading) {
    return (
      <div className="theme-blue h-full w-full min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (requiredRole === "restaurant") {
    const path = location.pathname;
    const isAllowedPath = allowedWithoutSubscription.some((prefix) => path.startsWith(prefix));
    const isRestaurantHome = path === "/restaurant";
    const needsSubscription =
      isRestaurantHome || gatedRestaurantPaths.some((prefix) => path.startsWith(prefix));
    const shouldRenderNoPlanPopup = needsSubscription && !isAllowedPath && !hasActiveSubscription;
    if (featureLock) {
      return <FeatureLockedScreen requiredFeature={featureLock} />;
    }

    return (
      <div className="theme-blue h-full w-full">
        {!shouldRenderNoPlanPopup && children}
        {shouldRenderNoPlanPopup && <NoPlanPopup />}
      </div>
    );
  }

  return children;
}
