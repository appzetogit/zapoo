import SupportPage from "@/components/SupportPage"
import { useEffect } from "react"
import { useLocation } from "react-router-dom"

export default function Support() {
  const location = useLocation()
  const backTo = location.state?.backTo || "/restaurant/login"

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return <SupportPage subtitle="RESTAURANT SUPPORT" backTo={backTo} />
}
