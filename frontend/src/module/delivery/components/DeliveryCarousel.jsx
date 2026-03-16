import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';

const DeliveryCarousel = React.memo(({ bankDetailsFilled, navigate }) => {
  const [currentCarouselSlide, setCurrentCarouselSlide] = useState(0);
  const carouselRef = useRef(null);
  const carouselAutoRotateRef = useRef(null);
  const carouselIsSwiping = useRef(false);
  const carouselStartX = useRef(0);
  const carouselStartY = useRef(0);

  // Carousel slides data - filter based on bank details status
  const carouselSlides = useMemo(() => [
    ...(bankDetailsFilled ? [] : [{
      id: 2,
      title: "Submit bank details",
      subtitle: "PAN & bank details required for payouts",
      icon: "bank",
      buttonText: "Submit",
      bgColor: "bg-[#DC2626]"
    }])
  ], [bankDetailsFilled]);

  const resetCarouselAutoRotate = useCallback(() => {
    if (carouselAutoRotateRef.current) {
      clearInterval(carouselAutoRotateRef.current);
    }
    carouselAutoRotateRef.current = setInterval(() => {
      setCurrentCarouselSlide(prev => (prev + 1) % carouselSlides.length);
    }, 3000);
  }, [carouselSlides.length]);

  // Handle carousel swipe touch events
  const handleCarouselTouchStart = useCallback(e => {
    carouselIsSwiping.current = true;
    carouselStartX.current = e.touches[0].clientX;
    carouselStartY.current = e.touches[0].clientY;
  }, []);

  const handleCarouselTouchMove = useCallback(e => {
    if (!carouselIsSwiping.current) return;
    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const deltaX = Math.abs(currentX - carouselStartX.current);
    const deltaY = Math.abs(currentY - carouselStartY.current);

    // Only prevent default if horizontal swipe is dominant
    if (deltaX > deltaY && deltaX > 10) {
      // safePreventDefault(e) // Removed to avoid passive listener error
    }
  }, []);

  const handleCarouselTouchEnd = useCallback(e => {
    if (!carouselIsSwiping.current) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const deltaX = carouselStartX.current - endX;
    const deltaY = Math.abs(carouselStartY.current - endY);
    const threshold = 50; // Minimum swipe distance

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > threshold && Math.abs(deltaX) > deltaY) {
      if (deltaX > 0) {
        // Swiped left - go to next slide
        setCurrentCarouselSlide(prev => (prev + 1) % carouselSlides.length);
      } else {
        // Swiped right - go to previous slide
        setCurrentCarouselSlide(prev => (prev - 1 + carouselSlides.length) % carouselSlides.length);
      }
      resetCarouselAutoRotate();
    }
    carouselIsSwiping.current = false;
    carouselStartX.current = 0;
    carouselStartY.current = 0;
  }, [carouselSlides.length, resetCarouselAutoRotate]);

  // Handle carousel mouse events for desktop
  const handleCarouselMouseDown = e => {
    carouselIsSwiping.current = true;
    carouselStartX.current = e.clientX;
    const handleMouseMove = moveEvent => {
      if (!carouselIsSwiping.current) return;
    };
    const handleMouseUp = upEvent => {
      if (!carouselIsSwiping.current) {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        return;
      }
      const endX = upEvent.clientX;
      const deltaX = carouselStartX.current - endX;
      const threshold = 50;
      if (Math.abs(deltaX) > threshold) {
        if (deltaX > 0) {
          // Swiped left - go to next slide
          setCurrentCarouselSlide(prev => (prev + 1) % carouselSlides.length);
        } else {
          // Swiped right - go to previous slide
          setCurrentCarouselSlide(prev => (prev - 1 + carouselSlides.length) % carouselSlides.length);
        }
        resetCarouselAutoRotate();
      }
      carouselIsSwiping.current = false;
      carouselStartX.current = 0;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Setup non-passive touch event listeners for carousel to allow preventDefault
  useEffect(() => {
    const carouselElement = carouselRef.current;
    if (!carouselElement) return;

    carouselElement.addEventListener('touchstart', handleCarouselTouchStart, {
      passive: true
    });
    carouselElement.addEventListener('touchmove', handleCarouselTouchMove, {
      passive: false
    });
    carouselElement.addEventListener('touchend', handleCarouselTouchEnd, {
      passive: true
    });

    return () => {
      carouselElement.removeEventListener('touchstart', handleCarouselTouchStart);
      carouselElement.removeEventListener('touchmove', handleCarouselTouchMove);
      carouselElement.removeEventListener('touchend', handleCarouselTouchEnd);
    };
  }, [handleCarouselTouchStart, handleCarouselTouchMove, handleCarouselTouchEnd]);

  // Auto-rotate carousel
  useEffect(() => {
    // Reset to first slide if current slide is out of bounds
    setCurrentCarouselSlide(prev => {
      if (prev >= carouselSlides.length) {
        return 0;
      }
      return prev;
    });
    carouselAutoRotateRef.current = setInterval(() => {
      setCurrentCarouselSlide(prev => (prev + 1) % carouselSlides.length);
    }, 3000);
    return () => {
      if (carouselAutoRotateRef.current) {
        clearInterval(carouselAutoRotateRef.current);
      }
    };
  }, [carouselSlides]);

  if (carouselSlides.length === 0) return null;

  return (
    <div ref={carouselRef} className="relative overflow-hidden bg-gray-700 cursor-grab active:cursor-grabbing select-none flex-shrink-0" onMouseDown={handleCarouselMouseDown}>
      <div className="flex transition-transform duration-500 ease-in-out" style={{
        transform: `translateX(-${currentCarouselSlide * 100}%)`
      }}>
        {carouselSlides.map(slide => <div key={slide.id} className="min-w-full">
          <div className={`${slide.bgColor} px-4 py-3 flex items-center gap-3 min-h-[80px]`}>
            {/* Icon */}
            <div className="flex-shrink-0">
              {slide.icon === "bag" ? <div className="relative">
                {/* Delivery Bag Icon - Reduced size */}
                <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center shadow-lg relative">
                  {/* Bag shape */}
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                  </svg>
                </div>
                {/* Shadow */}
                <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-10 h-1.5 bg-black/30 rounded-full blur-sm"></div>
              </div> : <div className="relative w-10 h-10">
                {/* Bank/Rupee Icon - Reduced size */}
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center relative">
                  {/* Rupee symbol */}
                  <svg className="w-12 h-12 text-white absolute" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.31-8.86c-1.77-.45-2.34-.94-2.34-1.67 0-.84.79-1.43 2.1-1.43 1.38 0 1.9.66 1.94 1.64h1.71c-.05-1.34-.87-2.57-2.49-2.97V5H10.9v1.69c-1.51.32-2.72 1.3-2.72 2.81 0 1.79 1.49 2.69 3.66 3.21 1.95.46 2.34 1.15 2.34 1.87 0 .53-.39 1.39-2.1 1.39-1.6 0-2.23-.72-2.32-1.64H8.04c.1 1.7 1.36 2.66 2.86 2.97V19h2.34v-1.67c1.52-.29 2.72-1.16 2.73-2.77-.01-2.2-1.9-2.96-3.66-3.42z" />
                  </svg>
                </div>
              </div>}
            </div>

            <div className="flex-1">
              <h3 className={`${slide.bgColor === "bg-gray-700" || slide.bgColor === "bg-[#DC2626]" ? "text-white" : "text-black"} text-sm font-semibold mb-0.5`}>
                {slide.title}
              </h3>
              <p className={`${slide.bgColor === "bg-gray-700" || slide.bgColor === "bg-[#DC2626]" ? "text-white/90" : "text-black/80"} text-xs`}>
                {slide.subtitle}
              </p>
            </div>

            <button onClick={() => {
              if (slide.id === 2) {
                navigate("/delivery/profile/details");
              }
            }} className={`px-3 py-1.5 rounded-lg font-medium text-xs transition-colors ${slide.bgColor === "bg-gray-700" ? "bg-gray-600 text-white hover:bg-gray-500" : "bg-white text-[#DC2626] hover:bg-gray-100"}`}>
              {slide.buttonText}
            </button>
          </div>
        </div>)}
      </div>

      {/* Carousel Indicators */}
      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {carouselSlides.map((_, index) => <button key={index} onClick={() => setCurrentCarouselSlide(index)} className={`h-1.5 rounded-full transition-all duration-300 ${index === currentCarouselSlide ? currentCarouselSlide === 0 ? "w-6 bg-white" : "w-6 bg-black" : index === 0 ? "w-1.5 bg-white/50" : "w-1.5 bg-black/30"}`} />)}
      </div>
    </div>
  );
});

export default DeliveryCarousel;
