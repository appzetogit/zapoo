import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, CreditCard, ShieldCheck, Zap, ArrowLeft, Phone } from "lucide-react";
import { toast } from "sonner";
import { subscriptionAPI, restaurantAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const formatFeatureLabel = (feature) => {
    if (!feature) return "";
    const readable = String(feature)
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .toLowerCase()
        .trim();
    return readable.charAt(0).toUpperCase() + readable.slice(1);
};

export default function SubscriptionPlans() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [queuedSubscription, setQueuedSubscription] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [trialUsed, setTrialUsed] = useState(false);
    const [pendingPlanConfirm, setPendingPlanConfirm] = useState(null);
    const [stopConfirmOpen, setStopConfirmOpen] = useState(false);
    const [stopProcessing, setStopProcessing] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [plansResult, subResult, restaurantResult] = await Promise.allSettled([
                subscriptionAPI.getPlans(),
                subscriptionAPI.getMySubscription(),
                restaurantAPI.getCurrentRestaurant()
            ]);

            const plansRes = plansResult.status === "fulfilled" ? plansResult.value : null;
            const subRes = subResult.status === "fulfilled" ? subResult.value : null;
            const restaurantRes = restaurantResult.status === "fulfilled" ? restaurantResult.value : null;

            if (plansRes?.data?.success) {
                setPlans(plansRes.data.data || []);
            } else {
                throw new Error("Failed to fetch subscription plans");
            }

            // Optional for first-time/no-plan/inactive restaurants.
            if (subRes?.data?.success && subRes?.data?.data) {
                setCurrentSubscription(subRes.data.data);
            } else {
                setCurrentSubscription(null);
            }
            setQueuedSubscription(subRes?.data?.queuedSubscription || null);

            const restaurant = restaurantRes?.data?.data?.restaurant || restaurantRes?.data?.restaurant;
            setTrialUsed(!!restaurant?.trialUsed);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load subscription details");
        } finally {
            setLoading(false);
        }
    };

    const startSubscriptionFlow = async (plan) => {
        if (!plan?._id) return;

        setProcessingId(plan._id);
        setPendingPlanConfirm(null);
        navigate(`/restaurant/subscription/checkout?planId=${plan._id}`, {
            state: { plan }
        });
    };

    const handleStopCurrentPlanNow = async () => {
        try {
            setStopProcessing(true);
            const res = await subscriptionAPI.stopSubscriptionNow();
            if (res?.data?.success) {
                toast.success(res?.data?.message || "Plan stopped");
                setStopConfirmOpen(false);
                await fetchData();
            } else {
                throw new Error(res?.data?.message || "Failed to stop plan");
            }
        } catch (error) {
            const message =
                error?.response?.data?.message ||
                error?.response?.data?.error ||
                error?.message ||
                "Failed to stop plan";
            toast.error(message);
        } finally {
            setStopProcessing(false);
        }
    };

    const handleSubscribe = async (plan) => {
        const activePlanId = currentSubscription?.planId?._id || currentSubscription?.planId;
        const endDateObj = currentSubscription?.endDate ? new Date(currentSubscription.endDate) : null;
        const hasValidEndDate = !!endDateObj && !Number.isNaN(endDateObj.getTime());
        const isDateValid = hasValidEndDate ? endDateObj.getTime() > Date.now() : false;
        const hasActiveSubscription = !!activePlanId && currentSubscription?.status === "active" && isDateValid;
        const isCurrentPlan = activePlanId?.toString() === plan?._id?.toString();

        if (plan.needsRMCall) {
            try {
                setProcessingId(plan._id);
                const res = await subscriptionAPI.requestRMCall({ planId: plan._id });
                if (res.data.success) {
                    toast.success("Request sent! Our Relationship Manager will contact you shortly.");
                    await fetchData();
                }
            } catch (error) {
                console.error("RM request error:", error);
                toast.error("Failed to send request");
            } finally {
                setProcessingId(null);
            }
            return;
        }

        if (hasActiveSubscription && !isCurrentPlan) {
            setPendingPlanConfirm(plan);
            return;
        }

        await startSubscriptionFlow(plan);
    };

    const handleClaimTrial = async () => {
        try {
            setProcessingId("trial");
            const res = await subscriptionAPI.claimTrial();
            if (res?.data?.success) {
                toast.success("Free trial activated!");
                await fetchData();
            } else {
                throw new Error(res?.data?.message || "Failed to activate free trial");
            }
        } catch (error) {
            const message = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Failed to activate free trial";
            toast.error(message);
        } finally {
            setProcessingId(null);
        }
    };

    const activePlanId = currentSubscription?.planId?._id || currentSubscription?.planId;
    const endDateObj = currentSubscription?.endDate ? new Date(currentSubscription.endDate) : null;
    const hasValidEndDate = !!endDateObj && !Number.isNaN(endDateObj.getTime());
    const isDateValid = hasValidEndDate ? endDateObj.getTime() > Date.now() : false;
    const isSubscribed = !!activePlanId && currentSubscription?.status === "active" && isDateValid;
    const currentSubscriptionDisplayName =
        currentSubscription?.subscriptionDisplayName ||
        currentSubscription?.planId?.name ||
        "Active";
    const expiresLabel = hasValidEndDate
        ? endDateObj.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
        : "N/A";
    const hasQueuedPlan = !!queuedSubscription?.planId;

    const handleBack = () => {
        if (isSubscribed) {
            navigate("/restaurant", { replace: true });
            return;
        }
        navigate(-1);
    };

    useEffect(() => {
        if (!isSubscribed) return;

        const handleBrowserBack = () => {
            navigate("/restaurant", { replace: true });
        };

        window.addEventListener("popstate", handleBrowserBack);
        return () => window.removeEventListener("popstate", handleBrowserBack);
    }, [isSubscribed, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col">
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={handleBack}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">Subscription Plans</h1>
                {!!activePlanId && (
                    <span
                        className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                            isSubscribed
                                ? "bg-green-100 text-green-700 border-green-200"
                                : "bg-red-100 text-red-700 border-red-200"
                        }`}
                    >
                        {isSubscribed ? currentSubscriptionDisplayName : "Expired"}
                    </span>
                )}
            </div>

            <div className="flex-1 px-4 py-6 pb-24 max-w-7xl mx-auto w-full space-y-8">
                <div className="text-center space-y-3 max-w-2xl mx-auto pt-2">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900">
                        Supercharge Your <span className="text-orange-500">Restaurant</span>
                    </h2>
                    <p className="text-gray-500 leading-relaxed text-sm md:text-base">
                        Choose a plan that fits your growth. Zero commission, enhanced visibility, and powerful analytics to scale your business.
                    </p>
                </div>

                {!isSubscribed && !trialUsed && (
                    <div className="max-w-md mx-auto">
                        <Button
                            onClick={handleClaimTrial}
                            disabled={processingId === "trial"}
                            className="w-full h-11 rounded-xl font-bold text-sm bg-gray-900 hover:bg-black text-white"
                        >
                            {processingId === "trial" ? "Activating free trial..." : "Get 1 month free"}
                        </Button>
                    </div>
                )}

                {!!activePlanId && (
                    <Card className="border-orange-200 bg-orange-50/50 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Zap className="w-32 h-32 animate-pulse text-orange-600" />
                        </div>
                        <div className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                            <div className="flex items-start gap-3">
                                <div className="p-2.5 bg-white rounded-xl shadow-sm border border-orange-100">
                                    <ShieldCheck className="w-6 h-6 text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="text-base font-bold text-gray-900">
                                        {isSubscribed ? "Active Subscription" : "Subscription Expired"}
                                    </h3>
                                    <p className="text-gray-600 text-sm mt-0.5">
                                        You are on{" "}
                                        <span className="font-semibold text-orange-600">{currentSubscriptionDisplayName}</span>.{" "}
                                        {isSubscribed ? `Expires ${expiresLabel}` : `Expired at ${expiresLabel}`}
                                    </p>
                                </div>
                            </div>
                            {isSubscribed && (
                                <div className="flex items-center gap-2 w-full sm:w-auto">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full sm:w-auto border-red-200 text-red-700 hover:bg-red-50"
                                        onClick={() => setStopConfirmOpen(true)}
                                        disabled={stopProcessing}
                                    >
                                        Stop current plan
                                    </Button>
                                </div>
                            )}
                        </div>
                    </Card>
                )}

                {hasQueuedPlan && (
                    <Card className="border-blue-200 bg-blue-50/60">
                        <div className="p-4 sm:p-5">
                            <h3 className="text-sm font-bold text-blue-900">Upcoming Plan Purchased</h3>
                            <p className="text-sm text-blue-800 mt-1">
                                This is not your current plan. <span className="font-semibold">{queuedSubscription?.planId?.name || "New plan"}</span> will be activated once your current plan expires.
                            </p>
                        </div>
                    </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                    {plans.map((plan) => {
                        const matchesStoredPlan = activePlanId?.toString() === plan._id?.toString();
                        const isActiveCurrent = isSubscribed && matchesStoredPlan;
                        const isExpiredCurrent = !isSubscribed && matchesStoredPlan;
                        return (
                            <Card
                                key={plan._id}
                                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${matchesStoredPlan
                                    ? "border-2 border-orange-500 shadow-lg shadow-orange-100 ring-4 ring-orange-50"
                                    : "border-gray-200 hover:border-orange-200"
                                    }`}
                            >
                                {plan.price > 1000 && plan.price < 5000 && !matchesStoredPlan && (
                                    <div className="absolute top-4 right-4">
                                        <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                                            MOST POPULAR
                                        </span>
                                    </div>
                                )}

                                {isActiveCurrent && (
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                            <Check className="w-3 h-3" /> ACTIVE PLAN
                                        </span>
                                    </div>
                                )}
                                {isExpiredCurrent && (
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-red-100 text-red-700 border border-red-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                            EXPIRED
                                        </span>
                                    </div>
                                )}

                                <CardHeader className={`pb-4 px-6 ${matchesStoredPlan ? "pt-12" : "pt-8"}`}>
                                    <div className="w-11 h-11 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-4">
                                        <CreditCard className="w-5 h-5" />
                                    </div>
                                    <CardTitle className="text-xl font-bold text-gray-900">{plan.name}</CardTitle>
                                    <CardDescription className="text-gray-500 font-medium uppercase tracking-wider text-xs mt-1">
                                        {plan.durationInDays} DAYS ACCESS
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="px-6 pb-6">
                                    <div className="flex items-baseline mb-6">
                                        <span className="text-4xl font-extrabold text-gray-900 tracking-tight">₹{plan.price?.toLocaleString() || "0"}</span>
                                        <span className="text-gray-400 font-medium ml-1.5 text-sm">/total</span>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Everything included</p>
                                        {plan.features?.map((feature, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5 group">
                                                <div className="mt-0.5 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                                </div>
                                                <span className="text-gray-600 font-medium text-sm leading-snug">{formatFeatureLabel(feature)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 pt-0">
                                    <Button
                                        className={`w-full h-11 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${isActiveCurrent
                                            ? "bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 cursor-default"
                                            : plan.needsRMCall
                                                ? "bg-orange-600 text-white hover:bg-orange-700 hover:shadow-orange-200 hover:shadow-lg"
                                                : "bg-gray-900 text-white hover:bg-orange-500 hover:shadow-orange-200 hover:shadow-lg"
                                            }`}
                                        onClick={() => !isActiveCurrent && handleSubscribe(plan)}
                                        disabled={isActiveCurrent || (processingId === plan._id)}
                                    >
                                        {processingId === plan._id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : isActiveCurrent ? (
                                            <><Check className="w-4 h-4" /> Current Plan</>
                                        ) : isExpiredCurrent ? (
                                            <>Renew Plan</>
                                        ) : plan.needsRMCall ? (
                                            <>Request Call <Phone className="w-4 h-4 ml-1.5" /></>
                                        ) : (
                                            <>Get Started <span className="ml-1.5">→</span></>
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>

                <div className="text-center pt-4 pb-2 border-t border-gray-200">
                    <p className="text-gray-400 text-sm">
                        Need help choosing? <button
                            type="button"
                            onClick={() =>
                                navigate("/restaurant/support", {
                                    state: { backTo: "/restaurant/subscription" },
                                })
                            }
                            className="text-orange-500 font-medium underline-offset-4 hover:underline"
                        >
                            Contact our sales team
                        </button> for a custom quote.
                    </p>
                </div>
            </div>

            {stopConfirmOpen && (
                <div className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px] px-4 flex items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-4 sm:p-5">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Stop current plan?</h3>
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                            This will stop your current plan immediately and your access may be interrupted. <span className="font-semibold text-red-600">No refund will be issued.</span>
                        </p>
                        {hasQueuedPlan && (
                            <p className="text-xs text-gray-500 mt-2">
                                Your queued plan will be activated immediately after stopping the current plan.
                            </p>
                        )}
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setStopConfirmOpen(false)}
                                disabled={stopProcessing}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleStopCurrentPlanNow}
                                disabled={stopProcessing}
                            >
                                {stopProcessing ? "Stopping..." : "Stop now"}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {pendingPlanConfirm && (
                <div className="fixed inset-0 z-[70] bg-black/40 backdrop-blur-[1px] px-4 flex items-center justify-center">
                    <div className="w-full max-w-md rounded-2xl bg-white border border-gray-200 shadow-2xl p-4 sm:p-5">
                        <h3 className="text-base sm:text-lg font-bold text-gray-900">Current plan is still active</h3>
                        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                            If you continue, <span className="font-semibold">{pendingPlanConfirm.name}</span> will be purchased now and activated automatically after your current plan expires.
                        </p>
                        <div className="mt-4 flex items-center justify-end gap-2">
                            <Button
                                variant="outline"
                                className="h-9 px-4"
                                onClick={() => setPendingPlanConfirm(null)}
                                disabled={processingId === pendingPlanConfirm._id}
                            >
                                Cancel
                            </Button>
                            <Button
                                className="h-9 px-4 bg-gray-900 hover:bg-black text-white"
                                onClick={() => startSubscriptionFlow(pendingPlanConfirm)}
                                disabled={processingId === pendingPlanConfirm._id}
                            >
                                {processingId === pendingPlanConfirm._id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    "Continue"
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
