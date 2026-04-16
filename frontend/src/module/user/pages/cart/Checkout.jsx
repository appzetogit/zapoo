import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

import { CheckCircle, MapPin, CreditCard, ArrowLeft } from "lucide-react"
import { Link } from "react-router-dom"
import AnimatedPage from "../../components/AnimatedPage"
import ScrollReveal from "../../components/ScrollReveal"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useCart } from "../../context/CartContext"
import { useProfile } from "../../context/ProfileContext"
import { orderAPI } from "@/lib/api"
import { initRazorpayPayment } from "@/lib/utils/razorpay"
import { getCompanyNameAsync } from "@/lib/utils/businessSettings"
import GstBreakdownDialog from "../../components/GstBreakdownDialog"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"

function normalizeCheckoutPaymentMethod(pm) {
  if (!pm) return "razorpay"
  const t = String(pm.type || "").toLowerCase()
  if (t === "wallet") return "wallet"
  if (t === "cash" || t === "cod") return "cash"
  return "razorpay"
}

export default function Checkout() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { cart, clearCart } = useCart()
  const { getDefaultAddress, getDefaultPaymentMethod, addresses, paymentMethods, userProfile } = useProfile()
  const [selectedAddress, setSelectedAddress] = useState(getDefaultAddress()?.id || "")
  const [selectedPayment, setSelectedPayment] = useState(getDefaultPaymentMethod()?.id || "")
  const [isPlacingOrder, setIsPlacingOrder] = useState(false)
  const [showGstBreakdown, setShowGstBreakdown] = useState(false)
  const [pricing, setPricing] = useState({
    subtotal: 0,
    deliveryFee: 0,
    platformFee: 0,
    gst: 0,
    total: 0,
    discount: 0,
    couponCode: null,
  })
  const [isCalculating, setIsCalculating] = useState(false)

  const defaultAddress = addresses.find(addr => addr.id === selectedAddress) || getDefaultAddress()
  const defaultPayment = paymentMethods.find(pm => pm.id === selectedPayment) || getDefaultPaymentMethod()

  useEffect(() => {
    const calculatePricing = async () => {
      if (cart.length === 0 || !selectedAddress) return

      setIsCalculating(true)
      try {
        const items = cart.map(item => ({
          itemId: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          image: item.image,
          description: item.description,
          isVeg: item.isVeg !== false,
          isRecommended: Boolean(item.isRecommended),
        }))

        const response = await orderAPI.calculateOrder({
          items,
          restaurantId: cart[0]?.restaurantId,
          deliveryAddress: defaultAddress,
          deliveryFleet: "standard",
        })

        const p = response?.data?.data?.pricing
        if (response?.data?.success && p) {
          setPricing({
            subtotal: p.subtotal,
            deliveryFee: p.deliveryFee,
            platformFee: p.platformFee,
            gst: p.tax,
            total: p.total,
            discount: p.discount || 0,
            couponCode: p.appliedCoupon?.code || null,
          })
        }
      } catch (error) {
        console.error("Error calculating pricing:", error)
      } finally {
        setIsCalculating(false)
      }
    }

    calculatePricing()
  }, [cart, selectedAddress, defaultAddress])

  const handlePlaceOrder = async () => {
    if (!selectedAddress || !selectedPayment) {
      toast.error(t("user.checkout.toast.selectAddressAndPayment"))
      return
    }

    if (cart.length === 0) {
      toast.error(t("user.checkout.toast.cartEmpty"))
      return
    }

    if (!defaultAddress) {
      toast.error(t("user.checkout.toast.invalidDeliveryAddress"))
      return
    }

    const restaurantId = cart[0]?.restaurantId
    if (!restaurantId) {
      toast.error(t("user.checkout.toast.missingRestaurant"))
      return
    }

    setIsPlacingOrder(true)

    try {
      const paymentMethod = normalizeCheckoutPaymentMethod(defaultPayment)
      const items = cart.map(item => ({
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: item.quantity || 1,
        image: item.image || "",
        description: item.description || "",
        isVeg: item.isVeg !== false,
        isRecommended: Boolean(item.isRecommended),
      }))

      const orderPricing = {
        subtotal: pricing.subtotal,
        deliveryFee: pricing.deliveryFee,
        tax: pricing.gst,
        platformFee: pricing.platformFee,
        discount: pricing.discount,
        total: pricing.total,
        couponCode: pricing.couponCode,
      }

      const response = await orderAPI.createOrder({
        items,
        address: defaultAddress,
        restaurantId,
        restaurantName: cart[0]?.restaurant,
        pricing: orderPricing,
        paymentMethod,
        deliveryFleet: "standard",
        sendCutlery: true,
      })


      const order = response.data?.data?.order || response.data?.order
      const razorpay = response.data?.data?.razorpay || response.data?.razorpay
      const razorpayOrderId = response.data?.razorpay?.orderId || response.data?.data?.razorpay?.orderId

      if (paymentMethod === "cash") {
        toast.success(t("user.checkout.toast.orderPlacedCod"))
        clearCart()
        navigate(`/user/orders/${order?.orderId || order?.id}?confirmed=true`)
        setIsPlacingOrder(false)
        return
      }

      if (paymentMethod === "wallet") {
        toast.success(t("user.checkout.toast.orderPlacedWallet"))
        clearCart()
        navigate(`/user/orders/${order?.orderId || order?.id}?confirmed=true`)
        setIsPlacingOrder(false)
        return
      }

      if (!razorpay?.orderId || !razorpay?.key) {
        throw new Error(razorpay ? t("user.checkout.toast.razorpayNotConfigured") : t("user.checkout.toast.failedToStartPayment"))
      }

      const userPhone = userProfile?.phone || defaultAddress?.phone || ""
      const formattedPhone = userPhone.replace(/\D/g, "").slice(-10)
      const companyName = await getCompanyNameAsync()

      await initRazorpayPayment({
        key: razorpay.key,
        amount: razorpay.amount,
        currency: razorpay.currency || "INR",
        order_id: razorpayOrderId,
        name: companyName,
        description: `Order ${order.orderId} - ₹${(razorpay.amount / 100).toFixed(2)}`,
        prefill: {
          name: userProfile?.name || "",
          email: userProfile?.email || "",
          contact: formattedPhone,
        },
        notes: {
          orderId: order.orderId,
          userId: userProfile?.id || "",
          restaurantId: String(restaurantId),
        },
        handler: async (response) => {
          try {
            const verifyResponse = await orderAPI.verifyPayment({
              orderId: order.id,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            if (verifyResponse.data.success) {
              toast.success(t("user.checkout.toast.paymentSuccessful"))
              clearCart()
              navigate(`/user/orders/${order.orderId}?confirmed=true`)
            } else {
              throw new Error(verifyResponse.data.message || t("user.checkout.toast.verificationFailed"))
            }
          } catch (err) {
            console.error(err)
            toast.error(err?.response?.data?.message || err.message || t("user.checkout.toast.paymentVerificationFailed"))
          } finally {
            setIsPlacingOrder(false)
          }
        },
        onError: (error) => {
          if (error?.code !== "PAYMENT_CANCELLED" && error?.message !== "PAYMENT_CANCELLED") {
            toast.error(error?.description || error?.message || t("user.checkout.toast.paymentFailed"))
          }
          setIsPlacingOrder(false)
        },
        onClose: () => setIsPlacingOrder(false),
      })
    } catch (err) {
      console.error("Order creation failed", err)
      toast.error(err?.response?.data?.message || err.message || t("user.checkout.toast.failedToPlaceOrder"))
      setIsPlacingOrder(false)
    }
  }

  if (cart.length === 0) {
    return (
      <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="bg-white dark:bg-[#1a1a1a] border-0 dark:border-gray-800">
            <CardHeader>
              <CardTitle className="text-base sm:text-lg md:text-xl dark:text-white">{t("user.checkout.title")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <p className="text-muted-foreground text-lg mb-4 dark:text-gray-400">{t("user.checkout.yourCartIsEmpty")}</p>
                <Link to="/user/cart">
                  <Button>{t("user.checkout.goToCart")}</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </AnimatedPage>
    )
  }

  return (
    <AnimatedPage className="min-h-screen bg-gradient-to-b from-yellow-50/30 via-white to-orange-50/20 dark:from-[#0a0a0a] dark:via-[#1a1a1a] dark:to-[#0a0a0a] p-4 sm:p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6 md:space-y-8">
        <ScrollReveal>
          <div className="flex items-center gap-4 mb-6 md:mb-8">
            <Link to="/user/cart">
              <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 md:h-10 md:w-10">
                <ArrowLeft className="h-5 w-5 md:h-6 md:w-6" />
              </Button>
            </Link>
            <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold dark:text-white">{t("user.checkout.title")}</h1>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
          {/* Left Column - Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Delivery Address */}
            <ScrollReveal delay={0.1}>
              <Card className="bg-white dark:bg-[#1a1a1a] border-0 dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-yellow-600" />
                    <span className="dark:text-white">{t("user.checkout.deliveryAddress")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {addresses.length > 0 ? (
                    <div className="space-y-3">
                      {addresses.map((address) => {
                        const isSelected = selectedAddress === address.id
                        const addressString = [
                          address.street,
                          address.additionalDetails,
                          `${address.city}, ${address.state} ${address.zipCode}`
                        ].filter(Boolean).join(", ")

                        return (
                          <div
                            key={address.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                              ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
                              : "border-gray-200 dark:border-gray-700 hover:border-yellow-300 dark:hover:border-yellow-500"
                              }`}
                            onClick={() => setSelectedAddress(address.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                {address.isDefault && (
                                  <Badge className="mb-2 bg-yellow-500 text-white">{t("user.checkout.default")}</Badge>
                                )}
                                <p className="text-sm font-medium">{addressString}</p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-yellow-600" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">{t("user.checkout.noAddressesSaved")}</p>
                      <Link to="/user/profile/addresses/new">
                        <Button>{t("user.checkout.addAddress")}</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>

            {/* Payment Method */}
            <ScrollReveal delay={0.2}>
              <Card className="bg-white dark:bg-[#1a1a1a] border-0 dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-yellow-600" />
                    <span className="dark:text-white">{t("user.checkout.paymentMethod")}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {paymentMethods.length > 0 ? (
                    <div className="space-y-3">
                      {paymentMethods.map((payment) => {
                        const isSelected = selectedPayment === payment.id
                        const cardNumber = `**** **** **** ${payment.cardNumber}`

                        return (
                          <div
                            key={payment.id}
                            className={`border-2 rounded-lg p-4 cursor-pointer transition-colors ${isSelected
                              ? "border-yellow-500 bg-yellow-50"
                              : "border-gray-200 hover:border-yellow-300"
                              }`}
                            onClick={() => setSelectedPayment(payment.id)}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  {payment.isDefault && (
                                    <Badge className="bg-yellow-500 text-white">{t("user.checkout.default")}</Badge>
                                  )}
                                  <Badge variant="outline" className="capitalize">
                                    {payment.type}
                                  </Badge>
                                </div>
                                <p className="font-semibold">{cardNumber}</p>
                                <p className="text-sm text-muted-foreground">
                                  {payment.cardHolder} • {t("user.checkout.expires")} {payment.expiryMonth}/{payment.expiryYear.slice(-2)}
                                </p>
                              </div>
                              {isSelected && (
                                <CheckCircle className="h-5 w-5 text-yellow-600" />
                              )}
                            </div>
                          </div>
                        )
                      })}
                      <Link to="/user/profile/payments">
                        <Button variant="outline" className="w-full">
                          {t("user.checkout.managePaymentMethods")}
                        </Button>
                      </Link>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">{t("user.checkout.noPaymentMethodsSaved")}</p>
                      <Link to="/user/profile/payments/new">
                        <Button>{t("user.checkout.addPaymentMethod")}</Button>
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>

          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <ScrollReveal delay={0.3}>
              <Card className="sticky top-4 md:top-6 dark:bg-[#1a1a1a] dark:border-gray-800">
                <CardHeader>
                  <CardTitle className="text-base md:text-lg lg:text-xl dark:text-white">{t("user.checkout.orderSummary")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 md:space-y-6">
                  <div className="space-y-3 md:space-y-4 max-h-64 md:max-h-80 overflow-y-auto">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 md:gap-4 pb-3 md:pb-4 border-b dark:border-gray-700">
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 md:w-20 md:h-20 object-cover rounded-lg"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-sm md:text-base dark:text-gray-200">{item.name}</p>
                          <p className="text-xs md:text-sm text-muted-foreground">
                            ₹{Number(item.price || 0).toFixed(0)} × {item.quantity}
                          </p>
                        </div>
                        <p className="font-semibold text-sm md:text-base dark:text-gray-200">
                          ₹{(Number(item.price || 0) * (item.quantity || 1)).toFixed(0)}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2 md:space-y-3 pt-4 md:pt-6 border-t dark:border-gray-700">
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">{t("user.checkout.subtotal")}</span>
                      <span className="dark:text-gray-200">₹{pricing.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">{t("user.checkout.deliveryFee")}</span>
                      <span className="dark:text-gray-200">
                        {isCalculating ? t("user.checkout.calculating") : `₹${pricing.deliveryFee.toFixed(2)}`}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm md:text-base">
                      <span className="text-muted-foreground">{t("user.checkout.platformFee")}</span>
                      <span className="dark:text-gray-200">₹{pricing.platformFee.toFixed(2)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowGstBreakdown(true)}
                      className="flex w-full items-center justify-between text-sm md:text-base text-left"
                    >
                      <span className="text-muted-foreground underline underline-offset-4 decoration-dotted">
                        GST (govt. taxes)
                      </span>
                      <span className="dark:text-gray-200">₹{pricing.gst.toFixed(2)}</span>
                    </button>
                    <div className="flex justify-between font-bold text-lg md:text-xl lg:text-2xl pt-2 md:pt-3 border-t dark:border-gray-700">
                      <span className="dark:text-white">{t("user.checkout.total")}</span>
                      <span className="text-yellow-600 dark:text-yellow-400">
                        {isCalculating ? "..." : `₹${pricing.total.toFixed(2)}`}
                      </span>
                    </div>
                  </div>

                  <Button
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white mt-4 md:mt-6 h-11 md:h-12 text-sm md:text-base"
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder || !selectedAddress || !selectedPayment}
                  >
                    {isPlacingOrder ? t("user.checkout.placingOrder") : t("user.checkout.placeOrder")}
                  </Button>
                </CardContent>
              </Card>
            </ScrollReveal>
          </div>
        </div>
        <GstBreakdownDialog
          open={showGstBreakdown}
          onOpenChange={setShowGstBreakdown}
          pricing={{
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            deliveryFee: pricing.deliveryFee,
            platformFee: pricing.platformFee,
          }}
        />
      </div>
    </AnimatedPage>
  )
}
