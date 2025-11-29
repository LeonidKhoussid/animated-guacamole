import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Input } from '../components/Input.jsx';
import apiClient from '../utils/apiClient.js';
import { toast } from '../components/Toast.jsx';

export const SubmitApplicationPage = () => {
  const { variantId } = useParams();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [passportData, setPassportData] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!address || !passportData) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await apiClient.post('/applications', {
        variant_id: variantId,
        address,
        passport_data: passportData,
      });
      toast.success('Application submitted successfully!');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit application');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Submit Application to BTI</h1>
        
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <Input
            label="Object Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            placeholder="Enter full address"
          />
          
          <Input
            label="Passport Data"
            value={passportData}
            onChange={(e) => setPassportData(e.target.value)}
            required
            placeholder="Enter passport information"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
          >
            {loading ? 'Submitting...' : 'Submit Application'}
          </button>
        </form>
      </div>
    </div>
  );
};


