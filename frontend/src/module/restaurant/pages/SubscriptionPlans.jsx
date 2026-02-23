import { useState, useEffect } from "react";
import { Check, Loader2, CreditCard, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { subscriptionAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function SubscriptionPlans() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentSubscription, setCurrentSubscription] = useState(null);
    const [processingId, setProcessingId] = useState(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [plansRes, subRes] = await Promise.all([
                subscriptionAPI.getPlans(),
                subscriptionAPI.getMySubscription()
            ]);

            if (plansRes.data.success) {
                setPlans(plansRes.data.data);
            }

            if (subRes.data.success) {
                setCurrentSubscription(subRes.data.data);
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            toast.error("Failed to load subscription details");
        } finally {
            setLoading(false);
        }
    };

    const handleSubscribe = async (plan) => {
        try {
            setProcessingId(plan._id);

            // Here you would integrate with Payment Gateway (Razorpay/Stripe)
            // For now, we simulate a successful payment and activation

            const res = await subscriptionAPI.subscribe({
                planId: plan._id,
                paymentMethod: 'razorpay' // Placeholder
            });

            if (res.data.success) {
                toast.success(`Successfully subscribed to ${plan.name}`);
                // Refresh data to show active subscription
                fetchData();
            }
        } catch (error) {
            console.error("Subscription error:", error);
            toast.error(error.response?.data?.message || "Failed to subscribe");
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
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
            </div>
        );
    }

    const activePlanId = currentSubscription?.planId?._id || currentSubscription?.planId;
    const isSubscribed = !!activePlanId && currentSubscription?.status === 'active';

    return (
        <div className="min-h-screen bg-gray-50/50 p-6 md:p-10">
            <div className="max-w-7xl mx-auto space-y-10">

                {/* Header Section */}
                <div className="text-center space-y-4 max-w-3xl mx-auto">

                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-gray-900">
                        Supercharge Your <span className="text-orange-500">Restaurant</span>
                    </h1>
                    <p className="text-lg text-gray-500 max-w-2xl mx-auto leading-relaxed">
                        Choose a plan that fits your growth. Zero commission, enhanced visibility, and powerful analytics to scale your business.
                    </p>
                </div>

                {/* Current Subscription Status (if active) */}
                {isSubscribed && (
                    <Card className="border-orange-200 bg-orange-50/50 mb-10 overflow-hidden relative">
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                            <Zap className="w-48 h-48 animate-pulse text-orange-600" />
                        </div>
                        <div className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                            <div className="flex items-start gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-orange-100">
                                    <ShieldCheck className="w-8 h-8 text-orange-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold text-gray-900">Active Subscription</h3>
                                    <p className="text-gray-600 mt-1">
                                        You are currently on the <span className="font-semibold text-orange-600">{currentSubscription.planId.name}</span>.
                                        {currentSubscription.autoRenew
                                            ? ` Renews on ${new Date(currentSubscription.endDate).toLocaleDateString()}`
                                            : ` Expires on ${new Date(currentSubscription.endDate).toLocaleDateString()}`}
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                {currentSubscription.autoRenew && (
                                    <Button
                                        variant="outline"
                                        className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300"
                                        onClick={handleCancel}
                                        disabled={processingId === "cancel"}
                                    >
                                        {processingId === "cancel" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Cancel Renewal
                                    </Button>
                                )}
                                <Button className="bg-gray-900 text-white hover:bg-gray-800 shadow-lg shadow-gray-200">
                                    Manage Billing
                                </Button>
                            </div>
                        </div>
                    </Card>
                )}

                {/* Plans Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                    {plans.map((plan) => {
                        const isCurrent = activePlanId === plan._id;
                        return (
                            <Card
                                key={plan._id}
                                className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${isCurrent
                                    ? 'border-2 border-orange-500 shadow-lg shadow-orange-100 ring-4 ring-orange-50'
                                    : 'border-gray-200 hover:border-orange-200'
                                    }`}
                            >
                                {/* Popular Tag (Mock logic: if price is middle range or specifically marked) */}
                                {plan.price > 1000 && plan.price < 5000 && (
                                    <div className="absolute top-5 right-5">
                                        <span className="bg-gradient-to-r from-orange-500 to-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                                            MOST POPULAR
                                        </span>
                                    </div>
                                )}

                                {isCurrent && (
                                    <div className="absolute top-5 left-5">
                                        <span className="bg-green-100 text-green-700 border border-green-200 text-xs font-bold px-3 py-1 rounded-full flex items-center gap-1">
                                            <Check className="w-3 h-3" /> ACTIVE PLAN
                                        </span>
                                    </div>
                                )}

                                <CardHeader className="pb-4 pt-8 px-8">
                                    <div className="w-12 h-12 rounded-2xl bg-orange-100 text-orange-600 flex items-center justify-center mb-6">
                                        <CreditCard className="w-6 h-6" />
                                    </div>
                                    <CardTitle className="text-2xl font-bold text-gray-900">{plan.name}</CardTitle>
                                    <CardDescription className="text-gray-500 font-medium uppercase tracking-wider text-xs mt-2">
                                        {plan.durationInDays} MONTHS ACCESS
                                    </CardDescription>
                                </CardHeader>

                                <CardContent className="px-8 pb-8">
                                    <div className="flex items-baseline mb-8">
                                        <span className="text-5xl font-extrabold text-gray-900 tracking-tight">₹{plan.price?.toLocaleString() || '0'}</span>
                                        <span className="text-gray-400 font-medium ml-2">/total</span>
                                    </div>

                                    <div className="space-y-4">
                                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Everything included</p>
                                        {plan.features.map((feature, idx) => (
                                            <div key={idx} className="flex items-start gap-3 group">
                                                <div className="mt-1 w-5 h-5 rounded-full bg-green-100 flex items-center justify-center shrink-0 group-hover:bg-green-200 transition-colors">
                                                    <Check className="w-3 h-3 text-green-600" />
                                                </div>
                                                <span className="text-gray-600 font-medium text-sm leading-relaxed">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>

                                <CardFooter className="px-8 pb-8 pt-0">
                                    <Button
                                        className={`w-full h-12 text-base font-semibold rounded-xl transition-all duration-200 ${isCurrent
                                            ? 'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                                            : 'bg-gray-900 text-white hover:bg-orange-500 hover:shadow-orange-200 hover:shadow-lg'
                                            }`}
                                        onClick={() => !isCurrent && handleSubscribe(plan)}
                                        disabled={isCurrent || (processingId === plan._id)}
                                    >
                                        {processingId === plan._id ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : isCurrent ? (
                                            "Current Plan"
                                        ) : (
                                            <>Get Started <span className="ml-2">→</span></>
                                        )}
                                    </Button>
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>

                {/* Feature Comparison / Footer Info */}
                <div className="text-center pt-10 pb-6 border-t border-gray-200">
                    <p className="text-gray-400 text-sm">
                        Need help choosing? <a href="#" className="text-orange-500 font-medium underline-offset-4 hover:underline">Contact our sales team</a> for a custom quote.
                    </p>
                </div>
            </div>
        </div>
    );
}
