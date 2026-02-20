import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ArrowLeft,
  CreditCard,
  Lock,
  CheckCircle,
  Home,
  Heart,
  ShoppingBag,
  Menu,
  ChefHat,
  MapPin,
  Clock,
  Check,
  ChevronRight
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { motion, AnimatePresence } from "framer-motion"

export default function PaymentPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const paymentMethod = searchParams.get("method") || "card"

  const [cardNumber, setCardNumber] = useState("")
  const [cardName, setCardName] = useState("")
  const [expiryDate, setExpiryDate] = useState("")
  const [cvv, setCvv] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  // Get order data from localStorage (set by CheckoutPage)
  const getOrderData = () => {
    const orderData = localStorage.getItem('usermain_current_order')
    if (orderData) {
      try {
        return JSON.parse(orderData)
      } catch (error) {
        console.error('Error parsing order data:', error)
      }
    }
    // Default fallback
    return {
      items: [],
      subtotal: 88.98,
      deliveryFee: 5.00,
      discount: 0,
      total: 93.98,
      deliveryAddress: "202, Princess Centre, 2nd Floor, 6/3, 452001, New Delhi",
      estimatedTime: "30-40 min"
    }
  }

  const [orderData] = useState(getOrderData())
  const totalAmount = orderData.total || 93.98

  // Save order to localStorage
  const saveOrder = () => {
    const newOrder = {
      id: `ORD-${Date.now()}`,
      date: new Date().toISOString(),
      time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      items: orderData.items?.length || 0,
      total: totalAmount,
      status: "Preparing",
      restaurant: "Hungry Puppets", // You can get this from orderData if available
      paymentMethod: paymentMethod,
      orderDetails: orderData
    }

    // Get existing orders
    const savedOrders = localStorage.getItem('usermain_orders')
    let orders = []
    if (savedOrders) {
      try {
        orders = JSON.parse(savedOrders)
      } catch (error) {
        console.error('Error parsing saved orders:', error)
      }
    }

    // Add new order at the beginning
    orders.unshift(newOrder)

    // Save back to localStorage
    localStorage.setItem('usermain_orders', JSON.stringify(orders))

    // Clear current order
    localStorage.removeItem('usermain_current_order')
  }

  // Auto-process Cash on Delivery
  useEffect(() => {
    if (paymentMethod === "cash") {
      setIsProcessing(true)
      setTimeout(() => {
        saveOrder()
        setIsProcessing(false)
        setIsSuccess(true)
        setTimeout(() => {
          navigate('/usermain/orders')
        }, 2000)
      }, 1500)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentMethod, navigate])

  const handleCardNumberChange = (e) => {
    let value = e.target.value.replace(/\s/g, "")
    if (value.length <= 16) {
      value = value.match(/.{1,4}/g)?.join(" ") || value
      setCardNumber(value)
    }
  }

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, "")
    if (value.length <= 4) {
      value = value.match(/.{1,2}/g)?.join("/") || value
      setExpiryDate(value)
    }
  }

  const handleCvvChange = (e) => {
    let value = e.target.value.replace(/\D/g, "")
    if (value.length <= 3) {
      setCvv(value)
    }
  }

  const handlePayment = () => {
    if (paymentMethod === "cash") {
      return // Already handled by useEffect
    }

    if (!cardNumber || !cardName || !expiryDate || !cvv) {
      return
    }

    setIsProcessing(true)

    // Simulate payment processing
    setTimeout(() => {
      saveOrder()
      setIsProcessing(false)
      setIsSuccess(true)

      // Navigate to success page after 2 seconds
      setTimeout(() => {
        navigate('/usermain/orders')
      }, 2000)
    }, 2000)
  }

  if (isSuccess) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-indigo-100 via-white to-emerald-100 flex flex-col items-center justify-center h-screen w-screen overflow-hidden"
        >
          {/* Decorative Floating Elements */}
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-200/30 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-200/30 rounded-full blur-[100px] animate-pulse" />

          {/* Confetti Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                initial={{ y: -20, x: Math.random() * 100 + "%", rotate: 0 }}
                animate={{
                  y: "110vh",
                  rotate: 360,
                  x: (Math.random() * 100 - 10) + "%"
                }}
                transition={{
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  ease: "linear",
                  delay: Math.random() * 3
                }}
                className="absolute w-2 h-4 rounded-sm"
                style={{
                  backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'][Math.floor(Math.random() * 6)],
                }}
              />
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 100, delay: 0.1 }}
            className="relative z-10 w-[92%] max-w-lg bg-white/70 backdrop-blur-3xl border border-white/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] p-8 md:p-12 rounded-[2.5rem] md:rounded-[3.5rem] flex flex-col items-center text-center"
          >
            {/* Success Tick Circle */}
            <div className="relative mb-8 md:mb-10">
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.3 }}
                className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-tr from-emerald-500 to-green-400 rounded-full flex items-center justify-center shadow-[0_20px_40px_-10px_rgba(34,197,94,0.4)] relative z-10"
              >
                <Check className="w-12 h-12 md:w-16 md:h-16 text-white stroke-[3.5px]" />
              </motion.div>

              {/* Animated Rings */}
              {[...Array(2)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: [0, 0.4, 0], scale: [1, 1.6, 2.2] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 + (i * 1.2) }}
                  className="absolute inset-0 border-2 border-green-400 rounded-full"
                />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <h2 className="text-2xl md:text-4xl font-black text-gray-900 mb-3 tracking-tight">
                {paymentMethod === "cash" ? "Order Placed!" : "Payment Successful!"}
              </h2>
              <p className="text-sm md:text-lg text-gray-600 font-medium mb-8 md:mb-10">
                {paymentMethod === "cash"
                  ? "Your order has been placed. Pay cash on delivery."
                  : "Thank you! Your order has been placed successfully."}
              </p>
            </motion.div>

            {/* Order Preview Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
              className="w-full bg-white/60 rounded-3xl p-5 mb-8 md:mb-10 border border-white/50 shadow-sm"
            >
              <div className="flex items-center gap-3 mb-4 last:mb-0">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin className="w-5 h-5 text-indigo-600" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Delivering to</p>
                  <p className="text-sm font-bold text-gray-800 truncate max-w-[200px] md:max-w-[280px]">
                    {orderData.deliveryAddress || "Your Order Location"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-left">
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Estimated Arrival</p>
                  <p className="text-sm font-bold text-gray-800">
                    {orderData.estimatedTime || "30-40 mins"}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.button
              whileHover={{ scale: 1.02, backgroundColor: "rgba(17, 24, 39, 1)" }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              onClick={() => navigate('/usermain/orders')}
              className="w-full h-14 md:h-16 bg-gray-900 text-white rounded-[1.2rem] md:rounded-[1.5rem] font-black text-base md:text-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 group"
            >
              View My Orders
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Show processing for Cash on Delivery
  if (paymentMethod === "cash" && isProcessing) {
    return (
      <div className="min-h-screen bg-[#f6e9dc] flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl p-6 text-center max-w-md w-full shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#ff8100] border-t-transparent mx-auto mb-4"></div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Placing Order...</h2>
          <p className="text-sm text-gray-600">Please wait</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f6e9dc] pb-20 md:pb-24">
      {/* Header */}
      <div className="bg-white sticky top-0 z-50 rounded-b-3xl">
        <div className="px-4 py-2.5 md:py-3 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-4 h-4 md:w-5 md:h-5 text-gray-800" />
          </button>
          <h1 className="text-base md:text-lg font-bold text-gray-900">Payment</h1>
        </div>
      </div>

      {/* Payment Amount */}
      <div className="px-4 py-3 md:py-4">
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs md:text-sm font-medium text-gray-600">Total Amount</span>
            <span className="text-xl md:text-2xl font-bold text-[#ff8100]">${totalAmount.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Card Details Form */}
      <div className="px-4 mb-3 md:mb-4">
        <div className="bg-white rounded-xl p-3 md:p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3 md:mb-4">
            <CreditCard className="w-4 h-4 md:w-5 md:h-5 text-[#ff8100]" />
            <h3 className="text-xs md:text-sm font-bold text-gray-900">Card Details</h3>
          </div>

          <div className="space-y-3 md:space-y-4">
            {/* Card Number */}
            <div>
              <label className="text-[10px] md:text-xs font-medium text-gray-700 mb-1 block">Card Number</label>
              <Input
                type="text"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={handleCardNumberChange}
                maxLength={19}
                className="h-10 md:h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-[#ff8100] text-sm"
              />
            </div>

            {/* Card Holder Name */}
            <div>
              <label className="text-[10px] md:text-xs font-medium text-gray-700 mb-1 block">Card Holder Name</label>
              <Input
                type="text"
                placeholder="John Doe"
                value={cardName}
                onChange={(e) => setCardName(e.target.value)}
                className="h-10 md:h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-[#ff8100] text-sm"
              />
            </div>

            {/* Expiry and CVV */}
            <div className="grid grid-cols-2 gap-2 md:gap-3">
              <div>
                <label className="text-[10px] md:text-xs font-medium text-gray-700 mb-1 block">Expiry Date</label>
                <Input
                  type="text"
                  placeholder="MM/YY"
                  value={expiryDate}
                  onChange={handleExpiryChange}
                  maxLength={5}
                  className="h-10 md:h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-[#ff8100] text-sm"
                />
              </div>
              <div>
                <label className="text-[10px] md:text-xs font-medium text-gray-700 mb-1 block">CVV</label>
                <Input
                  type="text"
                  placeholder="123"
                  value={cvv}
                  onChange={handleCvvChange}
                  maxLength={3}
                  className="h-10 md:h-12 bg-gray-50 border-gray-200 focus:bg-white focus:border-[#ff8100] text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Info */}
      <div className="px-4 mb-3 md:mb-4">
        <div className="flex items-center gap-2 text-[10px] md:text-xs text-gray-600">
          <Lock className="w-3 h-3 md:w-4 md:h-4" />
          <span>Your payment is secured and encrypted</span>
        </div>
      </div>

      {/* Pay Button */}
      <div className="px-4 pb-16 md:pb-20">
        <Button
          className="w-full bg-[#ff8100] hover:bg-[#e67300] text-white font-bold py-3 md:py-4 rounded-xl text-sm md:text-base disabled:opacity-50"
          onClick={handlePayment}
          disabled={isProcessing || !cardNumber || !cardName || !expiryDate || !cvv}
        >
          {isProcessing ? "Processing..." : `Pay $${totalAmount.toFixed(2)}`}
        </Button>
      </div>

      {/* Bottom Navigation Bar - Mobile Only */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex items-center justify-around py-2 px-4">
          <button
            onClick={() => navigate('/usermain')}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-[#ff8100] transition-colors"
          >
            <Home className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Home</span>
          </button>
          <button
            onClick={() => navigate('/usermain/wishlist')}
            className="flex flex-col items-center gap-1 p-2 text-gray-600 hover:text-[#ff8100] transition-colors"
          >
            <Heart className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Wishlist</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 -mt-8">
            <div className="bg-white rounded-full p-3 shadow-lg border-2 border-gray-200">
              <ChefHat className="w-6 h-6 text-gray-600" />
            </div>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-gray-600">
            <ShoppingBag className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Orders</span>
          </button>
          <button className="flex flex-col items-center gap-1 p-2 text-gray-600">
            <Menu className="w-6 h-6" />
            <span className="text-xs text-gray-600 font-medium">Menu</span>
          </button>
        </div>
      </div>
    </div>
  )
}
