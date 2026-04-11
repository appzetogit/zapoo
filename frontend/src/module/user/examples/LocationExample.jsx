/**
 * Location Integration Example
 * 
 * This file demonstrates how to use the Ola Maps location integration
 * to display area/subLocality names in a Zomato-style UI.
 * 
 * Copy these examples into your components to get started!
 */

import { useLocationSimple } from "../hooks/useLocationSimple"
import LocationDisplay, { CompactLocationDisplay, FullLocationDisplay } from "../components/LocationDisplay"
import { MapPin, Loader2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "react-i18next"

// ============================================================================
// Example 1: Basic Usage with Hook
// ============================================================================

export function Example1_BasicHook() {
  const { location, loading, error, requestLocation } = useLocationSimple()
  const { t } = useTranslation()

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{t("user.locationExample.basicHookUsage")}</h2>
      
      {loading && <p>{t("user.locationExample.loadingLocation")}</p>}
      
      {error && (
        <div className="flex items-center gap-2 text-red-500">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}
      
      {location && (
        <div className="space-y-2">
          <p><strong>{t("user.locationExample.area")}:</strong> {location.area || t("user.locationExample.notAvailable")}</p>
          <p><strong>{t("user.locationExample.city")}:</strong> {location.city || t("user.locationExample.notAvailable")}</p>
          <p><strong>{t("user.locationExample.state")}:</strong> {location.state || t("user.locationExample.notAvailable")}</p>
          <p><strong>{t("user.locationExample.coordinates")}:</strong> {location.latitude}, {location.longitude}</p>
        </div>
      )}
      
      <Button onClick={requestLocation} className="mt-4">
        {t("user.locationExample.getLocation")}
      </Button>
    </div>
  )
}

// ============================================================================
// Example 2: Zomato-Style "Delivering to" Display
// ============================================================================

export function Example2_ZomatoStyle() {
  const { location, loading } = useLocationSimple()
  const { t } = useTranslation()

  // Extract area name (primary) or city (fallback)
  const displayName = location?.area || location?.city || t("user.locationExample.selectLocation")

  return (
    <div className="flex items-center gap-2 p-4 bg-white rounded-lg shadow">
      <MapPin className="h-5 w-5 text-red-500" fill="currentColor" />
      <div className="flex flex-col">
        <span className="text-xs text-gray-500">{t("user.locationExample.deliveringTo")}</span>
        <span className="text-sm font-semibold text-gray-900">
          {loading ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("user.locationExample.loading")}
            </span>
          ) : (
            displayName
          )}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// Example 3: Using LocationDisplay Component (Recommended)
// ============================================================================

export function Example3_LocationDisplayComponent() {
  const { t } = useTranslation()

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">{t("user.locationExample.usingLocationDisplayComponent")}</h2>
      
      {/* Full Display */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">{t("user.locationExample.fullDisplay")}</h3>
        <LocationDisplay />
      </div>
      
      {/* Compact Display (for navbar) */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">{t("user.locationExample.compactDisplayNavbar")}</h3>
        <CompactLocationDisplay />
      </div>
      
      {/* Full Location Display (with city/state) */}
      <div className="mb-4">
        <h3 className="text-lg font-semibold mb-2">{t("user.locationExample.fullLocationDisplay")}</h3>
        <FullLocationDisplay />
      </div>
    </div>
  )
}

// ============================================================================
// Example 4: Custom Location Button (Navbar Style)
// ============================================================================

export function Example4_CustomNavbarButton() {
  const { location, loading, requestLocation } = useLocationSimple()
  const { t } = useTranslation()
  
  const displayText = location?.area || location?.city || t("user.locationExample.selectLocation")

  return (
    <button
      onClick={requestLocation}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <MapPin className="h-4 w-4 text-red-500" fill="currentColor" />
      <div className="flex flex-col items-start">
        <span className="text-xs text-gray-500">{t("user.locationExample.deliveringTo")}</span>
        <span className="text-sm font-semibold">
          {loading ? t("user.locationExample.loading") : displayText}
        </span>
      </div>
    </button>
  )
}

// ============================================================================
// Example 5: Location Selector with Dropdown
// ============================================================================

export function Example5_LocationSelector() {
  const { location, loading, error, requestLocation, permissionGranted } = useLocationSimple()
  const { t } = useTranslation()
  
  const displayText = location?.area || location?.city || t("user.locationExample.selectLocation")

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
        <MapPin className="h-5 w-5 text-red-500" fill="currentColor" />
        <div className="flex-1">
          <p className="text-xs text-gray-500 mb-1">{t("user.locationExample.deliveringTo")}</p>
          <p className="text-sm font-semibold">{loading ? t("user.locationExample.loading") : displayText}</p>
          {location?.city && location?.state && (
            <p className="text-xs text-gray-400 mt-1">
              {location.city}, {location.state}
            </p>
          )}
        </div>
        
        {!permissionGranted && (
          <Button 
            size="sm" 
            onClick={requestLocation}
            disabled={loading}
          >
            {loading ? t("user.locationExample.loading") : t("user.locationExample.allowLocation")}
          </Button>
        )}
      </div>
      
      {error && (
        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Example 6: Complete Page Header with Location
// ============================================================================

export function Example6_PageHeader() {
  const { location, loading } = useLocationSimple()
  const { t } = useTranslation()
  
  const displayText = location?.area || location?.city || t("user.locationExample.selectLocation")

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <div className="text-xl font-bold">AppzetoFood</div>
          
          {/* Location */}
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-red-500" fill="currentColor" />
            <div className="flex flex-col">
              <span className="text-xs text-gray-500">{t("user.locationExample.deliveringTo")}</span>
              <span className="text-sm font-semibold">
                {loading ? t("user.locationExample.loading") : displayText}
              </span>
            </div>
          </div>
          
          {/* Cart/Profile */}
          <div className="flex items-center gap-4">
            <Button variant="ghost">{t("user.locationExample.cart")}</Button>
            <Button variant="ghost">{t("user.locationExample.profile")}</Button>
          </div>
        </div>
      </div>
    </header>
  )
}

// ============================================================================
// Example 7: Display Area Only (Most Common Use Case)
// ============================================================================

export function Example7_AreaOnly() {
  const { location, loading } = useLocationSimple()
  const { t } = useTranslation()
  
  // This is the PRIMARY use case: Show ONLY the area name
  // Example: "New Palasia" (not full address)
  const areaName = location?.area || location?.city || t("user.locationExample.selectLocation")

  return (
    <div className="flex items-center gap-2 p-4">
      <MapPin className="h-5 w-5 text-red-500" fill="currentColor" />
      <span className="text-lg font-bold">
        {loading ? t("user.locationExample.loading") : areaName}
      </span>
    </div>
  )
}

// ============================================================================
// Usage Instructions:
// ============================================================================

/*
 * HOW TO USE IN YOUR COMPONENTS:
 * 
 * 1. Import the hook:
 *    import { useLocationSimple } from "../hooks/useLocationSimple"
 * 
 * 2. Use the hook:
 *    const { location, loading, error, requestLocation } = useLocationSimple()
 * 
 * 3. Display the area name:
 *    {location?.area || location?.city || "Select location"}
 * 
 * 4. OR use the pre-built component:
 *    import LocationDisplay from "../components/LocationDisplay"
 *    <LocationDisplay />
 * 
 * KEY FIELD: location.area
 * - This contains the subLocality/neighborhood name (e.g., "New Palasia")
 * - Falls back to location.city if area is not available
 * - Always use location.area for the primary display (Zomato-style)
 */
