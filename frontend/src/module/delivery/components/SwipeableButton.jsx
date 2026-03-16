import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

const SwipeableButton = ({ 
  buttonRef, 
  text, 
  onMouseDown, 
  onMouseMove, 
  onMouseUp, 
  onTouchStart, 
  onTouchMove, 
  onTouchEnd, 
  variant = 'teal' 
}) => {
  const containerRef = useRef(null);

  const colors = {
    teal: {
      bg: 'bg-teal-50',
      bar: 'bg-teal-600',
      text: 'text-teal-900',
      icon: 'text-teal-600',
      circle: 'bg-white'
    },
    orange: {
      bg: 'bg-orange-50',
      bar: 'bg-orange-600',
      text: 'text-orange-900',
      icon: 'text-orange-600',
      circle: 'bg-white'
    },
    blue: {
      bg: 'bg-blue-50',
      bar: 'bg-blue-600',
      text: 'text-blue-900',
      icon: 'text-blue-600',
      circle: 'bg-white'
    }
  };

  const color = colors[variant] || colors.teal;

  return (
    <div 
      ref={buttonRef}
      className={`relative w-full h-16 ${color.bg} rounded-2xl border border-white/50 shadow-inner overflow-hidden select-none touch-none`}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Background Text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`text-sm font-bold uppercase tracking-widest ${color.text} opacity-30`}>
          {text}
        </span>
      </div>

      {/* The Swipe Bar/Circle */}
      <motion.div 
        className="absolute left-1 top-1 bottom-1 w-14 bg-white rounded-xl shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing z-10"
      >
        <ChevronRight className={`w-6 h-6 ${color.icon}`} />
      </motion.div>

      {/* Progress Track (optional visualization if needed, but the current handlers handle the logic) */}
      <div className="absolute inset-0 pointer-events-none">
        {/* We can add a progress fill here if we have access to progress state, 
            but for now we just want to satisfy the import and basic event handling */}
      </div>
    </div>
  );
};

export default SwipeableButton;
