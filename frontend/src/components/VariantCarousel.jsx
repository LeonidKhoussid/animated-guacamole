import { useState, useRef, useEffect } from 'react';
import { ThreeDViewer } from './ThreeDViewer.jsx';
import apiClient from '../utils/apiClient.js';
import { toast } from './Toast.jsx';

export const VariantCarousel = ({ variants, onVariantClick, selectedVariantId }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [viewModes, setViewModes] = useState({}); // Track view mode for each variant
  const [favorites, setFavorites] = useState(new Set()); // Track favorite variant IDs
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

  const exitFirstPerson = (variantId) => {
    setViewModes(prev => ({
      ...prev,
      [variantId]: '3d'
    }));
  };

  // Load favorites on mount
  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const response = await apiClient.get('/favorites');
        const favoriteIds = new Set((response.data || []).map(fav => fav.variant?.id).filter(Boolean));
        setFavorites(favoriteIds);
      } catch (error) {
        // Silently fail - user might not be logged in or not authenticated
        if (error.response?.status !== 401 && error.response?.status !== 403) {
          console.log('Could not load favorites:', error);
        }
      }
    };
    loadFavorites();
  }, []);

  const toggleFavorite = async (variantId, e) => {
    e.stopPropagation();
    
    if (!variantId) {
      console.error('No variant ID provided');
      toast.error('Ошибка: ID варианта не найден');
      return;
    }
    
    // Check if user is authenticated
    const token = localStorage.getItem('token');
    if (!token) {
      toast.error('Необходимо войти в систему для добавления в избранное');
      return;
    }
    
    const isFavorite = favorites.has(variantId);
    
    try {
      if (isFavorite) {
        await apiClient.delete(`/favorites/${variantId}`);
        setFavorites(prev => {
          const newSet = new Set(prev);
          newSet.delete(variantId);
          return newSet;
        });
        toast.success('Удалено из избранного');
      } else {
        console.log('Adding favorite with variant_id:', variantId);
        const response = await apiClient.post('/favorites', { variant_id: variantId });
        console.log('Favorite added successfully:', response.data);
        setFavorites(prev => new Set(prev).add(variantId));
        toast.success('Добавлено в избранное');
      }
    } catch (error) {
      console.error('Favorite toggle error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      const errorMessage = error.response?.data?.error || error.message || 'Ошибка при изменении избранного';
      if (error.response?.status === 401 || error.response?.status === 403) {
        toast.error('Необходимо войти в систему');
      } else if (error.response?.status === 400 && error.response?.data?.error === 'Variant already in favorites') {
        // Variant is already in favorites - sync the state
        setFavorites(prev => new Set(prev).add(variantId));
        toast.success('Уже в избранном');
      } else if (error.response?.status === 400) {
        toast.error(errorMessage || 'Неверный запрос. Проверьте, что вариант существует.');
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const handleShare = async (variantId, e) => {
    e.stopPropagation();
    
    if (!variantId) {
      toast.error('Ошибка: ID варианта не найден');
      return;
    }
    
    const shareUrl = `${window.location.origin}/share/${variantId}`;
    
    try {
      // Try to use the Clipboard API
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('✅ Ссылка скопирована! Теперь вы можете отправить её другим.');
      } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = shareUrl;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        toast.success('✅ Ссылка скопирована! Теперь вы можете отправить её другим.');
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      // Show the URL in a prompt as fallback
      prompt('Скопируйте эту ссылку:', shareUrl);
      toast.info('Ссылка показана в диалоговом окне');
    }
  };

  // Check if any variant is in first-person mode
  const activeFirstPersonVariant = variants.find(v => viewModes[v.id] === 'first-person');

  if (variants.length === 0) return null;

  return (
    <>
      {/* Fullscreen First Person View */}
      {activeFirstPersonVariant && (
        <div className="fixed inset-0 z-50 bg-black">
          <div className="relative w-full h-full">
            <ThreeDViewer
              variant={activeFirstPersonVariant}
              viewMode="first-person"
              planGeometry={activeFirstPersonVariant.planGeometry || null}
            />
            {/* Close Button */}
            <button
              onClick={() => exitFirstPerson(activeFirstPersonVariant.id)}
              className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-3 shadow-lg transition-all z-50"
              aria-label="Close First Person View"
            >
              <svg className="w-6 h-6 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

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
                {/* 3D Viewer Container - Hide if in first-person (shown fullscreen) */}
                {viewMode !== 'first-person' && (
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

                    {/* Bottom Controls */}
                    <div className="absolute bottom-2 left-0 right-0 flex items-center justify-center gap-2 z-10">
                      {/* Navigation Arrow to First Person (only in 3D view) */}
                      {viewMode === '3d' && (
                        <button
                          onClick={(e) => switchToFirstPerson(variant.id, e)}
                          className="bg-white/90 hover:bg-white rounded-full p-2 shadow-lg transition-all"
                          aria-label="First Person View"
                        >
                          <svg className="w-5 h-5 text-[#2593F4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Share Button */}
                      {variant.id && (
                        <button
                          onClick={(e) => handleShare(variant.id, e)}
                          className="bg-blue-600 hover:bg-blue-700 rounded-full p-2 shadow-lg transition-all"
                          aria-label="Поделиться вариантом"
                          title="Поделиться вариантом"
                        >
                          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                          </svg>
                        </button>
                      )}
                      
                      {/* Favorite Button */}
                      {variant.id && (
                        <button
                          onClick={(e) => toggleFavorite(variant.id, e)}
                          className={`rounded-full p-2 shadow-lg transition-all ${
                            favorites.has(variant.id)
                              ? 'bg-red-500 hover:bg-red-600'
                              : 'bg-white/90 hover:bg-white'
                          }`}
                          aria-label={favorites.has(variant.id) ? 'Remove from favorites' : 'Add to favorites'}
                        >
                          <svg 
                            className={`w-5 h-5 ${favorites.has(variant.id) ? 'text-white' : 'text-red-500'}`}
                            fill={favorites.has(variant.id) ? 'currentColor' : 'none'}
                            stroke="currentColor" 
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                )}
                {/* Show placeholder when in first-person mode */}
                {viewMode === 'first-person' && (
                  <div className="w-full h-48 bg-gray-800 relative flex items-center justify-center">
                    <div className="text-white text-sm">First Person View Active</div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        exitFirstPerson(variant.id);
                      }}
                      className="absolute top-2 right-2 bg-white/90 hover:bg-white rounded-lg px-3 py-1.5 text-xs font-semibold text-[#2593F4] shadow-lg transition-all z-10"
                      aria-label="Exit First Person"
                    >
                      Exit
                    </button>
                  </div>
                )}
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
    </>
  );
};

