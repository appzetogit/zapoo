import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, CreditCard, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { subscriptionAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import BottomNavOrders from "../components/BottomNavOrders";

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

const roundToTwo = (value) => Math.round((Number(value) || 0) * 100) / 100;

export default function SubscriptionCheckout() {
    const navigate = useNavigate();
    const location = useLocation();
    const queryPlanId = useMemo(() => new URLSearchParams(location.search).get("planId"), [location.search]);
    const [plan, setPlan] = useState(location.state?.plan || null);
    const [loading, setLoading] = useState(!location.state?.plan && !!queryPlanId);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        let alive = true;

        const hydratePlan = async () => {
            if (location.state?.plan) {
                setPlan(location.state.plan);
                setLoading(false);
                return;
            }

            if (!queryPlanId) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                const res = await subscriptionAPI.getPlans();
                const plans = res?.data?.data || [];
                const foundPlan = plans.find((item) => String(item._id) === String(queryPlanId)) || null;
                if (alive) {
                    setPlan(foundPlan);
                }
            } catch (error) {
                if (alive) {
                    console.error("Failed to load subscription plan:", error);
                    toast.error("Failed to load plan details");
                }
            } finally {
                if (alive) {
                    setLoading(false);
                }
            }
        };

        hydratePlan();

        return () => {
            alive = false;
        };
    }, [location.state, queryPlanId]);

    const baseAmount = roundToTwo(plan?.price || 0);
    const gstAmount = roundToTwo(baseAmount * 0.18);
    const totalAmount = roundToTwo(baseAmount + gstAmount);

    const formatAmount = (amount) =>
        `₹${Number(amount || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        })}`;

    const loadAndOpenRazorpay = async (paymentData, selectedPlan) => {
        const sdkLoaded = await loadRazorpayScript();
        if (!sdkLoaded) {
            throw new Error("Razorpay SDK failed to load. Please check your internet connection.");
        }

        const { orderId, amount, currency, key } = paymentData.razorpay;

        await new Promise((resolve, reject) => {
            const rzp = new window.Razorpay({
                key,
                amount,
                currency,
                order_id: orderId,
                name: "Zapoo Restaurant",
                description: `Subscribe to ${selectedPlan.name}`,
                theme: { color: "#DC2626" },
                handler: async (paymentResponse) => {
                    try {
                        const verifyRes = await subscriptionAPI.verifyPayment({
                            razorpay_payment_id: paymentResponse.razorpay_payment_id,
                            razorpay_order_id: paymentResponse.razorpay_order_id,
                            razorpay_signature: paymentResponse.razorpay_signature,
                            planId: selectedPlan._id,
                        });

                        if (verifyRes.data.success) {
                            toast.success(verifyRes?.data?.message || `Successfully subscribed to ${selectedPlan.name}!`);
                            navigate("/restaurant/subscription", { replace: true });
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
                        resolve();
                    }
                }
            });
            rzp.open();
        });
    };

    const handleProceed = async () => {
        if (!plan?._id) return;

        try {
            setProcessing(true);
            const res = await subscriptionAPI.subscribe({ planId: plan._id });

            if (!res?.data?.success) {
                throw new Error(res?.data?.message || "Failed to initiate subscription");
            }

            if (res?.data?.message && res?.data?.data?.deferredActivation) {
                toast.info(res.data.message);
            }

            if (!res.data.data?.razorpay) {
                toast.success(`Successfully subscribed to ${plan.name}!`);
                navigate("/restaurant/subscription", { replace: true });
                return;
            }

            await loadAndOpenRazorpay(res.data.data, plan);
        } catch (error) {
            console.error("Subscription checkout error:", error);
            toast.error(error.response?.data?.message || error.message || "Failed to subscribe");
        } finally {
            setProcessing(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            </div>
        );
    }

    if (!plan?._id) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col">
                <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                    <button
                        onClick={() => navigate("/restaurant/subscription")}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-800" />
                    </button>
                    <h1 className="text-lg font-bold text-gray-900">Subscription Review</h1>
                </div>
                <div className="flex-1 flex items-center justify-center px-4">
                    <Card className="w-full max-w-lg">
                        <CardHeader>
                            <CardTitle className="text-xl">Plan not found</CardTitle>
                            <CardDescription>Please go back and select a plan again.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button className="w-full bg-gray-900 hover:bg-black text-white" onClick={() => navigate("/restaurant/subscription")}>
                                Back to plans
                            </Button>
                        </CardContent>
                    </Card>
                </div>
                <BottomNavOrders />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
                <button
                    onClick={() => navigate(-1)}
                    className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Go back"
                >
                    <ArrowLeft className="w-5 h-5 text-gray-800" />
                </button>
                <h1 className="text-lg font-bold text-gray-900">Subscription Review</h1>
            </div>

            <div className="flex-1 px-4 py-6 pb-24 max-w-4xl mx-auto w-full space-y-6">
                <Card className="border-orange-200 shadow-sm overflow-hidden">
                    <CardHeader className="bg-orange-50/60 border-b border-orange-100">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <CardTitle className="text-2xl text-gray-900">{plan.name}</CardTitle>
                                <CardDescription className="mt-1">
                                    Review the bill before opening Razorpay.
                                </CardDescription>
                            </div>
                            <div className="p-3 rounded-2xl bg-white border border-orange-100 shadow-sm">
                                <ShieldCheck className="w-6 h-6 text-orange-500" />
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-5 sm:p-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">Base Price</p>
                                <p className="mt-2 text-2xl font-bold text-gray-900">{formatAmount(baseAmount)}</p>
                            </div>
                            <div className="rounded-2xl border border-gray-200 bg-white p-4">
                                <p className="text-xs uppercase tracking-wider text-gray-500 font-semibold">GST (18%)</p>
                                <p className="mt-2 text-2xl font-bold text-gray-900">{formatAmount(gstAmount)}</p>
                            </div>
                            <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
                                <p className="text-xs uppercase tracking-wider text-orange-700 font-semibold">Total Bill</p>
                                <p className="mt-2 text-2xl font-bold text-orange-700">{formatAmount(totalAmount)}</p>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <p className="text-sm font-semibold text-gray-900 mb-3">Included features</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {plan.features?.map((feature, idx) => (
                                    <div key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                                        <div className="mt-0.5 w-4 h-4 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                            <Check className="w-2.5 h-2.5 text-green-600" />
                                        </div>
                                        <span>{feature}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </CardContent>

                    <div className="px-5 sm:px-6 pb-6 flex flex-col sm:flex-row gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11"
                            onClick={() => navigate(-1)}
                            disabled={processing}
                        >
                            Back
                        </Button>
                        <Button
                            className="h-11 flex-1 bg-gray-900 hover:bg-black text-white"
                            onClick={handleProceed}
                            disabled={processing}
                        >
                            {processing ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                    Opening payment...
                                </>
                            ) : (
                                <>
                                    <CreditCard className="w-4 h-4 mr-2" />
                                    Pay {formatAmount(totalAmount)}
                                </>
                            )}
                        </Button>
                    </div>
                </Card>
            </div>

            <BottomNavOrders />
        </div>
    );
}
