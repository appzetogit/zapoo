import React from 'react';
import { HelpCircle, ArrowRight, Phone, Check, Star, X, MapPin, Package, Clock, ShieldCheck, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import BottomPopup from '../components/BottomPopup';
import SwipeableButton from './SwipeableButton';

const DeliveryPopups = React.memo(({
  // Help popup
  showHelpPopup, setShowHelpPopup, helpOptions, handleHelpOptionClick,
  // Emergency popup
  showEmergencyPopup, setShowEmergencyPopup, emergencyOptions, handleEmergencyOptionClick,
  // Book Gigs popup
  showBookGigsPopup, setShowBookGigsPopup, navigate,
  // Delivery status popups
  showReachedPickupPopup, setShowReachedPickupPopup, reachedPickupButtonRef, handleReachedPickupTouchStart, handleReachedPickupTouchMove, handleReachedPickupTouchEnd,
  showOrderIdConfirmationPopup, setShowOrderIdConfirmationPopup, orderIdInput, setOrderIdInput, handleOrderIdSubmit, orderIdError,
  showReachedDropPopup, setShowReachedDropPopup, reachedDropButtonRef, handleReachedDropTouchStart, handleReachedDropTouchMove, handleReachedDropTouchEnd,
  showOrderDeliveredAnimation, setShowOrderDeliveredAnimation,
  showCustomerReviewPopup, setShowCustomerReviewPopup,
  // Order acceptance
  showAcceptingOrderPopup, setShowAcceptingOrderPopup, acceptingOrderProgress,
  showRejectionModal, setShowRejectionModal, rejectionReason, setRejectionReason, handleConfirmRejection,
  // Active states
  activeOrder, activeDelivery
}) => {
  return (
    <>
      {/* Help Popup */}
      <BottomPopup isOpen={showHelpPopup} onClose={() => setShowHelpPopup(false)} title="How can we help?" showCloseButton={true} closeOnBackdropClick={true} maxHeight="70vh">
        <div className="py-2">
          {helpOptions.map(option => <button key={option.id} onClick={() => handleHelpOptionClick(option)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
            {/* Icon */}
            <div className="shrink-0 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
              {option.icon === "helpCenter" && <HelpCircle className="w-6 h-6 text-gray-700" />}
              {option.icon === "ticket" && <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
              </svg>}
              {option.icon === "idCard" && <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
              </svg>}
              {option.icon === "language" && <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>}
            </div>

            {/* Text Content */}
            <div className="flex-1 text-left">
              <h3 className="text-base font-semibold text-gray-900 mb-1">{option.title}</h3>
              <p className="text-sm text-gray-600">{option.subtitle}</p>
            </div>

            {/* Arrow Icon */}
            <ArrowRight className="w-5 h-5 text-gray-400 shrink-0" />
          </button>)}
        </div>
      </BottomPopup>

      {/* Emergency Help Popup */}
      <BottomPopup isOpen={showEmergencyPopup} onClose={() => setShowEmergencyPopup(false)} title="Emergency help" showCloseButton={true} closeOnBackdropClick={true} maxHeight="70vh">
        <div className="py-2">
          {emergencyOptions.map((option, index) => <button key={option.id} onClick={() => handleEmergencyOptionClick(option)} className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-b-0">
            {/* Icon */}
            <div className="shrink-0 w-14 h-14 rounded-lg flex items-center justify-center">
              {option.icon === "ambulance" && <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200 relative overflow-hidden">
                <div className="absolute inset-0 bg-blue-500"></div>
                <div className="absolute top-1 left-2 w-2 h-3 bg-red-500 rounded-sm"></div>
                <div className="absolute top-1 right-2 w-2 h-3 bg-blue-500 rounded-sm"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2L2 7v10l10 5 10-5V7l-10-5zm0 2.18l8 4v7.64l-8 4-8-4V8.18l8-4z" />
                    <path d="M12 8L6 11v6l6 3 6-3v-6l-6-3z" />
                  </svg>
                </div>
                <div className="absolute bottom-1 left-0 right-0 text-[6px] font-bold text-white text-center">AMBULANCE</div>
              </div>}
              {option.icon === "siren" && <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200 relative">
                <div className="w-10 h-10 bg-red-500 rounded-full flex items-center justify-center relative">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 border-2 border-yellow-400 rounded-full animate-pulse"></div>
                  </div>
                  <Phone className="w-5 h-5 text-yellow-400 z-10" />
                </div>
              </div>}
              {option.icon === "police" && <div className="w-14 h-14 bg-white rounded-lg flex items-center justify-center shadow-sm border border-gray-200">
                <div className="relative">
                  <div className="w-10 h-10 bg-gray-300 rounded-full"></div>
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-4 bg-amber-700 rounded-t-lg"></div>
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-10 h-1 bg-amber-800"></div>
                  <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-6 h-2 bg-gray-800 rounded-full"></div>
                </div>
              </div>}
              {option.icon === "insurance" && <div className="w-14 h-14 bg-yellow-400 rounded-lg flex items-center justify-center shadow-sm border border-gray-200 relative">
                <div className="w-12 h-8 bg-white rounded-sm relative">
                  <div className="absolute left-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    <div className="w-0.5 h-3 bg-red-500"></div>
                  </div>
                </div>
              </div>}
            </div>

            {/* Text Content */}
            <div className="flex-1 text-left">
              <h3 className="text-base font-semibold text-gray-900 mb-1">{option.title}</h3>
              <p className="text-sm text-gray-600">{option.subtitle}</p>
            </div>

            {/* Arrow Icon */}
            <ArrowRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          </button>)}
        </div>
      </BottomPopup>

      {/* Book Gigs Popup */}
      <BottomPopup isOpen={showBookGigsPopup} onClose={() => setShowBookGigsPopup(false)} title="Book gigs to go online" showCloseButton={true} closeOnBackdropClick={true} maxHeight="auto">
        <div className="py-4">
          <div className="mb-6 rounded-lg overflow-hidden shadow-sm border border-gray-200">
            <div className="bg-teal-100 px-4 py-3 flex items-center gap-3">
              <div className="w-8 h-8 bg-teal-600 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">g</span>
              </div>
              <span className="text-teal-700 font-semibold">Gig details</span>
            </div>
            <div className="bg-white px-4 py-4">
              <p className="text-gray-900 text-sm">Gig booking open in your zone</p>
            </div>
          </div>

          <p className="text-gray-900 text-sm mb-6">
            Book your Gigs now to go online and start delivering orders
          </p>

          <button onClick={() => {
            setShowBookGigsPopup(false);
            navigate("/delivery/gig");
          }} className="w-full bg-black hover:bg-gray-800 text-white font-semibold py-4 rounded-lg transition-colors">
            Book gigs
          </button>
        </div>
      </BottomPopup>

      {/* Reached Pickup Popup */}
      <BottomPopup isOpen={showReachedPickupPopup} onClose={() => {}} title="Arrived at Pickup" showCloseButton={false} closeOnBackdropClick={false} maxHeight="auto">
        <div className="py-4 space-y-4">
          <div className="flex items-start gap-4 p-4 bg-teal-50 rounded-xl border border-teal-100">
            <div className="shrink-0 w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <p className="font-semibold text-teal-900">{activeOrder?.restaurant?.name || 'Restaurant Name'}</p>
              <p className="text-sm text-teal-700">{activeOrder?.restaurant?.address || 'Restaurant Address'}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <Clock className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600 font-medium">Pickup by {activeOrder?.pickupTime || '00:00 AM'}</span>
          </div>

          <div className="relative pt-2">
            <SwipeableButton 
              buttonRef={reachedPickupButtonRef}
              text="Swipe to reach pickup"
              onMouseDown={handleReachedPickupTouchStart}
              onMouseMove={handleReachedPickupTouchMove}
              onMouseUp={handleReachedPickupTouchEnd}
              onTouchStart={handleReachedPickupTouchStart}
              onTouchMove={handleReachedPickupTouchMove}
              onTouchEnd={handleReachedPickupTouchEnd}
              variant="teal"
            />
          </div>
        </div>
      </BottomPopup>

      {/* Order ID Confirmation Popup */}
      <BottomPopup isOpen={showOrderIdConfirmationPopup} onClose={() => setShowOrderIdConfirmationPopup(false)} title="Confirm Order ID" showCloseButton={false} closeOnBackdropClick={false} maxHeight="auto">
        <div className="py-4 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-gray-600">Please enter the 4-digit order ID provided by the restaurant to confirm pickup.</p>
            <div className="flex justify-center gap-2">
              <span className="text-2xl font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">#</span>
              <span className="text-2xl font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded tracking-widest">{activeOrder?.id?.slice(-4) || '----'}</span>
            </div>
          </div>

          <div className="space-y-4">
            <input 
              type="text" 
              maxLength="4"
              value={orderIdInput}
              onChange={(e) => setOrderIdInput(e.target.value)}
              placeholder="Enter 4-digit ID"
              className={`w-full text-center text-3xl font-bold py-4 rounded-xl border-2 focus:outline-none transition-all ${orderIdError ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-teal-500 bg-white'}`}
            />
            {orderIdError && <p className="text-red-500 text-sm text-center font-medium">{orderIdError}</p>}
          </div>

          <button 
            onClick={handleOrderIdSubmit}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-teal-100 transition-all flex items-center justify-center gap-2"
          >
            Confirm Pickup <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </BottomPopup>

      {/* Reached Drop Popup */}
      <BottomPopup isOpen={showReachedDropPopup} onClose={() => {}} title="Arrived at Delivery Location" showCloseButton={false} closeOnBackdropClick={false} maxHeight="auto">
        <div className="py-4 space-y-4">
          <div className="flex items-start gap-4 p-4 bg-orange-50 rounded-xl border border-orange-100">
            <div className="shrink-0 w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
              <MapPin className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <p className="font-semibold text-orange-900">{activeOrder?.customer?.name || 'Customer Name'}</p>
              <p className="text-sm text-orange-700">{activeOrder?.customer?.address || 'Customer Address'}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
            <div className="shrink-0 w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-blue-900">Safety First</p>
              <p className="text-xs text-blue-700">Ensure the vehicle is parked safely before completing delivery.</p>
            </div>
          </div>

          <div className="relative pt-2">
            <SwipeableButton 
              buttonRef={reachedDropButtonRef}
              text="Swipe to complete delivery"
              onMouseDown={handleReachedDropTouchStart}
              onMouseMove={handleReachedDropTouchMove}
              onMouseUp={handleReachedDropTouchEnd}
              onTouchStart={handleReachedDropTouchStart}
              onTouchMove={handleReachedDropTouchMove}
              onTouchEnd={handleReachedDropTouchEnd}
              variant="orange"
            />
          </div>
        </div>
      </BottomPopup>

      {/* Order Delivered Animation */}
      <AnimatePresence>
        {showOrderDeliveredAnimation && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-teal-600 overflow-hidden flex flex-col items-center justify-center px-6"
          >
            {/* Confetti Animation Effect (Simplified) */}
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ 
                    x: Math.random() * window.innerWidth, 
                    y: -20, 
                    rotate: 0,
                    scale: Math.random() * 0.5 + 0.5
                  }}
                  animate={{ 
                    y: window.innerHeight + 20,
                    rotate: 360,
                  }}
                  transition={{ 
                    duration: Math.random() * 2 + 2,
                    repeat: Infinity,
                    ease: "linear",
                    delay: Math.random() * 2
                  }}
                  className={`absolute w-3 h-3 ${['bg-yellow-400', 'bg-red-400', 'bg-blue-400', 'bg-white', 'bg-orange-400'][i % 5]} rounded-sm`}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", damping: 12, stiffness: 200 }}
              className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-8 shadow-2xl relative"
            >
              <Check className="w-16 h-16 text-teal-600" />
              <motion.div 
                animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="absolute inset-0 bg-white rounded-full"
              />
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-center space-y-4"
            >
              <h2 className="text-3xl font-black text-white italic">DELIVERED!</h2>
              <p className="text-teal-50 font-medium text-lg leading-relaxed">
                Smooth ride, partner! Your earnings for this trip have been added to your wallet.
              </p>
            </motion.div>

            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-12 bg-white/10 backdrop-blur-sm border border-white/20 p-6 rounded-2xl w-full max-w-sm"
            >
              <div className="flex justify-between items-center text-white">
                <span className="font-medium opacity-80">Trip Earnings</span>
                <span className="text-2xl font-black">₹{activeDelivery?.earnings || '45.00'}</span>
              </div>
            </motion.div>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowOrderDeliveredAnimation(false)}
              className="absolute bottom-10 left-6 right-6 bg-white py-4 rounded-xl font-black text-teal-700 tracking-wider shadow-xl"
            >
              NEXT DELIVERY
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Customer Review Popup */}
      <BottomPopup isOpen={showCustomerReviewPopup} onClose={() => setShowCustomerReviewPopup(false)} title="Quick Feedback" showCloseButton={true} closeOnBackdropClick={true} maxHeight="auto">
        <div className="py-4 space-y-6 text-center">
          <div className="relative inline-block">
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
              <Star className="w-10 h-10 text-yellow-500 fill-yellow-500" />
            </div>
            <div className="absolute -bottom-1 -right-1 bg-green-500 text-white p-1 rounded-full border-2 border-white">
              <Check className="w-4 h-4" />
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">How's your safety today?</h3>
            <p className="text-gray-600 px-8">Your feedback helps us make every delivery safer for you and our customers.</p>
          </div>

          <div className="flex justify-center gap-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button 
                key={star}
                className="hover:scale-110 transition-transform"
              >
                <Star className="w-10 h-10 text-gray-200 hover:text-yellow-400 fill-current" />
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 pt-4">
            <button 
              onClick={() => setShowCustomerReviewPopup(false)}
              className="py-3 border border-gray-200 rounded-lg text-gray-600 font-semibold"
            >
              Skip
            </button>
            <button 
              onClick={() => setShowCustomerReviewPopup(false)}
              className="py-3 bg-teal-600 text-white rounded-lg font-semibold shadow-lg shadow-teal-100"
            >
              Submit
            </button>
          </div>
        </div>
      </BottomPopup>

      {/* Accepting Order Progress Popup */}
      <AnimatePresence>
        {showAcceptingOrderPopup && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 text-center space-y-6">
                <div className="relative w-24 h-24 mx-auto">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-100"
                    />
                    <motion.circle
                      cx="48"
                      cy="48"
                      r="44"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray="276.46"
                      animate={{ strokeDashoffset: 276.46 * (1 - acceptingOrderProgress / 100) }}
                      className="text-teal-600"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-teal-600">
                    {Math.round(acceptingOrderProgress)}%
                  </div>
                </div>

                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-gray-900">Accepting Order...</h3>
                  <p className="text-gray-600">Syncing with our servers and notifying the restaurant.</p>
                </div>

                <div className="flex flex-col gap-3 pt-4">
                  <div className="flex items-center gap-3 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <ShieldCheck className="w-4 h-4 text-teal-500" />
                    <span>Safe Connection Secure</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-100">
                    <Clock className="w-4 h-4 text-teal-500" />
                    <span>Fast Dispatch Active</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rejection Modal */}
      <AnimatePresence>
        {showRejectionModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white w-full max-w-md rounded-2xl p-6 space-y-6 shadow-2xl"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Reject Order?</h3>
                <button onClick={() => setShowRejectionModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="p-4 bg-orange-50 border border-orange-100 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-orange-800 font-bold">
                  <AlertCircle className="w-5 h-5" />
                  <span>Important Note</span>
                </div>
                <p className="text-sm text-orange-700 leading-relaxed">
                  Rejecting orders may affect your acceptance rate and eligibility for future premium gigs.
                </p>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-semibold text-gray-700">Why are you rejecting this order?</label>
                <div className="grid grid-cols-1 gap-2">
                  {['Too far away', 'Heavy traffic', 'Vehicle issue', 'Emergency', 'Other'].map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setRejectionReason(reason)}
                      className={`text-left p-4 rounded-xl border-2 transition-all font-medium ${rejectionReason === reason ? 'border-orange-500 bg-orange-50 text-orange-900' : 'border-gray-100 hover:border-gray-200 text-gray-600'}`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowRejectionModal(false)}
                  className="flex-1 py-4 border-2 border-gray-100 rounded-xl font-bold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button 
                  disabled={!rejectionReason}
                  onClick={handleConfirmRejection}
                  className={`flex-1 py-4 rounded-xl font-bold text-white shadow-lg transition-all ${rejectionReason ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-100' : 'bg-gray-300 opacity-50 cursor-not-allowed'}`}
                >
                  Confirm Rejection
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

DeliveryPopups.displayName = 'DeliveryPopups';

export default DeliveryPopups;
