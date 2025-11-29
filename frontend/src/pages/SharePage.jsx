import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../utils/apiClient.js';
import { ThreeDViewer } from '../components/ThreeDViewer.jsx';

export const SharePage = () => {
  const { variantId } = useParams();
  const [variant, setVariant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('3d');

  useEffect(() => {
    loadVariant();
  }, [variantId]);

  const loadVariant = async () => {
    try {
      const response = await apiClient.get(`/share/${variantId}`);
      setVariant(response.data);
    } catch (error) {
      console.error('Failed to load variant:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!variant) {
    return <div className="min-h-screen flex items-center justify-center">Variant not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setViewMode('3d')}
                  className={`px-4 py-2 rounded ${viewMode === '3d' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  3D View
                </button>
                <button
                  onClick={() => setViewMode('top')}
                  className={`px-4 py-2 rounded ${viewMode === 'top' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
                >
                  Top View
                </button>
              </div>
              <div className="h-96 bg-gray-100 rounded">
                <ThreeDViewer variant={variant} viewMode={viewMode} />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Variant Details</h2>
            <p className="text-gray-700 mb-4">{variant.description}</p>
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Normative Explanation</h3>
              <p className="text-sm text-gray-600">{variant.normativeExplanation}</p>
            </div>
            <div className="mb-4">
              <h3 className="font-semibold mb-2">Approval Probability</h3>
              <p className="text-sm text-gray-600">
                {Math.round(variant.approvalProbability * 100)}%
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


