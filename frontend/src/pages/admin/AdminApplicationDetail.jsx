import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import adminApiClient from '../../utils/adminApiClient.js';
import { toast } from '../../components/Toast.jsx';

export const AdminApplicationDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');
  const [comment, setComment] = useState('');
  const [aiMistake, setAiMistake] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    try {
      const response = await adminApiClient.get(`/admin/applications/${id}`);
      setApplication(response.data);
      setStatus(response.data.status);
    } catch (error) {
      toast.error('Failed to load application');
      navigate('/admin/applications');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      await adminApiClient.post(`/admin/applications/${id}/decision`, {
        status,
        engineer_comment: comment,
        ai_mistake: aiMistake,
      });
      toast.success('Decision recorded successfully!');
      navigate('/admin/applications');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!application) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/admin/applications')}
          className="text-blue-600 hover:text-blue-800 mb-6"
        >
          ← Back to Applications
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">User Information</h2>
              <p><strong>Name:</strong> {application.user.fullName}</p>
              <p><strong>Phone:</strong> {application.user.phone}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Application Details</h2>
              <p><strong>Address:</strong> {application.address}</p>
              <p><strong>Status:</strong> {application.status}</p>
              <p><strong>Created:</strong> {new Date(application.createdAt).toLocaleString()}</p>
            </div>

            {application.variant && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-bold mb-4">Variant</h2>
                <p>{application.variant.description}</p>
                <p className="mt-2">
                  <strong>Approval Probability:</strong>{' '}
                  {Math.round(application.variant.approvalProbability * 100)}%
                </p>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold mb-4">Make Decision</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                >
                  <option value="NEW">New</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="NEEDS_FIX">Needs Fix</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Comment</label>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="4"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="aiMistake"
                  checked={aiMistake}
                  onChange={(e) => setAiMistake(e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor="aiMistake" className="text-sm text-gray-700">
                  Report AI mistake
                </label>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Decision'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

