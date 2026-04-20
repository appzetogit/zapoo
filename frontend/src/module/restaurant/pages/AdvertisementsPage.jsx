import { marketingAPI, restaurantAPI } from "@/lib/api";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { ArrowLeft, MoreVertical, ChevronRight, Plus, Eye, Edit, Pause, Copy, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { initRazorpayPayment } from "@/lib/utils/razorpay";
import { getCompanyNameAsync } from "@/lib/utils/businessSettings";
export default function AdvertisementsPage() {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState("all");
  const [openMenuId, setOpenMenuId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advertisements, setAdvertisements] = useState([]);
  const [processingPayment, setProcessingPayment] = useState(false);
  const adPaymentUiDebug = (step, meta = {}) => {
    try {
      console.log("[AD_PAYMENT_UI_DEBUG]", step, meta);
    } catch (_) {
      // no-op
    }
  };
  const fetchAds = async () => {
    try {
      setLoading(true);
      const res = await marketingAPI.getMyAds();
      setAdvertisements(res.data.data || []);
    } catch (error) {
      toast.error("Failed to load advertisements");
    } finally {
      setLoading(false);
    }
  };

  // Fetch ads from real backend
  useEffect(() => {
    fetchAds();
  }, []);
  const handlePayNow = async ad => {
    try {
      adPaymentUiDebug("pay_now_clicked", {
        adId: ad?._id || null,
        adStatus: ad?.status || null,
        paymentStatus: ad?.paymentStatus || null,
        totalCost: ad?.totalCost || null
      });
      setProcessingPayment(true);
      toast.loading("Initializing payment...");

      // 1. Create Order
      const orderRes = await marketingAPI.createAdPaymentOrder(ad._id);
      adPaymentUiDebug("create_order_response", {
        adId: ad?._id || null,
        success: Boolean(orderRes?.data?.success),
        hasData: Boolean(orderRes?.data?.data),
        orderId: orderRes?.data?.data?.orderId || orderRes?.data?.data?.order_id || null,
        amount: orderRes?.data?.data?.amount || null,
        currency: orderRes?.data?.data?.currency || null
      });
      if (orderRes.data?.data?.freeActivation) {
        toast.dismiss();
        toast.success("Free banner reward applied. Your ad is ready for admin banner upload.");
        fetchAds();
        setProcessingPayment(false);
        return;
      }

      const paymentData = orderRes?.data?.data || {};
      const orderId = paymentData.orderId || paymentData.order_id || null;
      const amount = paymentData.amount;
      const currency = paymentData.currency || "INR";
      const key = paymentData.key || paymentData.keyId || paymentData.key_id || null;
      adPaymentUiDebug("create_order_payload_for_checkout", {
        orderId,
        amount,
        currency,
        keyPrefix: key ? String(key).slice(0, 6) : null
      });

      if (!orderId || !key) {
        throw new Error("Razorpay is not configured for ad payment (missing orderId/key)");
      }

      // 2. Get Restaurant & Company Info
      // Use restaurantAPI because restaurant owners are authenticated via restaurant token
      const restaurantRes = await restaurantAPI.getCurrentRestaurant();
      const restaurant = restaurantRes.data.data?.restaurant || restaurantRes.data.restaurant || {};
      const companyName = await getCompanyNameAsync();
      adPaymentUiDebug("prefill_resolved", {
        hasRestaurant: Boolean(restaurant),
        hasName: Boolean(restaurant.name || restaurant.ownerName),
        hasEmail: Boolean(restaurant.email || restaurant.ownerEmail),
        hasContact: Boolean(restaurant.ownerPhone || restaurant.phone || restaurant.primaryContactNumber)
      });
      toast.dismiss();

      // 3. Open Razorpay
      adPaymentUiDebug("checkout_init_call", {
        adId: ad?._id || null,
        orderId,
        amount,
        currency
      });
      await initRazorpayPayment({
        key,
        amount,
        currency,
        order_id: orderId,
        name: companyName,
        description: `Ad Campaign: ${ad.title}`,
        prefill: {
          name: restaurant.name || restaurant.ownerName,
          email: restaurant.email || restaurant.ownerEmail,
          contact: restaurant.ownerPhone || restaurant.phone || restaurant.primaryContactNumber
        },
        notes: {
          adId: ad._id,
          type: 'AD_CAMPAIGN'
        },
        handler: async response => {
          try {
            adPaymentUiDebug("checkout_handler_received", {
              adId: ad?._id || null,
              razorpay_payment_id: response?.razorpay_payment_id || null,
              razorpay_order_id: response?.razorpay_order_id || null,
              has_signature: Boolean(response?.razorpay_signature)
            });
            toast.loading("Verifying payment...");

            // 4. Verify Payment
            await marketingAPI.verifyAdPayment({
              adId: ad._id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature
            });
            adPaymentUiDebug("verify_api_success", {
              adId: ad?._id || null,
              razorpay_order_id: response?.razorpay_order_id || null,
              razorpay_payment_id: response?.razorpay_payment_id || null
            });
            toast.dismiss();
            toast.success("Payment successful! Your ad is now live.");

            // Refresh list
            fetchAds();
          } catch (verifyErr) {
            console.error(verifyErr);
            adPaymentUiDebug("verify_api_error", {
              adId: ad?._id || null,
              message: verifyErr?.response?.data?.message || verifyErr?.message || null
            });
            toast.dismiss();
            toast.error("Payment verification failed. Please contact support.");
          } finally {
            setProcessingPayment(false);
          }
        },
        onError: err => {
          console.error(err);
          adPaymentUiDebug("checkout_error_callback", {
            adId: ad?._id || null,
            message: err?.error?.description || err?.message || String(err),
            code: err?.error?.code || null,
            source: err?.error?.source || null,
            step: err?.error?.step || null,
            reason: err?.error?.reason || null
          });
          toast.error("Payment failed. Please try again.");
          setProcessingPayment(false);
        },
        onClose: () => {
          adPaymentUiDebug("checkout_closed_by_user", {
            adId: ad?._id || null
          });
          setProcessingPayment(false);
        }
      });
    } catch (error) {
      console.error(error);
      adPaymentUiDebug("pay_now_catch_error", {
        adId: ad?._id || null,
        message: error?.response?.data?.message || error?.message || null
      });
      toast.dismiss();
      toast.error(error.response?.data?.message || "Failed to initiate payment");
      setProcessingPayment(false);
    }
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = event => {
      if (openMenuId && !event.target.closest(`[data-menu-id="${openMenuId}"]`)) {
        setOpenMenuId(null);
      }
    };
    if (openMenuId) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [openMenuId]);

  // Lenis smooth scrolling
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => {
      lenis.destroy();
    };
  }, []);

  // Filter counts dynamically
  const filterCounts = {
    all: advertisements.length,
    pending: advertisements.filter(ad => ad.status === "Pending").length,
    running: advertisements.filter(ad => ad.status === "Active").length,
    approve: advertisements.filter(ad => ad.status === "Approved").length
  };

  // Filter advertisements based on active filter
  const filteredAds = activeFilter === "all" ? advertisements : activeFilter === "pending" ? advertisements.filter(ad => ad.status === "Pending") : activeFilter === "running" ? advertisements.filter(ad => ad.status === "Active") : advertisements.filter(ad => ad.status === "Approved");
  const filters = [{
    id: "all",
    label: "All",
    count: filterCounts.all
  }, {
    id: "pending",
    label: "Pending",
    count: filterCounts.pending
  }, {
    id: "running",
    label: "Running",
    count: filterCounts.running
  }, {
    id: "approve",
    label: "Approve",
    count: filterCounts.approve
  }];
  return <div className="min-h-screen bg-[#f6e9dc] overflow-x-hidden pb-20 md:pb-6">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1">Advertisement List</h1>
      </div>

      {/* Filter Tabs */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-[57px] z-40">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4">
          {filters.map((filter, index) => <motion.button key={filter.id} initial={{
          opacity: 0,
          scale: 0.8
        }} animate={{
          opacity: 1,
          scale: 1
        }} transition={{
          duration: 0.3,
          delay: index * 0.05
        }} whileHover={{
          scale: 1.05
        }} whileTap={{
          scale: 0.95
        }} onClick={() => setActiveFilter(filter.id)} className={`relative z-10 flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeFilter === filter.id ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {activeFilter === filter.id && <motion.div layoutId="activeFilter" className="absolute inset-0 bg-[#3B82F6] rounded-full z-0" transition={{
            type: "spring",
            stiffness: 500,
            damping: 30
          }} />}
              <span className="relative z-10 text-black font-bold">
                {filter.label} {filter.count > 0 && filter.count}
              </span>
            </motion.button>)}
        </div>
      </div>

      {/* Advertisement List */}
      <div className="px-4 py-4 space-y-3">
        {loading ? (/* Skeleton Loader */
      [1, 2, 3].map(i => <div key={i} className="bg-white rounded-xl p-4 animate-pulse h-32 border border-gray-100" />)) : <AnimatePresence mode="wait">
            {filteredAds.map((ad, index) => <motion.div key={ad._id} initial={{
          opacity: 0,
          y: 20
        }} animate={{
          opacity: 1,
          y: 0
        }} exit={{
          opacity: 0,
          y: -20
        }} transition={{
          duration: 0.4,
          delay: index * 0.1,
          ease: [0.4, 0, 0.2, 1]
        }} whileHover={{
          y: -4,
          scale: 1.01
        }} whileTap={{
          scale: 0.98
        }}>
                <Card className="bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/restaurant/advertisements/${ad._id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      {/* Left Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-base font-bold text-gray-900 truncate">
                            ID: {ad._id.slice(-8).toUpperCase()}
                          </h3>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${ad.status === "Active" ? "bg-green-100 text-green-700" : ad.status === "Pending" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                            {ad.status}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-gray-800 mb-1 truncate">{ad.title}</p>

                        <div className="space-y-1 text-[11px] text-gray-500">
                          <p>Placed: {new Date(ad.createdAt).toLocaleDateString()}</p>
                          <p>Dates: {new Date(ad.startDate).toLocaleDateString()} - {new Date(ad.endDate).toLocaleDateString()}</p>
                        </div>

                        {/* Pay Now Button */}
                        {ad.status === 'Approved' && ad.paymentStatus !== 'Paid' && <motion.button whileHover={{
                    scale: 1.05
                  }} whileTap={{
                    scale: 0.95
                  }} onClick={e => {
                    e.stopPropagation();
                    handlePayNow(ad);
                  }} disabled={processingPayment} className="mt-3 bg-green-600 hover:bg-green-700 text-white text-xs font-bold px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
                            <span>Pay ₹{ad.totalCost} to Activate</span>
                          </motion.button>}
                      </div>

                      {/* Right Icons */}
                      <div className="flex items-center gap-2 flex-shrink-0 relative">
                        <motion.button whileHover={{
                    scale: 1.1
                  }} whileTap={{
                    scale: 0.9
                  }} onClick={e => {
                    e.stopPropagation();
                    setOpenMenuId(openMenuId === ad._id ? null : ad._id);
                  }} className="p-2 hover:bg-gray-100 rounded-lg transition-colors relative" data-menu-id={ad._id}>
                          <MoreVertical className="w-5 h-5 text-gray-600" />
                        </motion.button>

                        {/* Context Menu */}
                        <AnimatePresence>
                          {openMenuId === ad._id && <motion.div initial={{
                      opacity: 0,
                      scale: 0.95,
                      y: -10
                    }} animate={{
                      opacity: 1,
                      scale: 1,
                      y: 0
                    }} exit={{
                      opacity: 0,
                      scale: 0.95,
                      y: -10
                    }} transition={{
                      duration: 0.2,
                      ease: "easeOut"
                    }} className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 py-2 z-50 min-w-[180px]" data-menu-id={ad._id}>
                              {[{
                        icon: Eye,
                        label: "View Ads",
                        action: () => navigate(`/restaurant/advertisements/${ad._id}`)
                      }, {
                        icon: Edit,
                        label: "Edit Ads",
                        action: () => navigate(`/restaurant/advertisements/${ad._id}/edit`)
                      }, {
                        icon: Pause,
                        label: "Pause Ads",
                        action: () => {}
                      }, {
                        icon: Copy,
                        label: "Copy Ads",
                        action: () => {}
                      }, {
                        icon: Trash2,
                        label: "Delete Ads",
                        action: () => {},
                        isDanger: true
                      }].map((option, idx) => {
                        const IconComponent = option.icon;
                        return <motion.button key={option.label} initial={{
                          opacity: 0,
                          x: -10
                        }} animate={{
                          opacity: 1,
                          x: 0
                        }} transition={{
                          delay: idx * 0.03,
                          duration: 0.2
                        }} whileHover={{
                          x: 4
                        }} whileTap={{
                          scale: 0.95
                        }} onClick={e => {
                          e.stopPropagation();
                          option.action();
                          setOpenMenuId(null);
                        }} className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${option.isDanger ? "text-red-600 hover:bg-red-50" : "text-gray-700 hover:bg-gray-50"}`}>
                                    <IconComponent className="w-4 h-4" />
                                    <span>{option.label}</span>
                                  </motion.button>;
                      })}
                            </motion.div>}
                        </AnimatePresence>

                        <motion.button whileHover={{
                    scale: 1.1
                  }} whileTap={{
                    scale: 0.9
                  }} onClick={() => {
                    navigate(`/restaurant/advertisements/${ad._id}`);
                  }} className="p-2 bg-[#3B82F6] hover:bg-blue-700 rounded-lg transition-colors">
                          <ChevronRight className="w-5 h-5 text-white" />
                        </motion.button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>)}
          </AnimatePresence>}

        {/* Empty State */}
        {filteredAds.length === 0 && <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No advertisements found</p>
          </div>}
      </div>

      {/* Floating Action Button */}
      <motion.button initial={{
      scale: 0
    }} animate={{
      scale: 1
    }} transition={{
      type: "spring",
      stiffness: 200,
      damping: 15
    }} whileHover={{
      scale: 1.1
    }} whileTap={{
      scale: 0.9
    }} onClick={() => {
      navigate("/restaurant/advertisements/new");
    }} className="fixed bottom-20 md:bottom-6 right-4 md:right-6 w-14 h-14 bg-[#3B82F6] hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-40 transition-colors">
        <Plus className="w-6 h-6" />
      </motion.button>

      {/* Bottom Navigation Bar */}
    </div>;
}
