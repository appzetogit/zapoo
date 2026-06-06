import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@food/utils/auth"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const isAuthenticated = isModuleAuthenticated("delivery")
  const isLegacyDeliveryPath = location.pathname.startsWith("/delivery")
  const loginPath = isLegacyDeliveryPath ? "/delivery/sign-in" : "/food/delivery/login"
  let cachedUser = null

  try {
    const rawUser = localStorage.getItem("delivery_user")
    cachedUser = rawUser ? JSON.parse(rawUser) : null
  } catch {}

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  if (cachedUser?.status === "blocked" || cachedUser?.rejectionReason) {
    return <Navigate to="/food/delivery/rejected" state={{ from: location.pathname }} replace />
  }

  return children
}
