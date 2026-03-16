import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, CreditCard, ShieldCheck, Zap, ArrowLeft, Phone } from "lucide-react";
import { toast } from "sonner";
import { subscriptionAPI, restaurantAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import BottomNavOrders from "../components/BottomNavOrders";

// Load Razorpay SDK dynamically
function loadRazorpayScript() {
    return new Promise((resolve) => {
        if (window.Razorpay) return resolve(true);
        const script = document.createElement("script");
        script.src = "https://checkout.razorpay.com/v1/checkout.js";
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

export default function SubscriptionPlans() {
    const navigate = useNavigate();
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [processingId, setProcessingId] = useState(null);
    const [trialUsed, setTrialUsed] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [plansRes, subRes, restaurantRes] = await Promise.all([
                subscriptionAPI.getPlans(),
                subscriptionAPI.getMySubscription(),
                restaurantAPI.getCurrentRestaurant()
            ]);

            if (plansRes.data.success) {
                setPlans(plansRes.data.data);
            }

            if (subRes.data.success && subRes.data.data) {
                setCurrentSubscription(subRes.data.data);
            }
            const restaurant = restaurantRes?.data?.data?.restaurant || restaurantRes?.data?.restaurant;
            setTrialUsed(!!restaurant?.trialUsed);
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load subscription details");
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan) => {
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

        try {
            setProcessingId(plan._id);

            // Step 1: Create the Razorpay order (or activate free plan)
            const res = await subscriptionAPI.subscribe({ planId: plan._id });

            if (!res.data.success) {
                throw new Error(res.data.message || "Failed to initiate subscription");
            }

            // If no razorpay data, it was a free plan — already activated
            if (!res.data.data?.razorpay) {
                toast.success(`Successfully subscribed to ${plan.name}!`);
                await fetchData();
                return;
            }

            // Step 2: Load Razorpay SDK
            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) {
                throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
            }

            const { orderId, amount, currency, key } = res.data.data.razorpay;

            // Step 3: Open Razorpay Checkout
            await new Promise((resolve, reject) => {
                const rzp = new window.Razorpay({
                    key,
                    amount,
                    currency,
                    order_id: orderId,
                    name: "Zapoo Restaurant",
                    description: `Subscribe to ${plan.name}`,
                    theme: { color: "#DC2626" },
                    handler: async (paymentResponse) => {
                        try {
                            // Step 4: Verify payment and activate subscription
                            const verifyRes = await subscriptionAPI.verifyPayment({
                                razorpay_payment_id: paymentResponse.razorpay_payment_id,
                                razorpay_order_id: paymentResponse.razorpay_order_id,
                                razorpay_signature: paymentResponse.razorpay_signature,
                                planId: plan._id,
                            });

                            if (verifyRes.data.success) {
                                toast.success(`🎉 Successfully subscribed to ${plan.name}!`);
                                await fetchData();
                                resolve();
                            } else {
                                throw new Error(verifyRes.data.message || "Payment verification failed");
                            }
                        } catch (err) {
                            reject(err);
                        }
                    },
                    modal: {
                        ondismiss: () => {
                            toast.info("Payment cancelled");
                            resolve(); // don't reject — user just closed
                        }
                    }
                });
                rzp.open();
            });

        } catch (error) {
            console.error("Subscription error:", error);
            toast.error(error.response?.data?.message || error.message || "Failed to subscribe");
        } finally {
            setProcessingId(null);
        }
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

    const handleCancel = async () => {
        if (confirm("Are you sure you want to cancel auto-renewal? Your benefits will continue until the end of the current period.")) {
            try {
                setProcessingId("cancel");
                const res = await subscriptionAPI.cancelSubscription();
                if (res.data.success) {
                    toast.success("Subscription auto-renewal cancelled");
                    fetchData();
                }
            } catch (error) {
                console.error("Cancellation error:", error);
                toast.error("Failed to cancel subscription");
            } finally {
                setProcessingId(null);
            }
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            </div>
        );
    }

    const activePlanId = currentSubscription?.planId?._id || currentSubscription?.planId;
    const isSubscribed = !!activePlanId && currentSubscription?.status === 'active';

    return (
        <div className="min-h-screen bg-gray-50/50 flex flex-col">
            {/* Sticky Header */}
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">Subscription Plans</h1>
                {isSubscribed && (
                    <span className="ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-200">
                        {currentSubscription.planId?.name || "Active"}
                    </span>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 px-4 py-6 pb-24 max-w-7xl mx-auto w-full space-y-8">

                {/* Header Section */}
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

                {/* Current Subscription Status */}
                {isSubscribed && (
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
                                    <h3 className="text-base font-bold text-gray-900">Active Subscription</h3>
                                    <p className="text-gray-600 text-sm mt-0.5">
                                        You are on <span className="font-semibold text-orange-600">{currentSubscription.planId?.name}</span>.
                                        {" "}
                                        {currentSubscription.autoRenew
                                            ? `Renews ${new Date(currentSubscription.endDate).toLocaleDateString()}`
                                            : `Expires ${new Date(currentSubscription.endDate).toLocaleDateString()}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                {currentSubscription.autoRenew && (
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                        onClick={handleCancel}
                                        disabled={processingId === "cancel"}
                                    >
                                        {processingId === "cancel" ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                                        Cancel Renewal
                                    </Button>
                                )}
                            </div>
                        </div>
                    </Card>
                )}

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
                    {plans.map((plan) => {
                        const isCurrent = activePlanId?.toString() === plan._id?.toString();
                        return (
                            <Card
                                key={plan._id}
                                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isCurrent
                                    ? 'border-2 border-orange-500 shadow-lg shadow-orange-100 ring-4 ring-orange-50'
                                    : 'border-gray-200 hover:border-orange-200'
                                    }`}
                            >
                                {/* Popular Tag */}
                                {plan.price > 1000 && plan.price < 5000 && !isCurrent && (
                                    <div className="absolute top-4 right-4">
                                        <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-sm">
                                            MOST POPULAR
                                        </span>
                                    </div>
                                )}

                                {isCurrent && (
                                    <div className="absolute top-4 left-4">
                                        <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
                                            <Check className="w-3 h-3" /> ACTIVE PLAN
                                        </span>
                                    </div>
                                )}

                                <CardHeader className={`pb-4 px-6 ${isCurrent ? 'pt-12' : 'pt-8'}`}>
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
                                        <span className="text-4xl font-extrabold text-gray-900 tracking-tight">₹{plan.price?.toLocaleString() || '0'}</span>
                                        <span className="text-gray-400 font-medium ml-1.5 text-sm">/total</span>
                                    </div>

                                    <div className="space-y-3">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Everything included</p>
                                        {plan.features?.map((feature, idx) => (
                                            <div key={idx} className="flex items-start gap-2.5 group">
                                                <div className="mt-0.5 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                                    <Check className="w-2.5 h-2.5 text-green-600" />
                                                </div>
                                                <span className="text-gray-600 font-medium text-sm leading-snug">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>

                                <CardFooter className="px-6 pb-6 pt-0">
                                    <Button
                                        className={`w-full h-11 text-sm font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 ${isCurrent
                                            ? 'bg-green-100 text-green-700 border border-green-200 hover:bg-green-200 cursor-default'
                                            : plan.needsRMCall 
                                                ? 'bg-orange-600 text-white hover:bg-orange-700 hover:shadow-orange-200 hover:shadow-lg'
                                                : 'bg-gray-900 text-white hover:bg-orange-500 hover:shadow-orange-200 hover:shadow-lg'
                                            }`}
                                        onClick={() => !isCurrent && handleSubscribe(plan)}
                                        disabled={isCurrent || (processingId === plan._id)}
                                    >
                                        {processingId === plan._id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : isCurrent ? (
                                            <><Check className="w-4 h-4" /> Current Plan</>
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

                {/* Footer */}
                <div className="text-center pt-4 pb-2 border-t border-gray-200">
                    <p className="text-gray-400 text-sm">
                        Need help choosing? <a href="#" className="text-orange-500 font-medium underline-offset-4 hover:underline">Contact our sales team</a> for a custom quote.
                    </p>
                </div>
            </div>

            <BottomNavOrders />
        </div>
    );
}
