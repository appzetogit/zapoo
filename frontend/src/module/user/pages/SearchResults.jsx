import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Search, SlidersHorizontal, ChevronDown, Mic, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import StickyCartCard from "../components/StickyCartCard";
import { useProfile } from "../context/ProfileContext";
import { useLocation } from "../hooks/useLocation";
import { useZone } from "../hooks/useZone";
import { restaurantAPI, adminAPI } from "@/lib/api";
import { toast } from "sonner";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

// Import shared food images - prevents duplication
import { foodImages } from "@/constants/images";
import {
  isOpenForDeliveryNow,
  isWithinDeliveryRangeKm,
} from "../utils/restaurantAvailability";

// Filter options
const filterOptionsConfig = [{
  id: 'under-30-mins',
}, {
  id: 'price-match',
  hasIcon: true
}, {
  id: 'flat-50-off',
  hasIcon: true
}, {
  id: 'under-250',
}, {
  id: 'rating-4-plus',
}];

// Mock data removed - using backend data only

export default function SearchResults() {
  const { t } = useTranslation();
  const { vegMode } = useProfile();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get("q") || "";
  const navigate = useNavigate();
  const {
    location
  } = useLocation();
  const {
    zoneId,
    isOutOfService
  } = useZone(location);
  const userHasLocation =
    location?.latitude != null &&
    location?.longitude != null &&
    Number.isFinite(Number(location.latitude)) &&
    Number.isFinite(Number(location.longitude));
  const [searchQuery, setSearchQuery] = useState(query);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [activeFilters, setActiveFilters] = useState(new Set());
  const categoryScrollRef = useRef(null);
  const [restaurantsData, setRestaurantsData] = useState([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [categories, setCategories] = useState([{
    id: 'all',
    name: t("user.categoryPage.all"),
    image: foodImages[7]
  }]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [categoryKeywords, setCategoryKeywords] = useState({});
  const filterOptions = useMemo(() => [{
    ...filterOptionsConfig[0],
    label: t("user.categoryPage.filterPills.under30mins")
  }, {
    ...filterOptionsConfig[1],
    label: t("user.categoryPage.priceMatch")
  }, {
    ...filterOptionsConfig[2],
    label: t("user.categoryPage.filterPills.flat50off")
  }, {
    ...filterOptionsConfig[3],
    label: t("user.categoryPage.filterPills.under250")
  }, {
    ...filterOptionsConfig[4],
    label: t("user.categoryPage.filterPills.rating4Plus")
  }], [t]);

  // Fetch categories from admin API
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const response = await adminAPI.getPublicCategories();
        if (response.data && response.data.success && response.data.data && response.data.data.categories) {
          const categoriesArray = response.data.data.categories;

          // Transform API categories to match expected format
          const transformedCategories = [{
            id: 'all',
            name: t("user.categoryPage.all"),
            image: foodImages[7]
          }, ...categoriesArray.map(cat => ({
            id: cat.slug || cat.id,
            name: cat.name,
            image: cat.image || foodImages[0],
            type: cat.type
          }))];
          setCategories(transformedCategories);

          // Generate category keywords dynamically from category names
          const keywordsMap = {};
          categoriesArray.forEach(cat => {
            const categoryId = cat.slug || cat.id;
            const categoryName = cat.name.toLowerCase();

            // Generate keywords from category name
            // Split by common separators and use individual words
            const words = categoryName.split(/[\s-]+/).filter(w => w.length > 0);
            keywordsMap[categoryId] = [categoryName, ...words];
          });
          setCategoryKeywords(keywordsMap);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        // Keep default "All" category on error
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [t]);

  // Helper function to check if menu has dishes matching category keywords
  const checkCategoryInMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return false;
    }

    // Get keywords for this category
    const keywords = categoryKeywords[categoryId] || [];
    if (keywords.length === 0) {
      return false;
    }

    // Check sections and items for category keywords
    for (const section of menu.sections) {
      // Check section name
      const sectionNameLower = (section.name || '').toLowerCase();
      if (keywords.some(keyword => sectionNameLower.includes(keyword))) {
        return true;
      }

      // Check items in section
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          // Check item name
          const itemNameLower = (item.name || '').toLowerCase();
          if (keywords.some(keyword => itemNameLower.includes(keyword))) {
            return true;
          }
          // Check item category
          const itemCategoryLower = (item.category || '').toLowerCase();
          if (keywords.some(keyword => itemCategoryLower.includes(keyword))) {
            return true;
          }
        }
      }
    }
    return false;
  };

  // Helper function to get featured dish for a category from menu
  const getCategoryDishFromMenu = (menu, categoryId) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections)) {
      return null;
    }
    const keywords = categoryKeywords[categoryId] || [];
    if (keywords.length === 0) {
      return null;
    }

    // Find first matching item
    for (const section of menu.sections) {
      if (section.items && Array.isArray(section.items)) {
        for (const item of section.items) {
          const itemNameLower = (item.name || '').toLowerCase();
          const itemCategoryLower = (item.category || '').toLowerCase();
          if (keywords.some(keyword => itemNameLower.includes(keyword) || itemCategoryLower.includes(keyword))) {
            const originalPrice = item.originalPrice || item.price || 0;
            const discountPercent = item.discountPercent || 0;
            const price = discountPercent > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : originalPrice;
            return {
              name: item.name,
              price: price
            };
          }
        }
      }
    }
    return null;
  };

  // Helper function to find a matching item in menu based on query
  const findMatchingItemInMenu = (menu, query) => {
    if (!menu || !menu.sections || !Array.isArray(menu.sections) || !query) return null;
    const lowerQuery = query.toLowerCase();
    for (const section of menu.sections) {
      if (section.items) {
        for (const item of section.items) {
          if (item.name?.toLowerCase().includes(lowerQuery) || item.category?.toLowerCase().includes(lowerQuery)) {
            const originalPrice = item.originalPrice || item.price || 0;
            const discountPercent = item.discountPercent || 0;
            const price = discountPercent > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : originalPrice;
            return {
              name: item.name,
              price: price
            };
          }
        }
      }
    }
    return null;
  };

  // Fetch restaurants from API
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const hasExplicitQuery = query.trim().length > 0;
        // Keep old browse behavior for out-of-service users, but allow explicit search.
        if (isOutOfService && !hasExplicitQuery) {
          setRestaurantsData([]);
          setLoadingRestaurants(false);
          return;
        }
        setLoadingRestaurants(true);
        const params = {
          includeBeyondDeliveryRange: "true",
        };
        const pureVegOnlySelected =
          vegMode === true &&
          (typeof window !== "undefined" && localStorage.getItem("userVegModeOption") === "pure-veg");
        if (pureVegOnlySelected) {
          params.pureVeg = "true";
        }
        if (query.trim().length > 0) {
          params.includeInactiveForSearch = "true";
        }
        if (zoneId) params.zoneId = zoneId;
        // If currently out of service and no resolved zoneId, avoid geo-based empty response.
        if (
          location?.latitude != null &&
          location?.longitude != null &&
          (!isOutOfService || zoneId)
        ) {
          params.latitude = location.latitude;
          params.longitude = location.longitude;
        }
        const response = await restaurantAPI.getRestaurants(params);
        if (response.data && response.data.success && response.data.data && response.data.data.restaurants) {
          const restaurantsArray = response.data.data.restaurants;
          // Check if we have actual data or just defaults
          if (restaurantsArray.length > 0) { }

          // Helper function to check if value is a default/mock value
          const isDefaultValue = (value, fieldName) => {
            if (!value) return false;

            // Common default values from backend model
            const defaultOffers = ["Flat ₹50 OFF above ₹199", "Flat 50% OFF", "Flat ₹40 OFF above ₹149"];
            const defaultDeliveryTimes = ["25-30 mins", "20-25 mins", "30-35 mins"];
            const defaultDistances = ["1.2 km", "1 km", "0.8 km"];
            const defaultFeaturedPrice = 249;
            if (fieldName === 'offer' && defaultOffers.includes(value)) {
              return true;
            }
            if (fieldName === 'deliveryTime' && defaultDeliveryTimes.includes(value)) {
              return true;
            }
            if (fieldName === 'distance' && defaultDistances.includes(value)) {
              return true;
            }
            if (fieldName === 'featuredPrice' && value === defaultFeaturedPrice) {
              return true;
            }
            return false;
          };

          const calculateDistance = (lat1, lng1, lat2, lng2) => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLng = (lng2 - lng1) * Math.PI / 180;
            const a =
              Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) *
                Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLng / 2) *
                Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
          };
          const userLat = location?.latitude;
          const userLng = location?.longitude;

          // First transform restaurants without menu data - USE ONLY BACKEND DATA
          // Filter out restaurants with only default/mock data
          const restaurantsWithIds = restaurantsArray.filter(restaurant => {
            // At minimum, restaurant should have a name
            return restaurant.name && restaurant.name.trim().length > 0;
          }).map(restaurant => {
            // Use backend data directly - filter out default values
            let deliveryTime = restaurant.estimatedDeliveryTime || null;
            let distance = restaurant.distance || null;
            let offer = restaurant.offer || null;

            const restaurantLocation = restaurant.location;
            const restaurantLat =
              restaurantLocation?.latitude ||
              (restaurantLocation?.coordinates && Array.isArray(restaurantLocation.coordinates)
                ? restaurantLocation.coordinates[1]
                : null);
            const restaurantLng =
              restaurantLocation?.longitude ||
              (restaurantLocation?.coordinates && Array.isArray(restaurantLocation.coordinates)
                ? restaurantLocation.coordinates[0]
                : null);

            let distanceInKm = null;
            if (restaurant.distanceMeters != null && Number.isFinite(Number(restaurant.distanceMeters))) {
              distanceInKm = Number(restaurant.distanceMeters) / 1000;
            } else if (
              userLat != null &&
              userLng != null &&
              restaurantLat != null &&
              restaurantLng != null &&
              !Number.isNaN(userLat) &&
              !Number.isNaN(userLng) &&
              !Number.isNaN(restaurantLat) &&
              !Number.isNaN(restaurantLng)
            ) {
              distanceInKm = calculateDistance(userLat, userLng, restaurantLat, restaurantLng);
            }
            if (distanceInKm != null && Number.isFinite(distanceInKm)) {
              if (distanceInKm >= 1) {
                distance = `${distanceInKm.toFixed(1)} km`;
              } else {
                distance = `${Math.round(distanceInKm * 1000)} m`;
              }
            }

            // Filter out default values
            if (isDefaultValue(deliveryTime, 'deliveryTime')) {
              deliveryTime = null;
            }
            if (isDefaultValue(distance, 'distance')) {
              distance = null;
            }
            if (isDefaultValue(offer, 'offer')) {
              offer = null;
            }
            const cuisine = restaurant.cuisines && restaurant.cuisines.length > 0 ? restaurant.cuisines.join(", ") : null;

            // Get images from backend only
            const coverImages = restaurant.coverImages && restaurant.coverImages.length > 0 ? restaurant.coverImages.map(img => img.url || img).filter(Boolean) : [];
            const fallbackImages = restaurant.menuImages && restaurant.menuImages.length > 0 ? restaurant.menuImages.map(img => img.url || img).filter(Boolean) : [];

            // Use backend images if available, otherwise null (UI will show dish icon)
            const allImages = coverImages.length > 0 ? coverImages : fallbackImages.length > 0 ? fallbackImages : restaurant.profileImage?.url ? [restaurant.profileImage.url] : [];

            // Use backend images if available, otherwise a placeholder
            const image = allImages[0] || 'https://via.placeholder.com/150?text=No+Image'; // Placeholder image
            const restaurantId = restaurant.restaurantId || restaurant._id;
            let featuredDish = restaurant.featuredDish || null;
            let featuredPrice = restaurant.featuredPrice || null;

            // Filter out default featured price
            if (featuredPrice && isDefaultValue(featuredPrice, 'featuredPrice')) {
              featuredPrice = null;
            }
            return {
              id: restaurantId,
              name: restaurant.name,
              cuisine: cuisine,
              rating: restaurant.rating || null,
              // Use backend rating or null
              deliveryTime: deliveryTime,
              distance: distance,
              distanceInKm,
              image: image,
              images: allImages,
              priceRange: restaurant.priceRange || null,
              featuredDish: featuredDish,
              // Will be set from menu if available
              featuredPrice: featuredPrice,
              // Will be set from menu if available
              offer: offer,
              // Use backend offer or null (defaults filtered out)
              slug: restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, '-'),
              restaurantId: restaurantId,
              hasPaneer: false,
              // Will be updated after menu fetch
              category: 'all',
              isActive: restaurant.isActive !== false,
              isAcceptingOrders: restaurant.isAcceptingOrders !== false,
              openDays: restaurant.openDays,
              deliveryTimings: restaurant.deliveryTimings,
              deliveryRange:
                restaurant.deliveryRange != null && Number.isFinite(Number(restaurant.deliveryRange))
                  ? Number(restaurant.deliveryRange)
                  : 5,
              location: restaurant.location,
            };
          });

          // Fetch menus for all restaurants in parallel
          const menuPromises = restaurantsWithIds.map(async restaurant => {
            try {
              const menuResponse = await restaurantAPI.getMenuByRestaurantId(restaurant.restaurantId);
              if (menuResponse.data && menuResponse.data.success && menuResponse.data.data && menuResponse.data.data.menu) {
                const menu = menuResponse.data.data.menu;

                // Store menu data for dynamic filtering
                const hasPaneer = checkCategoryInMenu(menu, 'paneer-tikka');

                // Get featured dish and price from menu if not set in restaurant
                let featuredDish = restaurant.featuredDish;
                let featuredPrice = restaurant.featuredPrice;

                // If featured dish/price not set, get from first available menu item
                if (!featuredDish || !featuredPrice) {
                  for (const section of menu.sections || []) {
                    if (section.items && section.items.length > 0) {
                      const firstItem = section.items[0];
                      if (!featuredDish) featuredDish = firstItem.name;
                      if (!featuredPrice) {
                        // Calculate final price considering discounts
                        const originalPrice = firstItem.originalPrice || firstItem.price || 0;
                        const discountPercent = firstItem.discountPercent || 0;
                        featuredPrice = discountPercent > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : originalPrice;
                      }
                      break;
                    }
                  }
                }
                return {
                  ...restaurant,
                  menu: menu,
                  hasPaneer: hasPaneer,
                  featuredDish: featuredDish || null,
                  featuredPrice: featuredPrice || null,
                  categoryMatches: {}
                };
              }
              return {
                ...restaurant,
                menu: null,
                hasPaneer: false,
                categoryMatches: {}
              };
            } catch (error) {
              // If menu fetch fails, keep restaurant without menu data
              console.warn(`Failed to fetch menu for restaurant ${restaurant.restaurantId}:`, error);
              return {
                ...restaurant,
                menu: null,
                hasPaneer: false,
                categoryMatches: {}
              };
            }
          });

          // Wait for all menu fetches to complete
          const transformedRestaurants = await Promise.all(menuPromises);
          setRestaurantsData(transformedRestaurants);
        } else {
          console.warn('⚠️ No restaurants in API response. Response structure:', {
            hasData: !!response.data,
            hasSuccess: response.data?.success,
            hasDataField: !!response.data?.data,
            hasRestaurants: !!response.data?.data?.restaurants,
            fullResponse: response.data
          });
          setRestaurantsData([]);
        }
      } catch (error) {
        console.error('❌ Error fetching restaurants:', error);
        console.error('❌ Error response:', error.response?.data);
        setRestaurantsData([]);
      } finally {
        setLoadingRestaurants(false);
      }
    };
    fetchRestaurants();
  }, [zoneId, isOutOfService, location?.latitude, location?.longitude, query, vegMode]);

  // Update search query when URL changes
  useEffect(() => {
    if (query) {
      setSearchQuery(query);
      // Try to match query to a category
      const matchedCategory = categories.find(cat => cat.name.toLowerCase() === query.toLowerCase() || cat.id === query.toLowerCase().replace(/\s+/g, '-'));
      if (matchedCategory) {
        setSelectedCategory(matchedCategory.id);
      } else {
        setSelectedCategory('all');
      }
    } else {
      setSearchQuery("");
      setSelectedCategory('all');
    }
  }, [query, categories]);
  const toggleFilter = filterId => {
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filterId)) {
        newSet.delete(filterId);
      } else {
        newSet.add(filterId);
      }
      return newSet;
    });
  };
  const handleSearchFocus = useCallback(() => {
    // No-op or open search overlay if needed, but here we are already on the search page
  }, []);
  const handleVoiceSearch = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error(t("user.home.voiceNotSupported"));
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => {
      toast(t("user.home.listening"), {
        icon: <Mic className="w-4 h-4 text-orange-500 animate-pulse" />
      });
    };
    recognition.onresult = event => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      if (transcript.trim()) {
        toast.success(t("user.home.searchingFor", { text: transcript }));
        setSearchParams({
          q: transcript.trim()
        });
      }
    };
    recognition.onerror = event => {
      console.error("Speech recognition error", event.error);
      if (event.error === 'not-allowed') {
        toast.error(t("user.home.microphoneDenied"));
      } else {
        toast.error(t("user.home.couldNotHear"));
      }
    };
    recognition.start();
  }, [setSearchParams, t]);
  const handleSearch = e => {
    e.preventDefault();
    if (searchQuery.trim()) {
      setSearchParams({
        q: searchQuery.trim()
      });
    } else {
      setSearchParams({});
    }
  };
  const handleCategorySelect = catId => {
    setSelectedCategory(catId);
    // Update search query to match category name
    const category = categories.find(c => c.id === catId);
    if (category && category.id !== 'all') {
      setSearchQuery(category.name);
      setSearchParams({
        q: category.name
      });
    } else {
      setSearchQuery("");
      setSearchParams({});
    }
  };

  // Derived matching dishes across all restaurants (per-restaurant, in-range + open only)
  const matchingDishes = useMemo(() => {
    if (!searchQuery.trim() && selectedCategory === 'all') return [];

    const lowerQuery = searchQuery.toLowerCase();
    const dishes = [];
    const categoryKeywordsList = selectedCategory !== 'all' ? categoryKeywords[selectedCategory] || [] : [];

    restaurantsData.forEach(restaurant => {
      const inRange = isWithinDeliveryRangeKm(restaurant.distanceInKm, restaurant.deliveryRange, { userHasLocation });
      const isOpen = isOpenForDeliveryNow({
        openDays: restaurant.openDays,
        deliveryTimings: restaurant.deliveryTimings,
        weeklyTimings: restaurant.weeklyTimings,
        outletTimingsActive: restaurant.outletTimingsActive,
      });
      if (!inRange || !isOpen) return;

      if (restaurant.menu && restaurant.menu.sections) {
        restaurant.menu.sections.forEach(section => {
          if (section.items) {
            section.items.forEach(item => {
              const itemNameLower = (item.name || '').toLowerCase();
              const itemCategoryLower = (item.category || '').toLowerCase();

              const queryMatch = lowerQuery && (itemNameLower.includes(lowerQuery) || itemCategoryLower.includes(lowerQuery));
              const categoryMatch = selectedCategory !== 'all' && categoryKeywordsList.some(kw => itemNameLower.includes(kw) || itemCategoryLower.includes(kw));

              if (queryMatch || categoryMatch) {
                const originalPrice = item.originalPrice || item.price || 0;
                const discountPercent = item.discountPercent || 0;
                const finalPrice = discountPercent > 0 ? Math.round(originalPrice * (1 - discountPercent / 100)) : originalPrice;

                dishes.push({
                  id: `${restaurant.id}-${item.id || item.name}`,
                  name: item.name,
                  image: item.image || restaurant.image,
                  price: finalPrice,
                  restaurantName: restaurant.name,
                  restaurantId: restaurant.id,
                  restaurantSlug: restaurant.slug,
                  rating: restaurant.rating,
                  deliveryTime: restaurant.deliveryTime,
                });
              }
            });
          }
        });
      }
    });

    return dishes;
  }, [searchQuery, selectedCategory, restaurantsData, categoryKeywords, userHasLocation]);

  const matchingRestaurants = useMemo(() => {
    if (!searchQuery.trim() && selectedCategory === 'all') return [];
    const lowerQuery = searchQuery.toLowerCase();
    return (restaurantsData || []).filter(r => {
      const nameMatch = r.name?.toLowerCase().includes(lowerQuery);
      const cuisineMatch = r.cuisine?.toLowerCase().includes(lowerQuery);
      return Boolean(nameMatch || cuisineMatch);
    }).map(r => ({
      ...r,
      inRange: isWithinDeliveryRangeKm(r.distanceInKm, r.deliveryRange, { userHasLocation }),
      isClosed: !isOpenForDeliveryNow({
        openDays: r.openDays,
        deliveryTimings: r.deliveryTimings,
        weeklyTimings: r.weeklyTimings,
        outletTimingsActive: r.outletTimingsActive,
      })
    }));
  }, [searchQuery, selectedCategory, restaurantsData, userHasLocation]);
  // Filtered restaurant lists removed (blank search view + focused suggestions)

  const isBlankSearch = !searchQuery.trim() && selectedCategory === 'all';

  return <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
    {/* Sticky Header */}
    <div className="sticky top-0 z-20 bg-white dark:bg-[#1a1a1a] shadow-sm">
      <div className="max-w-7xl mx-auto">
        {/* Search Bar with Back Button */}
        <div className="flex items-center gap-2 px-3 sm:px-4 md:px-6 lg:px-8 py-3 md:py-4 border-b border-gray-100 dark:border-gray-800">
          <button onClick={() => navigate('/user')} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0">
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-gray-300" />
          </button>

          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input placeholder={t("user.categoryPage.searchPlaceholder")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-10 h-11 rounded-lg border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-[#1a1a1a] focus:bg-white dark:focus:bg-[#2a2a2a] focus:border-gray-500 dark:focus:border-gray-600 text-sm dark:text-white placeholder:text-gray-600 dark:placeholder:text-gray-400" />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? <button type="button" onClick={() => {
                setSearchQuery("");
                setSearchParams({});
              }} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
                <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button> : <button type="button" onClick={handleVoiceSearch} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-full transition-colors">
                <Mic className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              </button>}
            </div>
          </form>
        </div>

        {/* Browse Category Section */}
        {!isBlankSearch && <div ref={categoryScrollRef} className="flex gap-3 sm:gap-4 lg:gap-5 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800" style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}>
          {categories.map(cat => {
            const isSelected = selectedCategory === cat.id;
            return <button key={cat.id} onClick={() => handleCategorySelect(cat.id)} className={`flex flex-col items-center gap-1.5 flex-shrink-0 pb-2 transition-all ${isSelected ? 'border-b-2 border-green-600' : ''}`}>
              {cat.image ? <div className={`w-16 h-16 rounded-full overflow-hidden border-2 transition-all ${isSelected ? 'border-green-600 dark:border-green-500 shadow-lg' : 'border-transparent'}`}>
                <img src={cat.image} alt={cat.name} className="w-full h-full object-cover" />
              </div> : <div className={`w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center border-2 transition-all ${isSelected ? 'border-green-600 dark:border-green-500 shadow-lg bg-green-50 dark:bg-green-900/20' : 'border-transparent'}`}>
                <span className="text-xl">🍽️</span>
              </div>}
              <span className={`text-xs font-medium whitespace-nowrap ${isSelected ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {cat.name}
              </span>
            </button>;
          })}
        </div>}

        {/* Filters */}
        {!isBlankSearch && <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 overflow-x-auto scrollbar-hide px-4 sm:px-6 md:px-8 lg:px-10 py-3 md:py-4 bg-white dark:bg-[#1a1a1a] border-b border-gray-100 dark:border-gray-800" style={{
          scrollbarWidth: "none",
          msOverflowStyle: "none"
        }}>
          {/* Filter Button */}
          <Button variant="outline" className="h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 font-medium bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300">
            <SlidersHorizontal className="h-4 w-4" />
            <span className="text-sm font-bold text-black dark:text-white">{t("user.categoryPage.filters")}</span>
            <ChevronDown className="h-3 w-3" />
          </Button>

          {/* Filter Options */}
          {filterOptions.map(filter => {
            const isActive = activeFilters.has(filter.id);
            return <Button key={filter.id} variant="outline" onClick={() => toggleFilter(filter.id)} className={`h-9 px-3 rounded-lg flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 transition-all font-medium ${isActive ? 'bg-green-600 text-white border-green-600 hover:bg-green-700 dark:bg-green-600 dark:hover:bg-green-700' : 'bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {filter.hasIcon && filter.id === 'price-match' && <span className={`text-xs ${isActive ? 'text-white' : 'text-green-600 dark:text-green-400'}`}>✓</span>}
              {filter.hasIcon && filter.id === 'flat-50-off' && <span className={`text-xs ${isActive ? 'text-white' : 'text-blue-500 dark:text-blue-400'}`}>★</span>}
              <span className={`text-sm font-bold ${isActive ? 'text-white' : 'text-black dark:text-white'}`}>{filter.label}</span>
            </Button>;
          })}
        </div>}
      </div>
    </div>

    {/* Content */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 space-y-6 md:space-y-8 lg:space-y-10">
      {/* Loading State */}
      {loadingRestaurants && <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        <span className="ml-3 text-gray-600">{t("user.home.loadingRestaurants")}</span>
      </div>}

      {/* Matching results */}
      {!loadingRestaurants && !isBlankSearch && (
        <section>
          <h2 className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase mb-4">
            {t("user.searchResults.matchingDishesAndRestaurants")}
          </h2>

          <div className="space-y-3">
            {matchingDishes.map(item => {
              const targetUrl = `/user/restaurants/${item.restaurantSlug}?dish=${encodeURIComponent(item.name)}`;
              return (
                <Link
                  key={item.id}
                  to={targetUrl}
                  state={{ prefillDish: item.name }}
                  onClick={() => {
                    try {
                      sessionStorage.setItem("prefillDish", item.name);
                    } catch {}
                  }}
                  className="block"
                >
                  <div className="flex items-center gap-3 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md transition-shadow">
                    <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      {item.image ? (
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg">🍽️</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{item.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{t("user.searchResults.dishWithRestaurant", { restaurant: item.restaurantName })}</div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {matchingRestaurants.map(restaurant => {
              const restaurantSlug = restaurant.slug || restaurant.name.toLowerCase().replace(/\s+/g, "-");
              const disabled = restaurant.isClosed || !restaurant.inRange;
              const content = (
                <div className={`flex items-center gap-3 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-[#1a1a1a] shadow-sm transition-shadow ${disabled ? 'grayscale opacity-70 cursor-not-allowed' : 'hover:shadow-md'}`}>
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    {restaurant.image ? (
                      <img src={restaurant.image} alt={restaurant.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg">🍽️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">{restaurant.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{restaurant.cuisine || t("user.searchResults.restaurantFallback")}</div>
                  </div>
                  {disabled && (
                    <span className="text-[10px] font-semibold text-gray-500 border border-gray-200 rounded-full px-2 py-0.5">
                      {!restaurant.inRange ? "Out of range" : t("user.searchResults.closed")}
                    </span>
                  )}
                </div>
              );
              return disabled ? (
                <div key={restaurant.id}>{content}</div>
              ) : (
                <Link key={restaurant.id} to={`/user/restaurants/${restaurant.slug || restaurantSlug}`} className="block">
                  {content}
                </Link>
              );
            })}

            {matchingDishes.length === 0 && matchingRestaurants.length === 0 && (
              <div className="text-sm text-gray-500">{t("user.searchResults.noMatchesFound")}</div>
            )}
          </div>
        </section>
      )}
    </div>
    {!isBlankSearch && <StickyCartCard />}
  </div>;
}
