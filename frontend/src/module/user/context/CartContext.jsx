// src/context/cart-context.jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react"
import { getUserIdFromToken } from "@/lib/utils/auth"

// Default cart context value to prevent errors during initial render
const defaultCartContext = {
  _isProvider: false, // Flag to identify if this is from the actual provider
  cart: [],
  items: [],
  itemCount: 0,
  total: 0,
  lastAddEvent: null,
  lastRemoveEvent: null,
  addToCart: () => {
    console.warn('CartProvider not available - addToCart called');
  },
  removeFromCart: () => {
    console.warn('CartProvider not available - removeFromCart called');
  },
  updateQuantity: () => {
    console.warn('CartProvider not available - updateQuantity called');
  },
  getCartCount: () => 0,
  isInCart: () => false,
  getCartItem: () => null,
  clearCart: () => {
    console.warn('CartProvider not available - clearCart called');
  },
  cleanCartForRestaurant: () => {
    console.warn('CartProvider not available - cleanCartForRestaurant called');
  },
}

const CartContext = createContext(defaultCartContext)

const LEGACY_CART_STORAGE_KEY = "cart"
const GUEST_CART_STORAGE_KEY = "cart_guest"

const getStoredUserCartOwner = () => {
  if (typeof window === "undefined") return null

  try {
    const rawUser = localStorage.getItem("user_user")
    if (rawUser) {
      const parsedUser = JSON.parse(rawUser)
      return (
        parsedUser?._id ||
        parsedUser?.id ||
        parsedUser?.userId ||
        parsedUser?.phone ||
        null
      )
    }
  } catch {
    // ignore malformed user payload and fall back to token
  }

  const token =
    localStorage.getItem("user_accessToken") ||
    localStorage.getItem("accessToken")

  return getUserIdFromToken(token) || null
}

const getCartStorageKey = () => {
  const ownerId = getStoredUserCartOwner()
  return ownerId ? `cart_${String(ownerId)}` : GUEST_CART_STORAGE_KEY
}

