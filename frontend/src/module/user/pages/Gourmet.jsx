import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { heroBannerAPI } from "@/lib/api";
import api from "@/lib/api";
import { useLocation } from "../hooks/useLocation";
import { useZone } from "../hooks/useZone";
import { toast } from "sonner";
import FeaturedStyleRestaurantCard from "../components/FeaturedStyleRestaurantCard";

import gourmetBanner from "@/assets/groumetpagebanner.png";

export default function Gourmet() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const { zoneId, isOutOfService } = useZone(location);
  const [favorites, setFavorites] = useState(new Set());
  const [gourmetRestaurants, setGourmetRestaurants] = useState([]);
  const [recommendedPreviewByRestaurantId, setRecommendedPreviewByRestaurantId] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchGourmetRestaurants = async () => {
      try {
        const hasCoords = location?.latitude != null && location?.longitude != null;
        if (!hasCoords) {
          setLoading(true);
          setError(null);
          setGourmetRestaurants([]);
          return;
        }
        if (isOutOfService) {
          setGourmetRestaurants([]);
          setError(null);
          setLoading(false);
          return;
        }
        setLoading(true);
        setError(null);
        const params = {};
        if (zoneId) params.zoneId = zoneId;
        params.latitude = location.latitude;
        params.longitude = location.longitude;
        const response = await heroBannerAPI.getGourmetRestaurants(params);
        const data = response?.data?.data;

        if (data && data.restaurants) {
          setGourmetRestaurants(data.restaurants);
        } else {
          setGourmetRestaurants([]);
        }
      } catch (err) {
        console.error("Error fetching Gourmet restaurants:", err);
        const errorMessage = err?.response?.data?.message || err?.message || "Failed to load Gourmet restaurants";
        setError(errorMessage);
        toast.error(errorMessage);
        setGourmetRestaurants([]);
      } finally {
        setLoading(false);
      }
    };

    fetchGourmetRestaurants();
  }, [location?.latitude, location?.longitude, zoneId, isOutOfService]);

  useEffect(() => {
    const ids = (gourmetRestaurants || [])
      .map((r) => String(r?._id || r?.id || ""))
      .filter((id) => id && id.length === 24);
    const uniqueIds = [...new Set(ids)].slice(0, 60);
    if (uniqueIds.length === 0) {
      setRecommendedPreviewByRestaurantId({});
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await api.post("/restaurant/recommended-preview", {
          restaurantIds: uniqueIds,
        });
        const previews = res?.data?.data?.previews || {};
        if (!cancelled) setRecommendedPreviewByRestaurantId(previews);
      } catch (_) {
        if (!cancelled) setRecommendedPreviewByRestaurantId({});
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [gourmetRestaurants]);

  const toggleFavorite = (id) => {
    setFavorites((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return newSet;
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a]">
      <div className="relative w-full overflow-hidden min-h-[25vh] md:min-h-[30vh]">
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 md:top-6 md:left-6 z-20 w-10 h-10 md:w-12 md:h-12 bg-gray-800/60 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-gray-800/80 transition-colors"
        >
          <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-white" />
        </button>
        <div className="absolute inset-0 z-0">
          <img src={gourmetBanner} alt="Gourmet Food" className="w-full h-full object-cover" />
        </div>
      </div>

      <div className="px-4 sm:px-6 md:px-8 lg:px-10 py-6 md:py-8 lg:py-10 space-y-4 md:space-y-6">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          <div className="mb-2">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">Premium Gourmet Restaurants</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Exquisite dishes delivered to your doorstep</p>
          </div>

          <p className="text-xs sm:text-sm font-semibold text-gray-400 dark:text-gray-500 tracking-widest uppercase">
            {loading ? "..." : gourmetRestaurants.length} GOURMET RESTAURANTS
          </p>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="h-10 w-10 animate-spin text-gray-400" />
              <p className="mt-4 text-gray-500 dark:text-gray-400">Loading Gourmet restaurants...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <p className="text-red-500 dark:text-red-400 text-center">{error}</p>
              <Button onClick={() => window.location.reload()} className="mt-4">
                Retry
              </Button>
            </div>
          )}

          {!loading && !error && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
              {gourmetRestaurants.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <p className="text-gray-500 dark:text-gray-400">No Gourmet restaurants available at the moment</p>
                </div>
              ) : (
                gourmetRestaurants.map((restaurant, index) => {
                  const restaurantId = restaurant._id || restaurant.restaurantId || restaurant.id;
                  const isFavorite = favorites.has(restaurantId);

                  return (
                    <FeaturedStyleRestaurantCard
                      key={restaurantId}
                      restaurant={restaurant}
                      recommendedItems={recommendedPreviewByRestaurantId[String(restaurantId)]}
                      priority={index < 3}
                      favorite={isFavorite}
                      onToggleFavorite={toggleFavorite}
                    />
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
