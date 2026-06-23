import { createContext, useContext, useState, useEffect, useMemo, useCallback, useRef } from "react"
import { authAPI, userAPI } from "@/lib/api"

const ProfileContext = createContext(null)

export function ProfileProvider({ children }) {
  const [userProfile, setUserProfile] = useState(() => {
    // First, try to get from localStorage (user_user from auth)
    const userStr = localStorage.getItem("user_user")
    if (userStr) {
      try {
        return JSON.parse(userStr)
      } catch (e) {
        console.error("Error parsing user_user from localStorage:", e)
      }
    }

    // Fallback to userProfile from localStorage
    const saved = localStorage.getItem("userProfile")
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch (e) {
        console.error("Error parsing userProfile from localStorage:", e)
      }
    }

    // Default empty profile
    return null
  })

  const [loading, setLoading] = useState(true)

  const [addresses, setAddresses] = useState(() => {
    const saved = localStorage.getItem("userAddresses")
    if (!saved) {
      return []
    }

    try {
      return JSON.parse(saved)
    } catch (error) {
      console.error("Error parsing userAddresses from localStorage:", error)
      return []
    }
  })

  const [paymentMethods, setPaymentMethods] = useState(() => {
    const saved = localStorage.getItem("userPaymentMethods")
    return saved ? JSON.parse(saved) : [
      {
        id: "1",
        cardNumber: "1234",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2025",
        cvv: "123",
        isDefault: true,
        type: "visa",
      },
      {
        id: "2",
        cardNumber: "5678",
        cardHolder: "John Doe",
        expiryMonth: "12",
        expiryYear: "2026",
        cvv: "456",
        isDefault: false,
        type: "mastercard",
      },
    ]
  })

  const [favorites, setFavorites] = useState(() => {
    const saved = localStorage.getItem("userFavorites")
    return saved ? JSON.parse(saved) : []
  })
  const userProfileRef = useRef(userProfile)

  // Dish favorites state - stored in localStorage for persistence
  const [dishFavorites, setDishFavorites] = useState(() => {
    const saved = localStorage.getItem("userDishFavorites")
    return saved ? JSON.parse(saved) : []
  })

  // VegMode state - stored in localStorage for persistence
  const [vegMode, setVegMode] = useState(() => {
    const saved = localStorage.getItem("userVegMode")
    // Default to false (OFF) if not set
    return saved !== null ? saved === "true" : false
  })

  // Appearance state - stored in localStorage for persistence
  const [appearance, setAppearance] = useState(() => {
    const saved = localStorage.getItem("userAppearance")
    // Default to "light" if not set
    return saved || "light"
  })

  // Save to localStorage whenever userProfile, addresses or paymentMethods change
  useEffect(() => {
    localStorage.setItem("userProfile", JSON.stringify(userProfile))
  }, [userProfile])

  useEffect(() => {
    userProfileRef.current = userProfile
  }, [userProfile])

  useEffect(() => {
    localStorage.setItem("userAddresses", JSON.stringify(addresses))
  }, [addresses])

  useEffect(() => {
    localStorage.setItem("userPaymentMethods", JSON.stringify(paymentMethods))
  }, [paymentMethods])

  useEffect(() => {
    localStorage.setItem("userFavorites", JSON.stringify(favorites))
  }, [favorites])

  useEffect(() => {
    localStorage.setItem("userDishFavorites", JSON.stringify(dishFavorites))
  }, [dishFavorites])

  useEffect(() => {
    localStorage.setItem("userVegMode", vegMode.toString())
  }, [vegMode])

  useEffect(() => {
    localStorage.setItem("userAppearance", appearance)
    // Also update appTheme for compatibility with Profile.jsx until it's fully migrated
    localStorage.setItem("appTheme", appearance)

    // Apply theme to document
    const root = document.documentElement;
    if (appearance === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }

    // Keep the app-wide theme context aligned with profile appearance changes
    window.dispatchEvent(new Event("userAppearanceChanged"))
  }, [appearance])

  // Fetch user profile and addresses from API on mount and when authentication changes
  useEffect(() => {
    const fetchUserProfile = async (force = false) => {
      // Check if user is authenticated
      const isAuthenticated = localStorage.getItem("user_authenticated") === "true" ||
        localStorage.getItem("user_accessToken")

      if (!isAuthenticated) {
        setLoading(false)
        return
      }

      // Optimization: Avoid redundant profile fetches
      const lastFetchTime = localStorage.getItem("lastProfileFetchTime")
      const STALE_TIME = 5 * 60 * 1000 // 5 minutes
      const now = Date.now()

      if (!force && lastFetchTime && (now - parseInt(lastFetchTime) < STALE_TIME) && userProfileRef.current) {
        setLoading(false)
        return
      }

      try {
        setLoading(true)

        const [response, addressesResponse] = await Promise.all([
          authAPI.getCurrentUser({ force }),
          userAPI.getAddresses({ force }).catch((error) => {
            console.error("Error fetching addresses:", error)
            return null
          }),
        ])

        const userData = response?.data?.data?.user || response?.data?.user || response?.data
        if (userData) {
          setUserProfile(userData)
          localStorage.setItem("user_user", JSON.stringify(userData))
          localStorage.setItem("userProfile", JSON.stringify(userData))
          localStorage.setItem("lastProfileFetchTime", now.toString())
        }

        try {
          const addressesData = addressesResponse?.data?.data?.addresses || addressesResponse?.data?.addresses || []
          setAddresses(addressesData)
          localStorage.setItem("userAddresses", JSON.stringify(addressesData))
        } catch {
          // Try to load from localStorage as fallback
          const saved = localStorage.getItem("userAddresses")
          if (saved) {
            try {
              setAddresses(JSON.parse(saved))
            } catch (e) {
              console.error("Error parsing saved addresses:", e)
            }
          }
        }
      } catch (error) {
        // Silently handle error - use existing profile from localStorage
        console.error("Error fetching user profile:", error)
        // Try to load from localStorage as fallback
        const saved = localStorage.getItem("userAddresses")
        if (saved) {
          try {
            setAddresses(JSON.parse(saved))
          } catch (e) {
            console.error("Error parsing saved addresses:", e)
          }
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUserProfile()

    // Listen for auth changes - force refresh on login/registration events
    const handleAuthChange = () => {
      fetchUserProfile(true)
    }

    window.addEventListener("userAuthChanged", handleAuthChange)

    return () => {
      window.removeEventListener("userAuthChanged", handleAuthChange)
    }
  }, [])

  // Address functions - memoized with useCallback
  const addAddress = useCallback(async (address) => {
    try {
      const response = await userAPI.addAddress(address)
      const newAddress = response?.data?.data?.address || response?.data?.address

      if (newAddress) {
        setAddresses((prev) => {
          const updated = [...prev, newAddress]
          localStorage.setItem("userAddresses", JSON.stringify(updated))
          return updated
        })
        return newAddress
      }
    } catch (error) {
      console.error("Error adding address:", error)
      throw error
    }
  }, [])

  const updateAddress = useCallback(async (id, updatedAddress) => {
    try {
      const response = await userAPI.updateAddress(id, updatedAddress)
      const updatedAddr = response?.data?.data?.address || response?.data?.address

      if (updatedAddr) {
        setAddresses((prev) => {
          const updated = prev.map((addr) => (addr.id === id ? { ...updatedAddr, id } : addr))
          localStorage.setItem("userAddresses", JSON.stringify(updated))
          return updated
        })
        return updatedAddr
      }
    } catch (error) {
      console.error("Error updating address:", error)
      throw error
    }
  }, [])

  const deleteAddress = useCallback(async (id) => {
    try {
      await userAPI.deleteAddress(id)
      setAddresses((prev) => {
        const newAddresses = prev.filter((addr) => addr.id !== id)
        localStorage.setItem("userAddresses", JSON.stringify(newAddresses))
        return newAddresses
      })
    } catch (error) {
      console.error("Error deleting address:", error)
      throw error
    }
  }, [])

  const setDefaultAddress = useCallback((id) => {
    setAddresses((prev) =>
      prev.map((addr) => ({
        ...addr,
        isDefault: addr.id === id,
      }))
    )
  }, [])

  const getDefaultAddress = useCallback(() => {
    return addresses.find((addr) => addr.isDefault) || addresses[0] || null
  }, [addresses])

  // Payment method functions - memoized with useCallback
  const addPaymentMethod = useCallback((payment) => {
    setPaymentMethods((prev) => {
      const newPayment = {
        ...payment,
        id: Date.now().toString(),
        isDefault: prev.length === 0 ? true : false,
      }
      return [...prev, newPayment]
    })
  }, [])

  const updatePaymentMethod = useCallback((id, updatedPayment) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => (pm.id === id ? { ...pm, ...updatedPayment } : pm))
    )
  }, [])

  const deletePaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) => {
      const paymentToDelete = prev.find((pm) => pm.id === id)
      const newPayments = prev.filter((pm) => pm.id !== id)

      // If deleting default, set first remaining as default
      if (paymentToDelete?.isDefault && newPayments.length > 0) {
        newPayments[0].isDefault = true
      }

      return newPayments
    })
  }, [])

  const setDefaultPaymentMethod = useCallback((id) => {
    setPaymentMethods((prev) =>
      prev.map((pm) => ({
        ...pm,
        isDefault: pm.id === id,
      }))
    )
  }, [])

  const getDefaultPaymentMethod = useCallback(() => {
    return paymentMethods.find((pm) => pm.isDefault) || paymentMethods[0] || null
  }, [paymentMethods])

  const getAddressById = useCallback((id) => {
    return addresses.find((addr) => addr.id === id)
  }, [addresses])

  const getPaymentMethodById = useCallback((id) => {
    return paymentMethods.find((pm) => pm.id === id)
  }, [paymentMethods])

  // Favorites functions - memoized with useCallback
  const addFavorite = useCallback((restaurant) => {
    setFavorites((prev) => {
      if (!prev.find(fav => fav.slug === restaurant.slug)) {
        return [...prev, restaurant]
      }
      return prev
    })
  }, [])

  const removeFavorite = useCallback((slug) => {
    setFavorites((prev) => prev.filter(fav => fav.slug !== slug))
  }, [])

  const isFavorite = useCallback((slug) => {
    return favorites.some(fav => fav.slug === slug)
  }, [favorites])

  const getFavorites = useCallback(() => {
    return favorites
  }, [favorites])

  // Dish favorites functions - memoized with useCallback
  const addDishFavorite = useCallback((dish) => {
    setDishFavorites((prev) => {
      if (!prev.find(fav => fav.id === dish.id && fav.restaurantId === dish.restaurantId)) {
        return [...prev, dish]
      }
      return prev
    })
  }, [])

  const removeDishFavorite = useCallback((dishId, restaurantId) => {
    setDishFavorites((prev) =>
      prev.filter(fav => !(fav.id === dishId && fav.restaurantId === restaurantId))
    )
  }, [])

  const isDishFavorite = useCallback((dishId, restaurantId) => {
    return dishFavorites.some(fav => fav.id === dishId && fav.restaurantId === restaurantId)
  }, [dishFavorites])

  const getDishFavorites = useCallback(() => {
    return dishFavorites
  }, [dishFavorites])

  // User profile functions - memoized with useCallback
  const updateUserProfile = useCallback((updatedProfile) => {
    setUserProfile((prev) => ({ ...prev, ...updatedProfile }))
  }, [])

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(
    () => ({
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      dishFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      appearance,
      setAppearance,
    }),
    [
      userProfile,
      loading,
      updateUserProfile,
      addresses,
      paymentMethods,
      favorites,
      dishFavorites,
      vegMode,
      setVegMode,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
      getDefaultAddress,
      getAddressById,
      addPaymentMethod,
      updatePaymentMethod,
      deletePaymentMethod,
      setDefaultPaymentMethod,
      getDefaultPaymentMethod,
      getPaymentMethodById,
      addFavorite,
      removeFavorite,
      isFavorite,
      getFavorites,
      addDishFavorite,
      removeDishFavorite,
      isDishFavorite,
      getDishFavorites,
      appearance,
      setAppearance,
    ]
  )

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (!context) {
    // Return fallback values instead of throwing error
    // This prevents crashes when ProfileProvider is not available
    console.warn("useProfile called outside ProfileProvider - using fallback values")
    return {
      userProfile: null,
      loading: false,
      updateUserProfile: () => console.warn("ProfileProvider not available"),
      addresses: [],
      paymentMethods: [],
      favorites: [],
      addAddress: () => console.warn("ProfileProvider not available"),
      updateAddress: () => console.warn("ProfileProvider not available"),
      deleteAddress: () => console.warn("ProfileProvider not available"),
      setDefaultAddress: () => console.warn("ProfileProvider not available"),
      getDefaultAddress: () => null,
      getAddressById: () => null,
      addPaymentMethod: () => console.warn("ProfileProvider not available"),
      updatePaymentMethod: () => console.warn("ProfileProvider not available"),
      deletePaymentMethod: () => console.warn("ProfileProvider not available"),
      setDefaultPaymentMethod: () => console.warn("ProfileProvider not available"),
      getDefaultPaymentMethod: () => null,
      getPaymentMethodById: () => null,
      addFavorite: () => console.warn("ProfileProvider not available"),
      removeFavorite: () => console.warn("ProfileProvider not available"),
      isFavorite: () => false,
      getFavorites: () => [],
      dishFavorites: [],
      addDishFavorite: () => console.warn("ProfileProvider not available"),
      removeDishFavorite: () => console.warn("ProfileProvider not available"),
      isDishFavorite: () => false,
      getDishFavorites: () => [],
      vegMode: false,
      setVegMode: () => console.warn("ProfileProvider not available"),
      appearance: "light",
      setAppearance: () => console.warn("ProfileProvider not available")
    }
  }
  return context
}
