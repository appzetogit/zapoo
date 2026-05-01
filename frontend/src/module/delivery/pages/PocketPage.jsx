import { useEffect, useRef, useState, useMemo } from "react";
import Lenis from "lenis";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Home,
  FileText,
  UtensilsCrossed,
  User,
  ArrowRight,
  Lightbulb,
  HelpCircle,
  Wallet,
  CheckCircle,
  Receipt,
  FileText as FileTextIcon,
  Wallet as WalletIcon,
  Sparkles,
  IndianRupee,
  Trophy,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  fetchDeliveryWallet,
  calculateDeliveryBalances,
  calculatePeriodEarnings,
} from "../utils/deliveryWalletState";
import { formatCurrency } from "../../restaurant/utils/currency";
import { useGigStore } from "../store/gigStore";
import { useProgressStore } from "../store/progressStore";
import { HelpCircle as HelpIcon } from "lucide-react";
import { getAllDeliveryOrders } from "../utils/deliveryOrderStatus";
import { deliveryAPI } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api/config";
import FeedNavbar from "../components/FeedNavbar";
import AvailableCashLimit from "../components/AvailableCashLimit";
import BottomPopup from "../components/BottomPopup";
import DepositPopup from "../components/DepositPopup";

export default function PocketPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [animationKey, setAnimationKey] = useState(0);
  const [walletState, setWalletState] = useState({
    totalBalance: 0,
    cashInHand: 0,
    totalWithdrawn: 0,
    totalEarned: 0,
    transactions: [],
    joiningBonusClaimed: false,
  });
  const [walletLoading, setWalletLoading] = useState(true);
  const [currentCarouselSlide, setCurrentCarouselSlide] = useState(0);
  const carouselRef = useRef(null);
  const carouselStartX = useRef(0);
  const carouselIsSwiping = useRef(false);
  const carouselAutoRotateRef = useRef(null);
  const [showCashLimitPopup, setShowCashLimitPopup] = useState(false);
  const [showDepositPopup, setShowDepositPopup] = useState(false);
  const [bankDetailsFilled, setBankDetailsFilled] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const { isOnline, bookedGigs, goOnline, goOffline } = useGigStore();
  const { getDateData, hasDateData } = useProgressStore();

  // Fetch bank details status
  useEffect(() => {
    const checkBankDetails = async () => {
      try {
        const response = await deliveryAPI.getProfile();
        if (response?.data?.success && response?.data?.data?.profile) {
          const profile = response.data.data.profile;
          const bankDetails = profile?.documents?.bankDetails;

          // Check if all required bank details fields are filled
          const isFilled = !!(
            bankDetails?.accountHolderName?.trim() &&
            bankDetails?.accountNumber?.trim() &&
            bankDetails?.ifscCode?.trim() &&
            bankDetails?.bankName?.trim()
          );
          setBankDetailsFilled(isFilled);
        }
      } catch (error) {
        if (error.code !== "ECONNABORTED" && !error.message?.includes("timeout")) {
          console.error("Error checking bank details:", error);
        }
        setBankDetailsFilled(false);
      }
    };
    checkBankDetails();

    const handleProfileRefresh = () => {
      checkBankDetails();
    };
    window.addEventListener("deliveryProfileRefresh", handleProfileRefresh);
    return () => {
      window.removeEventListener("deliveryProfileRefresh", handleProfileRefresh);
    };
  }, []);

  // Carousel slides data
  const carouselSlides = useMemo(
    () =>
      bankDetailsFilled
        ? []
        : [
          {
            id: 2,
            title: "Submit bank details",
            subtitle: "PAN & bank details required for payouts",
            icon: "bank",
            buttonText: "Submit",
            bgColor: "bg-[#DC2626]",
          },
        ],
    [bankDetailsFilled]
  );

  // Calculate balances
  const balances = calculateDeliveryBalances(walletState);

  // Calculate weekly earnings from wallet transactions
  const weeklyEarnings =
    walletState?.transactions
      ?.filter((t) => {
        if (t.type !== "payment" || t.status !== "Completed") return false;
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const transactionDate = t.date ? new Date(t.date) : t.createdAt ? new Date(t.createdAt) : null;
        if (!transactionDate) return false;
        return transactionDate >= startOfWeek && transactionDate <= now;
      })
      .reduce((sum, t) => sum + (t.amount || 0), 0) || 0;

  // Calculate weekly orders count
  const calculateWeeklyOrders = () => {
    if (!walletState?.transactions || !Array.isArray(walletState.transactions)) return 0;
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    return walletState.transactions.filter((t) => {
      if (t.type !== "payment" || t.status !== "Completed") return false;
      const transactionDate = t.date ? new Date(t.date) : t.createdAt ? new Date(t.createdAt) : null;
      if (!transactionDate) return false;
      return transactionDate >= startOfWeek && transactionDate <= now;
    }).length;
  };
  const weeklyOrders = calculateWeeklyOrders();

  // IMPORTANT: Always trust backend-computed pocket/total balance.
  // Do not override with client-side weekly/bonus formulas (can show stale/incorrect balance after withdrawals).
  const pocketBalance = Math.max(
    0,
    Number.isFinite(Number(walletState?.pocketBalance))
      ? Number(walletState.pocketBalance)
      : Number(walletState?.totalBalance ?? balances.totalBalance ?? 0)
  );

  const totalCashLimit = Number.isFinite(Number(walletState?.totalCashLimit)) ? Number(walletState.totalCashLimit) : 0;
  const availableCashLimit =
    Number.isFinite(Number(walletState?.availableCashLimit)) && Number(walletState?.availableCashLimit) >= 0
      ? Number(walletState.availableCashLimit)
      : Math.max(0, totalCashLimit - (Number(balances.cashInHand) || 0));

  const payoutAmount = useMemo(() => {
    const now = new Date();
    const lastWeekStart = new Date(now);
    lastWeekStart.setDate(now.getDate() - now.getDay() - 7);
    lastWeekStart.setHours(0, 0, 0, 0);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);
    return (
      walletState.transactions
        ?.filter((t) => {
          if (t.type !== "withdrawal" || t.status !== "Completed") return false;
          const transactionDate = t.date ? new Date(t.date) : t.createdAt ? new Date(t.createdAt) : null;
          return transactionDate && transactionDate >= lastWeekStart && transactionDate <= lastWeekEnd;
        })
        .reduce((sum, t) => sum + (t.amount || 0), 0) || 0
    );
  }, [walletState.transactions]);

  const payoutPeriod = useMemo(() => {
    const lastWeekStart = new Date();
    lastWeekStart.setDate(lastWeekStart.getDate() - lastWeekStart.getDay() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    const f = (d) => `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
    return `${f(lastWeekStart)} - ${f(lastWeekEnd)}`;
  }, []);

  useEffect(() => {
    const fetchWalletData = async () => {
      try {
        setWalletLoading(true);
        const data = await fetchDeliveryWallet();
        setWalletState(data);
      } catch (error) {
        console.error("Error fetching wallet data:", error);
      } finally {
        setWalletLoading(false);
      }
    };
    fetchWalletData();
    const interval = setInterval(fetchWalletData, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
    });
    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    requestAnimationFrame(raf);
    return () => lenis.destroy();
  }, [animationKey]);

  useEffect(() => {
    const handleRequestRefresh = () => setAnimationKey((prev) => prev + 1);
    window.addEventListener("deliveryRequestRefresh", handleRequestRefresh);
    return () => window.removeEventListener("deliveryRequestRefresh", handleRequestRefresh);
  }, []);

  const handleToggleOnline = () => {
    if (isOnline) {
      goOffline();
    } else {
      if (bookedGigs.length === 0) {
        navigate("/delivery/gig");
      } else {
        goOnline();
      }
    }
  };

  useEffect(() => {
    carouselAutoRotateRef.current = setInterval(() => {
      if (carouselSlides.length > 0) {
        setCurrentCarouselSlide((prev) => (prev + 1) % carouselSlides.length);
      }
    }, 3000);
    return () => clearInterval(carouselAutoRotateRef.current);
  }, [carouselSlides]);

  const resetCarouselAutoRotate = () => {
    clearInterval(carouselAutoRotateRef.current);
    carouselAutoRotateRef.current = setInterval(() => {
      if (carouselSlides.length > 0) {
        setCurrentCarouselSlide((prev) => (prev + 1) % carouselSlides.length);
      }
    }, 3000);
  };

  const handleCarouselTouchStart = (e) => {
    carouselIsSwiping.current = true;
    carouselStartX.current = e.touches[0].clientX;
  };

  const handleCarouselTouchEnd = (e) => {
    if (!carouselIsSwiping.current) return;
    const deltaX = carouselStartX.current - e.changedTouches[0].clientX;
    if (Math.abs(deltaX) > 50) {
      if (deltaX > 0) {
        setCurrentCarouselSlide((prev) => (prev + 1) % carouselSlides.length);
      } else {
        setCurrentCarouselSlide((prev) => (prev - 1 + carouselSlides.length) % carouselSlides.length);
      }
      resetCarouselAutoRotate();
    }
    carouselIsSwiping.current = false;
  };

  const getCurrentWeekRange = () => {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const f = (d) => `${d.getDate()} ${d.toLocaleString("en-US", { month: "short" })}`;
    return `${f(start)} - ${f(end)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <FeedNavbar isOnline={isOnline} onToggleOnline={handleToggleOnline} onEmergencyClick={() => { }} onHelpClick={() => { }} />

      {carouselSlides.length > 0 && (
        <div
          ref={carouselRef}
          className="relative overflow-hidden bg-gray-700 cursor-grab active:cursor-grabbing select-none"
          onTouchStart={handleCarouselTouchStart}
          onTouchEnd={handleCarouselTouchEnd}
        >
          <div
            className="flex transition-transform duration-500 ease-in-out"
            style={{ transform: `translateX(-${currentCarouselSlide * 100}%)` }}
          >
            {carouselSlides.map((slide) => (
              <div key={slide.id} className="min-w-full">
                <div className={`${slide.bgColor} px-4 py-3 flex items-center gap-3 min-h-[80px]`}>
                  <div className="flex-shrink-0">
                    <div className="relative w-10 h-10 bg-black rounded-lg flex items-center justify-center">
                      <IndianRupee className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white text-sm font-semibold mb-0.5">{slide.title}</h3>
                    <p className="text-white/90 text-xs">{slide.subtitle}</p>
                  </div>
                  <button
                    onClick={() => slide.id === 2 && navigate("/delivery/profile/details")}
                    className="px-3 py-1.5 rounded-lg bg-white text-[#DC2626] font-medium text-xs"
                  >
                    {slide.buttonText}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
            {carouselSlides.map((_, index) => (
              <button
                key={index}
                className={`h-1.5 rounded-full transition-all duration-300 ${index === currentCarouselSlide ? "w-6 bg-white" : "w-1.5 bg-white/50"
                  }`}
                onClick={() => setCurrentCarouselSlide(index)}
              />
            ))}
          </div>
        </div>
      )}

      <div className="px-4 py-6 bg-gray-100 pb-24 md:pb-6">
        <Card onClick={() => navigate("/delivery/earnings")} className="py-4 bg-white border-0 shadow-none mb-4">
          <CardContent className="p-4 text-center">
            <div className="flex justify-center mb-2">
              <span className="text-black text-sm">Earnings: {getCurrentWeekRange()} →</span>
            </div>
            <div className="text-black text-3xl font-bold">₹{weeklyEarnings.toFixed(0)}</div>
          </CardContent>
        </Card>

        <div className="my-6">
          <div className="relative mb-4">
            <div className="h-px bg-gray-300"></div>
            <div className="absolute left-1/2 transform -translate-x-1/2 bg-gray-100 -top-3 px-3">
              <span className="text-black text-xs font-medium uppercase">Pocket</span>
            </div>
          </div>

          <Card className="bg-white border-0 shadow-none">
            <CardContent className="p-4 space-y-4">
              <div onClick={() => navigate("/delivery/pocket-balance")} className="flex items-center justify-between cursor-pointer">
                <span className="text-black text-sm">Pocket balance</span>
                <div className="flex items-center gap-2">
                  <span className="text-black text-sm font-medium">₹{pocketBalance.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <hr />
              <div onClick={() => setShowCashLimitPopup(true)} className="flex items-center justify-between cursor-pointer">
                <span className="text-black text-sm">Available cash limit</span>
                <div className="flex items-center gap-2">
                  <span className="text-black text-sm font-medium">₹{availableCashLimit.toFixed(2)}</span>
                  <ArrowRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button onClick={() => setShowDepositPopup(true)} className="flex-1 bg-white hover:bg-red-50 text-[#DC2626] border border-[#DC2626] font-bold py-3 rounded-lg">
                  Deposit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div className="relative mb-4">
            <div className="h-px bg-gray-300"></div>
            <div className="absolute left-1/2 transform -translate-x-1/2 -top-3 bg-gray-100 px-3">
              <span className="text-black text-xs font-medium uppercase">More Services</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-white border-0 shadow-none cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => navigate("/delivery/payout")}>
              <CardContent className="p-4 flex flex-col items-start">
                <div className="text-black text-2xl font-bold mb-2">₹{payoutAmount}</div>
                <div className="text-black text-sm font-medium mb-1">Payout</div>
                <div className="text-gray-600 text-xs">{payoutPeriod}</div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-none cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => navigate("/delivery/limit-settlement")}>
              <CardContent className="p-4 flex flex-col items-start">
                <Receipt className="w-8 h-8 text-black mb-3" />
                <div className="text-black text-sm font-medium">Available limit settlement</div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-none cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => navigate("/delivery/deduction-statement")}>
              <CardContent className="p-4 flex flex-col items-start">
                <FileTextIcon className="w-8 h-8 text-black mb-3" />
                <div className="text-black text-sm font-medium">Deduction statement</div>
              </CardContent>
            </Card>

            <Card className="bg-white border-0 shadow-none cursor-pointer hover:bg-gray-200 transition-colors" onClick={() => navigate("/delivery/pocket-details")}>
              <CardContent className="p-4 flex flex-col items-start">
                <WalletIcon className="w-8 h-8 text-black mb-3" />
                <div className="text-black text-sm font-medium">Pocket details</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <BottomPopup isOpen={showCashLimitPopup} onClose={() => setShowCashLimitPopup(false)} title="Available Cash Limit?" showCloseButton={true}>
        <AvailableCashLimit onClose={() => setShowCashLimitPopup(false)} walletData={{
          totalCashLimit,
          cashInHand: balances.cashInHand ?? 0,
          deductions: 0,
          pocketWithdrawals: balances.totalWithdrawn ?? 0,
          settlementAdjustment: 0
        }} />
      </BottomPopup>

      <BottomPopup isOpen={showDepositPopup} onClose={() => setShowDepositPopup(false)} title="Deposit" showCloseButton={true}>
        <DepositPopup cashInHand={balances.cashInHand ?? walletState?.cashInHand ?? 0} onSuccess={() => setShowDepositPopup(false)} />
      </BottomPopup>
    </div>
  );
}
