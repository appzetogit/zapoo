import React from 'react';
import { motion, AnimatePresence } from "framer-motion";
import { ChevronUp, ChevronDown, IndianRupee, Clock, TargetIcon, Wallet, TrendingUp, CheckCircle, ArrowRight, IndianRupee as RupeeIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DeliverySwipeBar = ({
  showHomeSections,
  isDraggingSwipeBar,
  swipeBarPosition,
  swipeBarRef,
  handleSwipeBarTouchStart,
  handleSwipeBarTouchMove,
  handleSwipeBarTouchEnd,
  handleSwipeBarMouseDown,
  handleChevronUpClick,
  handleChevronDownClick,
  isOnline,
  goOffline,
  setShowBookGigsPopup,
  todayEarnings,
  todayTrips,
  todayHoursWorked,
  todayGigsCount,
  weekEndDate,
  isOfferLive,
  earningsGuaranteeTarget,
  earningsGuaranteeOrdersTarget,
  earningsGuaranteeCurrentOrders,
  earningsGuaranteeCurrentEarnings,
  ordersProgress,
  earningsProgress,
  formatCurrency,
  formatHours,
  onGoOnline
}) => {
  return (
    <>
      {!showHomeSections ? (
        <motion.div
          ref={swipeBarRef}
          initial={{ y: "85%" }}
          animate={{
            y: isDraggingSwipeBar 
              ? swipeBarPosition 
              : "85%" // Simplified as deliveryStatus and mapViewMode are removed
          }}
          transition={isDraggingSwipeBar ? { duration: 0 } : { type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-0 left-0 right-0 bg-white rounded-t-[32px] shadow-[0_-8px_32px_rgba(0,0,0,0.12)] z-[60] h-full cursor-grab active:cursor-grabbing"
          onTouchStart={handleSwipeBarTouchStart}
          onTouchMove={handleSwipeBarTouchMove}
          onTouchEnd={handleSwipeBarTouchEnd}
          onMouseDown={handleSwipeBarMouseDown}
        >
          <div className="flex flex-col items-center pt-2 pb-6">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4" />
            <div className="w-full px-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="bg-emerald-50 p-2.5 rounded-2xl">
                  <RupeeIcon className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Today's Earnings</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(todayEarnings)}</p>
                </div>
              </div>
              <button 
                onClick={handleChevronUpClick}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                aria-label="Expand earnings"
              >
                <ChevronUp className="w-6 h-6 text-gray-400" />
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          ref={swipeBarRef}
          initial={{ y: "100%" }}
          animate={{ y: isDraggingSwipeBar ? swipeBarPosition : 0 }}
          transition={isDraggingSwipeBar ? { duration: 0 } : { type: "spring", damping: 30, stiffness: 200 }}
          className="fixed inset-0 bg-white z-[70] flex flex-col pt-4"
          onTouchStart={handleSwipeBarTouchStart}
          onTouchMove={handleSwipeBarTouchMove}
          onTouchEnd={handleSwipeBarTouchEnd}
          onMouseDown={handleSwipeBarMouseDown}
        >
          {/* Header with Chevron */}
          <div className="px-6 pb-2 flex items-center justify-between shrink-0">
            <button 
              onClick={handleChevronDownClick}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors"
            >
              <ChevronDown className="w-7 h-7 text-gray-600" />
            </button>
            <div className="w-12 h-1.5 bg-gray-100 rounded-full absolute left-1/2 -translate-x-1/2 top-4" />
          </div>

          {/* Main Content Area */}
          <div className="flex-1 overflow-hidden flex flex-col">
            <div
              className="flex flex-col gap-4 p-4 pb-24 overflow-y-auto max-h-[calc(100vh-80px)]"
            >
              {/* Unlock Offer Card */}
              <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-blue-50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="bg-blue-600 p-2.5 rounded-2xl">
                      <IndianRupee className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900 leading-tight">Extra ₹150 Earnings</h3>
                      <p className="text-blue-700/80 text-sm mt-1">Ends Sunday, {weekEndDate}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm font-medium">
                      <span className="text-blue-900">Complete 30 gigs</span>
                      <span className="text-blue-900">{ordersProgress}%</span>
                    </div>
                    <div className="h-2.5 bg-blue-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-blue-600 transition-all duration-500 ease-out"
                        style={{ width: `${ordersProgress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Earnings Guarantee Card */}
              <Card className="rounded-3xl border-none shadow-md overflow-hidden bg-emerald-50">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-100 p-2 rounded-xl">
                        <CheckCircle className="w-5 h-5 text-emerald-600" />
                      </div>
                      <h3 className="font-bold text-gray-900">Weekly Earnings</h3>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-6 mb-6">
                    <div>
                      <p className="text-xs text-emerald-700 font-medium uppercase tracking-wider mb-1">Weekly Target</p>
                      <p className="text-2xl font-bold text-gray-900">{formatCurrency(earningsGuaranteeTarget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-emerald-700 font-medium uppercase tracking-wider mb-1">Gigs Done</p>
                      <p className="text-2xl font-bold text-gray-900">{earningsGuaranteeCurrentOrders}/{earningsGuaranteeOrdersTarget}</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <div className="text-sm font-medium text-emerald-900">Current Earnings: {formatCurrency(earningsGuaranteeCurrentEarnings)}</div>
                      <div className="text-sm font-bold text-emerald-600">{earningsProgress}%</div>
                    </div>
                    <div className="h-3 bg-emerald-100 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 transition-all duration-700 ease-in-out"
                        style={{ width: `${earningsProgress}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Today's Progress Card */}
              <Card className="rounded-3xl border-none shadow-md overflow-hidden mb-6">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                      <div className="bg-violet-100 p-2 rounded-xl">
                        <TrendingUp className="w-5 h-5 text-violet-600" />
                      </div>
                      <h3 className="font-bold text-gray-900">Today's Summary</h3>
                    </div>
                    <Button 
                      variant="ghost" 
                      className="text-violet-600 font-bold hover:bg-violet-50 rounded-2xl px-4"
                      onClick={() => navigate('/wallet')}
                    >
                      View Wallet
                    </Button>
                  </div>

                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
                          <RupeeIcon className="w-6 h-6 text-emerald-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-500">Net Earnings</p>
                          <p className="text-xl font-bold text-gray-900">{formatCurrency(todayEarnings)}</p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-gray-50 rounded-3xl">
                        <div className="flex items-center gap-2 mb-2">
                          <Clock className="w-4 h-4 text-violet-500" />
                          <span className="text-xs font-bold text-gray-500 uppercase">Login Time</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">{formatHours(todayHoursWorked)}</p>
                      </div>
                      <div className="p-4 bg-gray-50 rounded-3xl">
                        <div className="flex items-center gap-2 mb-2">
                          <TargetIcon className="w-4 h-4 text-orange-500" />
                          <span className="text-xs font-bold text-gray-500 uppercase">Gigs Done</span>
                        </div>
                        <p className="text-lg font-bold text-gray-900">{todayGigsCount}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-8 border-t border-gray-100">
                    <Button 
                      onClick={goOffline}
                      className="w-full bg-gray-900 hover:bg-black text-white rounded-2xl py-6 text-lg font-bold transition-all active:scale-[0.98]"
                    >
                      Go Offline
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <AnimatePresence>
            {!isOnline && (
              <motion.div 
                initial={{ y: 100 }}
                animate={{ y: 0 }}
                exit={{ y: 100 }}
                className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t z-[80]"
              >
                <p className="text-center font-bold text-gray-500 mb-4">You are currently offline</p>
                <Button 
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl py-6 text-lg font-bold flex items-center justify-center gap-2"
                  onClick={onGoOnline || (() => setShowBookGigsPopup(true))}
                >
                  <span>Go Online</span>
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </>
  );
};

export default DeliverySwipeBar;
