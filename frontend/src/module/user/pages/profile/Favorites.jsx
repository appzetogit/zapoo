import { Link } from "react-router-dom"
import { useState } from "react"

import { Heart, Star, Clock, MapPin, ArrowRight, ArrowLeft, Bookmark } from "lucide-react"
import AnimatedPage from "../../components/AnimatedPage"
import ScrollReveal from "../../components/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useProfile } from "../../context/ProfileContext"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

export default function Favorites() {
  const { getFavorites, removeFavorite, getDishFavorites, removeDishFavorite } = useProfile()
  const { t } = useTranslation()
  const restaurantFavorites = getFavorites()
  const dishFavorites = getDishFavorites()
  const [activeTab, setActiveTab] = useState("restaurants")
  const RESTAURANT_FALLBACK_IMAGE = "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=600&fit=crop&q=80"

  const getRestaurantImageUrl = (restaurant) => {
    if (!restaurant) return ""
    if (typeof restaurant.image === "string" && restaurant.image.trim()) return restaurant.image
    if (restaurant.image?.url) return restaurant.image.url
    if (typeof restaurant.profileImage === "string" && restaurant.profileImage.trim()) return restaurant.profileImage
    if (restaurant.profileImage?.url) return restaurant.profileImage.url
    return ""
  }

  const handleRemoveFavorite = (e, slug) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(t("user.favorites.confirm.removeRestaurant"))) {
      removeFavorite(slug)
      toast.success(t("user.favorites.toast.restaurantRemoved"))
    }
  }

  const handleRemoveDishFavorite = (e, dishId, restaurantId) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(t("user.favorites.confirm.removeDish"))) {
      removeDishFavorite(dishId, restaurantId)
      toast.success(t("user.favorites.toast.dishRemoved"))
    }
  }

  const totalFavorites = restaurantFavorites.length + dishFavorites.length

  if (totalFavorites === 0) {
    return (
      <><AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <ScrollReveal>
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/user/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{t("user.favorites.title")}</h1>
            </div>
          </ScrollReveal>
          <Card>
            <CardContent className="py-12 text-center">
              <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-lg mb-4">{t("user.favorites.empty.noFavorites")}</p>
              <Link to="/user">
                <Button className="bg-[#FF5200] hover:opacity-90 text-white">
                  {t("user.favorites.actions.exploreRestaurants")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage></>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#0a0a0a] dark:to-[#0a0a0a] p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        <ScrollReveal>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <Link to="/user/profile">
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-10 sm:w-10">
                  <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
                </Button>
              </Link>
              <div>
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold">{t("user.favorites.title")}</h1>
                <p className="text-gray-700 dark:text-gray-300 mt-1 text-sm font-semibold">
                  {t("user.favorites.counts.summary", {
                    dishes: dishFavorites.length || 0,
                    dishesLabel: dishFavorites.length === 1 ? t("user.favorites.counts.dish") : t("user.favorites.counts.dishes"),
                    restaurants: restaurantFavorites.length || 0,
                    restaurantsLabel: restaurantFavorites.length === 1 ? t("user.favorites.counts.restaurant") : t("user.favorites.counts.restaurants"),
                  })}
                </p>
              </div>
            </div>
          </div>
        </ScrollReveal>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("restaurants")}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === "restaurants"
                ? "border-b-2 border-[#FF5200] text-[#FF5200]"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            {t("user.favorites.tabs.restaurants", { count: restaurantFavorites.length })}
          </button>
          <button
            onClick={() => setActiveTab("dishes")}
            className={`px-4 py-2 font-medium transition-colors ${activeTab === "dishes"
                ? "border-b-2 border-[#FF5200] text-[#FF5200]"
                : "text-gray-500 hover:text-gray-700"
              }`}
          >
            {t("user.favorites.tabs.dishes", { count: dishFavorites.length })}
          </button>
        </div>

        {/* Restaurants Tab */}
        {activeTab === "restaurants" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {restaurantFavorites.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg mb-4">{t("user.favorites.empty.noRestaurants")}</p>
                <Link to="/user">
                  <Button className="bg-[#FF5200] hover:opacity-90 text-white">
                    {t("user.favorites.actions.exploreRestaurants")}
                  </Button>
                </Link>
              </div>
            ) : (
              restaurantFavorites.map((restaurant, index) => (
                <ScrollReveal key={restaurant.slug} delay={index * 0.1}>
                  <Link to={`/user/restaurants/${restaurant.slug}`}>
                    <Card className="overflow-hidden h-full">
                      <div className="h-32 w-full relative overflow-hidden">
                        <img
                          src={getRestaurantImageUrl(restaurant) || RESTAURANT_FALLBACK_IMAGE}
                          alt={restaurant.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.target.src = RESTAURANT_FALLBACK_IMAGE
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                        <div className="absolute top-2 right-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-red-500"
                            onClick={(e) => handleRemoveFavorite(e, restaurant.slug)}
                          >
                            <Heart className="h-4 w-4 fill-red-500" />
                          </Button>
                        </div>
                        <div className="absolute bottom-2 left-2">
                          <div className="flex items-center gap-1 bg-white/90 backdrop-blur-sm px-1.5 py-0.5 rounded-full">
                            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                            <span className="font-bold text-xs">{restaurant.rating}</span>
                          </div>
                        </div>
                      </div>
                      <CardContent className="p-3 space-y-2">
                        <div>
                          <CardTitle className="text-sm font-bold mb-0.5 line-clamp-1">
                            {restaurant.name}
                          </CardTitle>
                          <p className="text-xs text-muted-foreground font-medium line-clamp-1">
                            {restaurant.cuisine}
                          </p>
                        </div>
                        <div className="flex items-center justify-between text-xs pt-2 border-t">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium">{restaurant.deliveryTime}</span>
                          </div>
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            <span className="font-medium">{restaurant.distance}</span>
                          </div>
                        </div>
                        <Button className="w-full bg-[#FF5200] hover:opacity-90 text-white text-xs py-1.5 h-8">
                          {t("user.favorites.actions.viewRestaurant")}
                          <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </CardContent>
                    </Card>
                  </Link>
                </ScrollReveal>
              ))
            )}
          </div>
        )}

        {/* Dishes Tab */}
        {activeTab === "dishes" && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {dishFavorites.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Bookmark className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground text-lg mb-4">{t("user.favorites.empty.noDishes")}</p>
                <Link to="/user">
                  <Button className="bg-[#FF5200] hover:opacity-90 text-white">
                    {t("user.favorites.actions.exploreDishes")}
                  </Button>
                </Link>
              </div>
            ) : (
              dishFavorites.map((dish, index) => {
                const restaurantSlug = dish.restaurantSlug || ""
                return (
                  <ScrollReveal key={`${dish.id}-${dish.restaurantId}`} delay={index * 0.1}>
                    <Link to={`/user/restaurants/${restaurantSlug}?dish=${dish.id}`}>
                      <Card className="overflow-hidden h-full cursor-pointer hover:shadow-lg transition-shadow">
                        <div className="h-32 w-full relative overflow-hidden">
                          <img
                            src={dish.image || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80"}
                            alt={dish.name}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop&q=80"
                            }}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                          <div className="absolute top-2 right-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white text-red-500"
                              onClick={(e) => handleRemoveDishFavorite(e, dish.id, dish.restaurantId)}
                            >
                              <Bookmark className="h-4 w-4 fill-red-500" />
                            </Button>
                          </div>
                        </div>
                        <CardContent className="p-3 space-y-2">
                          <div>
                            <CardTitle className="text-sm font-bold mb-0.5 line-clamp-1">
                              {dish.name}
                            </CardTitle>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {dish.restaurantName || t("user.favorites.restaurantFallback")}
                            </p>
                          </div>
                          <div className="flex items-center justify-between text-xs pt-2 border-t">
                            <div className="flex items-center gap-1">
                              {dish.foodType === "Veg" ? (
                                <div className="w-3 h-3 border-2 border-green-600 flex items-center justify-center rounded-sm">
                                  <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                </div>
                              ) : (
                                <div className="w-3 h-3 border-2 border-orange-600 flex items-center justify-center rounded-sm">
                                  <div className="w-1.5 h-1.5 bg-orange-600 rounded-full"></div>
                                </div>
                              )}
                              <span className="text-muted-foreground font-medium text-xs">{dish.foodType || t("user.favorites.na")}</span>
                            </div>
                            <div className="text-sm font-bold text-[#FF5200]">
                              ₹{Math.round(dish.price || 0)}
                            </div>
                          </div>
                          <Button className="w-full bg-[#FF5200] hover:opacity-90 text-white text-xs py-1.5 h-8">
                            {t("user.favorites.actions.viewDish")}
                            <ArrowRight className="h-3 w-3 ml-1" />
                          </Button>
                        </CardContent>
                      </Card>
                    </Link>
                  </ScrollReveal>
                )
              })
            )}
          </div>
        )}
      </div>
    </AnimatedPage>
  )
}
