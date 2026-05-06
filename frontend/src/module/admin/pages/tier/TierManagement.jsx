import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Layers, MapPin, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { tierAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useNavigate } from "react-router-dom";

export default function TierManagement() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTier, setEditingTier] = useState(null);
  const navigate = useNavigate();

  const { register, handleSubmit, reset, setValue, formState: { isSubmitting } } = useForm();

  useEffect(() => {
    fetchTiers();
  }, []);

  const fetchTiers = async () => {
    try {
      setLoading(true);
      const res = await tierAPI.getAllTiers();
      if (res.data.success) {
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
        basePay: parseFloat(data.basePay || 0),
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
    setValue("basePay", tier.deliveryPricing?.basePay || 0);
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
      basePay: 0,
      isActive: true,
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
        <Button onClick={openNewDialog} className="bg-orange-600 hover:bg-orange-700 text-white gap-2 px-5 py-6 rounded-xl shadow-md transition-all active:scale-95">
          <Plus className="w-5 h-5" />
          <span className="font-semibold">Add Tier</span>
        </Button>
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
                  <TableHead>Platform Fee</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tiers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-10 text-neutral-500">
                      No tiers configured yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  tiers.map((tier) => (
                    <TableRow
                      key={tier._id}
                      className="cursor-pointer hover:bg-neutral-50"
                      onClick={(e) => {
                        if (!e.target.closest("button")) {
                          navigate(`/admin/tiers/${tier._id}/zones`);
                        }
                      }}
                    >
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
                          <span className="text-neutral-900 font-medium">Base Pay: Rs {tier.deliveryPricing?.basePay || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium text-neutral-900 text-sm">Rs {tier.platformFee || 0}</span>
                      </TableCell>
                      <TableCell className="text-neutral-500 max-w-[200px] truncate">{tier.description}</TableCell>

                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(tier)}>
                            <Edit className="w-4 h-4 text-neutral-600" />
                          </Button>

                          <Button variant="outline" size="sm" className="h-8 w-8 p-0 text-purple-600 border-purple-200 hover:bg-purple-50" onClick={() => navigate(`/admin/tiers/${tier._id}/zones`)} title="View Zones">
                            <MapPin className="w-4 h-4" />
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(tier._id);
                            }}
                            title="Delete Tier"
                          >
                            <Trash2 className="w-4 h-4" />
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
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden bg-white gap-0 rounded-lg">
          <DialogHeader className="p-5 pb-2">
            <DialogTitle className="text-xl font-bold text-neutral-900">
              {editingTier ? "Edit Tier Rule" : "Create New Tier"}
            </DialogTitle>
            <p className="text-sm text-neutral-500 mt-1">
              Define area-based classification rules
            </p>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col max-h-[80vh]">
            <div className="p-5 space-y-4 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-sm text-neutral-700 font-medium">Tier Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. Small"
                  className="h-9 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20"
                  {...register("name", { required: "Required" })}
                />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="rank" className="text-xs text-neutral-700 font-semibold uppercase tracking-wider">Priority Rank</Label>
                  <Input
                    id="rank"
                    type="number"
                    placeholder="1"
                    className="h-9 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20"
                    {...register("rank", { required: "Required" })}
                  />
                </div>
              </div>

              <div className="bg-neutral-50/50 p-3 rounded-lg border border-neutral-100 space-y-3">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Delivery Pricing</p>
                <div className="grid grid-cols-1 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="basePay" className="text-xs text-neutral-700 font-medium">Base Pay (Rs)</Label>
                    <Input
                      id="basePay"
                      type="number"
                      min="0"
                      placeholder="0"
                      className="h-9 bg-white border-neutral-200 focus:border-orange-500"
                      onWheel={(e) => e.target.blur()}
                      {...register("basePay", { required: "Required", min: 0 })}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="description" className="text-xs text-neutral-700 font-semibold uppercase tracking-wider">Description</Label>
                <Input
                  id="description"
                  placeholder="Optional description"
                  className="h-9 border-neutral-200 focus:border-orange-500 focus:ring-orange-500/20"
                  {...register("description")}
                />
              </div>

              <div className="space-y-2 pt-1">
                <Label className="text-xs text-neutral-700 font-semibold uppercase tracking-wider block">Auto-Assign Range (km2)</Label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <span className="text-neutral-400 text-[10px] font-bold uppercase">Min</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="0"
                      step="0.1"
                      min="0"
                      className="pl-10 h-8 border-neutral-200 text-sm bg-white"
                      onWheel={(e) => e.target.blur()}
                      {...register("minArea", { required: "Required", min: 0 })}
                    />
                  </div>
                  <div className="h-px w-3 bg-neutral-200"></div>
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
                      <span className="text-neutral-400 text-[10px] font-bold uppercase">Max</span>
                    </div>
                    <Input
                      type="number"
                      placeholder="10"
                      step="0.1"
                      min="1"
                      className="pl-10 h-8 border-neutral-200 text-sm bg-white"
                      onWheel={(e) => e.target.blur()}
                      {...register("maxArea", { required: "Required", min: 1 })}
                    />
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter className="p-4 bg-neutral-50/80 border-t border-neutral-100 sm:justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsDialogOpen(false)}
                className="h-9 px-4 text-neutral-500 text-sm hover:bg-neutral-200/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-9 px-6 bg-orange-600 hover:bg-orange-700 text-white text-sm shadow-md font-bold transition-all"
              >
                {isSubmitting ? "Saving..." : "Save Tier Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
