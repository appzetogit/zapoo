import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import api from "@/lib/api";

export default function PolicyPageTemplate({
  title,
  endpoint,
  renderMode = "html",
}) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [htmlData, setHtmlData] = useState({ title, content: "<p>Loading...</p>" });
  const [aboutData, setAboutData] = useState({
    appName: "",
    description: "",
    features: [],
  });

  useEffect(() => {
    const fetchPolicy = async () => {
      try {
        setLoading(true);
        const response = await api.get(endpoint, {
          params: { module: "restaurant" },
        });
        const payload = response?.data?.data || {};

        if (renderMode === "about") {
          setAboutData({
            appName: payload.appName || "Restaurant",
            description: payload.description || "",
            features: Array.isArray(payload.features) ? payload.features : [],
          });
        } else {
          setHtmlData({
            title: payload.title || title,
            content: payload.content || "<p>No content available.</p>",
          });
        }
      } catch (error) {
        console.error("Failed to load restaurant policy:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicy();
  }, [endpoint, renderMode, title]);

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 px-4 py-4 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="px-4 py-6 max-w-4xl">
        {loading ? (
          <div className="min-h-[40vh] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : renderMode === "about" ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{aboutData.appName}</h2>
              <p className="mt-3 text-gray-700 leading-relaxed">{aboutData.description}</p>
            </div>
            {aboutData.features.length > 0 && (
              <div className="space-y-3">
                {aboutData.features.map((feature, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                    <p className="text-sm text-gray-700 mt-1">{feature.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className="prose prose-slate max-w-none"
            dangerouslySetInnerHTML={{ __html: htmlData.content }}
          />
        )}
      </div>
    </div>
  );
}

