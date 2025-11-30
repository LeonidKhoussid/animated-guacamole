import { useState, useRef } from 'react';
import { ThreeDViewer } from './ThreeDViewer.jsx';

export const VariantCarousel = ({ variants, onVariantClick, selectedVariantId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewModes, setViewModes] = useState({}); // Track view mode for each variant
  const scrollContainerRef = useRef(null);

  const scrollToIndex = (index) => {
    if (scrollContainerRef.current) {
      const cardWidth = 280; // Approximate card width including gap
      scrollContainerRef.current.scrollTo({
        left: index * cardWidth,
        behavior: 'smooth'
      });
      setCurrentIndex(index);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      scrollToIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < variants.length - 1) {
      scrollToIndex(currentIndex + 1);
    }
  };

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const scrollLeft = scrollContainerRef.current.scrollLeft;
      const cardWidth = 280;
      const newIndex = Math.round(scrollLeft / cardWidth);
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < variants.length) {
        setCurrentIndex(newIndex);
      }
    }
  };

  const toggleViewMode = (variantId, e) => {
    e.stopPropagation();
    setViewModes(prev => {
      const currentMode = prev[variantId] || 'top';
      const newMode = currentMode === 'top' ? '3d' : 'top';
      return { ...prev, [variantId]: newMode };
    });
  };

  const switchToFirstPerson = (variantId, e) => {
    e.stopPropagation();
    setViewModes(prev => ({
      ...prev,
      [variantId]: 'first-person'
    }));
  };

  if (variants.length === 0) return null;

  return (
    <div className="sticky top-0 z-30 bg-[#2593F4] pb-3 pt-2 shadow-lg">
      <div className="relative">
        {/* Navigation Buttons */}
        {variants.length > 1 && (
          <>
            {currentIndex > 0 && (
              <button
                onClick={handlePrev}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                aria-label="Previous variant"
              >
                <svg className="w-5 h-5 text-[#2593F4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {currentIndex < variants.length - 1 && (
              <button
                onClick={handleNext}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                aria-label="Next variant"
              >
                <svg className="w-5 h-5 text-[#2593F4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </>
        )}

        {/* Carousel Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {variants.map((variant, index) => {
            const viewMode = viewModes[variant.id] || 'top';
            const isSelected = selectedVariantId === variant.id;
            
            return (
              <div
                key={variant.id}
                onClick={() => onVariantClick(variant)}
                className={`flex-shrink-0 w-[260px] bg-white rounded-xl shadow-lg overflow-hidden cursor-pointer transition-all relative ${
                  isSelected
                    ? 'ring-4 ring-blue-400 scale-105'
                    : 'hover:shadow-xl hover:scale-[1.02]'
                }`}
              >
                {/* 3D Viewer Container */}
                <div className="w-full h-48 bg-gray-100 relative">
                  <ThreeDViewer
                    variant={variant}
                    viewMode={viewMode}
                    planGeometry={variant.planGeometry || null}
                  />
                  
                  {/* 2D/3D Switcher - Top Right */}
                  <button
                    onClick={(e) => toggleViewMode(variant.id, e)}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2593F4] shadow-lg transition-all z-10"
                  >
                    {viewMode === 'top' ? '3D' : '2D'}
                  </button>

                  {/* Navigation Arrows - Bottom Center (only in 3D view) */}
                  {viewMode === '3d' && (
                    <button
                      onClick={(e) => switchToFirstPerson(variant.id, e)}
                      className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all z-10"
                      aria-label="First Person View"
                    >
                      <svg className="w-5 h-5 text-[#2593F4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </button>
                  )}

                  {/* Back to 3D button (only in first-person view) */}
                  {viewMode === 'first-person' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setViewModes(prev => ({
                          ...prev,
                          [variant.id]: '3d'
                        }));
                      }}
                      className="absolute bottom-2 left-2 bg-white/90 hover:bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2593F4] shadow-lg transition-all z-10"
                      aria-label="Back to 3D"
                    >
                      ← 3D
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Dots Indicator */}
        {variants.length > 1 && (
          <div className="flex justify-center gap-2 mt-2">
            {variants.map((_, index) => (
              <button
                key={index}
                onClick={() => scrollToIndex(index)}
                className={`h-2 rounded-full transition-all ${
                  index === currentIndex
                    ? 'w-6 bg-white'
                    : 'w-2 bg-white/50 hover:bg-white/75'
                }`}
                aria-label={`Go to variant ${index + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

