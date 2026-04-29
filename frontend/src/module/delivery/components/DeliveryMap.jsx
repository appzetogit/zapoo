import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TargetIcon, MapPin } from 'lucide-react';

const DeliveryMap = React.memo(({ mapContainerRef, mapLoading, isRefreshingLocation, onRefreshLocation }) => {
  return (
    <>
      {/* Google Maps Container */}
      <div ref={mapContainerRef} className="w-full h-full" style={{
        height: '100%',
        width: '100%',
        backgroundColor: '#e5e7eb',
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'auto',
        zIndex: 0
      }} />

      {/* Loading indicator */}
      {mapLoading && <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
        <div className="flex flex-col items-center gap-2">
          <div className="text-gray-600 font-medium">Loading map...</div>
          <div className="text-xs text-gray-500">Please wait</div>
        </div>
      </div>}

      {/* Map Refresh Overlay - Professional Loading Indicator */}
      <AnimatePresence>
      {isRefreshingLocation && <motion.div initial={{
        opacity: 0
      }} animate={{
        opacity: 1
      }} exit={{
        opacity: 0
      }} transition={{
        duration: 0.2
      }} className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        {/* Loading indicator container */}
        <motion.div initial={{
          scale: 0.8,
          opacity: 0
        }} animate={{
          scale: 1,
          opacity: 1
        }} exit={{
          scale: 0.8,
          opacity: 0
        }} transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1]
        }} className="relative">
          {/* Outer pulsing ring */}
          <motion.div animate={{
            scale: [1, 1.3, 1],
            opacity: [0.6, 0.3, 0.6]
          }} transition={{
            duration: 2,
            repeat: Infinity,
            ease: [0.4, 0, 0.6, 1],
            type: "tween",
            times: [0, 0.5, 1]
          }} className="absolute inset-0 w-20 h-20 bg-blue-500/20 rounded-full" />

          {/* Middle ring */}
          <motion.div animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 0.2, 0.5]
          }} transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: [0.4, 0, 0.6, 1],
            type: "tween",
            delay: 0.3,
            times: [0, 0.5, 1]
          }} className="absolute inset-0 w-16 h-16 bg-blue-500/30 rounded-full m-2" />

          {/* Inner spinner */}
          <div className="relative w-12 h-12 bg-white/90 rounded-full flex items-center justify-center shadow-lg">
            <motion.div animate={{
              rotate: 360
            }} transition={{
              duration: 1.2,
              repeat: Infinity,
              ease: "linear",
              type: "tween"
            }} className="w-8 h-8 border-[3px] border-blue-600 border-t-transparent rounded-full" />
          </div>
        </motion.div>
      </motion.div>}
      </AnimatePresence>

      {/* Floating Action Button - My Location */}
      <motion.button onClick={onRefreshLocation} className="absolute right-3 w-12 h-12 bg-white rounded-full shadow-lg flex items-center justify-center hover:bg-gray-50 transition-colors z-20 overflow-visible" style={{
        top: "calc(50% + 88px)"
      }} whileTap={{
        scale: 0.92
      }} transition={{
        type: "spring",
        stiffness: 300,
        damping: 25,
        mass: 0.5
      }}>
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Ripple effect */}
          {isRefreshingLocation && <motion.div className="absolute inset-0 rounded-full bg-blue-500/20" initial={{
            scale: 0.9,
            opacity: 0.6
          }} animate={{
            scale: [0.9, 1.6, 1.8],
            opacity: [0.6, 0.3, 0]
          }} transition={{
            duration: 2,
            repeat: Infinity,
            ease: [0.25, 0.46, 0.45, 0.94],
            times: [0, 0.5, 1]
          }} />}

          {/* Icon with smooth animations */}
          <motion.div className="relative z-10" animate={{
            rotate: isRefreshingLocation ? 360 : 0,
            scale: isRefreshingLocation ? [1, 1.1, 1] : 1
          }} transition={{
            rotate: {
              duration: 2,
              repeat: isRefreshingLocation ? Infinity : 0,
              ease: "linear",
              type: "tween"
            },
            scale: {
              duration: 1.5,
              repeat: isRefreshingLocation ? Infinity : 0,
              ease: [0.4, 0, 0.6, 1],
              type: "tween",
              times: [0, 0.5, 1]
            }
          }}>
            <MapPin className={`w-6 h-6 transition-colors duration-500 ease-in-out ${isRefreshingLocation ? 'text-blue-600' : 'text-gray-700'}`} />
          </motion.div>
        </div>
      </motion.button>
    </>
  );
});

DeliveryMap.displayName = 'DeliveryMap';

export default DeliveryMap;
