import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Layers,
  Info,
  CheckCircle2,
  Loader2,
  MapPin,
  Tag,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { marketingAPI, restaurantAPI } from "@/lib/api";

export default function NewAdvertisementPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [myZone, setMyZone] = useState(null);
  const [availableFreeBannerCredits, setAvailableFreeBannerCredits] = useState(0);
  const [zoneLoading, setZoneLoading] = useState(true);
  const [zoneError, setZoneError] = useState(null);
  const [dateError, setDateError] = useState("");
  const [conflictError, setConflictError] = useState(null);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    startDate: "",
    endDate: "",
    redirectTarget: "menu",
  });

  const tomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const validateDates = (startDate, endDate) => {
    const tomorrow = tomorrowStr();
    if (startDate && startDate < tomorrow) {
      return "Campaigns must be requested at least one day in advance.";
    }
    if (endDate && endDate < tomorrow) {
      return "End date cannot be in the past.";
    }
    if (startDate && endDate && endDate < startDate) {
      return "End date cannot be before start date.";
    }
    return "";
  };

  const handleStartDateChange = (e) => {
    const val = e.target.value;
    setFormData((f) => ({
      ...f,
      startDate: val,
    }));

    if (val && val.length === 10) {
      const year = parseInt(val.split("-")[0], 10);
      if (year >= new Date().getFullYear()) {
        const err = validateDates(val, formData.endDate);
        if (err) {
          toast.error(err);
          setDateError(err);
        } else {
          setDateError("");
        }
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  };

  const handleEndDateChange = (e) => {
    const val = e.target.value;
    setFormData((f) => ({
      ...f,
      endDate: val,
    }));

    if (val && val.length === 10) {
      const year = parseInt(val.split("-")[0], 10);
      if (year >= new Date().getFullYear()) {
        const err = validateDates(formData.startDate, val);
        if (err) {
          toast.error(err);
          setDateError(err);
        } else {
          setDateError("");
        }
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  };

  useEffect(() => {
    const fetchPageData = async () => {
      try {
        const [zoneRes, challengeRes] = await Promise.all([
          marketingAPI.getMyZone(),
          restaurantAPI.getMyChallenges(),
        ]);
        setMyZone(zoneRes.data.data);
        setAvailableFreeBannerCredits(
          challengeRes.data?.data?.availableFreeBannerCredits || 0
        );
      } catch (error) {
        const msg =
          error.response?.data?.message || "Failed to fetch your zone info";
        setZoneError(msg);
        toast.error(msg);
      } finally {
        setZoneLoading(false);
      }
    };

    fetchPageData();
  }, []);

  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
    return diffDays > 0 ? diffDays : 0;
  };

  const totalPrice = useMemo(() => {
    if (!myZone) return 0;
    const days = calculateDays();
    if (days <= 0) return 0;
    return myZone.pricePerDay * days;
  }, [myZone, formData.startDate, formData.endDate]);

  const freeBannerDiscount = useMemo(() => {
    if (!myZone || availableFreeBannerCredits <= 0) return 0;
    const days = calculateDays();
    if (days <= 0) return 0;
    return myZone.pricePerDay;
  }, [myZone, availableFreeBannerCredits, formData.startDate, formData.endDate]);

  const finalEstimatedTotal = Math.max(0, totalPrice - freeBannerDiscount);

  const handleSubmit = async () => {
    if (!formData.title || !formData.startDate || !formData.endDate) {
      toast.error("Please fill all required fields");
      return;
    }
    if (!myZone) {
      toast.error("Zone information not available. Please try again.");
      return;
    }
    if (dateError) {
      toast.error(dateError);
      return;
    }

    const days = calculateDays();
    if (days <= 0) {
      toast.error("Please select a valid date range (at least 1 day)");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title: formData.title,
        description: formData.description,
        startDate: formData.startDate,
        endDate: formData.endDate,
        redirectTarget: formData.redirectTarget,
        targetZones: [myZone._id],
      };

      const response = await marketingAPI.createAdRequest(payload);
      const finalTotal =
        response.data?.data?.finalTotalCost ?? response.data?.data?.totalCost;
      const discountAmount =
        response.data?.data?.freeBannerDiscountAmount || 0;
      const billingMessage = response.data?.data?.billingMessage;

      if (discountAmount > 0) {
        toast.success(
          `${billingMessage || "Free day banner applied"} Final payable amount: ₹${finalTotal}`
        );
      } else {
        toast.success("Ad request submitted for review!");
      }

      navigate("/restaurant/advertisements");
    } catch (error) {
      if (error.response?.status === 409) {
        setConflictError(error.response.data.message);
      } else {
        toast.error(error.response?.data?.message || "Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  const days = calculateDays();

  return (
    <div className="min-h-screen bg-[#fef9f5] pb-32">
      <div className="bg-white border-b border-gray-100 px-4 py-4 sticky top-0 z-50 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-blue-50 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Promoted Listing</h1>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#3B82F6] font-bold px-1">
            <Layers className="w-5 h-5" />
            <h2>Campaign Details</h2>
          </div>
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-4 space-y-4">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">
                    Campaign Title
                  </label>
                  <span
                    className={`text-[10px] font-bold ${
                      formData.title.length >= 50
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {formData.title.length}/50
                  </span>
                </div>
                <Input
                  placeholder="e.g. Weekend Feast Special"
                  value={formData.title}
                  maxLength={50}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      title: e.target.value,
                    }))
                  }
                  className="font-semibold text-lg border-gray-100 focus:border-orange-200 focus:ring-orange-100 h-12"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">
                    Short Description
                  </label>
                  <span
                    className={`text-[10px] font-bold ${
                      formData.description.length >= 200
                        ? "text-red-500"
                        : "text-gray-400"
                    }`}
                  >
                    {formData.description.length}/200
                  </span>
                </div>
                <textarea
                  placeholder="Short catchy description to attract customers..."
                  value={formData.description}
                  maxLength={200}
                  onChange={(e) =>
                    setFormData((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  className="w-full text-sm text-gray-600 border border-gray-100 rounded-lg focus:border-orange-200 focus:ring-orange-100 resize-none p-3 bg-gray-50/30 min-h-[80px]"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#3B82F6] font-bold px-1">
            <MapPin className="w-5 h-5" />
            <h2>Ad Placement Zone</h2>
          </div>

          {zoneLoading ? (
            <div className="h-20 bg-gray-100 animate-pulse rounded-xl" />
          ) : zoneError ? (
            <div className="bg-red-50 border border-red-100 rounded-xl p-4 flex gap-3">
              <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-red-800">
                  Zone Not Assigned
                </p>
                <p className="text-xs text-red-600 mt-1">{zoneError}</p>
              </div>
            </div>
          ) : myZone ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border-2 border-blue-400 p-4 flex items-center gap-4 shadow-sm"
            >
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                <MapPin className="w-6 h-6 text-[#3B82F6]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-gray-900 text-base truncate">
                    {myZone.name}
                  </h3>
                  <CheckCircle2 className="w-4 h-4 text-orange-500 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold uppercase text-[#3B82F6] bg-blue-50 px-2 py-0.5 rounded-full">
                    {myZone.tier}
                  </span>
                  <span className="text-xs text-gray-500 flex items-center gap-1">
                    <Tag className="w-3 h-3" />₹{myZone.pricePerDay}/day
                  </span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] text-gray-400 uppercase font-bold">
                  Auto-selected
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  Your restaurant's zone
                </p>
              </div>
            </motion.div>
          ) : null}

          <p className="text-xs text-gray-400 px-1">
            Your ad will be shown to customers browsing restaurants in your
            zone.
          </p>

          {availableFreeBannerCredits > 0 && myZone ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-3"
            >
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-bold text-emerald-800">
                  You have won a free day banner
                </p>
                <p className="text-xs text-emerald-700 mt-1">
                  1 day will be deducted automatically from this campaign
                  billing. Available credits: {availableFreeBannerCredits}
                </p>
              </div>
            </motion.div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex items-center gap-2 text-[#3B82F6] font-bold px-1">
            <Calendar className="w-5 h-5" />
            <h2>Campaign Duration</h2>
          </div>
          <Card className="border-none shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">
                    Start Date
                  </label>
                  <div className="relative mt-1">
                    <Input
                      type="date"
                      value={formData.startDate}
                      onChange={handleStartDateChange}
                      min={tomorrowStr()}
                      className="pl-10"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">
                    End Date
                  </label>
                  <div className="relative mt-1">
                    <Input
                      type="date"
                      value={formData.endDate}
                      onChange={handleEndDateChange}
                      min={formData.startDate || tomorrowStr()}
                      className="pl-10"
                    />
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>

              {dateError ? (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  <Info className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{dateError}</span>
                </div>
              ) : null}

              {days > 0 && myZone ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="bg-blue-50 rounded-lg p-3 flex items-center justify-between"
                >
                  <div className="text-sm text-gray-700">
                    <div>
                      <span className="font-bold text-blue-700">
                        {days} day{days > 1 ? "s" : ""}
                      </span>
                      <span className="text-gray-500">
                        {" "}
                        × ₹{myZone.pricePerDay}/day
                      </span>
                    </div>
                    {freeBannerDiscount > 0 ? (
                      <div className="text-emerald-700 font-semibold mt-1">
                        Free day reward applied: -₹{freeBannerDiscount}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right">
                    {freeBannerDiscount > 0 ? (
                      <div className="text-xs font-semibold text-gray-400 line-through">
                        ₹{totalPrice}
                      </div>
                    ) : null}
                    <div className="text-base font-black text-gray-900">
                      = ₹{finalEstimatedTotal}
                    </div>
                  </div>
                </motion.div>
              ) : null}
            </CardContent>
          </Card>
        </section>
      </div>

      <div className="fixed bottom-16 md:bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-6 z-50">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Estimated Total
            </span>
            <div className="flex items-center text-xl font-black text-gray-900">
              <span className="text-lg mr-1">₹</span>
              {finalEstimatedTotal}
            </div>
            {freeBannerDiscount > 0 ? (
              <span className="text-xs font-semibold text-emerald-700 mt-1">
                Includes free 1-day banner reward
              </span>
            ) : null}
          </div>
          <Button
            disabled={loading || !myZone}
            onClick={handleSubmit}
            className="bg-[#3B82F6] hover:bg-blue-700 text-white px-8 h-12 rounded-xl font-bold text-lg shadow-lg shadow-blue-100 transition-all flex-1 sm:flex-none disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              "Request Review"
            )}
          </Button>
        </div>
      </div>

      <Dialog open={!!conflictError} onOpenChange={() => setConflictError(null)}>
        <DialogContent className="w-[90%] sm:w-full sm:max-w-[340px] p-0 gap-0 overflow-hidden rounded-xl border-0 shadow-xl">
          <div className="bg-red-50 p-4 flex flex-col items-center justify-center border-b border-red-100">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm mb-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
            <DialogTitle className="text-base font-bold text-red-900">
              Campaign Conflict
            </DialogTitle>
          </div>

          <div className="p-4">
            <DialogDescription className="text-center text-gray-600 text-sm mb-4 leading-relaxed">
              {conflictError}
            </DialogDescription>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3 mb-4">
              <Info className="w-4 h-4 text-[#3B82F6] shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs text-blue-900 leading-relaxed">
                  You can only have <span className="font-bold">one active campaign</span> per zone at a time.
                </p>
                <p className="text-[10px] text-blue-700 font-medium opacity-80">
                  Please choose non-overlapping dates or wait for the current campaign to finish.
                </p>
              </div>
            </div>

            <DialogFooter className="sm:justify-center">
              <Button
                type="button"
                className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold h-9 text-sm rounded-lg transition-all"
                onClick={() => setConflictError(null)}
              >
                Understood, I'll fix it
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
