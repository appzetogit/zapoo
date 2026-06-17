import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { DateRangeCalendar } from "@/components/ui/date-range-calendar";
import { Bell, HelpCircle, Menu, Search, TrendingUp, BarChart3, Users, CalendarRange, Download, ChevronLeft, ChevronRight, Wand2, X, MapPin, Megaphone } from "lucide-react";
import { FaExclamationTriangle, FaStar, FaCommentDots, FaLink } from "react-icons/fa";
import { AreaChart, Area, Line, Bar, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart } from "recharts";
import BottomNavOrders from "../components/BottomNavOrders";
import SubscriptionFeatureOverlay from "../components/SubscriptionFeatureOverlay";
import SubscriptionExpiryBanner from "../components/SubscriptionExpiryBanner";
import useSubscriptionExpiryNotice from "../hooks/useSubscriptionExpiryNotice";
import { restaurantAPI } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, format, isSameDay, isSameMonth } from "date-fns";
export default function ToHub() {
  const navigate = useNavigate();
  const expiryNotice = useSubscriptionExpiryNotice();
  const [activeTopTab, setActiveTopTab] = useState("my-feed");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [restaurantData, setRestaurantData] = useState(null);
  const [loadingRestaurant, setLoadingRestaurant] = useState(true);
  const [graphFilter, setGraphFilter] = useState("daily"); // daily, weekly, monthly, yearly
  const subscription = restaurantData?.subscription;
  const readFeatureKeys = useCallback((source) => {
    if (!Array.isArray(source)) return [];
    return source.map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object") {
        return item.key || item.feature || item.name || "";
      }
      return "";
    }).filter(Boolean);
  }, []);
  const featureList = useMemo(() => {
    const snapshot = readFeatureKeys(subscription?.features);
    const plan = readFeatureKeys(subscription?.planId?.features);
    return [...new Set([...snapshot, ...plan].map((f) => String(f).trim().toLowerCase()))];
  }, [readFeatureKeys, subscription?.features, subscription?.planId?.features]);
  const hasAdvancedAnalytics = featureList.includes("advanced_analytics");
  const hasAdvancedMarketingTools = featureList.includes("advanced_marketing_tools");
  const topTabs = useMemo(() => {
    return [{
      id: "my-feed",
      label: "Sales"
    }, {
      id: "sales",
      label: "Advanced Analytics"
    }];
  }, []);

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
  useEffect(() => {
    if (!topTabs.some(tab => tab.id === activeTopTab)) {
      setActiveTopTab("my-feed");
    }
  }, [topTabs, activeTopTab]);
  const topTabBarRef = useRef(null);
  const contentContainerRef = useRef(null);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const touchStartY = useRef(0);
  const isSwiping = useRef(false);
  const mouseStartX = useRef(0);
  const mouseEndX = useRef(0);
  const isMouseDown = useRef(false);


  // Card definitions data
  const cardDefinitions = {
    sales: {
      title: "Sales",
      metrics: [{
        name: "Net sales",
        definition: "Total revenue from delivered orders after deductions"
      }, {
        name: "Orders delivered",
        definition: "Number of successfully completed customer orders"
      }, {
        name: "Avg. order value",
        definition: "Average amount spent per order by customers"
      }]
    },
    customers: {
      title: "Customers",
      metrics: [{
        name: "New customers",
        definition: "First-time visitors ordering from your restaurant"
      }, {
        name: "Repeat customers",
        definition: "Returning customers who ordered before"
      }, {
        name: "Lapsed customers",
        definition: "Previous customers who haven't ordered recently"
      }]
    },
    "orders-by-mealtime": {
      title: "Orders by mealtime",
      metrics: [{
        name: "Breakfast",
        definition: "Morning orders between 6 AM to 11 AM"
      }, {
        name: "Lunch",
        definition: "Afternoon orders between 11 AM to 4 PM"
      }, {
        name: "Snacks",
        definition: "Evening orders between 4 PM to 7 PM"
      }, {
        name: "Dinner",
        definition: "Night orders between 7 PM onwards"
      }]
    },
    offers: {
      title: "Offers",
      metrics: [{
        name: "Discount given",
        definition: "Total amount discounted on orders"
      }, {
        name: "Orders from offers",
        definition: "Orders placed using your active offers"
      }, {
        name: "Effective discount %",
        definition: "Average discount percentage given to customers"
      }, {
        name: "Offer orders %",
        definition: "Percentage of total orders using offers"
      }]
    },
    ads: {
      title: "Ads",
      metrics: [{
        name: "Ad impressions",
        definition: "Times your ad was shown to customers"
      }, {
        name: "Orders from ads",
        definition: "Orders received through ad campaigns"
      }, {
        name: "Ad spends",
        definition: "Total amount spent on advertising"
      }, {
        name: "ROI",
        definition: "Return on investment from ad spending"
      }]
    },
    "sales-orders": {
      title: "Sales & orders",
      metrics: [{
        name: "Net sales",
        definition: "Total revenue from delivered orders"
      }, {
        name: "Orders delivered",
        definition: "Successfully completed customer orders"
      }]
    },
    "avg-order-value": {
      title: "Average order value",
      metrics: [{
        name: "Avg. order value",
        definition: "Average amount spent per order"
      }]
    },
    "find-you": {
      title: "Where customers find you",
      metrics: [{
        name: "Search",
        definition: "Found through search queries"
      }, {
        name: "Category",
        definition: "Found through category browsing"
      }, {
        name: "Previously ordered",
        definition: "Found in past orders section"
      }]
    },
    impressions: {
      title: "Impressions",
      metrics: [{
        name: "Total impressions",
        definition: "Total times shown in app"
      }]
    },
    "impressions-by-customer": {
      title: "Impressions by customer type",
      metrics: [{
        name: "New customers",
        definition: "Impressions to first-time users"
      }, {
        name: "Repeat customers",
        definition: "Impressions to returning users"
      }, {
        name: "Lapsed customers",
        definition: "Impressions to inactive users"
      }]
    },
    "menu-opens": {
      title: "Menu opens",
      metrics: [{
        name: "Total menu opens",
        definition: "Times menu was viewed"
      }]
    },
    "menu-opens-by-customer": {
      title: "Menu opens by customer type",
      metrics: [{
        name: "New customers",
        definition: "Menu views by first-timers"
      }, {
        name: "Repeat customers",
        definition: "Menu views by returning users"
      }, {
        name: "Lapsed customers",
        definition: "Menu views by inactive users"
      }]
    },
    "orders-placed": {
      title: "Orders placed",
      metrics: [{
        name: "Total orders",
        definition: "All orders received"
      }]
    },
    "orders-by-customer": {
      title: "Orders placed by customer type",
      metrics: [{
        name: "New customers",
        definition: "Orders from first-timers"
      }, {
        name: "Repeat customers",
        definition: "Orders from returning users"
      }, {
        name: "Lapsed customers",
        definition: "Orders from inactive users"
      }]
    }
  };
  const scrollToTopTab = index => {
    if (topTabBarRef.current) {
      const buttons = topTabBarRef.current.querySelectorAll("button");
      if (buttons[index]) {
        const button = buttons[index];
        const container = topTabBarRef.current;
        const buttonLeft = button.offsetLeft;
        const buttonWidth = button.offsetWidth;
        const containerWidth = container.offsetWidth;
        const scrollLeft = buttonLeft - containerWidth / 2 + buttonWidth / 2;
        container.scrollTo({
          left: scrollLeft,
          behavior: "smooth"
        });
      }
    }
  };
  useEffect(() => {
    const index = topTabs.findIndex(tab => tab.id === activeTopTab);
    if (index >= 0) {
      requestAnimationFrame(() => scrollToTopTab(index));
    }
  }, [activeTopTab]);

  // Handle swipe gestures with smooth animations
  const handleTouchStart = e => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchEndX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };
  const handleTouchMove = e => {
    if (!isSwiping.current) {
      const deltaX = Math.abs(e.touches[0].clientX - touchStartX.current);
      const deltaY = Math.abs(e.touches[0].clientY - touchStartY.current);

      // Determine if this is a horizontal swipe
      if (deltaX > deltaY && deltaX > 10) {
        isSwiping.current = true;
      }
    }
    if (isSwiping.current) {
      touchEndX.current = e.touches[0].clientX;
    }
  };
  const handleTouchEnd = () => {
    if (!isSwiping.current) {
      touchStartX.current = 0;
      touchEndX.current = 0;
      return;
    }
    const swipeDistance = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;
    const swipeVelocity = Math.abs(swipeDistance);
    if (swipeVelocity > minSwipeDistance && !isTransitioning) {
      const currentIndex = topTabs.findIndex(tab => tab.id === activeTopTab);
      let newIndex = currentIndex;
      if (swipeDistance > 0 && currentIndex < topTabs.length - 1) {
        // Swipe left - go to next tab (right side)
        newIndex = currentIndex + 1;
      } else if (swipeDistance < 0 && currentIndex > 0) {
        // Swipe right - go to previous tab (left side)
        newIndex = currentIndex - 1;
      }
      if (newIndex !== currentIndex) {
        setIsTransitioning(true);

        // Smooth transition with animation
        setTimeout(() => {
          setActiveTopTab(topTabs[newIndex].id);

          // Reset transition state after animation
          setTimeout(() => {
            setIsTransitioning(false);
          }, 300);
        }, 50);
      }
    }

    // Reset touch positions
    touchStartX.current = 0;
    touchEndX.current = 0;
    touchStartY.current = 0;
    isSwiping.current = false;
  };
  const quickLinks = useMemo(() => {
    const links = [];

    if (hasAdvancedMarketingTools) {
      links.push({
        id: "promoted-banners",
        label: "Promoted Banners",
        icon: Megaphone,
        route: "/restaurant/advertisements"
      });
    }

    // Add Relationship Manager only if effective enabled features include RM access
    const hasRM = featureList.includes("relationship_manager");
    const rmDetails = restaurantData?.relationshipManager;
    const resolvedRMPhone = String(rmDetails?.phone || restaurantData?.rmFallbackPhone || "").trim();

    if (hasRM) {
      links.push({
        id: "relationship-manager",
        label: "Your RM",
        icon: Users,
        route: resolvedRMPhone ? `tel:${resolvedRMPhone}` : "",
        isPhone: true,
        subLabel: rmDetails?.name || "RM assigned"
      });
    }

    links.push(...[{
      id: "complaints",
      label: "Complaints",
      icon: FaExclamationTriangle,
      route: "/restaurant/feedback?tab=complaints"
    }, {
      id: "reviews",
      label: "Reviews",
      icon: FaStar,
      route: "/restaurant/feedback"
    }, {
      id: "feedback",
      label: "feedback",
      icon: FaCommentDots,
      route: "/restaurant/Share-Feedback"
    }, {
      id: "zone-setup",
      label: "Zone Setup",
      icon: MapPin,
      route: "/restaurant/zone-setup"
    }]);

    return links;
  }, [hasAdvancedMarketingTools, restaurantData, featureList]);
  const [chartData, setChartData] = useState([{
    hour: "12am",
    orders: 0,
    sales: 0
  }, {
    hour: "4am",
    orders: 0,
    sales: 0
  }, {
    hour: "8am",
    orders: 0,
    sales: 0
  }, {
    hour: "12pm",
    orders: 0,
    sales: 0
  }, {
    hour: "4pm",
    orders: 0,
    sales: 0
  }, {
    hour: "8pm",
    orders: 0,
    sales: 0
  }, {
    hour: "12am",
    orders: 0,
    sales: 0
  }]);
  const [totalSales, setTotalSales] = useState("INR 0");
  const [totalOrders, setTotalOrders] = useState("0");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mealtimeMetrics, setMealtimeMetrics] = useState([{
    title: "Dinner",
    window: "7:00 pm - 11:00 pm",
    value: "0",
    change: "- 0%",
    color: "#f59e0b"
  }, {
    title: "Late night",
    window: "11:00 pm - 7:00 am",
    value: "0",
    change: "- 0%",
    color: "#10b981"
  }]);
  const [customersMetrics, setCustomersMetrics] = useState([{
    title: "New customers",
    sub: "First order in selected period",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Repeat customers",
    sub: "Ordered in last 60 days",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Lapsed customers",
    sub: "Last order 60+ days ago",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }]);
  const [offersAnalytics, setOffersAnalytics] = useState({
    offerClicks: null,
    offerRedemptions: 0,
    conversionRatePct: null,
    costPerRedemption: 0
  });
  const [recommendedStats, setRecommendedStats] = useState({
    count: 0,
    revenue: 0,
    fees: 0,
    netRevenue: 0,
    contribution: 0
  });
  const [complaintsView, setComplaintsView] = useState("all");
  const [isKptVideoOpen, setIsKptVideoOpen] = useState(false);
  const [offersWeeklyData] = useState([{
    day: "M",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }, {
    day: "T",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }, {
    day: "W",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }, {
    day: "T",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }, {
    day: "F",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }, {
    day: "S",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }, {
    day: "S",
    totalGross: 0,
    offersGross: 0,
    discountGiven: 0,
    effectiveDiscount: 0,
    ordersFromOffers: 0,
    totalOrders: 0
  }]);
  const [adsSalesWeeklyData] = useState([{
    day: "M",
    salesFromAds: 0,
    totalSales: 0
  }, {
    day: "T",
    salesFromAds: 0,
    totalSales: 0
  }, {
    day: "W",
    salesFromAds: 0,
    totalSales: 0
  }, {
    day: "T",
    salesFromAds: 0,
    totalSales: 0
  }, {
    day: "F",
    salesFromAds: 0,
    totalSales: 0
  }, {
    day: "S",
    salesFromAds: 0,
    totalSales: 0
  }, {
    day: "S",
    salesFromAds: 0,
    totalSales: 0
  }]);
  const [adsSpendsROIWeeklyData] = useState([{
    day: "M",
    adSpends: 0,
    roi: 0
  }, {
    day: "T",
    adSpends: 0,
    roi: 0
  }, {
    day: "W",
    adSpends: 0,
    roi: 0
  }, {
    day: "T",
    adSpends: 0,
    roi: 0
  }, {
    day: "F",
    adSpends: 0,
    roi: 0
  }, {
    day: "S",
    adSpends: 0,
    roi: 0
  }, {
    day: "S",
    adSpends: 0,
    roi: 0
  }]);
  const [percentageOrdersFromAdsWeeklyData] = useState([{
    day: "M",
    percentageOrdersFromAds: 0
  }, {
    day: "T",
    percentageOrdersFromAds: 0
  }, {
    day: "W",
    percentageOrdersFromAds: 0
  }, {
    day: "T",
    percentageOrdersFromAds: 0
  }, {
    day: "F",
    percentageOrdersFromAds: 0
  }, {
    day: "S",
    percentageOrdersFromAds: 0
  }, {
    day: "S",
    percentageOrdersFromAds: 0
  }]);
  const [adImpressionsWeeklyData] = useState([{
    day: "M",
    adImpressions: 0
  }, {
    day: "T",
    adImpressions: 0
  }, {
    day: "W",
    adImpressions: 0
  }, {
    day: "T",
    adImpressions: 0
  }, {
    day: "F",
    adImpressions: 0
  }, {
    day: "S",
    adImpressions: 0
  }, {
    day: "S",
    adImpressions: 0
  }]);
  const [adCTRM2OWeeklyData] = useState([{
    day: "M",
    adCTR: 0,
    adM2O: 0
  }, {
    day: "T",
    adCTR: 0,
    adM2O: 0
  }, {
    day: "W",
    adCTR: 0,
    adM2O: 0
  }, {
    day: "T",
    adCTR: 0,
    adM2O: 0
  }, {
    day: "F",
    adCTR: 0,
    adM2O: 0
  }, {
    day: "S",
    adCTR: 0,
    adM2O: 0
  }, {
    day: "S",
    adCTR: 0,
    adM2O: 0
  }]);
  const discountTypeBreakup = [{
    title: "Promo discounts",
    value: "INR 0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Dish discounts",
    value: "INR 0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Buy 1 Get 1, etc.",
    value: "INR 0",
    change: "- 0%",
    color: "#2563eb"
  }, {
    title: "Freebie",
    value: "INR 0",
    change: "- 0%",
    color: "#f59e0b"
  }, {
    title: "Gold discount",
    value: "INR 0",
    change: "- 0%",
    color: "#10b981"
  }, {
    title: "Winback discount",
    value: "INR 0",
    change: "- 0%",
    color: "#d1d5db"
  }];
  const offersCustomerAffinity = [{
    title: "New customers",
    sub: "No orders in last 90 days",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Repeat customers",
    sub: "Ordered in last 60 days",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Lapsed customers",
    sub: "Last order 60 to 90 days ago",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }];
  const offersCustomerSpending = [{
    title: "Mass market customers",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Mid premium customers",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Premium customers",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }];
  const adsBreakup = [{
    title: "Visit pack",
    value: "0%",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Video ads",
    value: "0%",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Branding on Search (BoS)",
    value: "0%",
    change: "- 0%",
    color: "#2563eb"
  }, {
    title: "Others",
    value: "0%",
    change: "- 0%",
    color: "#f59e0b"
  }];
  const adImpressionsCustomerAffinity = [{
    title: "New customers",
    sub: "No orders in last 365 days",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Repeat customers",
    sub: "Ordered in last 60 days",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Lapsed customers",
    sub: "Last order 60 to 365 days ago",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }];
  const adImpressionsCustomerSpending = [{
    title: "Mass market customers",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Mid premium customers",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Premium customers",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }];
  const [menuOpensData] = useState([{
    hour: "12am",
    opens: 0,
    i2m: 0
  }, {
    hour: "4am",
    opens: 2,
    i2m: 0.2
  }, {
    hour: "8am",
    opens: 0,
    i2m: 0
  }, {
    hour: "12pm",
    opens: 0,
    i2m: 0
  }, {
    hour: "4pm",
    opens: 1,
    i2m: 0.6
  }, {
    hour: "8pm",
    opens: 1,
    i2m: 1.1
  }, {
    hour: "12am",
    opens: 0,
    i2m: 0.1
  }]);
  const [isDateSelectorOpen, setIsDateSelectorOpen] = useState(false);
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState("today");
  const [customDateRange, setCustomDateRange] = useState({
    start: null,
    end: null
  });
  const [isDateLoading, setIsDateLoading] = useState(false);

  // Helper functions for date ranges
  const getDateRanges = () => {
    const now = new Date();
    const today = new Date(now);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay() + 1);
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekStart.getDate() + 6);
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setDate(thisWeekStart.getDate() - 1);
    const lastWeekStart = new Date(lastWeekEnd);
    lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    const last5DaysEnd = new Date(now);
    const last5DaysStart = new Date(now);
    last5DaysStart.setDate(now.getDate() - 4);
    const thisYearStart = startOfYear(now);
    const thisYearEnd = endOfYear(now);
    return {
      today,
      yesterday,
      thisWeekStart,
      thisWeekEnd,
      lastWeekStart,
      lastWeekEnd,
      thisMonthStart,
      thisMonthEnd,
      lastMonthStart,
      lastMonthEnd,
      last5DaysStart,
      last5DaysEnd,
      thisYearStart,
      thisYearEnd
    };
  };

  // Calculate chart data from real orders
  const calculateChartDataFromOrders = (orders, startDate, endDate) => {
    // Initialize hour buckets
    const hourBuckets = {
      "12am": {
        orders: 0,
        sales: 0
      },
      "4am": {
        orders: 0,
        sales: 0
      },
      "8am": {
        orders: 0,
        sales: 0
      },
      "12pm": {
        orders: 0,
        sales: 0
      },
      "4pm": {
        orders: 0,
        sales: 0
      },
      "8pm": {
        orders: 0,
        sales: 0
      }
    };

    // Filter orders by date range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });

    // Calculate total sales and orders
    let totalSalesAmount = 0;
    let totalOrdersCount = 0;

    // Group orders by hour
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();

      // Determine hour bucket
      let hourLabel;
      if (hour >= 0 && hour < 4) hourLabel = "12am";else if (hour >= 4 && hour < 8) hourLabel = "4am";else if (hour >= 8 && hour < 12) hourLabel = "8am";else if (hour >= 12 && hour < 16) hourLabel = "12pm";else if (hour >= 16 && hour < 20) hourLabel = "4pm";else hourLabel = "8pm"; // 20-23

      const orderAmount = order.pricing?.total || 0;
      hourBuckets[hourLabel].orders += 1;
      hourBuckets[hourLabel].sales += orderAmount;
      totalSalesAmount += orderAmount;
      totalOrdersCount += 1;
    });

    // Convert to chart data format
    const chartData = [{
      hour: "12am",
      orders: hourBuckets["12am"].orders,
      sales: Math.round(hourBuckets["12am"].sales)
    }, {
      hour: "4am",
      orders: hourBuckets["4am"].orders,
      sales: Math.round(hourBuckets["4am"].sales)
    }, {
      hour: "8am",
      orders: hourBuckets["8am"].orders,
      sales: Math.round(hourBuckets["8am"].sales)
    }, {
      hour: "12pm",
      orders: hourBuckets["12pm"].orders,
      sales: Math.round(hourBuckets["12pm"].sales)
    }, {
      hour: "4pm",
      orders: hourBuckets["4pm"].orders,
      sales: Math.round(hourBuckets["4pm"].sales)
    }, {
      hour: "8pm",
      orders: hourBuckets["8pm"].orders,
      sales: Math.round(hourBuckets["8pm"].sales)
    }, {
      hour: "12am",
      orders: 0,
      sales: 0
    } // Next day marker
    ];
    return {
      chartData,
      totalSales: Math.round(totalSalesAmount),
      totalOrders: totalOrdersCount
    };
  };

  // Calculate chart data for Weekly filter
  const calculateWeeklyChartData = (orders, startDate, endDate) => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Generate all days in the interval
    const daysInInterval = eachDayOfInterval({
      start,
      end
    });

    // Initialize buckets for each day
    const dayBuckets = daysInInterval.map(day => ({
      date: day,
      dayLabel: format(day, 'EEE'),
      // Mon, Tue, Wed
      fullLabel: format(day, 'dd MMM'),
      // 01 Jan
      orders: 0,
      sales: 0
    }));
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });
    let totalSalesAmount = 0;
    let totalOrdersCount = 0;
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const bucket = dayBuckets.find(b => isSameDay(b.date, orderDate));
      if (bucket) {
        const orderAmount = order.pricing?.total || 0;
        bucket.orders += 1;
        bucket.sales += orderAmount;
        totalSalesAmount += orderAmount;
        totalOrdersCount += 1;
      }
    });
    const chartData = dayBuckets.map(bucket => ({
      day: bucket.dayLabel,
      fullLabel: bucket.fullLabel,
      orders: bucket.orders,
      sales: Math.round(bucket.sales)
    }));
    return {
      chartData,
      totalSales: Math.round(totalSalesAmount),
      totalOrders: totalOrdersCount
    };
  };

  // Calculate chart data for Monthly filter
  const calculateMonthlyChartData = (orders, startDate, endDate) => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Generate all days in the interval
    const daysInInterval = eachDayOfInterval({
      start,
      end
    });

    // Initialize buckets for each day
    const dayBuckets = daysInInterval.map(day => ({
      date: day,
      dayLabel: format(day, 'd'),
      // 1, 2, 3
      fullLabel: format(day, 'dd MMM'),
      orders: 0,
      sales: 0
    }));
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });
    let totalSalesAmount = 0;
    let totalOrdersCount = 0;
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const bucket = dayBuckets.find(b => isSameDay(b.date, orderDate));
      if (bucket) {
        const orderAmount = order.pricing?.total || 0;
        bucket.orders += 1;
        bucket.sales += orderAmount;
        totalSalesAmount += orderAmount;
        totalOrdersCount += 1;
      }
    });
    const chartData = dayBuckets.map(bucket => ({
      date: bucket.dayLabel,
      fullLabel: bucket.fullLabel,
      orders: bucket.orders,
      sales: Math.round(bucket.sales)
    }));
    return {
      chartData,
      totalSales: Math.round(totalSalesAmount),
      totalOrders: totalOrdersCount
    };
  };

  // Calculate chart data for Yearly filter
  const calculateYearlyChartData = (orders, startDate, endDate) => {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Generate all months in the interval
    const monthsInInterval = eachMonthOfInterval({
      start,
      end
    });

    // Initialize buckets for each month
    const monthBuckets = monthsInInterval.map(month => ({
      date: month,
      monthLabel: format(month, 'MMM'),
      // Jan, Feb
      fullLabel: format(month, 'MMMM yyyy'),
      orders: 0,
      sales: 0
    }));
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });
    let totalSalesAmount = 0;
    let totalOrdersCount = 0;
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const bucket = monthBuckets.find(b => isSameMonth(b.date, orderDate));
      if (bucket) {
        const orderAmount = order.pricing?.total || 0;
        bucket.orders += 1;
        bucket.sales += orderAmount;
        totalSalesAmount += orderAmount;
        totalOrdersCount += 1;
      }
    });
    const chartData = monthBuckets.map(bucket => ({
      month: bucket.monthLabel,
      fullLabel: bucket.fullLabel,
      orders: bucket.orders,
      sales: Math.round(bucket.sales)
    }));
    return {
      chartData,
      totalSales: Math.round(totalSalesAmount),
      totalOrders: totalOrdersCount
    };
  };

  // Calculate mealtime data from orders
  const calculateMealtimeData = (orders, startDate, endDate) => {
    // Initialize mealtime buckets
    const mealtimeBuckets = {
      breakfast: {
        count: 0,
        color: "#111827"
      },
      lunch: {
        count: 0,
        color: "#ef4444"
      },
      eveningSnacks: {
        count: 0,
        color: "#2563eb"
      },
      dinner: {
        count: 0,
        color: "#f59e0b"
      },
      lateNight: {
        count: 0,
        color: "#10b981"
      }
    };

    // Filter orders by date range
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    const filteredOrders = orders.filter(order => {
      if (!order.createdAt) return false;
      const orderDate = new Date(order.createdAt);
      return orderDate >= start && orderDate <= end;
    });

    // Group orders by mealtime
    filteredOrders.forEach(order => {
      const orderDate = new Date(order.createdAt);
      const hour = orderDate.getHours();
      const minute = orderDate.getMinutes();
      const timeInMinutes = hour * 60 + minute;

      // Breakfast: 7:00 am - 11:00 am (420 - 660 minutes)
      if (timeInMinutes >= 420 && timeInMinutes < 660) {
        mealtimeBuckets.breakfast.count++;
      }
      // Lunch: 11:00 am - 4:00 pm (660 - 960 minutes)
      else if (timeInMinutes >= 660 && timeInMinutes < 960) {
        mealtimeBuckets.lunch.count++;
      }
      // Evening snacks: 4:00 pm - 7:00 pm (960 - 1140 minutes)
      else if (timeInMinutes >= 960 && timeInMinutes < 1140) {
        mealtimeBuckets.eveningSnacks.count++;
      }
      // Dinner: 7:00 pm - 11:00 pm (1140 - 1380 minutes, or 1140 - 1440)
      else if (timeInMinutes >= 1140 && timeInMinutes < 1380) {
        mealtimeBuckets.dinner.count++;
      }
      // Late night: 11:00 pm - 7:00 am (1380 - 1440 and 0 - 420 minutes)
      else if (timeInMinutes >= 1380 || timeInMinutes < 420) {
        mealtimeBuckets.lateNight.count++;
      }
    });
    const totalOrdersCount = filteredOrders.length;

    // Calculate percentages and format data
    const calculatePercentage = (count, total) => {
      if (total === 0) return "- 0%";
      const percentage = (count / total * 100).toFixed(1);
      return `${percentage}%`;
    };
    return [{
      title: "Breakfast",
      window: "7:00 am - 11:00 am",
      value: mealtimeBuckets.breakfast.count.toString(),
      change: calculatePercentage(mealtimeBuckets.breakfast.count, totalOrdersCount),
      color: mealtimeBuckets.breakfast.color
    }, {
      title: "Lunch",
      window: "11:00 am - 4:00 pm",
      value: mealtimeBuckets.lunch.count.toString(),
      change: calculatePercentage(mealtimeBuckets.lunch.count, totalOrdersCount),
      color: mealtimeBuckets.lunch.color
    }, {
      title: "Evening snacks",
      window: "4:00 pm - 7:00 pm",
      value: mealtimeBuckets.eveningSnacks.count.toString(),
      change: calculatePercentage(mealtimeBuckets.eveningSnacks.count, totalOrdersCount),
      color: mealtimeBuckets.eveningSnacks.color
    }, {
      title: "Dinner",
      window: "7:00 pm - 11:00 pm",
      value: mealtimeBuckets.dinner.count.toString(),
      change: calculatePercentage(mealtimeBuckets.dinner.count, totalOrdersCount),
      color: mealtimeBuckets.dinner.color
    }, {
      title: "Late night",
      window: "11:00 pm - 7:00 am",
      value: mealtimeBuckets.lateNight.count.toString(),
      change: calculatePercentage(mealtimeBuckets.lateNight.count, totalOrdersCount),
      color: mealtimeBuckets.lateNight.color
    }];
  };
  // Fetch analytics from backend and update chart/cards
  const fetchOrdersAndUpdateChart = useCallback(async rangeId => {
    try {
      setIsDateLoading(true);

      const ranges = getDateRanges();
      let startDate, endDate;
      switch (rangeId) {
        case "today":
          startDate = ranges.today;
          endDate = ranges.today;
          break;
        case "yesterday":
          startDate = ranges.yesterday;
          endDate = ranges.yesterday;
          break;
        case "thisWeek":
          startDate = ranges.thisWeekStart;
          endDate = ranges.thisWeekEnd;
          break;
        case "lastWeek":
          startDate = ranges.lastWeekStart;
          endDate = ranges.lastWeekEnd;
          break;
        case "thisMonth":
          startDate = ranges.thisMonthStart;
          endDate = ranges.thisMonthEnd;
          break;
        case "lastMonth":
          startDate = ranges.lastMonthStart;
          endDate = ranges.lastMonthEnd;
          break;
        case "last5days":
          startDate = ranges.last5DaysStart;
          endDate = ranges.last5DaysEnd;
          break;
        case "custom":
          if (customDateRange.start && customDateRange.end) {
            startDate = customDateRange.start;
            endDate = customDateRange.end;
          } else {
            startDate = ranges.today;
            endDate = ranges.today;
          }
          break;
        case "thisYear":
          startDate = ranges.thisYearStart;
          endDate = ranges.thisYearEnd;
          break;
        default:
          startDate = ranges.today;
          endDate = ranges.today;
      }

      const startDateISO = new Date(startDate);
      startDateISO.setHours(0, 0, 0, 0);
      const endDateISO = new Date(endDate);
      endDateISO.setHours(23, 59, 59, 999);

      const analyticsResponse = await restaurantAPI.getAnalytics({
        period: graphFilter,
        startDate: startDateISO.toISOString(),
        endDate: endDateISO.toISOString()
      });

      let financeData = {};
      try {
        const financeResponse = await restaurantAPI.getFinance({
          startDate: startDateISO.toISOString(),
          endDate: endDateISO.toISOString()
        });
        financeData = financeResponse?.data?.data || {};
      } catch (financeError) {
        if (financeError?.response?.status !== 401) {
          console.error("Error fetching finance for recommended stats:", financeError);
        }
      }

      const analytics = analyticsResponse?.data?.data || {};
      const summary = analytics.summary || {};
      const chart = Array.isArray(analytics.chartData) ? analytics.chartData : [];
      const mealtime = Array.isArray(analytics.mealtime) ? analytics.mealtime : [];
      const customers = Array.isArray(analytics.customers) ? analytics.customers : [];
      const offers = analytics.offers && typeof analytics.offers === "object" ? analytics.offers : null;
      const recommendedItems = financeData?.currentCycle?.recommendedItems || {};

      if (chart.length) {
        setChartData(chart);
      }

      const totalSalesValue = Number(summary.totalSales || 0);
      const totalOrdersValue = Number(summary.totalOrders || 0);
      setTotalSales(`INR ${totalSalesValue.toLocaleString("en-IN")}`);
      setTotalOrders(totalOrdersValue.toString());

      if (mealtime.length) setMealtimeMetrics(mealtime);
      if (customers.length) setCustomersMetrics(customers);
      if (offers) {
        const rawOfferClicks = offers.offerClicks;
        const rawConversionRatePct = offers.conversionRatePct;
        const parsedOfferClicks = Number(rawOfferClicks);
        const parsedConversionRatePct = Number(rawConversionRatePct);
        setOffersAnalytics({
          offerClicks: rawOfferClicks === null || rawOfferClicks === undefined || rawOfferClicks === ""
            ? null
            : (Number.isFinite(parsedOfferClicks) ? parsedOfferClicks : null),
          offerRedemptions: Number(offers.offerRedemptions || 0),
          conversionRatePct: rawConversionRatePct === null || rawConversionRatePct === undefined || rawConversionRatePct === ""
            ? null
            : (Number.isFinite(parsedConversionRatePct) ? parsedConversionRatePct : null),
          costPerRedemption: Number(offers.costPerRedemption || 0)
        });
      } else {
        setOffersAnalytics({
          offerClicks: null,
          offerRedemptions: 0,
          conversionRatePct: null,
          costPerRedemption: 0
        });
      }

      const recommendedCount = Number(recommendedItems.count || 0);
      const recommendedRevenue = Number(recommendedItems.revenue || 0);
      const recommendedFees = Number(recommendedItems.fees || 0);
      const recommendedNetRevenue = Number(recommendedItems.netRevenue || 0);
      const recommendedContribution = totalSalesValue > 0
        ? Number(((recommendedRevenue / totalSalesValue) * 100).toFixed(1))
        : 0;

      setRecommendedStats({
        count: recommendedCount,
        revenue: recommendedRevenue,
        fees: recommendedFees,
        netRevenue: recommendedNetRevenue,
        contribution: recommendedContribution
      });
      setLastUpdated(new Date());
    } catch (error) {
      if (error.response?.status !== 401) {
        console.error("Error fetching analytics:", error);
      }
    } finally {
      setIsDateLoading(false);
    }
  }, [customDateRange, graphFilter]);

  const handleFilterChange = value => {
    setGraphFilter(value);
    switch (value) {
      case "daily":
        setSelectedDateRange("today");
        break;
      case "weekly":
        setSelectedDateRange("thisWeek");
        break;
      case "monthly":
        setSelectedDateRange("thisMonth");
        break;
      case "yearly":
        setSelectedDateRange("thisYear");
        break;
      default:
        setSelectedDateRange("today");
    }
  };
  const handleDateRangeSelect = id => {
    if (id === "custom") {
      setIsCustomDateOpen(true);
      setIsDateSelectorOpen(false);
      return;
    }
    setSelectedDateRange(id);
    setIsDateSelectorOpen(false);
    fetchOrdersAndUpdateChart(id);
  };
  const handleCustomDateApply = () => {
    if (customDateRange.start && customDateRange.end) {
      setSelectedDateRange("custom");
      setIsCustomDateOpen(false);
      fetchOrdersAndUpdateChart("custom");
    }
  };

  // Fetch orders on mount and when date range changes
  useEffect(() => {
    if (!restaurantData) return; // Don't fetch if restaurant data is not loaded yet
    fetchOrdersAndUpdateChart(selectedDateRange);
  }, [restaurantData, selectedDateRange, fetchOrdersAndUpdateChart]);
  const formatDateShort = date => date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short"
  });
  const formatDateLong = date => date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "2-digit"
  });
  const formatTimeAgo = date => {
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    if (diffInSeconds < 60) {
      return "few seconds ago";
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
  };
  const selectedRangeLabel = useMemo(() => {
    const r = getDateRanges();
    switch (selectedDateRange) {
      case "today":
        return `Today - ${formatDateLong(r.today)}`;
      case "yesterday":
        return `Yesterday - ${formatDateLong(r.yesterday)}`;
      case "thisWeek":
        return `This week - ${formatDateShort(r.thisWeekStart)} - ${formatDateShort(r.thisWeekEnd)}`;
      case "lastWeek":
        return `Last week - ${formatDateShort(r.lastWeekStart)} - ${formatDateShort(r.lastWeekEnd)}`;
      case "thisMonth":
        return `This month - ${formatDateShort(r.thisMonthStart)} - ${formatDateShort(r.thisMonthEnd)}`;
      case "lastMonth":
        return `Last month - ${formatDateShort(r.lastMonthStart)} - ${formatDateShort(r.lastMonthEnd)}`;
      case "last5days":
        return `Last 5 days - ${formatDateShort(r.last5DaysStart)} - ${formatDateShort(r.last5DaysEnd)}`;
      case "custom":
        if (customDateRange.start && customDateRange.end) {
          return `${formatDateShort(customDateRange.start)} - ${formatDateShort(customDateRange.end)}`;
        }
        return "Custom range";
      default:
        return `Today - ${formatDateLong(r.today)}`;
    }
  }, [selectedDateRange, customDateRange]);
  const findSourcesMetrics = [{
    title: "Dish/cuisine search",
    color: "#111827",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }, {
    title: "Recommended for you",
    color: "#ef4444",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }, {
    title: "Restaurant search",
    color: "#2563eb",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }, {
    title: "Home page listing",
    color: "#f59e0b",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }, {
    title: "Offers page",
    color: "#10b981",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }, {
    title: "Campaign page",
    color: "#d1d5db",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }, {
    title: "Others",
    color: "#4b5563",
    impressions: "0",
    menu: "0",
    change: "- 0%"
  }];
  const impressionsCustomerTypes = {
    affinity: [{
      title: "Mass market customers",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Mid premium customers",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Premium customers",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }],
    spending: [{
      title: "Mass market customers",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Mid premium customers",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Premium customers",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }]
  };
  const menuOpensCustomerTypes = {
    affinity: [{
      title: "New customers",
      sub: "No orders in last 365 days",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Repeat customers",
      sub: "Ordered in last 60 days",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Lapsed customers",
      sub: "Last order 60 to 365 days ago",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }],
    spending: [{
      title: "Value seekers",
      sub: "Orders under INR 300",
      color: "#111827",
      value: "2",
      change: "- 0%"
    }, {
      title: "Mid spenders",
      sub: "Orders INR 300 - INR 800",
      color: "#ef4444",
      value: "1",
      change: "- 0%"
    }, {
      title: "High spenders",
      sub: "Orders above INR 800",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }]
  };
  const ordersPlacedCustomerTypes = {
    affinity: [{
      title: "New customers",
      sub: "No orders in last 365 days",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Repeat customers",
      sub: "Ordered in last 60 days",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Lapsed customers",
      sub: "Last order 60 to 365 days ago",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }],
    spending: [{
      title: "Value seekers",
      sub: "Orders under INR 300",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Mid spenders",
      sub: "Orders INR 300 - INR 800",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "High spenders",
      sub: "Orders above INR 800",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }]
  };
  const complaintsReasons = {
    all: [{
      title: "Poor packaging & spillage",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Poor taste & quality",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Wrong item delivered",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }, {
      title: "Missing items",
      color: "#f59e0b",
      value: "0",
      change: "- 0%"
    }],
    refunded: [{
      title: "Poor packaging & spillage",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Poor taste & quality",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Wrong item delivered",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }, {
      title: "Missing items",
      color: "#f59e0b",
      value: "0",
      change: "- 0%"
    }],
    resolved: [{
      title: "Poor packaging & spillage",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Poor taste & quality",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Wrong item delivered",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }, {
      title: "Missing items",
      color: "#f59e0b",
      value: "0",
      change: "- 0%"
    }],
    winback: [{
      title: "Poor packaging & spillage",
      color: "#111827",
      value: "0",
      change: "- 0%"
    }, {
      title: "Poor taste & quality",
      color: "#ef4444",
      value: "0",
      change: "- 0%"
    }, {
      title: "Wrong item delivered",
      color: "#2563eb",
      value: "0",
      change: "- 0%"
    }, {
      title: "Missing items",
      color: "#f59e0b",
      value: "0",
      change: "- 0%"
    }]
  };
  const rejectionsReasons = [{
    title: "Items out of stock",
    color: "#111827",
    value: "0",
    change: "- 0%"
  }, {
    title: "Kitchen is full",
    color: "#ef4444",
    value: "0",
    change: "- 0%"
  }, {
    title: "Outlet closed",
    color: "#2563eb",
    value: "0",
    change: "- 0%"
  }, {
    title: "Others",
    color: "#f59e0b",
    value: "0",
    change: "- 0%"
  }];
  const offersMetrics = useMemo(() => [{
    title: "Offer clicks",
    value: offersAnalytics.offerClicks == null ? "N/A" : String(offersAnalytics.offerClicks),
    change: "-",
    sub: "Clicks on offers"
  }, {
    title: "Offer redemptions",
    value: String(offersAnalytics.offerRedemptions || 0),
    change: "-",
    sub: "Total redeemed"
  }, {
    title: "Conversion rate",
    value: offersAnalytics.conversionRatePct == null ? "N/A" : `${offersAnalytics.conversionRatePct.toFixed(1)}%`,
    change: "-",
    sub: "Redemptions / clicks"
  }, {
    title: "Cost per redemption",
    value: `INR ${Number(offersAnalytics.costPerRedemption || 0).toFixed(2)}`,
    change: "-",
    sub: "Est. cost"
  }], [offersAnalytics]);
  const offersCardSummary = {
    grossSales: "INR 0",
    grossPct: "0%",
    grossShare: "0% of total gross sales",
    discountGiven: "INR 0",
    discountPct: "0%",
    discountPerOrder: "INR 0 discount per order",
    ordersFromOffers: "0",
    ordersPct: "0%",
    ordersShare: "0% of total orders",
    effectiveDiscount: "0%",
    effectivePct: "0%",
    effectiveDesc: "Discount given/Gross sales from offers"
  };
  const adsMetrics = [{
    title: "Ad impressions",
    value: "0",
    change: "- 0%",
    sub: "Served impressions"
  }, {
    title: "Ad clicks",
    value: "0",
    change: "- 0%",
    sub: "Total clicks"
  }, {
    title: "CTR",
    value: "0%",
    change: "- 0%",
    sub: "Click-through rate"
  }, {
    title: "Spend",
    value: "INR 0",
    change: "- 0%",
    sub: "Total spend"
  }];
  const customerAffinityBreakup = [{
    title: "New customers",
    sub: "No orders in last 365 days",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Repeat customers",
    sub: "Ordered in last 60 days",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Lapsed customers",
    sub: "Last order 60 to 365 days ago",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }];
  const customerSpendingBreakup = [{
    title: "Mass market customers",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Mid premium customers",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Premium customers",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }];
  const customerDistanceBreakup = [{
    title: "Within 4 km",
    value: "0",
    change: "- 0%",
    color: "#111827"
  }, {
    title: "Between 4 and 6 km",
    value: "0",
    change: "- 0%",
    color: "#ef4444"
  }, {
    title: "Between 6 and 10 km",
    value: "0",
    change: "- 0%",
    color: "#2563eb"
  }, {
    title: "Above 10 km",
    value: "0",
    change: "- 0%",
    color: "#f59e0b"
  }];
  const xAxisKey = useMemo(() => {
    switch (graphFilter) {
      case "weekly":
        return "day";
      case "monthly":
        return "date";
      case "yearly":
        return "month";
      default:
        return "hour";
    }
  }, [graphFilter]);
  const {
    headerPrimary,
    compareLabel
  } = useMemo(() => {
    const ranges = getDateRanges();
    let primary = selectedRangeLabel;
    let baseEnd = ranges.today;
    switch (selectedDateRange) {
      case "today":
        baseEnd = ranges.today;
        break;
      case "thisWeek":
        baseEnd = ranges.thisWeekEnd;
        break;
      case "lastWeek":
        baseEnd = ranges.lastWeekEnd;
        break;
      case "thisMonth":
        baseEnd = ranges.thisMonthEnd;
        break;
      case "lastMonth":
        baseEnd = ranges.lastMonthEnd;
        break;
      case "last5days":
        baseEnd = ranges.last5DaysEnd;
        break;
      case "custom":
        baseEnd = customDateRange.end || ranges.today;
        break;
      default:
        baseEnd = ranges.today;
    }
    const compare = new Date(baseEnd);
    compare.setDate(compare.getDate() - 7);
    return {
      headerPrimary: primary,
      compareLabel: formatDateLong(compare)
    };
  }, [selectedRangeLabel, selectedDateRange, customDateRange]);
  const MyFeedContent = () => <div className="space-y-4">

      <div className="px-4">
        <div className="bg-white rounded-lg space-y-4">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">Total sales</div>
              <Select value={graphFilter} onValueChange={handleFilterChange}>
                <SelectTrigger className="w-[100px] h-8 text-xs bg-gray-50 border-gray-200">
                  <SelectValue placeholder="Filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <span className="text-xs text-green-700 bg-green-100 px-3 rounded-full">Live</span>
          </div>
          <div className="px-4 flex items-center justify-between text-md font-semibold text-gray-700">
            <span>{totalSales}</span>
            <span>Total orders {totalOrders}</span>
          </div>
          <div className="h-48 chart-shell">
            <style>{`
              .chart-shell *:focus {
                outline: none !important;
                box-shadow: none !important;
              }
              .recharts-wrapper:focus,
              .recharts-surface:focus,
              .recharts-responsive-container:focus {
                outline: none !important;
              }
            `}</style>
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <AreaChart data={chartData} margin={{
              top: 10,
              right: 20,
              left: -10,
              bottom: 0
            }}>
                <defs>
                  <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={xAxisKey} tick={{
                fontSize: 11,
                fill: "#6b7280"
              }} />
                <YAxis tick={{
                fontSize: 11,
                fill: "#6b7280"
              }} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="orders" stroke="#3B82F6" fill="url(#ordersGradient)" />
                <Area type="monotone" dataKey="sales" stroke="#10b981" fill="url(#salesGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>


        <div className="px-4">
          <h3 className="text-lg font-bold text-gray-900 mb-3">Quick links</h3>
          <div className="grid grid-cols-4 gap-3">
            {quickLinks.map(link => {
            const Icon = link.icon;
            return <button key={link.id} onClick={() => {
              if (link.isPhone) {
                if (link.route && link.route.startsWith("tel:")) {
                  window.location.href = link.route;
                }
              } else {
                navigate(link.route);
              }
            }} className="flex flex-col items-center gap-2 hover:opacity-80 transition-opacity">
                  <div className="w-16 h-16 bg-white rounded-xl flex items-center justify-center shadow-sm hover:shadow-md transition-shadow">
                    <Icon className="w-5 h-5 text-[#3B82F6]" />
                  </div>
                  <span className="text-[12px] text-center text-gray-800 leading-tight">
                    {link.label}
                  </span>
                </button>;
          })}
          </div>
        </div>



      </div>
    </div>;
  const SalesTabContent = () => {
    const salesMax = Math.max(...chartData.map(d => d.sales || 0), 1);
    const ordersMax = Math.max(...chartData.map(d => d.orders || 0), 1);
    const aovData = useMemo(() => chartData.map(d => ({
      ...d,
      aov: d.orders ? d.sales / d.orders : 0
    })), [chartData]);
    const aovMax = Math.max(...aovData.map(d => d.aov || 0), 1);
    return <>
        <div className="space-y-4">
          {/* Business insights + filters */}
          <div className="px-4 space-y-3">
            <p className="text-lg font-bold text-gray-900 mb-3">Business insights</p>
          </div>


          {/* Sales card */}
          <div className="px-4">
            <div className="bg-white rounded-lg p-4 space-y-4 relative">
              {isDateLoading && <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-white/60 rounded-lg" />
                  <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
                </div>}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Sales</p>
                  <p className="text-xs text-gray-500">Last updated: few seconds ago</p>
                </div>
                

              </div>

              {[{
            title: "Net sales",
            value: `${totalSales} - 0%`,
            dataKey: "sales",
            color: "#f97316"
          }, {
            title: "Orders delivered",
            value: `${totalOrders} - 0%`,
            dataKey: "orders",
            color: "#f97316"
          }, {
            title: "Avg. order value",
            value: `INR ${(parseFloat(totalSales.replace(/[^\d.]/g, "")) / (parseInt(totalOrders, 10) || 1)).toFixed(0)} - 0%`,
            dataKey: "sales",
            color: "#f97316"
          }].map((section, idx) => <div key={section.title} className={idx < 2 ? "pb-3 border-b border-dashed border-gray-200 space-y-2" : "space-y-2"}>
                  <div className="flex items-center justify-between text-sm font-semibold text-gray-900">
                    <span>{section.title}</span>
                    <span>{section.value}</span>
                  </div>
                  <div className="chart-shell-mini">
                    <MiniMetricChart data={chartData} dataKey={section.dataKey} color={section.color} xKey={xAxisKey} gradientId={`mini-${section.dataKey}-${idx}`} />
                  </div>
                </div>)}

              <div className="pt-2">
                <div className="flex items-center justify-center gap-4 text-xs text-gray-600">
                  <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-[#3B82F6] inline-block"></span>Yesterday</span>
                  <span className="flex items-center gap-2"><span className="w-3 h-0.5 bg-gray-400 inline-block"></span>Day before yesterday</span>
                </div>
              </div>
            </div>
          </div>

          {/* Customers card */}
          <div className="px-4 mt-4">
            <div className="bg-white rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Customers</p>
                  <p className="text-xs text-gray-500">Last updated: a day ago</p>
                </div>
                
              </div>

              <div className="space-y-4">
                {customersMetrics.map(metric => <div key={metric.title} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full" style={{
                  backgroundColor: metric.color
                }} />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{metric.title}</span>
                        <span className="text-xs text-gray-600">{metric.sub}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-gray-900">{metric.value}</p>
                      <p className="text-xs text-gray-600">{metric.change}</p>
                    </div>
                  </div>)}
              </div>

            </div>
          </div>

          {/* Orders by mealtime */}
          <div className="px-4 mt-4">
            <div className="bg-white rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Orders by mealtime</p>
                  <p className="text-xs text-gray-500">
                    {lastUpdated ? `Last updated: ${formatTimeAgo(lastUpdated)}` : "Last updated: a day ago"}
                  </p>
                </div>
                
              </div>

              <div className="space-y-3">
                {mealtimeMetrics.map(slot => <div key={slot.title} className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <span className="w-2.5 h-2.5 rounded-full mt-1" style={{
                  backgroundColor: slot.color
                }} />
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-gray-900">{slot.title}</span>
                        <span className="text-xs text-gray-600">{slot.window}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{slot.value}</p>
                      <p className="text-xs text-gray-600">{slot.change}</p>
                    </div>
                  </div>)}
              </div>
            </div>
          </div>

          {/* Offers card */}
          <div className="px-4 mt-4">
            <div className="bg-white rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Offers</p>
                  <p className="text-xs text-gray-500">Last updated: an hour ago</p>
                </div>
                
              </div>

              <div className="divide-y divide-dashed divide-gray-200">
                <div className="grid grid-cols-2 gap-y-4 py-3">
                  {offersMetrics.slice(0, 2).map(metric => <div key={metric.title} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{metric.title}</span>
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {metric.value} <span className="text-sm font-normal text-gray-600">{metric.change}</span>
                      </div>
                      <div className="text-xs text-gray-600">{metric.sub}</div>
                    </div>)}
                </div>
                <div className="grid grid-cols-2 gap-y-4 py-3">
                  {offersMetrics.slice(2).map(metric => <div key={metric.title} className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">{metric.title}</span>
                      </div>
                      <div className="text-lg font-bold text-gray-900">
                        {metric.value} <span className="text-sm font-normal text-gray-600">{metric.change}</span>
                      </div>
                      <div className="text-xs text-gray-600">{metric.sub}</div>
                    </div>)}
                </div>
              </div>

            </div>
          </div>

          {/* Sales & orders combined card */}
          <div className="px-4 mt-4">
            <div className="bg-white rounded-lg p-4 space-y-4 relative">
              {isDateLoading && <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-white/60 rounded-lg" />
                  <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
                </div>}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-bold text-gray-900">Sales & orders</div>
                  <p className="text-xs text-gray-500">Last updated: few seconds ago</p>
                </div>
                <div className="flex items-start gap-2">
                  <Select value={graphFilter} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-[100px] h-8 text-xs bg-gray-50 border-gray-200">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  
                </div>
              </div>


              <div className="grid grid-cols-2 gap-4 text-sm font-semibold text-gray-900 text-center items-center">
                <div className="space-y-1 flex flex-col items-center">
                  <p className="text-xs text-gray-500">Net sales</p>
                  <p className="text-lg font-bold text-gray-900">{totalSales || "INR 0"}</p>
                  <p className="text-xs text-gray-500">- 0%</p>
                </div>
                <div className="space-y-1 flex flex-col items-center">
                  <p className="text-xs text-gray-500">Orders delivered</p>
                  <p className="text-lg font-bold text-gray-900">{totalOrders || "0"}</p>
                  <p className="text-xs text-gray-500">- 0%</p>
                </div>
              </div>

              <div className="h-64 chart-shell -mx-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={chartData} margin={{
                  top: 10,
                  right: 12,
                  left: 0,
                  bottom: 0
                }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                    <XAxis dataKey={xAxisKey} tick={{
                    fontSize: 10,
                    fill: "#9ca3af"
                  }} tickLine={false} axisLine={{
                    stroke: "#e5e7eb"
                  }} />
                    <YAxis yAxisId="left" tick={{
                    fontSize: 10,
                    fill: "#9ca3af"
                  }} tickFormatter={value => `INR ${value.toLocaleString("en-IN")}`} tickLine={false} axisLine={{
                    stroke: "#e5e7eb"
                  }} allowDecimals={false} domain={[0, salesMax]} tickCount={5} />
                    <YAxis yAxisId="right" orientation="right" tick={false} axisLine={false} domain={[0, ordersMax]} />
                    <Tooltip contentStyle={{
                    fontSize: "0.75rem"
                  }} />
                    <Area yAxisId="left" type="monotone" dataKey="sales" stroke="#3B82F6" strokeWidth={2} fill="rgba(59, 130, 246, 0.12)" dot={{
                    r: 3,
                    fill: "#3B82F6"
                  }} activeDot={{
                    r: 4
                  }} />
                    <Line yAxisId="right" type="monotone" dataKey="orders" stroke="#6b7280" strokeWidth={2} dot={{
                    r: 6,
                    fill: "#9ca3af",
                    stroke: "#6b7280",
                    strokeWidth: 1.5
                  }} activeDot={{
                    r: 7
                  }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="flex items-center justify-center gap-6 text-xs text-gray-600">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-[#3B82F6] inline-block rounded-[2px]" />
                  Net sales
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full border border-gray-400 bg-gray-200 inline-block" />
                  Orders delivered
                </span>
              </div>
            </div>
          </div>


          <div className="px-4 mt-4">
            <div className="bg-white rounded-lg p-4 space-y-4 relative">
              {isDateLoading && <div className="absolute inset-0 flex items-center justify-center">
                  <div className="absolute inset-0 bg-white/60 rounded-lg" />
                  <div className="relative text-sm font-semibold text-gray-700 animate-pulse">Refreshing...</div>
                </div>}

              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-base font-bold text-gray-900">Average order value</div>
                  <p className="text-xs text-gray-500">Last updated: few seconds ago</p>
                </div>
                <div className="flex items-start gap-2">
                  <Select value={graphFilter} onValueChange={handleFilterChange}>
                    <SelectTrigger className="w-[100px] h-8 text-xs bg-gray-50 border-gray-200">
                      <SelectValue placeholder="Filter" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Daily</SelectItem>
                      <SelectItem value="weekly">Weekly</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  
                </div>
              </div>

              <div className="space-y-1 pt-1">
                <p className="text-xs text-gray-500">AOV</p>
                <p className="text-lg font-bold text-gray-900">
                  INR {(parseFloat(totalSales.replace(/[^\d.]/g, '')) / (parseInt(totalOrders) || 1)).toFixed(0)} <span className="text-xs font-normal text-gray-500">- 0%</span>
                </p>
              </div>

              <div className="h-64 chart-shell -mx-2">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <AreaChart data={aovData} margin={{
                  top: 10,
                  right: 8,
                  left: 0,
                  bottom: 0
                }}>
                    <CartesianGrid strokeDasharray="4 4" stroke="#e5e7eb" />
                    <XAxis dataKey={xAxisKey} tick={{
                    fontSize: 10,
                    fill: "#9ca3af"
                  }} tickLine={false} axisLine={{
                    stroke: "#e5e7eb"
                  }} />
                    <YAxis tick={{
                    fontSize: 10,
                    fill: "#9ca3af"
                  }} tickFormatter={value => `INR ${value.toLocaleString("en-IN")}`} tickLine={false} axisLine={{
                    stroke: "#e5e7eb"
                  }} allowDecimals={false} domain={[0, aovMax]} tickCount={5} />
                    <Tooltip contentStyle={{
                    fontSize: "0.75rem"
                  }} />
                    <Area type="monotone" dataKey="aov" stroke="#3B82F6" strokeWidth={2} fill="rgba(59, 130, 246, 0.08)" dot={{
                    r: 3,
                    fill: "#3B82F6"
                  }} activeDot={{
                    r: 4
                  }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Recommended Items Performance card */}
          <div className="px-4 mt-4">
            <div className="bg-white rounded-lg p-4 space-y-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 p-2">
                <Wand2 className="w-8 h-8 text-blue-100/50" />
              </div>
              <div className="flex items-center justify-between relative z-10">
                <div>
                  <p className="text-base font-bold text-gray-900">Special Items Performance</p>
                  <p className="text-xs text-gray-500">How your boosted items are performing</p>
                </div>
              </div>

              {/* Top metrics row */}
              <div className="grid grid-cols-2 gap-4 relative z-10">
                <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100/50">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Items Sold</p>
                  <p className="text-xl font-bold text-blue-600">{recommendedStats.count}</p>
                  <p className="text-[10px] text-blue-400 mt-1">{recommendedStats.contribution}% of total sales</p>
                </div>
                <div className="bg-green-50/50 p-3 rounded-lg border border-green-100/50">
                  <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Gross Revenue</p>
                  <p className="text-xl font-bold text-green-600">INR {recommendedStats.revenue?.toLocaleString('en-IN')}</p>
                  <p className="text-[10px] text-green-400 mt-1">Before platform fees</p>
                </div>
              </div>

              {/* Earnings breakdown */}
              <div className="relative z-10 border-t border-gray-100 pt-3 space-y-2">
                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Earnings Breakdown</p>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-red-50/60 p-3 rounded-lg border border-red-100/60">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Platform Fee</p>
                    <p className="text-xl font-bold text-red-500">- INR {recommendedStats.fees?.toLocaleString('en-IN') ?? 0}</p>
                    <p className="text-[10px] text-red-400 mt-1">Goes to admin</p>
                  </div>
                  <div className="bg-green-50/60 p-3 rounded-lg border border-green-100/60">
                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1">Your Earnings</p>
                    <p className="text-xl font-bold text-green-600">INR {(recommendedStats.netRevenue || 0).toLocaleString('en-IN')}</p>
                    <p className="text-[10px] text-green-400 mt-1">After platform fee</p>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 text-[10px] text-gray-400 italic bg-gray-50/80 p-2 rounded relative z-10">
                <span>Note:</span>
                <span>Platform fees are charged for featuring your items to more customers. These are separate from your regular earnings.</span>
              </div>
            </div>
          </div>

        </div>
      </>;
  };
  const EmptyTab = ({
    label
  }) => <div className="flex-1 flex items-center justify-center text-gray-500 text-sm px-4">
      {label} is empty for now.
    </div>;
  const MiniMetricChart = ({
    data,
    dataKey,
    color,
    xKey,
    gradientId
  }) => {
    const containerRef = useRef(null);
    const [dimensions, setDimensions] = useState({
      width: 0,
      height: 0
    });
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;
      const updateDimensions = () => {
        setDimensions({
          width: Math.max(0, Math.floor(container.clientWidth)),
          height: Math.max(0, Math.floor(container.clientHeight))
        });
      };
      updateDimensions();
      let resizeObserver;
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => updateDimensions());
        resizeObserver.observe(container);
      } else {
        window.addEventListener("resize", updateDimensions);
      }
      return () => {
        if (resizeObserver) resizeObserver.disconnect();
        else window.removeEventListener("resize", updateDimensions);
      };
    }, []);
    return <div ref={containerRef} className="h-16 w-full">
        {dimensions.width > 0 && dimensions.height > 0 ? <AreaChart width={dimensions.width} height={dimensions.height} data={data} margin={{
      top: 0,
      right: 0,
      left: 0,
      bottom: 0
    }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.5} />
                <stop offset="95%" stopColor={color} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis dataKey={xKey} tick={{
          fontSize: 10,
          fill: "#9ca3af"
        }} />
            <YAxis hide />
            <Tooltip />
            <Area type="monotone" dataKey={dataKey} stroke={color} fill={`url(#${gradientId})`} />
          </AreaChart> : null}
      </div>;
  };
  const isSalesLocked = activeTopTab === "sales" && !hasAdvancedAnalytics;

  return <div className="min-h-screen bg-gray-100 flex flex-col">
      <style>{`
        .chart-shell *, .chart-shell, .chart-shell-mini *, .chart-shell-mini,
        .recharts-wrapper:focus, .recharts-surface:focus, .recharts-responsive-container:focus {
          outline: none !important;
          box-shadow: none !important;
        }
      `}</style>
      <div className="">
        {/* Reuse Feedback-like navbar */}
        <div className="sticky bg-white top-0 z-60 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <p className="text-[10px] tracking-[0.12em] text-gray-500 uppercase">
              Showing data for
            </p>
            <p className="text-md font-semibold text-gray-900 mt-0.5">
              {loadingRestaurant ? "Loading..." : restaurantData?.name || "Restaurant"}
            </p>
          </div>

          <div className="flex items-center">
            <button className="p-2 hover:bg-gray-100 rounded-full transition-colors" onClick={() => navigate("/restaurant/notifications")}>
              <Bell className="w-5 h-5 text-gray-700" />
            </button>
            <button className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors" onClick={() => navigate("/restaurant/help-centre")}>
              <HelpCircle className="w-5 h-5 text-gray-700" />
            </button>
            <button className="p-2 ml-1 hover:bg-gray-100 rounded-full transition-colors" onClick={() => navigate("/restaurant/explore")}>
              <Menu className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>

        {/* Top tabs (matching Orders tab style) */}
        <div className="sticky top-[50px] z-50 pb-2 bg-gray-100">
          <div ref={topTabBarRef} className="flex gap-2 overflow-x-auto scrollbar-hide bg-transparent rounded-full px-3 py-2 mt-2" style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch'
        }}>
            <style>{`
            .scrollbar-hide::-webkit-scrollbar {
              display: none;
            }
          `}</style>
            {topTabs.map(tab => {
            const isActive = activeTopTab === tab.id;
            return <motion.button key={tab.id} onClick={() => {
              if (!isTransitioning) {
                setIsTransitioning(true);
                setActiveTopTab(tab.id);
                setTimeout(() => setIsTransitioning(false), 300);
              }
            }} className={`shrink-0 px-6 py-3.5 rounded-full font-medium text-sm whitespace-nowrap relative overflow-hidden ${isActive ? 'text-white' : 'bg-white text-gray-700'}`} animate={{
              scale: isActive ? 1.05 : 1,
              opacity: isActive ? 1 : 0.7
            }} transition={{
              duration: 0.3,
              ease: [0.25, 0.1, 0.25, 1]
            }} whileTap={{
              scale: 0.95
            }}>
                  {isActive && <motion.div layoutId="hubTopTabActive" className="absolute inset-0 bg-[#3B82F6] rounded-full -z-10" initial={false} transition={{
                type: "spring",
                stiffness: 500,
                damping: 30
              }} />}
                  <span className="relative z-10">{tab.label}</span>
                </motion.button>;
          })}
          </div>
        </div>
      </div>

      {expiryNotice.isVisible && !expiryNotice.loading && (
        <div className="px-4">
          <SubscriptionExpiryBanner
            daysLeft={expiryNotice.daysLeft}
            isExpired={expiryNotice.isExpired}
            type={expiryNotice.type}
            planName={expiryNotice.planName}
            onBuyNow={() => navigate("/restaurant/subscription")}
          />
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div ref={contentContainerRef} key={activeTopTab} initial={{
        opacity: 0,
        y: 10
      }} animate={{
        opacity: 1,
        y: 0
      }} exit={{
        opacity: 0,
        y: 10
      }} transition={{
        duration: 0.2
      }} className={`flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] ${isSalesLocked ? "overflow-hidden" : ""}`} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onMouseDown={e => {
        const target = e.target;
        // Don't handle swipe if starting on topbar or chart
        if (topTabBarRef.current?.contains(target)) return;
        if (target.closest('.chart-shell, .chart-shell-mini')) return;
        mouseStartX.current = e.clientX;
        mouseEndX.current = e.clientX;
        isMouseDown.current = true;
        isSwiping.current = false;
      }} onMouseMove={e => {
        if (isMouseDown.current) {
          if (!isSwiping.current) {
            const deltaX = Math.abs(e.clientX - mouseStartX.current);
            if (deltaX > 10) {
              isSwiping.current = true;
            }
          }
          if (isSwiping.current) {
            mouseEndX.current = e.clientX;
          }
        }
      }} onMouseUp={() => {
        if (isMouseDown.current && isSwiping.current) {
          const swipeDistance = mouseStartX.current - mouseEndX.current;
          const currentIndex = topTabs.findIndex(t => t.id === activeTopTab);
          if (swipeDistance > 50 && currentIndex < topTabs.length - 1) {
            setActiveTopTab(topTabs[currentIndex + 1].id);
          } else if (swipeDistance < -50 && currentIndex > 0) {
            setActiveTopTab(topTabs[currentIndex - 1].id);
          }
          isMouseDown.current = false;
          isSwiping.current = false;
        }
      }}>
          {activeTopTab === "my-feed" ? <MyFeedContent /> : activeTopTab === "sales" ? hasAdvancedAnalytics ? <SalesTabContent /> : <div className="p-4 bg-gray-100 h-full overflow-hidden">
                <SubscriptionFeatureOverlay fullscreen isLocked title="Advanced Analytics" message="Upgrade to GROWTH to unlock Advanced Analytics insights and reports." onGoBack={() => setActiveTopTab("my-feed")}>
                  <div className="h-full w-full" />
                </SubscriptionFeatureOverlay>
              </div> : activeTopTab === "growth" ? <div className="p-4 bg-gray-100 min-h-screen">
              <div className="space-y-4">
              {hasAdvancedMarketingTools && (
                <motion.div whileTap={{
              scale: 0.98
            }} onClick={() => navigate("/restaurant/advertisements")} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200 cursor-pointer">
                  <div className="shrink-0">
                    <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Megaphone className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-base font-bold text-gray-900 mb-1">Promoted Banners</h3>
                    <p className="text-sm text-gray-600">Get better visibility on homepage & search</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
                </motion.div>
              )}

              <motion.div whileTap={{
            scale: 0.98
          }} onClick={() => navigate("/restaurant/hub-growth/create-offers")} className="bg-white rounded-lg p-4 flex items-center gap-4 border border-gray-200 cursor-pointer">
                <div className="shrink-0">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-gray-900 mb-1">Offers and discounts</h3>
                  <p className="text-sm text-gray-600">Start your own offers and grow your business</p>
                </div>
                <ChevronRight className="w-5 h-5 text-blue-600 shrink-0" />
              </motion.div>
              </div>
            </div> : <EmptyTab label={topTabs.find(t => t.id === activeTopTab)?.label || "Tab"} />}
        </motion.div>
      </AnimatePresence>

      <BottomNavOrders />
    </div>;
}
