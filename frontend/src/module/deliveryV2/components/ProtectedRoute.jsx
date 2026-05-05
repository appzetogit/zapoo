import { Navigate, useLocation } from "react-router-dom"
import { isModuleAuthenticated } from "@food/utils/auth"

export default function ProtectedRoute({ children }) {
  const location = useLocation()
  const isAuthenticated = isModuleAuthenticated("delivery")
  const isLegacyDeliveryPath = location.pathname.startsWith("/delivery")
  const loginPath = isLegacyDeliveryPath ? "/delivery/sign-in" : "/food/delivery/login"

  if (!isAuthenticated) {
    return <Navigate to={loginPath} state={{ from: location.pathname }} replace />
  }

  return children
}
