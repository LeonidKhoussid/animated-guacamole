import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import apiClient from "../utils/apiClient.js";
import { toast } from "../components/Toast.jsx";
import { ThreeDViewer } from "../components/ThreeDViewer.jsx";

export const VariantViewerPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [variant, setVariant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("3d"); // '3d', 'top', 'first-person'

  useEffect(() => {
    loadVariant();
  }, [id]);

  const loadVariant = async () => {
    try {
      const response = await apiClient.get(`/variants/${id}`);
      const variant = response.data;

      // Log bearing wall information
      if (variant.planGeometry?.geometry?.walls) {
        const walls = variant.planGeometry.geometry.walls;
        const bearingWalls = walls.filter((w) => w.isBearing);
        const nonBearingWalls = walls.filter((w) => !w.isBearing);

        console.log("\n========== VARIANT VIEWER PAGE ==========");
        console.log("📋 Variant ID:", variant.id);
        console.log("📝 Description:", variant.description);
        console.log("\n🏗️  Plan Geometry Analysis:");
        console.log(`   Total walls: ${walls.length}`);
        console.log(
          `   🚫 Bearing walls (CANNOT CHANGE): ${bearingWalls.length} - shown in RED`
        );
        console.log(
          `   ✅ Non-bearing walls (CAN CHANGE): ${nonBearingWalls.length} - shown in GREEN`
        );

        if (bearingWalls.length > 0) {
          console.log(
            "\n⚠️  IMPORTANT: The following walls are BEARING and CANNOT be modified:"
          );
          bearingWalls.forEach((wall, idx) => {
            console.log(`   ${idx + 1}. Wall ${wall.id || "unnamed"}:`);
            console.log(`      - From: (${wall.start.x}m, ${wall.start.y}m)`);
            console.log(`      - To: (${wall.end.x}m, ${wall.end.y}m)`);
            console.log(`      - Thickness: ${wall.thickness || 0.15}m`);
            console.log(
              `      - ⛔ This wall supports the building structure!`
            );
          });
        }
        console.log("==========================================\n");
      } else {
        console.log("⚠️  No plan geometry available for this variant");
      }

      setVariant(variant);
    } catch (error) {
      toast.error("Failed to load variant");
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFavorite = async () => {
    try {
      await apiClient.post("/favorites", { variant_id: id });
      toast.success("Added to favorites!");
    } catch (error) {
      toast.error(error.response?.data?.error || "Failed to add favorite");
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${id}`;
    navigator.clipboard.writeText(shareUrl);
    toast.success("Share link copied to clipboard!");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Loading...
      </div>
    );
  }

  if (!variant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        Variant not found
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center gap-4">
          <Link to="/dashboard" className="text-blue-600 hover:text-blue-800">
            ← Back to Dashboard
          </Link>
          <Link
            to={
              variant?.aiRequest?.planId || variant?.aiRequest?.plan?.id
                ? `/chat/${
                    variant.aiRequest.planId || variant.aiRequest.plan.id
                  }`
                : "/chat"
            }
            className="text-blue-600 hover:text-blue-800">
            ← Back to Chat
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="flex space-x-2 mb-4">
                <button
                  onClick={() => setViewMode("3d")}
                  className={`px-4 py-2 rounded ${
                    viewMode === "3d" ? "bg-blue-600 text-white" : "bg-gray-200"
                  }`}>
                  3D View
                </button>
                <button
                  onClick={() => setViewMode("top")}
                  className={`px-4 py-2 rounded ${
                    viewMode === "top"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200"
                  }`}>
                  Top View
                </button>
                <button
                  onClick={() => setViewMode("first-person")}
                  className={`px-4 py-2 rounded ${
                    viewMode === "first-person"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200"
                  }`}>
                  First Person
                </button>
              </div>
              <div className="h-96 bg-gray-100 rounded">
                <ThreeDViewer
                  variant={variant}
                  viewMode={viewMode}
                  planGeometry={variant.planGeometry || null}
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold mb-4">Variant Details</h2>
              <p className="text-gray-700 mb-4">{variant.description}</p>

              <div className="mb-4">
                <h3 className="font-semibold mb-2">Normative Explanation</h3>
                <p className="text-sm text-gray-600">
                  {variant.normativeExplanation}
                </p>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold mb-2">Approval Probability</h3>
                <div className="w-full bg-gray-200 rounded-full h-4">
                  <div
                    className="bg-blue-600 h-4 rounded-full"
                    style={{
                      width: `${variant.approvalProbability * 100}%`,
                    }}></div>
                </div>
                <p className="text-sm text-gray-600 mt-1">
                  {Math.round(variant.approvalProbability * 100)}%
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleAddFavorite}
                  className="w-full bg-yellow-500 text-white px-4 py-2 rounded hover:bg-yellow-600">
                  Add to Favorites
                </button>
                <button
                  onClick={handleShare}
                  className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600">
                  Share
                </button>
                <Link
                  to={`/submit/${id}`}
                  className="block w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 text-center">
                  Submit to BTI
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
