import { useEffect, useRef, useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Home, ShoppingBag, Store, Wallet, Menu } from "lucide-react"

export default function BottomNavbar({ onMenuClick }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [isNavVisible, setIsNavVisible] = useState(true)
  const lastScrollYRef = useRef(0)

  useEffect(() => {
    lastScrollYRef.current = window.scrollY || 0

    const onScroll = () => {
      const currentY = window.scrollY || 0
      const delta = currentY - lastScrollYRef.current
      const threshold = 8

      if (currentY <= 20) {
        setIsNavVisible(true)
      } else if (delta > threshold) {
        setIsNavVisible(false)
      } else if (delta < -threshold) {
        setIsNavVisible(true)
      }

      lastScrollYRef.current = currentY
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  const isActive = (path) => {
    if (path === "/restaurant") {
      return location.pathname === "/restaurant"
    }
    return location.pathname.startsWith(path)
  }

  const navItems = [
    { id: "home", icon: Home, route: "/restaurant", active: isActive("/restaurant"), label: "Home" },
    { id: "orders", icon: ShoppingBag, route: "/restaurant/orders", active: isActive("/restaurant/orders"), label: "Orders" },
    { id: "store", icon: Store, route: "/restaurant/details", active: isActive("/restaurant/details"), label: "Store", isCenter: true },
    { id: "wallet", icon: Wallet, route: "/restaurant/wallet", active: isActive("/restaurant/wallet"), label: "Wallet" },
    { id: "menu", icon: Menu, route: "/restaurant/food/all", active: isActive("/restaurant/food/all"), label: "Menu", isMenu: true },
  ]

  return (
    <div
      className={`md:hidden fixed bottom-0 left-0 right-0 z-50 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition-transform duration-200 ease-out ${isNavVisible ? "translate-y-0" : "translate-y-[120%] pointer-events-none"}`}
    >
      <div className="rounded-2xl border border-slate-200/80 bg-white/95 backdrop-blur-md shadow-[0_10px_28px_rgba(15,23,42,0.14)] px-2 py-1.5">
        <div className="flex items-end justify-between gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isItemActive = item.active
            const iconClass = item.isCenter
              ? `w-[18px] h-[18px] ${isItemActive ? "text-white" : "text-slate-700"}`
              : `w-[18px] h-[18px] ${isItemActive ? "text-blue-600" : "text-slate-500"}`

            return (
              <button
                key={item.id}
                type="button"
                onClick={(e) => {
                  if (item.isMenu) {
                    e.preventDefault()
                    e.stopPropagation()
                    if (onMenuClick && typeof onMenuClick === "function") {
                      onMenuClick(e)
                      return
                    }
                  }
                  navigate(item.route)
                }}
                className={`relative flex min-w-0 flex-1 flex-col items-center justify-center rounded-xl py-1.5 transition-all ${item.isCenter ? "-mt-6" : ""}`}
              >
                {item.isCenter ? (
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full border shadow-md ${isItemActive ? "bg-blue-600 border-blue-600" : "bg-white border-slate-200"}`}>
                    <Icon className={iconClass} />
                  </div>
                ) : (
                  <>
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${isItemActive ? "bg-blue-50" : "bg-transparent"}`}>
                      <Icon className={iconClass} />
                    </div>
                    <span className={`mt-0.5 text-[10px] leading-none ${isItemActive ? "font-semibold text-blue-700" : "text-slate-500"}`}>
                      {item.label}
                    </span>
                  </>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
