import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
import Lenis from "lenis";
import { ArrowLeft, Search, User, UserRound, Store, ChevronRight, Info, Clock, Users, Truck, FileText, Star, MessageSquare, HelpCircle, Edit, IndianRupee, Receipt, X, MapPin, Zap, Languages } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { clearModuleAuth, clearAuthData } from "@/lib/utils/auth";
import { restaurantAPI } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import { revokeFcmTokenOnLogout } from "@/lib/utils/fcmTokenLifecycle";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
export default function ExploreMore() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Restaurant data state
  const [restaurantData, setRestaurantData] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);

  // Fetch restaurant data on mount
  useEffect(() => {
    const fetchRestaurantData = async () => {
      try {
        setLoadingRestaurant(true);
        const response = await restaurantAPI.getCurrentRestaurant();
        const data = response?.data?.data?.restaurant || response?.data?.restaurant;
        if (data) {
          setRestaurantData(data);
        }
      } catch (error) {
        // Only log error if it's not a network/timeout error (backend might be down/slow)
        if (error.code !== 'ERR_NETWORK' && error.code !== 'ECONNABORTED' && !error.message?.includes('timeout')) {
          console.error("Error fetching restaurant data:", error);
        }
        // Continue with default values if fetch fails
      } finally {
        setLoadingRestaurant(false);
      }
    };
    fetchRestaurantData();
  }, []);

  // Format address from location object
  const formatAddress = location => {
    if (!location) return "";
    const parts = [];

    // Add area if available
    if (location.area) {
      parts.push(location.area.trim());
    }

    // Add city if available and not already in area
    if (location.city) {
      const city = location.city.trim();
      // Only add city if it's not already included in area
      if (!location.area || !location.area.includes(city)) {
        parts.push(city);
      }
    }
    return parts.join(", ") || "";
  };

  // Get user data from restaurant data
  const userData = restaurantData ? {
    name: restaurantData.ownerName || restaurantData.name || t("restaurant.exploreMore.profile.restaurantOwner"),
    phone: restaurantData.ownerPhone || restaurantData.phone || t("restaurant.exploreMore.common.na"),
    email: restaurantData.ownerEmail || restaurantData.email || t("restaurant.exploreMore.common.na"),
    role: t("restaurant.exploreMore.profile.roleOwner"),
    profileImage: restaurantData.profileImage
  } : {
    name: t("restaurant.exploreMore.common.loading"),
    phone: "",
    email: "",
    role: t("restaurant.exploreMore.profile.roleOwner")
  };

  // Get restaurant display data
  const restaurantDisplayName = restaurantData?.name || t("restaurant.exploreMore.common.loading");
  const restaurantDisplayAddress = restaurantData?.location ? formatAddress(restaurantData.location) : "";
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks

    setIsLoggingOut(true);
    setProfileOpen(false);
    try {
      // Call backend logout API to invalidate refresh token
      try {
        await revokeFcmTokenOnLogout("restaurant");
        await restaurantAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        console.warn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Sign out from Firebase if restaurant logged in via Google
      try {
        const {
          signOut
        } = await import("firebase/auth");
        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
          await signOut(firebaseAuth);
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        console.warn("Firebase logout failed, continuing with local cleanup:", firebaseError);
      }

      // Clear restaurant module authentication data
      clearModuleAuth("restaurant");

      // Clear any onboarding data from localStorage
      localStorage.removeItem("restaurant_onboarding");
      localStorage.removeItem("restaurant_accessToken");
      localStorage.removeItem("restaurant_authenticated");
      localStorage.removeItem("restaurant_user");

      // Clear sessionStorage
      sessionStorage.removeItem("restaurantAuthData");

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"));

      // Small delay for UX, then navigate to welcome page
      setTimeout(() => {
        navigate("/restaurant/welcome", {
          replace: true
        });
      }, 300);
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      console.error("Error during logout:", error);
      clearModuleAuth("restaurant");
      localStorage.removeItem("restaurant_onboarding");
      localStorage.removeItem("restaurant_accessToken");
      localStorage.removeItem("restaurant_authenticated");
      localStorage.removeItem("restaurant_user");
      sessionStorage.removeItem("restaurantAuthData");
      window.dispatchEvent(new Event("restaurantAuthChanged"));
      navigate("/restaurant/welcome", {
        replace: true
      });
    } finally {
      setIsLoggingOut(false);
    }
  };
  const handleLogoutAllDevices = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks

    setIsLoggingOut(true);
    setProfileOpen(false);
    try {
      // Call backend logout API to invalidate refresh token
      try {
        await revokeFcmTokenOnLogout("restaurant");
        await restaurantAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        console.warn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Sign out from Firebase if restaurant logged in via Google
      try {
        const {
          signOut
        } = await import("firebase/auth");
        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
          await signOut(firebaseAuth);
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        console.warn("Firebase logout failed, continuing with local cleanup:", firebaseError);
      }

      // Clear auth for all modules (admin, restaurant, delivery, user)
      clearAuthData();

      // Clear any onboarding data from localStorage
      localStorage.removeItem("restaurant_onboarding");

      // Clear sessionStorage for all modules
      sessionStorage.removeItem("restaurantAuthData");
      sessionStorage.removeItem("adminAuthData");
      sessionStorage.removeItem("deliveryAuthData");
      sessionStorage.removeItem("userAuthData");

      // Dispatch auth change events to notify other components
      window.dispatchEvent(new Event("restaurantAuthChanged"));
      window.dispatchEvent(new Event("adminAuthChanged"));
      window.dispatchEvent(new Event("deliveryAuthChanged"));
      window.dispatchEvent(new Event("userAuthChanged"));

      // Small delay for UX, then navigate to welcome page
      setTimeout(() => {
        navigate("/restaurant/welcome", {
          replace: true
        });
      }, 300);
    } catch (error) {
      // Even if there's an error, we should still clear local data and logout
      console.error("Error during logout from all devices:", error);
      clearAuthData();
      localStorage.removeItem("restaurant_onboarding");
      sessionStorage.removeItem("restaurantAuthData");
      sessionStorage.removeItem("adminAuthData");
      sessionStorage.removeItem("deliveryAuthData");
      sessionStorage.removeItem("userAuthData");
      window.dispatchEvent(new Event("restaurantAuthChanged"));
      navigate("/restaurant/welcome", {
        replace: true
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteConfirmationChange = (event) => {
    setDeleteConfirmationText((event.target.value || "").toUpperCase());
  };

  const handleDeleteDialogOpenChange = (open) => {
    if (isDeletingAccount) return;
    setDeleteConfirmOpen(open);
    if (!open) {
      setDeleteConfirmationText("");
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount || deleteConfirmationText !== "DELETE") return;

    setIsDeletingAccount(true);
    try {
      await revokeFcmTokenOnLogout("restaurant");
      await restaurantAPI.deleteAccount();

      try {
        const { signOut } = await import("firebase/auth");
        if (firebaseAuth.currentUser) {
          await signOut(firebaseAuth);
        }
      } catch (firebaseError) {
        console.warn("Firebase logout failed after account deletion:", firebaseError);
      }

      clearModuleAuth("restaurant");
      localStorage.removeItem("restaurant_onboarding");
      localStorage.removeItem("restaurant_accessToken");
      localStorage.removeItem("restaurant_authenticated");
      localStorage.removeItem("restaurant_user");
      localStorage.removeItem("restaurant_invited_users");
      sessionStorage.removeItem("restaurantAuthData");
      window.dispatchEvent(new Event("restaurantAuthChanged"));

      setDeleteConfirmationText("");
      setDeleteConfirmOpen(false);
      setProfileOpen(false);
      toast.success("Account deleted successfully");
      navigate("/restaurant/welcome", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete account. Please try again.");
      setIsDeletingAccount(false);
    }
  };
  // Prevent body scroll when popup is open
  useEffect(() => {
    if (profileOpen || searchOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [profileOpen, searchOpen]);

  useEffect(() => {
    if (profileOpen) {
      document.body.dataset.noPlanPopup = "suppress";
    } else {
      delete document.body.dataset.noPlanPopup;
    }
    window.dispatchEvent(new Event("noPlanPopupToggle"));
    return () => {
      delete document.body.dataset.noPlanPopup;
      window.dispatchEvent(new Event("noPlanPopupToggle"));
    };
  }, [profileOpen]);

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

  // Section data
  const manageOutletItems = [{
    id: 1,
    label: t("restaurant.exploreMore.items.outletInfo"),
    icon: Info,
    route: "/restaurant/outlet-info"
  }, {
    id: 2,
    label: t("restaurant.exploreMore.items.outletTimings"),
    icon: Clock,
    route: "/restaurant/outlet-timings"
  }, {
    id: 4,
    label: t("restaurant.exploreMore.items.manageStaff"),
    icon: Users,
    route: "/restaurant/contact-details"
  }];
  const settingsItems = [{
    id: 4,
    label: t("restaurant.exploreMore.items.zoneSetup"),
    icon: MapPin,
    route: "/restaurant/zone-setup"
  }, {
    id: 5,
    label: t("restaurant.exploreMore.items.deliverySetup"),
    icon: Truck,
    route: "/restaurant/delivery-pricing"
  }, {
    id: 6,
    label: t("restaurant.exploreMore.items.changeLanguage"),
    icon: Languages,
    route: "/restaurant/change-language"
  }];
  const ordersItems = [{
    id: 1,
    label: t("restaurant.exploreMore.items.orderHistory"),
    icon: FileText,
    route: "/restaurant/orders/all"
  }, {
    id: 2,
    label: t("restaurant.exploreMore.items.complaints"),
    icon: Star,
    route: "/restaurant/feedback?tab=complaints"
  }, {
    id: 3,
    label: t("restaurant.exploreMore.items.reviews"),
    icon: MessageSquare,
    route: "/restaurant/feedback"
  }];
  const helpItems = [{
    id: 1,
    label: t("restaurant.exploreMore.items.helpCentre"),
    icon: HelpCircle,
    route: "/restaurant/help-centre"
  }, {
    id: 3,
    label: t("restaurant.exploreMore.items.shareFeedback"),
    icon: Edit,
    route: "/restaurant/Share-Feedback"
  }];
  const accountingItems = [{
    id: 1,
    label: t("restaurant.exploreMore.items.payout"),
    icon: IndianRupee,
    route: "/restaurant/hub-finance"
  }, {
    id: 2,
    label: t("restaurant.exploreMore.items.invoices"),
    icon: Receipt,
    route: "/restaurant/hub-finance?tab=invoices"
  }, {
    id: 3,
    label: t("restaurant.exploreMore.items.subscription"),
    icon: Zap,
    route: "/restaurant/subscription"
  }];

  // All sections with their items
  const allSections = [{
    title: t("restaurant.exploreMore.sections.manageOutlet"),
    items: manageOutletItems,
    key: "manage-outlet"
  }, {
    title: t("restaurant.exploreMore.sections.settings"),
    items: settingsItems,
    key: "settings"
  }, {
    title: t("restaurant.exploreMore.sections.orders"),
    items: ordersItems,
    key: "orders"
  }, {
    title: t("restaurant.exploreMore.sections.help"),
    items: helpItems,
    key: "help"
  }, {
    title: t("restaurant.exploreMore.sections.accounting"),
    items: accountingItems,
    key: "accounting"
  }];

  // Filter logic
  const getFilteredSections = () => {
    if (!searchQuery.trim()) {
      return allSections;
    }
    const query = searchQuery.toLowerCase();
    return allSections.map(section => ({
      ...section,
      items: section.items.filter(item => item.label.toLowerCase().includes(query))
    })).filter(section => section.items.length > 0);
  };
  const filteredSections = getFilteredSections();
  const renderSection = (title, items, delay = 0) => <motion.div initial={{
    opacity: 0,
    y: 8
  }} animate={{
    opacity: 1,
    y: 0
  }} transition={{
    duration: 0.3,
    delay,
    ease: [0.25, 0.1, 0.25, 1]
  }} className="mb-8">
      <motion.h2 initial={{
      opacity: 0
    }} animate={{
      opacity: 1
    }} transition={{
      duration: 0.2,
      delay: delay + 0.05
    }} className="text-base font-bold text-gray-900 mb-4">
        {title}
      </motion.h2>
      <div className="grid grid-cols-3 gap-4">
        {items.map((item, index) => {
        const IconComponent = item.icon;
        return <motion.div key={item.id} initial={{
          opacity: 0,
          y: 4
        }} animate={{
          opacity: 1,
          y: 0
        }} transition={{
          duration: 0.25,
          delay: delay + 0.1 + index * 0.02,
          ease: [0.25, 0.1, 0.25, 1]
        }} className="flex flex-col items-center">
              <motion.button whileHover={{
            scale: 1.02,
            y: -1
          }} whileTap={{
            scale: 0.98
          }} onClick={() => {
            if (item.route) {
              navigate(item.route);
            }
          }} className="w-full flex items-center justify-center p-6 bg-white rounded-lg shadow-md border-2 border-gray-200 hover:shadow-md transition-shadow duration-200 min-h-[110px]">
                <div className="relative flex items-center justify-center">
                  {item.customIcon ? <div className="w-12 h-12 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-900">hp</span>
                    </div> : <IconComponent className="w-8 h-8 text-gray-900" strokeWidth={1.5} />}
                  {item.badge && <motion.span initial={{
                scale: 0
              }} animate={{
                scale: 1
              }} transition={{
                delay: delay + 0.15 + index * 0.02,
                type: "spring",
                stiffness: 500
              }} className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded">
                      {item.badge}
                    </motion.span>}
                </div>
              </motion.button>
              <span className="text-sm text-gray-700 text-center leading-tight font-normal mt-3">
                {item.label}
              </span>
            </motion.div>;
      })}
      </div>
    </motion.div>;
  return <motion.div initial={{
    opacity: 0
  }} animate={{
    opacity: 1
  }} exit={{
    opacity: 0
  }} transition={{
    duration: 0.2,
    ease: [0.25, 0.1, 0.25, 1]
  }} className="min-h-screen bg-white overflow-x-hidden">
      {/* Header */}
      <motion.div initial={{
      opacity: 0,
      y: -8
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      duration: 0.25,
      ease: [0.25, 0.1, 0.25, 1]
    }} className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1">
            <button onClick={() => navigate("/restaurant")} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label={t("restaurant.exploreMore.aria.goBack")}>
              <ArrowLeft className="w-6 h-6 text-gray-900" />
            </button>
            <h1 className="text-lg font-bold text-gray-900">{t("restaurant.exploreMore.title")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setSearchOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label={t("restaurant.exploreMore.aria.search")}>
              <Search className="w-5 h-5 text-gray-900" />
            </button>
            <button onClick={() => setProfileOpen(true)} className="p-2 hover:bg-gray-100 bg-gray-200 rounded-full transition-colors" aria-label={t("restaurant.exploreMore.aria.profile")}>
              <UserRound className="w-5 h-5 text-gray-900 " />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="px-4 py-6">
        {/* Restaurant Information Card */}
        <motion.div initial={{
        opacity: 0,
        y: 8
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.3,
        delay: 0.05,
        ease: [0.25, 0.1, 0.25, 1]
      }}>
          <Card className="bg-white border-gray-200 py-3 mb-6 rounded-lg shadow-0">
            <CardContent className="px-4">
              <div className="w-full flex items-center justify-between">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <Store className="w-5 h-5 text-gray-900" />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <h2 className="text-base font-semibold text-gray-900 mb-0.5">
                      {restaurantDisplayName}
                    </h2>
                    {restaurantDisplayAddress && <p className="text-sm text-gray-500 truncate">
                        {restaurantDisplayAddress}
                      </p>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Sections */}
        {filteredSections.length > 0 ? filteredSections.map((section, index) => <div key={section.key}>
              {renderSection(section.title, section.items, 0.1 + index * 0.05)}
              {index < filteredSections.length - 1 && <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} transition={{
          delay: 0.25 + index * 0.05,
          duration: 0.2
        }} className="border-t border-gray-200 my-6" />}
            </div>) : <motion.div initial={{
        opacity: 0,
        y: 8
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.3
      }} className="text-center py-12">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">{t("restaurant.exploreMore.search.noResultsTitle")}</p>
            <p className="text-sm text-gray-500">{t("restaurant.exploreMore.search.noResultsSubtitle")}</p>
          </motion.div>}
        <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} transition={{
        delay: 0.45,
        duration: 0.2
      }} className="border-t border-gray-200 my-6" />
      </div>

      {/* Search Popup */}
      <AnimatePresence>
        {searchOpen && <>
            {/* Backdrop */}
            <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} transition={{
          duration: 0.2
        }} className="fixed inset-0 bg-black/50 z-50" onClick={() => {
          setSearchOpen(false);
          setSearchQuery("");
        }} />

            {/* Search Modal */}
            <motion.div initial={{
          y: "-100%"
        }} animate={{
          y: 0
        }} exit={{
          y: "-100%"
        }} transition={{
          type: "spring",
          damping: 30,
          stiffness: 300
        }} className="fixed top-0 left-0 right-0 bg-white shadow-lg z-50 h-screen" onClick={e => e.stopPropagation()}>
              {/* Search Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
                <button onClick={() => {
              setSearchOpen(false);
              setSearchQuery("");
            }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label={t("restaurant.exploreMore.aria.closeSearch")}>
                  <ArrowLeft className="w-6 h-6 text-gray-900" />
                </button>
                <div className="flex-1 relative">
                  <input type="text" placeholder={t("restaurant.exploreMore.search.placeholder")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} autoFocus className="w-full px-4 py-2 pr-10 bg-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-500" />
                  {searchQuery && <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full transition-colors" aria-label={t("restaurant.exploreMore.aria.clearSearch")}>
                      <X className="w-4 h-4 text-gray-600" />
                    </button>}
                </div>
              </div>

              {/* Search Results */}
              <div className="max-h-[70vh] overflow-y-auto">
                {searchQuery.trim() ? getFilteredSections().length > 0 ? <div className="px-4 py-4">
                      {getFilteredSections().map(section => <div key={section.key} className="mb-6 last:mb-0">
                          <h3 className="text-sm font-semibold text-gray-500 mb-3 uppercase tracking-wide">
                            {section.title}
                          </h3>
                          <div className="space-y-2">
                            {section.items.map(item => {
                    const IconComponent = item.icon;
                    return <button key={item.id} onClick={() => {
                      if (item.route) {
                        navigate(item.route);
                      }
                      setSearchOpen(false);
                      setSearchQuery("");
                    }} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 rounded-lg transition-colors text-left">
                                  <div className="p-2 bg-gray-100 rounded-lg">
                                    <IconComponent className="w-5 h-5 text-gray-900" />
                                  </div>
                                  <span className="flex-1 text-base text-gray-900">{item.label}</span>
                                  {item.badge && <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded">
                                      {item.badge}
                                    </span>}
                                  <ChevronRight className="w-5 h-5 text-gray-400" />
                                </button>;
                  })}
                          </div>
                        </div>)}
                    </div> : <div className="text-center py-12 px-4">
                      <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-lg font-semibold text-gray-900 mb-2">{t("restaurant.exploreMore.search.noResultsTitle")}</p>
                      <p className="text-sm text-gray-500">{t("restaurant.exploreMore.search.noResultsSubtitle")}</p>
                    </div> : <div className="text-center py-12 px-4">
                    <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                    <p className="text-base font-medium text-gray-900 mb-1">{t("restaurant.exploreMore.search.idleTitle")}</p>
                    <p className="text-sm text-gray-500">{t("restaurant.exploreMore.search.idleSubtitle")}</p>
                  </div>}
              </div>
            </motion.div>
          </>}
      </AnimatePresence>

      {/* Profile Popup */}
      <AnimatePresence>
        {profileOpen && <>
            {/* Backdrop */}
            <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} transition={{
          duration: 0.2
        }} className="fixed inset-0 bg-black/50 z-50" onClick={() => setProfileOpen(false)} />

            {/* Popup Sheet */}
            <motion.div initial={{
          y: "100%"
        }} animate={{
          y: 0
        }} exit={{
          y: "100%"
        }} transition={{
          type: "spring",
          damping: 30,
          stiffness: 300
        }} className="fixed bottom-0 left-0 right-0 bg-white rounded-0 shadow-2xl z-50 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 sticky top-0 bg-white z-10">
                <h2 className="text-lg font-bold text-gray-900">{t("restaurant.exploreMore.profile.title")}</h2>
                <button onClick={() => setProfileOpen(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" aria-label={t("restaurant.exploreMore.aria.close")}>
                  <X className="w-5 h-5 text-gray-900" />
                </button>
              </div>

              {/* User Information Section */}
              <div className="px-6 py-6">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center shrink-0 overflow-hidden">
                    {userData.profileImage?.url ? <img src={userData.profileImage.url} alt={userData.name} className="w-full h-full object-cover" /> : <User className="w-8 h-8 text-gray-400" />}
                  </div>

                  {/* User Details */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-gray-900 mb-1">
                      {loadingRestaurant ? t("restaurant.exploreMore.common.loading") : userData.name}
                    </h3>
                    {userData.phone && <p className="text-sm text-gray-900 mb-1">
                        {userData.phone}
                      </p>}
                    {userData.email && <p className="text-sm text-gray-900 mb-1">
                        {userData.email}
                      </p>}
                    <p className="text-sm font-bold text-gray-900 mt-2">
                      {userData.role}
                    </p>
                  </div>
                </div>
              </div>

              {/* Logout Buttons */}
              <div className="px-6 pb-6 space-y-3">
                {/* Logout Button */}
                <button onClick={handleLogout} disabled={isLoggingOut} className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors">
                  {isLoggingOut ? t("restaurant.exploreMore.profile.loggingOut") : t("restaurant.exploreMore.profile.logout")}
                </button>

                <button onClick={() => handleDeleteDialogOpenChange(true)} disabled={isLoggingOut || isDeletingAccount} className="w-full bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold py-3 px-4 rounded-lg transition-colors">
                  {isDeletingAccount ? "Deleting..." : "Delete Account"}
                </button>

                {/* Logout from all devices Button */}
                <button onClick={handleLogoutAllDevices} disabled={isLoggingOut} className="w-full bg-white border-2 border-red-600 text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold py-3 px-4 rounded-lg transition-colors">
                  {isLoggingOut ? t("restaurant.exploreMore.profile.loggingOut") : t("restaurant.exploreMore.profile.logoutAllDevices")}
                </button>
              </div>

              {/* Footer Links */}
              <div className="px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
                  <Link to="/restaurant/legal/terms" className="hover:text-gray-700 transition-colors border-b border-dotted border-gray-400">
                    {t("restaurant.exploreMore.footer.terms")}
                  </Link>
                  <span className="text-gray-400">|</span>
                  <Link to="/restaurant/legal/privacy" className="hover:text-gray-700 transition-colors border-b border-dotted border-gray-400">
                    {t("restaurant.exploreMore.footer.privacy")}
                  </Link>
                  <span className="text-gray-400">|</span>
                  <Link to="/restaurant/legal/code-of-conduct" className="hover:text-gray-700 transition-colors border-b border-dotted border-gray-400">
                    {t("restaurant.exploreMore.footer.codeOfConduct")}
                  </Link>
                </div>
              </div>
            </motion.div>
          </>}
      </AnimatePresence>

      <Dialog open={deleteConfirmOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl p-4 sm:p-5 [&>button]:hidden">
          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="text-base sm:text-lg font-bold text-red-600">Delete Your Account?</DialogTitle>
            <DialogDescription className="text-sm leading-5 text-gray-600">
              Are you sure you want to delete your account? All your data will be permanently lost. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type DELETE to confirm"
            value={deleteConfirmationText}
            onChange={handleDeleteConfirmationChange}
            disabled={isDeletingAccount}
            className="h-11 mt-2"
          />
          <DialogFooter className="mt-4 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDeleteDialogOpenChange(false)}
              disabled={isDeletingAccount}
              className="h-11 w-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-11 w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || deleteConfirmationText !== "DELETE"}
            >
              {isDeletingAccount ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </motion.div>;
}