const loadCartFromStorage = (storageKey) => {
  if (typeof window === "undefined") return []

  try {
    const saved = localStorage.getItem(storageKey)
    return saved ? JSON.parse(saved) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }) {
  const [cartStorageKey, setCartStorageKey] = useState(() => getCartStorageKey())
  // Safe init (works with SSR and bad JSON)
  const [cart, setCart] = useState(() => loadCartFromStorage(getCartStorageKey()))

  // Track last add event for animation
  const [lastAddEvent, setLastAddEvent] = useState(null)
  // Track last remove event for animation
  const [lastRemoveEvent, setLastRemoveEvent] = useState(null)
  const [isCartHydrated, setIsCartHydrated] = useState(false)

  useEffect(() => {
    setCart(loadCartFromStorage(cartStorageKey))
    setIsCartHydrated(true)
  }, [cartStorageKey])

  useEffect(() => {
    const syncCartOwner = () => {
      const nextStorageKey = getCartStorageKey()
      setCartStorageKey((prev) => {
        if (prev === nextStorageKey) return prev
        setIsCartHydrated(false)
        return nextStorageKey
      })
    }

    syncCartOwner()
    window.addEventListener("userAuthChanged", syncCartOwner)

    return () => {
      window.removeEventListener("userAuthChanged", syncCartOwner)
    }
  }, [])

  // Persist to localStorage whenever cart changes
  useEffect(() => {
    if (!isCartHydrated) return

    try {
      localStorage.setItem(cartStorageKey, JSON.stringify(cart))
      localStorage.removeItem(LEGACY_CART_STORAGE_KEY)
    } catch {
      // ignore storage errors (private mode, quota, etc.)
    }
  }, [cart, cartStorageKey, isCartHydrated])

  const addToCart = (item, sourcePosition = null) => {
    // 1. Validate item has required info
    if (!item || !item.id) {
      console.error('❌ Cannot add item: Invalid item!', item);
      return;
    }

    if (!item.restaurantId && !item.restaurant) {
      console.error('❌ Cannot add item: Missing restaurant information!', item);
      import('sonner').then(({ toast }) => {
        toast.error('Item is missing restaurant information. Please refresh the page.');
      });
      return;
    }

    // 2. Check for restaurant consistency BEFORE updating state
    // This avoids throwing inside the functional updater which can crash the app
    if (cart.length > 0) {
      const firstItemRestaurantId = cart[0]?.restaurantId;
      const firstItemRestaurantName = cart[0]?.restaurant;

      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const firstResNameNorm = normalizeName(firstItemRestaurantName);
      const newResNameNorm = normalizeName(item.restaurant);

      const normalizeId = (id) => id ? String(id) : null;
      const firstResIdNorm = normalizeId(firstItemRestaurantId);
      const newResIdNorm = normalizeId(item.restaurantId);

      let isMismatch = false;
      if (firstResNameNorm && newResNameNorm) {
        if (firstResNameNorm !== newResNameNorm) isMismatch = true;
      } else if (firstResIdNorm && newResIdNorm) {
        if (firstResIdNorm !== newResIdNorm) isMismatch = true;
      }

      if (isMismatch) {
        console.error('❌ Restaurant mismatch!', {
          cart: firstItemRestaurantName,
          new: item.restaurant
        });
        import('sonner').then(({ toast }) => {
          toast.error(`Cart already contains items from "${firstItemRestaurantName || 'another restaurant'}". Please clear cart or complete order first.`);
        });
        return;
      }
    }

    // 3. Trigger animation side effect (safely outside updater)
    if (sourcePosition) {
      setLastAddEvent({
        product: {
          id: item.id,
          name: item.name,
          imageUrl: item.image || item.imageUrl,
        },
        sourcePosition,
      });
      setTimeout(() => setLastAddEvent(null), 1500);
    }

    // 4. Update the cart state
    setCart((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      if (existing) {
        return prev.map((i) =>
          i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  }

  const removeFromCart = (itemId, sourcePosition = null, productInfo = null) => {
    // Trigger animation side effect
    if (sourcePosition && productInfo) {
      setLastRemoveEvent({
        product: {
          id: productInfo.id || itemId,
          name: productInfo.name,
          imageUrl: productInfo.imageUrl || productInfo.image,
        },
        sourcePosition,
      });
      setTimeout(() => setLastRemoveEvent(null), 1500);
    }

    setCart((prev) => prev.filter((i) => i.id !== itemId));
  }

  const updateQuantity = (itemId, quantity, sourcePosition = null, productInfo = null) => {
    // Trigger animation side effect for decreases/removals
    if (sourcePosition && productInfo) {
      const existingItem = cart.find(i => i.id === itemId);
      if (existingItem && quantity < existingItem.quantity) {
        setLastRemoveEvent({
          product: {
            id: productInfo.id || itemId,
            name: productInfo.name,
            imageUrl: productInfo.imageUrl || productInfo.image,
          },
          sourcePosition,
        });
        setTimeout(() => setLastRemoveEvent(null), 1500);
      }
    }

    if (quantity <= 0) {
      setCart((prev) => prev.filter((i) => i.id !== itemId));
    } else {
      setCart((prev) => prev.map((i) => (i.id === itemId ? { ...i, quantity } : i)));
    }
  }

  const getCartCount = () =>
    cart.reduce((total, item) => total + (item.quantity || 0), 0)

  const isInCart = (itemId) => cart.some((i) => i.id === itemId)

  const getCartItem = (itemId) => cart.find((i) => i.id === itemId)

  const clearCart = () => setCart([])

  // Clean cart to remove items from different restaurants
  // Keeps only items from the specified restaurant
  const cleanCartForRestaurant = (restaurantId, restaurantName) => {
    setCart((prev) => {
      if (prev.length === 0) return prev;

      // Normalize restaurant name for comparison
      const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
      const targetRestaurantNameNormalized = normalizeName(restaurantName);

      // Filter cart to keep only items from the target restaurant
      const cleanedCart = prev.filter((item) => {
        const itemRestaurantId = item?.restaurantId;
        const itemRestaurantName = item?.restaurant;
        const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);

        // Check by restaurant name first (more reliable)
        if (targetRestaurantNameNormalized && itemRestaurantNameNormalized) {
          return itemRestaurantNameNormalized === targetRestaurantNameNormalized;
        }
        // Fallback to ID comparison
        if (restaurantId && itemRestaurantId) {
          return itemRestaurantId === restaurantId ||
            itemRestaurantId === restaurantId.toString() ||
            itemRestaurantId.toString() === restaurantId;
        }
        // If no match, remove item
        return false;
      });

      if (cleanedCart.length !== prev.length) {
        console.warn('🧹 Cleaned cart: Removed items from different restaurants', {
          before: prev.length,
          after: cleanedCart.length,
          removed: prev.length - cleanedCart.length
        });
      }

      return cleanedCart;
    });
  }

  // Validate and clean cart on mount/load to prevent multiple restaurant items
  // This runs only once on initial load to clean up any corrupted cart data from localStorage
  useEffect(() => {
    if (cart.length === 0) return;

    // Get unique restaurant IDs and names
    const restaurantIds = cart.map(item => item.restaurantId).filter(Boolean);
    const restaurantNames = cart.map(item => item.restaurant).filter(Boolean);
    const uniqueRestaurantIds = [...new Set(restaurantIds)];
    const uniqueRestaurantNames = [...new Set(restaurantNames)];

    // Normalize restaurant names for comparison
    const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
    const uniqueRestaurantNamesNormalized = uniqueRestaurantNames.map(normalizeName);
    const uniqueRestaurantNamesSet = new Set(uniqueRestaurantNamesNormalized);

    // Check if cart has items from multiple restaurants
    if (uniqueRestaurantIds.length > 1 || uniqueRestaurantNamesSet.size > 1) {
      console.warn('⚠️ Cart contains items from multiple restaurants. Cleaning cart...', {
        restaurantIds: uniqueRestaurantIds,
        restaurantNames: uniqueRestaurantNames
      });

      // Keep items from the first restaurant (most recent or first in cart)
      const firstRestaurantId = uniqueRestaurantIds[0];
      const firstRestaurantName = uniqueRestaurantNames[0];

      setCart((prev) => {
        const normalizeName = (name) => name ? name.trim().toLowerCase() : '';
        const firstRestaurantNameNormalized = normalizeName(firstRestaurantName);

        return prev.filter((item) => {
          const itemRestaurantId = item?.restaurantId;
          const itemRestaurantName = item?.restaurant;
          const itemRestaurantNameNormalized = normalizeName(itemRestaurantName);

          // Check by restaurant name first
          if (firstRestaurantNameNormalized && itemRestaurantNameNormalized) {
            return itemRestaurantNameNormalized === firstRestaurantNameNormalized;
          }
          // Fallback to ID comparison
          if (firstRestaurantId && itemRestaurantId) {
            return itemRestaurantId === firstRestaurantId ||
              itemRestaurantId === firstRestaurantId.toString() ||
              itemRestaurantId.toString() === firstRestaurantId;
          }
          return false;
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount to clean up localStorage data

  // Transform cart to match AddToCartAnimation expected structure
  const cartForAnimation = useMemo(() => {
    const items = cart.map(item => ({
      product: {
        id: item.id,
        name: item.name,
        imageUrl: item.image || item.imageUrl,
      },
      quantity: item.quantity || 1,
    }))

    const itemCount = cart.reduce((total, item) => total + (item.quantity || 0), 0)
    const total = cart.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 0), 0)

    return {
      items,
      itemCount,
      total,
    }
  }, [cart])

  const value = useMemo(
    () => ({
      _isProvider: true, // Flag to identify this is from the actual provider
      // Keep original cart array for backward compatibility
      cart,
      // Add animation-compatible structure
      items: cartForAnimation.items,
      itemCount: cartForAnimation.itemCount,
      total: cartForAnimation.total,
      lastAddEvent,
      lastRemoveEvent,
      addToCart,
      removeFromCart,
      updateQuantity,
      getCartCount,
      isInCart,
      getCartItem,
      clearCart,
      cleanCartForRestaurant,
    }),
    [cart, cartForAnimation, lastAddEvent, lastRemoveEvent]
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  // Check if context is from the actual provider by checking the _isProvider flag
  if (!context || context._isProvider !== true) {
    // In development, log a warning but don't throw to prevent crashes
    if (process.env.NODE_ENV === 'development') {
      console.warn('⚠️ useCart called outside CartProvider. Using default values.');
      console.warn('💡 Make sure the component is rendered inside UserLayout which provides CartProvider.');
    }
    // Return default context instead of throwing
    return defaultCartContext
  }
  return context
}
