import { useEffect, useState } from "react";
import { toast } from "sonner";
import api from "@/lib/api";
import { Textarea } from "@/components/ui/textarea";

const LOCALES = [
  { code: "en", label: "English" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
];

function htmlToText(html) {
  if (!html) return "";

  let text = html;
  text = text.replace(/<p[^>]*>/gi, "").replace(/<\/p>/gi, "\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<div[^>]*>/gi, "").replace(/<\/div>/gi, "\n");
  text = text.replace(/<[^>]*>/g, "");
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  text = text.replace(/&apos;/g, "'");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text
    .split("\n")
    .map((line) => line.trim())
    .join("\n");

  return text.trim();
}

function textToHtml(text) {
  const safe = typeof text === "string" ? text : "";
  return safe
    .split("\n")
    .map((line) => {
      if (line.trim() === "") return "<p><br></p>";
      return `<p>${line}</p>`;
    })
    .join("");
}

export default function PolicyEditor({
  endpoint,
  pageTitle,
  pageSubtitle,
  placeholder,
  loadErrorMessage,
  saveSuccessMessage,
  saveErrorMessage,
  defaultTitle,
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeLocale, setActiveLocale] = useState("en");
  const [policyData, setPolicyData] = useState({
    title: defaultTitle,
    localizedTitle: { en: defaultTitle, hi: "", bn: "" },
    localizedContent: { en: "", hi: "", bn: "" },
  });

  useEffect(() => {
    const fetchPolicyData = async () => {
      try {
        setLoading(true);
        const response = await api.get(endpoint);
        if (response.data.success) {
          const payload = response.data.data || {};
          const localizedTitle = payload.localizedTitle || {};
          const localizedContent = payload.localizedContent || {};
          const englishContent = htmlToText(payload.content || "");

          setPolicyData({
            ...payload,
            title: payload.title || defaultTitle,
            localizedTitle: {
              en: localizedTitle.en || payload.title || defaultTitle,
              hi: localizedTitle.hi || "",
              bn: localizedTitle.bn || "",
            },
            localizedContent: {
              en: htmlToText(localizedContent.en || payload.content || ""),
              hi: htmlToText(localizedContent.hi || ""),
              bn: htmlToText(localizedContent.bn || ""),
            },
            content: englishContent,
          });
        }
      } catch (error) {
        console.error(`Error fetching ${pageTitle}:`, error);
        toast.error(loadErrorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPolicyData();
  }, [defaultTitle, endpoint, loadErrorMessage, pageTitle]);

  const handleSave = async () => {
    try {
      setSaving(true);
      const englishTitle =
        policyData.localizedTitle?.en || policyData.title || defaultTitle;
      const englishContent =
        policyData.localizedContent?.en || policyData.content || "";

      const payload = {
        title: englishTitle,
        content: textToHtml(englishContent),
        localizedTitle: {
          en: englishTitle,
          hi: policyData.localizedTitle?.hi || "",
          bn: policyData.localizedTitle?.bn || "",
        },
        localizedContent: {
          en: textToHtml(policyData.localizedContent?.en || ""),
          hi: textToHtml(policyData.localizedContent?.hi || ""),
          bn: textToHtml(policyData.localizedContent?.bn || ""),
        },
        locale: activeLocale,
        autoTranslate: activeLocale === "en",
      };

      const response = await api.put(endpoint, payload);
      if (response.data.success) {
        const updated = response.data.data || {};
        toast.success(saveSuccessMessage);
        setPolicyData({
          ...updated,
          title: updated.title || englishTitle,
          localizedTitle: {
            en: updated.localizedTitle?.en || updated.title || englishTitle,
            hi: updated.localizedTitle?.hi || payload.localizedTitle.hi,
            bn: updated.localizedTitle?.bn || payload.localizedTitle.bn,
          },
          localizedContent: {
            en: htmlToText(updated.localizedContent?.en || updated.content || payload.content),
            hi: htmlToText(updated.localizedContent?.hi || payload.localizedContent.hi),
            bn: htmlToText(updated.localizedContent?.bn || payload.localizedContent.bn),
          },
          content: htmlToText(updated.content || payload.content),
        });
      }
    } catch (error) {
      console.error(`Error saving ${pageTitle}:`, error);
      toast.error(error.response?.data?.message || saveErrorMessage);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto" />
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const activeContent = policyData.localizedContent?.[activeLocale] || "";

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">{pageTitle}</h1>
          <p className="text-sm text-slate-600 mt-1">{pageSubtitle}</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {LOCALES.map((locale) => (
              <button
                key={locale.code}
                type="button"
                onClick={() => setActiveLocale(locale.code)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  activeLocale === locale.code
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {locale.label}
              </button>
            ))}
          </div>

          <Textarea
            value={activeContent}
            onChange={(e) =>
              setPolicyData((prev) => ({
                ...prev,
                localizedContent: {
                  ...prev.localizedContent,
                  [activeLocale]: e.target.value,
                },
              }))
            }
            placeholder={placeholder}
            className="min-h-[600px] w-full text-sm text-slate-700 leading-relaxed resize-y"
            dir="ltr"
            style={{
              direction: "ltr",
              textAlign: "left",
              unicodeBidi: "bidi-override",
              width: "100%",
              maxWidth: "100%",
            }}
          />
          <p className="mt-3 text-xs text-slate-500">
            Editing: {LOCALES.find((item) => item.code === activeLocale)?.label}
          </p>
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
