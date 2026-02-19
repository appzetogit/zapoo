import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Layers, MapPin } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { tierAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function TierManagement() {
    const [tiers, setTiers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [editingTier, setEditingTier] = useState(null);
    const navigate = useNavigate();

    const { register, handleSubmit, reset, setValue, formState: { errors, isSubmitting } } = useForm();

    useEffect(() => {
        fetchTiers();
    }, []);

    const fetchTiers = async () => {
        try {
            setLoading(true);
            const res = await tierAPI.getAllTiers();
            if (res.data.success) {
                // Sort by rank
                const sorted = res.data.data.sort((a, b) => a.rank - b.rank);
                setTiers(sorted);
            }
        } catch (error) {
            console.error("Error fetching tiers:", error);
            toast.error("Failed to load tiers");
        } finally {
            setLoading(false);
        }
    };

    const onSubmit = async (data) => {
        try {
            const formattedData = {
                ...data,
                minArea: parseFloat(data.minArea),
                maxArea: parseFloat(data.maxArea),
                rank: parseInt(data.rank),
                baseFee: parseFloat(data.baseFee || 0),
                freeDeliveryThreshold: parseFloat(data.freeDeliveryThreshold || 0)
            };

            if (editingTier) {
                await tierAPI.updateTier(editingTier._id, formattedData);
                toast.success("Tier updated successfully");
            } else {
                await tierAPI.createTier(formattedData);
                toast.success("Tier created successfully");
            }

            setIsDialogOpen(false);
            reset();
            setEditingTier(null);
            fetchTiers();
        } catch (error) {
            console.error("Error saving tier:", error);
            toast.error(error.response?.data?.message || "Failed to save tier");
        }
    };

    const handleEdit = (tier) => {
        setEditingTier(tier);
        setValue("name", tier.name);
        setValue("minArea", tier.minArea);
        setValue("maxArea", tier.maxArea);
        setValue("description", tier.description);
        setValue("rank", tier.rank);
        setValue("baseFee", tier.deliveryPricing?.baseFee || 0);
        setValue("freeDeliveryThreshold", tier.deliveryPricing?.freeDeliveryThreshold || 0);
        setIsDialogOpen(true);
    };

    const handleDelete = async (id) => {
        if (confirm("Are you sure you want to delete this tier?")) {
            try {
                await tierAPI.deleteTier(id);
                toast.success("Tier deleted successfully");
                fetchTiers();
            } catch (error) {
                console.error("Error deleting tier:", error);
                toast.error("Failed to delete tier");
            }
        }
    };

    const openNewDialog = () => {
        setEditingTier(null);
        reset({
            rank: tiers.length + 1,
            baseFee: 0,
            freeDeliveryThreshold: 0
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
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl border border-neutral-200 shadow-sm">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 rounded-lg text-purple-600">
                        <Layers className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Zone Tiers</h1>
                        <p className="text-neutral-500 text-sm">Configure automated zone classification rules</p>
                    </div>
                </div>

            </div>

            <Card className="border-neutral-200 shadow-sm">
                <CardHeader>
                    <CardTitle>Tier Configuration</CardTitle>
                    <CardDescription>Zones are automatically assigned to tiers based on their area size.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border border-neutral-200">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-neutral-50">
                                    <TableHead className="w-[60px]">Rank</TableHead>
                                    <TableHead>Tier Name</TableHead>
                                    <TableHead>Area Range</TableHead>
                                    <TableHead>Delivery Pricing</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {tiers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-10 text-neutral-500">
                                            No tiers configured yet.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    tiers.map((tier) => (
                                        <TableRow key={tier._id} className="cursor-pointer hover:bg-neutral-50" onClick={(e) => {
                                            if (!e.target.closest('button')) {
                                                navigate(`/admin/tiers/${tier._id}/zones`);
                                            }
                                        }}>
                                            <TableCell className="font-medium">#{tier.rank}</TableCell>
                                            <TableCell className="font-semibold text-neutral-900">{tier.name}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2 text-sm text-neutral-600">
                                                    <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-700 font-medium">{tier.minArea} km²</span>
                                                    <span>-</span>
                                                    <span className="bg-neutral-100 px-2 py-0.5 rounded text-neutral-700 font-medium">{tier.maxArea} km²</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1 text-sm">
                                                    <span className="text-neutral-900 font-medium">Base: ₹{tier.deliveryPricing?.baseFee || 0}</span>
                                                    <span className="text-neutral-500 text-xs">Free above ₹{tier.deliveryPricing?.freeDeliveryThreshold || 0}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-neutral-500 max-w-[200px] truncate">{tier.description}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(tier)}>
                                                        <Edit className="w-4 h-4 text-neutral-600" />
                                                    </Button>

                                                    <Button variant="outline" size="sm" className="ml-1 h-8 w-8 p-0 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => navigate(`/admin/tiers/${tier._id}/zones`)} title="View Zones">
                                                        <MapPin className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-white gap-0 rounded-lg">
                    <DialogHeader className="p-6 pb-2">
                        <DialogTitle className="text-xl font-bold text-neutral-900">
                            {editingTier ? "Edit Tier Rule" : "Create New Tier"}
                        </DialogTitle>
                        <p className="text-sm text-neutral-500 mt-1">
                            Define area-based classification rules
                        </p>
                    </DialogHeader>

                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="p-6 space-y-5">
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-neutral-700 font-medium">Tier Name</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Small"
                                    className="h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20"
                                    {...register("name", { required: "Required" })}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <Label htmlFor="rank" className="text-neutral-700 font-medium">Rank Priority</Label>
                                    <Input
                                        id="rank"
                                        type="number"
                                        placeholder="1"
                                        className="h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20"
                                        {...register("rank", { required: "Required" })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="description" className="text-neutral-700 font-medium">Description</Label>
                                    <Input
                                        id="description"
                                        placeholder="Optional"
                                        className="h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20"
                                        {...register("description")}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-5 pt-2">
                                <div className="space-y-2">
                                    <Label htmlFor="baseFee" className="text-neutral-700 font-medium">Base Delivery Fee (₹)</Label>
                                    <Input
                                        id="baseFee"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        className="h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                                        onWheel={(e) => e.target.blur()}
                                        {...register("baseFee", { required: "Required", min: 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="freeDeliveryThreshold" className="text-neutral-700 font-medium">Free Delivery Above (₹)</Label>
                                    <Input
                                        id="freeDeliveryThreshold"
                                        type="number"
                                        min="0"
                                        placeholder="0"
                                        className="h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                                        onWheel={(e) => e.target.blur()}
                                        {...register("freeDeliveryThreshold", { required: "Required", min: 0 })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 pt-2">
                                <Label className="text-neutral-700 font-medium block">Area Range (km²)</Label>
                                <div className="flex items-center gap-3">
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-neutral-400 text-sm">Min</span>
                                        </div>
                                        <Input
                                            type="number"
                                            placeholder="0"
                                            step="0.1"
                                            className="pl-12 h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                                            onWheel={(e) => e.target.blur()}
                                            {...register("minArea", { required: "Required" })}
                                        />
                                    </div>
                                    <div className="h-px w-4 bg-neutral-300"></div>
                                    <div className="relative flex-1">
                                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                            <span className="text-neutral-400 text-sm">Max</span>
                                        </div>
                                        <Input
                                            type="number"
                                            placeholder="10"
                                            step="0.1"
                                            className="pl-12 h-10 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20 appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
                                            onWheel={(e) => e.target.blur()}
                                            {...register("maxArea", { required: "Required" })}
                                        />
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-500">
                                    Zones within this area range will be automatically assigned to this tier.
                                </p>
                            </div>
                        </div>

                        <DialogFooter className="p-6 pt-2 pb-6 bg-white border-t-0 sm:justify-end gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsDialogOpen(false)}
                                className="h-10 px-4 border-neutral-300 text-neutral-700 hover:bg-neutral-50"
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                disabled={isSubmitting}
                                className="h-10 px-6 bg-orange-600 hover:bg-orange-700 text-white shadow-sm"
                            >
                                {isSubmitting ? "Saving..." : "Save Tier"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div >
    );
}
