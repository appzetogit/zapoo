import { Outlet, useLocation } from "react-router-dom"
import { useEffect, createContext, useContext, lazy, Suspense, useState } from "react"
import { ProfileProvider } from "../context/ProfileContext"
import LocationPrompt from "./LocationPrompt"
import { CartProvider } from "../context/CartContext"
import { OrdersProvider } from "../context/OrdersContext"
import { useFCMNotification } from "@/hooks/useFCMNotification"
import BottomNavigation from "./BottomNavigation"
import DesktopNavbar from "./DesktopNavbar"

const SearchOverlay = lazy(() => import("./SearchOverlay"))
const LocationSelectorOverlay = lazy(() => import("./LocationSelectorOverlay"))

const SearchOverlayContext = createContext({
  isSearchOpen: false,
  searchValue: "",
  setSearchValue: () => {
    console.warn("SearchOverlayProvider not available")
  },
  openSearch: () => {
    console.warn("SearchOverlayProvider not available")
  },
  closeSearch: () => { }
})

export function useSearchOverlay() {
  const context = useContext(SearchOverlayContext)
  return context
}

function SearchOverlayProvider({ children }) {
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const openSearch = () => {
    setIsSearchOpen(true)
  }

  const closeSearch = () => {
    setIsSearchOpen(false)
    setSearchValue("")
  }

  return (
    <SearchOverlayContext.Provider value={{ isSearchOpen, searchValue, setSearchValue, openSearch, closeSearch }}>
      {children}
      <Suspense fallback={null}>
        {isSearchOpen && (
          <SearchOverlay
            isOpen={isSearchOpen}
            onClose={closeSearch}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
          />
        )}
      </Suspense>
    </SearchOverlayContext.Provider>
  )
}

const LocationSelectorContext = createContext({
  isLocationSelectorOpen: false,
  locationSelectorLabel: null,
  openLocationSelector: () => {
    console.warn("LocationSelectorProvider not available")
  },
  closeLocationSelector: () => { }
})

export function useLocationSelector() {
  const context = useContext(LocationSelectorContext)
  if (!context) {
    throw new Error("useLocationSelector must be used within LocationSelectorProvider")
  }
  return context
}

function LocationSelectorProvider({ children }) {
  const [isLocationSelectorOpen, setIsLocationSelectorOpen] = useState(false)
  const [locationSelectorLabel, setLocationSelectorLabel] = useState(null)

  const openLocationSelector = (label = null) => {
    setLocationSelectorLabel(label)
    setIsLocationSelectorOpen(true)
  }

  const closeLocationSelector = () => {
    setIsLocationSelectorOpen(false)
    setLocationSelectorLabel(null)
  }

  const value = {
    isLocationSelectorOpen,
    locationSelectorLabel,
    openLocationSelector,
    closeLocationSelector
  }

  return (
    <LocationSelectorContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {isLocationSelectorOpen && (
          <LocationSelectorOverlay
            isOpen={isLocationSelectorOpen}
            onClose={closeLocationSelector}
            initialLabel={locationSelectorLabel}
          />
        )}
      </Suspense>
    </LocationSelectorContext.Provider>
  )
}

export default function UserLayout() {
  const location = useLocation()

  const isLoggedIn = localStorage.getItem("user_authenticated") === "true"
  useFCMNotification({ isLoggedIn })

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" })
  }, [location.pathname, location.search, location.hash])

  const showBottomNav =
    location.pathname === "/" ||
    location.pathname === "/user" ||
    location.pathname === "/under-250" ||
    location.pathname === "/user/under-250" ||
    location.pathname === "/profile" ||
    location.pathname === "/user/profile" ||
    location.pathname.startsWith("/user/profile")

  return (
    <div className="theme-orange min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a] transition-colors duration-200">
      <CartProvider>
        <ProfileProvider>
          <OrdersProvider>
            <SearchOverlayProvider>
              <LocationSelectorProvider>
                {!location.pathname.startsWith("/auth/") && (
                  <>
                    <DesktopNavbar />
                    <LocationPrompt />
                  </>
                )}
                <main className={!location.pathname.startsWith("/auth/") ? "md:pt-16" : ""}>
                  <Outlet />
                </main>
                {showBottomNav && <BottomNavigation />}
              </LocationSelectorProvider>
            </SearchOverlayProvider>
          </OrdersProvider>
        </ProfileProvider>
      </CartProvider>
    </div>
  )
}
