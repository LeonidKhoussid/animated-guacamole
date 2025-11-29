import { useEffect, useState } from 'react';
import { VariantCard } from '../components/VariantCard.jsx';
import { BottomNav } from '../components/BottomNav.jsx';
import apiClient from '../utils/apiClient.js';
import { toast } from '../components/Toast.jsx';

export const FavoritesPage = () => {
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavorites();
  }, []);

  const loadFavorites = async () => {
    try {
      const response = await apiClient.get('/favorites');
      setFavorites(response.data);
    } catch (error) {
      toast.error('Failed to load favorites');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Favorites</h1>
        
        {loading ? (
          <p className="text-gray-600">Loading...</p>
        ) : favorites.length === 0 ? (
          <p className="text-gray-600">No favorites yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((fav) => (
              <VariantCard key={fav.id} variant={fav.variant} />
            ))}
          </div>
        )}
      </div>
      <BottomNav />
    </div>
  );
};


