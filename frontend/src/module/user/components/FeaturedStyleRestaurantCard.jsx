import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bookmark, Star, Zap, BadgePercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import OptimizedImage from "@/components/OptimizedImage";
import DynamicEtaText from "./DynamicEtaText";
import RecommendedItemsBadge, { ActiveRecommendedItemBadge } from "./RecommendedItemsBadge";

function RestaurantImageCarousel({ restaurant, recommendedItems = [], priority = false }) {
  const restaurantImages = useMemo(() => {
    const baseImages = Array.isArray(restaurant.images) && restaurant.images.length ? restaurant.images : [restaurant.image];
    return baseImages.filter(Boolean);
  }, [restaurant]);

  const recommendedSlides = useMemo(() => {
    if (!Array.isArray(recommendedItems) || recommendedItems.length === 0) return [];
    return recommendedItems
      .filter(Boolean)
      .map((item, index) => ({
        id: item.itemId || `${item.name || "recommended"}-${index}`,
        image: item.image || restaurantImages[0] || restaurant.image,
        name: item.name || "",
        price: item.price,
        isRecommended: true,
      }))
      .filter((item) => Boolean(item.image));
  }, [recommendedItems, restaurant.image, restaurantImages]);

  const gallerySlides = useMemo(() => {
    if (recommendedSlides.length > 0) return recommendedSlides;
    return restaurantImages.map((image, index) => ({
      id: `${restaurant._id || restaurant.id || restaurant.name}-gallery-${index}`,
      image,
      isRecommended: false,
    }));
  }, [recommendedSlides, restaurantImages, restaurant]);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isSwiping = useRef(false);
  const fallbackText = restaurant.featuredDish
    ? `${restaurant.featuredDish}${restaurant.featuredPrice ? ` · ₹${restaurant.featuredPrice}` : ""}`
    : "";

  useEffect(() => {
    setCurrentIndex(0);
  }, [restaurant._id, restaurant.id, gallerySlides.length]);

  useEffect(() => {
    if (gallerySlides.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % gallerySlides.length);
    }, 3500);

    return () => window.clearInterval(intervalId);
  }, [gallerySlides.length]);

  if (!gallerySlides || gallerySlides.length === 0) {
    return (
      <div className="relative h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0 bg-gray-200">
        <OptimizedImage
          src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop"
          alt={restaurant.name}
          className="w-full h-full"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
          objectFit="cover"
          placeholder="blur"
          priority={priority}
        />
      </div>
    );
  }

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
    isSwiping.current = false;
  };

  const handleTouchMove = (e) => {
    const currentX = e.touches[0].clientX;
    const diff = touchStartX.current - currentX;
    if (Math.abs(diff) > 10) {
      isSwiping.current = true;
    }
  };

  const handleTouchEnd = (e) => {
    if (!isSwiping.current) return;
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    const minSwipeDistance = 50;

    if (Math.abs(diff) > minSwipeDistance) {
      if (diff > 0) {
        setDirection(1);
        setCurrentIndex((prev) => (prev + 1) % gallerySlides.length);
      } else {
        setDirection(-1);
        setCurrentIndex((prev) => (prev - 1 + gallerySlides.length) % gallerySlides.length);
      }
    }

    isSwiping.current = false;
    touchStartX.current = 0;
    touchEndX.current = 0;
  };

  const activeSlide = gallerySlides[currentIndex] || null;
  const activeRecommendedItem = activeSlide?.isRecommended ? recommendedSlides[currentIndex] || null : null;

  return (
    <div
      className="relative h-48 sm:h-56 md:h-60 lg:h-64 xl:h-72 w-full overflow-hidden rounded-t-md flex-shrink-0 group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <AnimatePresence initial={false} custom={direction} mode="wait">
        <motion.div
          key={activeSlide?.id || currentIndex}
          custom={direction}
          initial={{ opacity: 0, x: direction > 0 ? 32 : -32, scale: 1.02 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: direction > 0 ? -24 : 24, scale: 0.985 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0 transition-transform duration-700 ease-out group-hover:scale-110">
            <OptimizedImage
              src={activeSlide?.image}
              alt={activeRecommendedItem?.name ? `${restaurant.name} - ${activeRecommendedItem.name}` : `${restaurant.name} - Image ${currentIndex + 1}`}
              className="w-full h-full"
              priority={priority && currentIndex === 0}
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              objectFit="cover"
              placeholder="blur"
            />
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute top-3 left-3 md:top-4 md:left-4 z-10 transform transition-transform duration-300 group-hover:scale-105 group-hover:-translate-y-0.5">
        {recommendedSlides.length > 0 ? (
          <ActiveRecommendedItemBadge item={activeRecommendedItem} fallbackText={fallbackText} />
        ) : (
          <RecommendedItemsBadge fallbackText={fallbackText} />
        )}
      </div>

      {gallerySlides.length > 1 && (
        <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center z-10 -space-x-2">
          {gallerySlides.map((slide, index) => (
            <button
              key={slide.id || index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirection(index >= currentIndex ? 1 : -1);
                setCurrentIndex(index);
              }}
              className="w-10 h-10 flex items-center justify-center focus:outline-none group/btn rounded-full"
              aria-label={`Go to image ${index + 1}`}
            >
              <div className={`h-1.5 rounded-full transition-all duration-300 ${index === currentIndex ? "w-6 bg-white" : "w-1.5 bg-white/50 group-hover/btn:bg-white/75"}`} />
            </button>
          ))}
        </div>
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full transition-transform duration-1000 group-hover:animate-shine" />
    </div>
  );
}

export default function FeaturedStyleRestaurantCard({
  restaurant,
  recommendedItems = [],
  priority = false,
  favorite = false,
  onToggleFavorite = () => {},
}) {
  const restaurantSlug = restaurant.slug || restaurant.name?.toLowerCase().replace(/\s+/g, "-") || "";
  const restaurantId = restaurant._id || restaurant.restaurantId || restaurant.id;
  const ratingValue = Number(restaurant.rating);
  const hasRating = Number.isFinite(ratingValue);

  return (
    <div className="h-full transform transition-all duration-300 hover:-translate-y-3 hover:scale-[1.02]" style={{ perspective: 1000 }}>
      <div className="h-full group">
        <Link to={`/user/restaurants/${restaurantSlug}`} className="h-full flex">
          <Card className="overflow-hidden gap-0 cursor-pointer border-0 dark:border-gray-800 group bg-white dark:bg-[#1a1a1a] border-background transition-all duration-500 py-0 rounded-md flex flex-col h-full w-full relative">
            <div className="relative">
              <RestaurantImageCarousel
                restaurant={restaurant}
                recommendedItems={recommendedItems}
                priority={priority}
              />

              <div className="absolute top-3 right-3 md:top-4 md:right-4 z-10 transform transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onToggleFavorite(restaurantId, restaurant);
                  }}
                  aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
                  className={`h-9 w-9 md:h-11 md:w-11 rounded-full border flex items-center justify-center transition-all duration-300 ${favorite ? "border-red-500 bg-red-50 text-red-500" : "border-white bg-white/90 text-gray-600 hover:bg-white"}`}
                >
                  <Bookmark className={`h-5 w-5 lg:h-6 lg:w-6 transition-all duration-300 ${favorite ? "fill-red-500" : ""}`} />
                </Button>
              </div>
            </div>

            <div className="transform transition-transform duration-300 group-hover:-translate-y-1">
              <CardContent className="p-3 sm:p-4 lg:p-5 pt-3 sm:pt-4 lg:pt-5 flex flex-col flex-grow">
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white line-clamp-1">
                      {restaurant.name}
                    </h3>
                  </div>

                  <div className="flex flex-col items-end flex-shrink-0">
                    <div className="flex items-center gap-1 bg-white dark:bg-[#141414] border border-emerald-600 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full">
                      <Star className="h-4 w-4 fill-current" />
                      <span className="text-sm font-bold">{hasRating ? ratingValue.toFixed(1) : "0.0"}</span>
                    </div>
                    {Number(restaurant.totalRatings) > 0 && (
                      <span className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                        {`By ${Number(restaurant.totalRatings) >= 1000 ? `${(Number(restaurant.totalRatings) / 1000).toFixed(0)}K+` : `${Number(restaurant.totalRatings)}+`}`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 mb-1.5">
                  <Zap className="w-4 h-4 text-emerald-600 fill-current" />
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    <DynamicEtaText
                      restaurantId={restaurant._id || restaurant.id || restaurant.restaurantId}
                      fallback={restaurant.deliveryTime || restaurant.estimatedDeliveryTime || "25-30 mins"}
                    />
                  </span>
                  <span className="text-gray-400">|</span>
                  <span className="font-semibold">{restaurant.distance || "1.2 km"}</span>
                </div>

                {restaurant.offer && (
                  <div className="flex items-center gap-2 text-sm mt-auto">
                    <BadgePercent className="h-4 w-4 text-blue-600 dark:text-blue-400" strokeWidth={2} />
                    <span className="text-gray-700 dark:text-gray-300 font-medium line-clamp-1">
                      {restaurant.offer}
                    </span>
                  </div>
                )}
              </CardContent>
            </div>

            <div className="absolute inset-0 rounded-md pointer-events-none z-0 transition-all duration-300 border border-transparent group-hover:border-orange-500/30 group-hover:shadow-[inset_0_0_0_1px_rgba(234,88,12,0.2)]" />
          </Card>
        </Link>
      </div>
    </div>
  );
}
