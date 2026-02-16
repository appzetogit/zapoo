
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Check, Shield, Star, Zap, Clock, AlertCircle, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import RestaurantNavbar from "../components/RestaurantNavbar"
import BottomNavbar from "../components/BottomNavbar"

export default function BusinessPlanPage() {
  const navigate = useNavigate()
  const [plans, setPlans] = useState([])
  const [currentSubscription, setCurrentSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const token = localStorage.getItem('token') || localStorage.getItem('restaurant_accessToken') // Check for restaurant token

      // Fetch plans
      const plansRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/subscription/plans`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const plansData = await plansRes.json()

      // Fetch current subscription
      const subRes = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/subscription/my-subscription`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const subData = await subRes.json()

      if (plansData.success) {
        setPlans(plansData.data)
      }

      if (subData.success) {
        setCurrentSubscription(subData.data)
      }
    } catch (err) {
      console.error("Error fetching subscription data:", err)
      // setError("Failed to load subscription details. Please try again.")
      // Dont show error, just show empty or default state if backend not ready
    } finally {
      setLoading(false)
    }
  }

  const handleSubscribe = async (planId) => {
    try {
      setProcessing(true)
      const token = localStorage.getItem('token') || localStorage.getItem('restaurant_accessToken')

      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/subscription/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ planId, paymentMethod: 'razorpay' })
      })

      const data = await response.json()

      if (data.success) {
        alert("Subscription successful!")
        fetchData() // Refresh data
      } else {
        alert(data.message || "Subscription failed")
      }
    } catch (err) {
      console.error("Error subscribing:", err)
      alert("An error occurred. Please try again.")
    } finally {
      setProcessing(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm("Are you sure you want to cancel auto-renewal? Your plan will remain active until the end date.")) return

    try {
      setProcessing(true)
      const token = localStorage.getItem('token') || localStorage.getItem('restaurant_accessToken')

      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/subscription/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        alert("Subscription cancelled successfully.")
        fetchData()
      } else {
        alert(data.message || "Cancellation failed")
      }
    } catch (err) {
      console.error("Error cancelling:", err)
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const currentPlanId = currentSubscription?.planId?._id || currentSubscription?.planId

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white border-b border-gray-200 px-4 py-3 sticky top-0 z-50 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-bold text-gray-900 flex-1 text-center -ml-8">
          My Business Plan
        </h1>
      </div>

      <main className="container mx-auto px-4 py-6 max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight mb-2">Upgrade Your Business</h1>
          <p className="text-muted-foreground">Choose the plan that fits your growth.</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Current Subscription Status */}
        {currentSubscription && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Current Plan: {currentSubscription.planId?.name || "Active Plan"}
                    {currentSubscription.status === 'active' && <Badge className="bg-green-500">Active</Badge>}
                  </CardTitle>
                  <CardDescription>
                    Valid until {new Date(currentSubscription.endDate).toLocaleDateString()}
                  </CardDescription>
                </div>
                {currentSubscription.autoRenew && (
                  <Button variant="outline" size="sm" onClick={handleCancel} disabled={processing}>
                    Cancel Auto-renewal
                  </Button>
                )}
              </div>
            </CardHeader>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.length === 0 && !loading && (
            <div className="col-span-3 text-center py-10">
              <p className="text-muted-foreground">No subscription plans available at the moment.</p>
            </div>
          )}

          {plans.map((plan) => {
            const isCurrent = currentPlanId === plan._id

            return (
              <Card key={plan._id} className={`flex flex-col relative ${isCurrent ? 'border-primary ring-1 ring-primary' : ''}`}>
                {isCurrent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">Current Plan</Badge>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">₹{plan.price}</span>
                    <span className="text-muted-foreground">/{plan.durationInDays} days</span>
                  </div>
                  {plan.originalPrice && plan.originalPrice !== plan.price && (
                    <p className="text-sm text-green-600 font-medium">Zone-based pricing applied</p>
                  )}
                </CardHeader>

                <CardContent className="flex-1">
                  <ul className="space-y-3">
                    {plan.features?.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <Check className="h-5 w-5 text-green-500 shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm">0% Commission</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-5 w-5 text-green-500 shrink-0" />
                      <span className="text-sm">Zone-based Delivery</span>
                    </li>
                  </ul>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || processing}
                    onClick={() => handleSubscribe(plan._id)}
                  >
                    {isCurrent ? "Active" : "Subscribe Now"}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </main>

      <BottomNavbar />
    </div>
  )
}
