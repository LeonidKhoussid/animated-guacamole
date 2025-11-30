import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { VariantCard } from '../components/VariantCard.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import apiClient from '../utils/apiClient.js';
import { toast } from '../components/Toast.jsx';

export const FavoritesPage = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState(null);
  const location = useLocation();

  useEffect(() => {
    loadFavorites();
  }, [location.pathname]); // Reload when navigating to this page

  const loadFavorites = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/favorites');
      console.log('Favorites response:', response.data);
      console.log('Favorites count:', response.data?.length);
      
      // Filter out favorites where variant was deleted or is null
      const valid = (response.data || []).filter((fav) => {
        const hasVariant = fav?.variant && fav.variant.id;
        if (!hasVariant) {
          console.warn('Filtered out favorite with missing variant:', fav);
        }
        return hasVariant;
      });
      
      console.log('Valid favorites after filtering:', valid.length);
      setFavorites(valid);
    } catch (error) {
      console.error('Failed to load favorites:', error);
      console.error('Error response:', error.response?.data);
      if (error.response?.status === 401 || error.response?.status === 403) {
        // User not authenticated - silently fail
        setFavorites([]);
      } else {
        toast.error('Failed to load favorites');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (variantId) => {
    if (removingId) return;
    setRemovingId(variantId);
    try {
      await apiClient.delete(`/favorites/${variantId}`);
      setFavorites((prev) => prev.filter((fav) => fav.variant?.id !== variantId));
      toast.success('Удалено из избранного');
    } catch (error) {
      console.error('Remove favorite error:', error);
      toast.error(error.response?.data?.error || 'Ошибка при удалении из избранного');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Favorites</h1>
          
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, idx) => (
              <div
                key={idx}
                className="bg-white rounded-lg shadow-md p-4 animate-pulse h-60"
              >
                <div className="h-36 bg-gray-200 rounded mb-4" />
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-10 text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              No favorites yet
            </h2>
            <p className="text-gray-600 mb-6">
              Save variants you like to quickly find them later.
            </p>
            <Link
              to="/dashboard"
              className="inline-block bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
            >
              Browse Variants
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => (
              <div key={fav.id} className="relative group">
                <VariantCard variant={fav.variant} />
                <button
                  onClick={() => handleRemove(fav.variant?.id)}
                  disabled={removingId === fav.variant?.id}
                  className="absolute top-3 right-3 bg-white/90 hover:bg-white text-red-600 text-sm px-3 py-1 rounded shadow transition disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {removingId === fav.variant?.id ? 'Removing…' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};
