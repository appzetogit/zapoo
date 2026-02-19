import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Check, X, Loader2, DollarSign, Calendar, Star, Crown, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { subscriptionAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SubscriptionManagement() {
    // ... state and hooks ...
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingPlan, setEditingPlan] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

    useEffect(() => {
        fetchPlans();
    }, []);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const res = await subscriptionAPI.getPlans();
            if (res.data.success) {
                setPlans(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching plans:", error);
            toast.error("Failed to load subscription plans");
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data) => {
        try {
            // Format data
            const formattedData = {
                name: data.name,
                durationInDays: parseInt(data.durationInDays),
                features: data.features.split('\n').filter(f => f.trim() !== ''),
                isActive: data.isActive,
                pricing: {
                    tier1: parseFloat(data.priceTier1),
                    tier2: parseFloat(data.priceTier2),
                    tier3: parseFloat(data.priceTier3),
                    tier4: parseFloat(data.priceTier4)
                }
            };

            if (editingPlan) {
                await subscriptionAPI.updatePlan(editingPlan._id, formattedData);
                toast.success("Plan updated successfully");
            } else {
                await subscriptionAPI.createPlan(formattedData);
                toast.success("Plan created successfully");
            }

            setIsDialogOpen(false);
            reset();
            setEditingPlan(null);
            fetchPlans();
        } catch (error) {
            console.error("Error saving plan:", error);
            toast.error(error.response?.data?.message || "Failed to save plan");
        }
    };

    const handleEdit = (plan) => {
        setEditingPlan(plan);
        setValue("name", plan.name);
        setValue("durationInDays", plan.durationInDays);
        setValue("features", plan.features.join('\n'));
        setValue("isActive", plan.isActive);

        // Handle old pricing structure fallback
        const pricing = plan.pricing || {};
        setValue("priceTier1", pricing.tier1 || plan.price || 0);
        setValue("priceTier2", pricing.tier2 || plan.price || 0);
        setValue("priceTier3", pricing.tier3 || plan.price || 0);
        setValue("priceTier4", pricing.tier4 || plan.price || 0);

        setIsDialogOpen(true);
    };

    const handleDelete = async (id) => {
        if (confirm("Are you sure you want to delete this plan? This action cannot be undone.")) {
            try {
                await subscriptionAPI.deletePlan(id);
                toast.success("Plan deleted successfully");
                fetchPlans();
            } catch (error) {
                console.error("Error deleting plan:", error);
                toast.error("Failed to delete plan");
            }
        }
    };

    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        planId: null,
        title: "",
        message: "",
        action: null
    });

    const handleToggleStatusClick = (plan) => {
        if (plan.isActive) {
            setConfirmDialog({
                isOpen: true,
                planId: plan._id,
                title: "Deactivate Plan?",
                message: `Are you sure you want to deactivate "${plan.name}"? Restaurants will no longer be able to subscribe to this plan.`,
                action: () => processToggleStatus(plan._id)
            });
        } else {
            processToggleStatus(plan._id);
        }
    };

    const processToggleStatus = async (id) => {
        try {
            await subscriptionAPI.togglePlanStatus(id);
            fetchPlans();
            toast.success("Plan status updated");
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        } catch (error) {
            console.error("Error toggling status:", error);
            toast.error("Failed to update status");
        }
    };

    const openNewDialog = () => {
        setEditingPlan(null);
        reset({
            isActive: true,
            durationInDays: 30
        });
        setIsDialogOpen(true);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-lg text-orange-600 shadow-sm border border-orange-200">
                        <Crown className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Subscription Plans</h1>
                        <p className="text-neutral-500 text-sm">Manage pricing tiers and restaurant subscriptions</p>
                    </div>
                </div>

                <div className="flex items-center p-1 bg-neutral-100 rounded-lg border border-neutral-200 self-start md:self-center">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'overview' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                    >
                        Plans Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('subscribers')}
                        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${activeTab === 'subscribers' ? 'bg-white text-neutral-900 shadow-sm' : 'text-neutral-500 hover:text-neutral-900'}`}
                    >
                        Subscribers
                    </button>
                </div>
            </div>

            {activeTab === 'overview' ? (
                <div className="space-y-6">
                    {/* Action Bar */}
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-neutral-900">Available Plans</h2>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {plans.map((plan) => (
                            <Card key={plan._id} className={`relative flex flex-col transition-all duration-200 ${!plan.isActive ? 'border-neutral-200 bg-neutral-50/50' : 'border-orange-100 shadow-sm hover:shadow-md'}`}>
                                <div className={`absolute top-0 left-0 w-full h-1 ${plan.isActive ? 'bg-orange-500' : 'bg-neutral-300'} rounded-t-lg`} />

                                <CardHeader className="pb-4">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className={`${!plan.isActive ? 'text-neutral-500' : 'text-neutral-900'}`}>
                                            {plan.name}
                                        </CardTitle>
                                        <Badge variant={plan.isActive ? "default" : "secondary"} className={plan.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : "bg-neutral-200 text-neutral-600 hover:bg-neutral-200"}>
                                            {plan.isActive ? "Active" : "Inactive"}
                                        </Badge>
                                    </div>
                                    <CardDescription className="flex items-baseline gap-1 mt-2">
                                        {plan.pricing ? (
                                            <div className="flex flex-col">
                                                <span className={`text-xl font-bold ${!plan.isActive ? 'text-neutral-400' : 'text-neutral-900'}`}>
                                                    ₹{plan.pricing.tier1} - ₹{plan.pricing.tier4}
                                                </span>
                                                <span className="text-xs text-neutral-500">Tier based pricing</span>
                                            </div>
                                        ) : (
                                            <span className={`text-2xl font-bold ${!plan.isActive ? 'text-neutral-400' : 'text-neutral-900'}`}>₹{plan.price}</span>
                                        )}
                                        <span className="text-neutral-500 ml-1">/ {plan.durationInDays} days</span>
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="space-y-3">
                                        <p className="text-sm font-medium text-neutral-500 uppercase tracking-wider text-xs">Features</p>
                                        {plan.features.map((feature, idx) => (
                                            <div key={idx} className={`flex items-start gap-2 text-sm ${!plan.isActive ? 'text-neutral-400' : 'text-neutral-600'}`}>
                                                <Check className={`w-4 h-4 mt-0.5 shrink-0 ${!plan.isActive ? 'text-neutral-300' : 'text-green-500'}`} />
                                                <span>{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                                <CardFooter className="border-t pt-4 pb-4 gap-3 bg-white/50">
                                    <div className="flex items-center gap-2 flex-1">
                                        <Switch
                                            checked={plan.isActive}
                                            onCheckedChange={() => handleToggleStatusClick(plan)}
                                            className="data-[state=checked]:bg-orange-600"
                                        />
                                        <span className={`text-sm font-medium ${plan.isActive ? 'text-orange-700' : 'text-neutral-500'}`}>
                                            {plan.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>

                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(plan)}>
                                            <Edit className="w-4 h-4 text-neutral-600" />
                                        </Button>

                                    </div>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>


                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 bg-neutral-50 rounded-lg border border-dashed border-neutral-300">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4">
                        <Users className="w-8 h-8 text-neutral-400" />
                    </div>
                    <h3 className="text-lg font-medium text-neutral-900">Subscriber Management</h3>
                    <p className="text-neutral-500 max-w-sm text-center mt-1">This feature is coming soon. You will be able to view and manage all restaurant subscriptions here.</p>
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={confirmDialog.isOpen} onOpenChange={(open) => !open && setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
                <DialogContent className="sm:max-w-[400px] border-none shadow-xl p-0 overflow-hidden bg-white gap-0 rounded-lg">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-3">
                            <div className="bg-red-50 p-2 rounded-full border border-red-100 flex items-center justify-center">
                                <X className="w-5 h-5 text-red-600" />
                            </div>
                            {confirmDialog.title}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="px-6 py-2">
                        <p className="text-neutral-600 leading-relaxed text-[15px]">
                            {confirmDialog.message}
                        </p>
                    </div>

                    <DialogFooter className="p-6 pt-6 bg-neutral-50/50 mt-4 flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                            className="w-full sm:w-auto border-neutral-300 hover:bg-white hover:text-neutral-900"
                        >
                            Cancel
                        </Button>
                        <Button
                            className="w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white shadow-sm"
                            onClick={confirmDialog.action}
                        >
                            Yes, Deactivate
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[550px] border-none shadow-2xl p-0 overflow-hidden">
                    <DialogHeader className="px-6 py-4 bg-orange-50/50 border-b border-orange-100">
                        <DialogTitle className="text-xl font-bold text-orange-600 flex items-center gap-2">
                            {editingPlan ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {editingPlan ? "Edit Subscription Plan" : "Create New Plan"}
                        </DialogTitle>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-5">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="text-neutral-700 font-medium">Plan Name</Label>
                            <Input
                                id="name"
                                placeholder="e.g. Starter Plan"
                                className="focus-visible:ring-orange-500/30 border-neutral-200"
                                {...register("name", { required: "Plan name is required" })}
                                autoFocus
                            />
                            {errors.name && <p className="text-xs text-red-500 font-medium">{errors.name.message}</p>}
                        </div>

                        <div className="grid grid-cols-2 gap-5">
                            <div className="col-span-2 space-y-2">
                                <Label className="text-neutral-700 font-medium">Tier Pricing (₹)</Label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <Label className="text-xs text-neutral-500 mb-1 block">Tier 1 (Small)</Label>
                                        <Input type="number" step="0.01" placeholder="0" {...register("priceTier1", { required: "Required", min: 0 })} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-neutral-500 mb-1 block">Tier 2 (Medium)</Label>
                                        <Input type="number" step="0.01" placeholder="0" {...register("priceTier2", { required: "Required", min: 0 })} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-neutral-500 mb-1 block">Tier 3 (Large)</Label>
                                        <Input type="number" step="0.01" placeholder="0" {...register("priceTier3", { required: "Required", min: 0 })} />
                                    </div>
                                    <div>
                                        <Label className="text-xs text-neutral-500 mb-1 block">Tier 4 (XL)</Label>
                                        <Input type="number" step="0.01" placeholder="0" {...register("priceTier4", { required: "Required", min: 0 })} />
                                    </div>
                                </div>
                            </div>


                            <div className="space-y-2">
                                <Label htmlFor="durationInDays" className="text-neutral-700 font-medium">Duration (Days)</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-neutral-400" />
                                    <Input
                                        id="durationInDays"
                                        type="number"
                                        min="1"
                                        placeholder="30"
                                        className="pl-9 focus-visible:ring-orange-500/30 border-neutral-200"
                                        {...register("durationInDays", { required: "Duration is required", min: 1 })}
                                    />
                                </div>
                                {errors.durationInDays && <p className="text-xs text-red-500 font-medium">{errors.durationInDays.message}</p>}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="features" className="text-neutral-700 font-medium">
                                Features
                                <span className="text-xs font-normal text-neutral-500 ml-2">(One feature per line)</span>
                            </Label>
                            <textarea
                                id="features"
                                className="flex min-h-[120px] w-full rounded-md border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/30 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                                placeholder="Basic Listing&#10;Standard Delivery&#10;Email Support"
                                {...register("features")}
                            />
                        </div>

                        <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg border border-neutral-100">
                            <div className="space-y-0.5">
                                <Label htmlFor="isActive" className="text-base font-medium text-neutral-900">Active Status</Label>
                                <p className="text-xs text-neutral-500">Enable this plan for restaurants</p>
                            </div>
                            <Switch
                                id="isActive"
                                onCheckedChange={(checked) => setValue("isActive", checked)}
                                checked={editingPlan ? editingPlan.isActive : true}
                                className="data-[state=checked]:bg-orange-600"
                            />
                        </div>

                        <DialogFooter className="pt-2 gap-2">
                            <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="hover:bg-neutral-50 hover:text-neutral-900">Cancel</Button>
                            <Button type="submit" disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700 text-white">
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-4 w-4" />
                                        Save Plan
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
