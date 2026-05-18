import SupportPage from "@/components/SupportPage"
import { useLocation } from "react-router-dom"

export default function Support() {
  const location = useLocation()
  const backTo = location.state?.backTo || "/restaurant/login"
  return <SupportPage subtitle="RESTAURANT SUPPORT" backTo={backTo} />
}
