import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from "react-i18next";
import { Bell, Send, Clock, CheckCircle2, XCircle, AlertCircle, ImagePlus, Camera, X, Trash2, ArrowLeft } from 'lucide-react';
import apiClient from '@/lib/api';

const STATUS_CONFIG = {
    pending: { labelKey: 'restaurant.notificationRequest.status.pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    approved: { labelKey: 'restaurant.notificationRequest.status.approved', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
    rejected: { labelKey: 'restaurant.notificationRequest.status.rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

export default function RestaurantNotificationRequest() {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const [form, setForm] = useState({ title: '', description: '' });
    const [quota, setQuota] = useState({ used: 0, limit: 2, remaining: 2 });
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [page, setPage] = useState(1);

    const PAGE_SIZE = 5;

    // Image state
    const [imageFile, setImageFile] = useState(null);       // File object for preview
    const [imagePreview, setImagePreview] = useState(null); // base64 preview URL
    const [imageUrl, setImageUrl] = useState(null);         // Cloudinary URL after upload
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageError, setImageError] = useState('');
    const fileInputRef = useRef(null);
    const cameraInputRef = useRef(null);

    const fetchRequests = async () => {
        try {
            const res = await apiClient.get('/notification/requests/my');
            setRequests(res.data.data.requests || []);
            setQuota(res.data.data.quota || { used: 0, limit: 2, remaining: 2 });
        } catch {
            // fail silently — list just stays empty
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await apiClient.delete(`/notification/requests/${id}`);
            setRequests((prev) => {
                const next = prev.filter((r) => r._id !== id);
                const totalPages = Math.max(1, Math.ceil(next.length / PAGE_SIZE));
                if (page > totalPages) {
                    setPage(totalPages);
                }
                return next;
            });
        } catch {
            // optionally show toast in future
        }
    };

    useEffect(() => {
        fetchRequests();
    }, []);

    // ── Image handling ────────────────────────────────────────────────────────
    const handleImageChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Client-side validation
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setImageError(t("restaurant.notificationRequest.validation.imageType"));
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError(t("restaurant.notificationRequest.validation.imageSize"));
            return;
        }

        setImageError('');
        setImageFile(file);
        setImageUrl(null);

        // Show local preview immediately
        const reader = new FileReader();
        reader.onload = (ev) => setImagePreview(ev.target.result);
        reader.readAsDataURL(file);

        // Upload to Cloudinary via the existing /upload/media endpoint
        setUploadingImage(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const res = await apiClient.post('/upload/media', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = res.data?.data?.url || res.data?.url;
            if (!url) throw new Error(t("restaurant.notificationRequest.validation.noUploadUrl"));
            setImageUrl(url);
        } catch {
            setImageError(t("restaurant.notificationRequest.validation.imageUploadFailed"));
            setImageFile(null);
            setImagePreview(null);
        } finally {
            setUploadingImage(false);
        }
    };

    const clearImage = () => {
        setImageFile(null);
        setImagePreview(null);
        setImageUrl(null);
        setImageError('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (cameraInputRef.current) cameraInputRef.current.value = '';
    };

    // ── Form submit ───────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!form.title.trim() || !form.description.trim()) {
            setError(t("restaurant.notificationRequest.validation.titleDescriptionRequired"));
            return;
        }
        if (uploadingImage) {
            setError(t("restaurant.notificationRequest.validation.imageUploading"));
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.post('/notification/requests', {
                ...form,
                imageUrl: imageUrl || null,
            });
            setSuccess(t("restaurant.notificationRequest.feedback.submitSuccess"));
            setForm({ title: '', description: '' });
            clearImage();
            fetchRequests();
        } catch (err) {
            const msg = err.response?.data?.message || t("restaurant.notificationRequest.feedback.submitFailed");
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const isLimitReached = quota.remaining <= 0;
    const hasPending = requests.some(r => r.status === 'pending');
    const formDisabled = isLimitReached || hasPending;

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-1.5 -ml-1 rounded-lg hover:bg-slate-200/80 transition-colors shrink-0"
                        aria-label={t("restaurant.notificationRequest.aria.goBack")}
                    >
                        <ArrowLeft className="w-5 h-5 text-slate-700" />
                    </button>
                    <Bell className="w-6 h-6 text-[#FF5200]" />
                    <h1 className="text-2xl font-bold text-slate-900">{t("restaurant.notificationRequest.title")}</h1>
                </div>

                {/* Quota Bar */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                        <p className="text-sm font-medium text-slate-700">{t("restaurant.notificationRequest.quota.title")}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{t("restaurant.notificationRequest.quota.subtitle")}</p>
                    </div>
                    <div
                        className="w-full sm:w-auto overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
                    >
                        <div className="inline-flex items-center gap-2 min-w-max pr-1">
                            {[...Array(quota.limit)].map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border-2 flex items-center justify-center text-[11px] sm:text-xs font-bold flex-shrink-0 ${i < quota.used
                                        ? 'bg-[#FF5200] border-[#FF5200] text-white'
                                        : 'bg-slate-100 border-slate-300 text-slate-400'
                                        }`}
                                >
                                    {i < quota.used ? '\u2713' : i + 1}
                                </div>
                            ))}
                            <span className="ml-1 sm:ml-2 text-sm text-slate-600 font-medium whitespace-nowrap">
                                {t("restaurant.notificationRequest.quota.used", { used: quota.used, limit: quota.limit })}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Submit Form */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("restaurant.notificationRequest.submit.title")}</h2>

                    {(isLimitReached || hasPending) && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-700">
                                {isLimitReached
                                    ? t("restaurant.notificationRequest.submit.limitReached")
                                    : t("restaurant.notificationRequest.submit.pendingExists")}
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {t("restaurant.notificationRequest.fields.notificationTitle")} <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                placeholder={t("restaurant.notificationRequest.placeholders.title")}
                                maxLength={60}
                                disabled={formDisabled}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] disabled:opacity-50 disabled:bg-slate-50"
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">{form.title.length}/60</p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {t("restaurant.notificationRequest.fields.description")} <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder={t("restaurant.notificationRequest.placeholders.description")}
                                rows={4}
                                maxLength={200}
                                disabled={formDisabled}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] disabled:opacity-50 disabled:bg-slate-50 resize-none"
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">{form.description.length}/200</p>
                        </div>

                        {/* Image Upload */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                {t("restaurant.notificationRequest.fields.image")} <span className="text-slate-400 font-normal">({t("restaurant.notificationRequest.common.optional")})</span>
                            </label>

                            {!imagePreview ? (
                                /* Upload options: gallery + camera */
                                <div className="space-y-2">
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        disabled={formDisabled}
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                    <input
                                        ref={cameraInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        capture="environment"
                                        disabled={formDisabled}
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />

                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        disabled={formDisabled}
                                        className={`flex items-center justify-center gap-2 w-full h-12 border-2 border-dashed rounded-lg transition-colors ${formDisabled
                                            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                                            : 'border-slate-300 bg-slate-50 hover:border-[#FF5200] hover:bg-orange-50'
                                            }`}
                                    >
                                        <ImagePlus className="w-5 h-5 text-slate-400" />
                                        <span className="text-sm text-slate-600">Choose from gallery</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => cameraInputRef.current?.click()}
                                        disabled={formDisabled}
                                        className={`flex items-center justify-center gap-2 w-full h-12 border-2 border-dashed rounded-lg transition-colors ${formDisabled
                                            ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                                            : 'border-slate-300 bg-slate-50 hover:border-[#FF5200] hover:bg-orange-50'
                                            }`}
                                    >
                                        <Camera className="w-5 h-5 text-slate-400" />
                                        <span className="text-sm text-slate-600">Take photo</span>
                                    </button>

                                    <p className="text-xs text-slate-500 text-center">{t("restaurant.notificationRequest.upload.helpText")}</p>
                                </div>
                            ) : (
                                /* Preview */
                                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-200">
                                    <img src={imagePreview} alt={t("restaurant.notificationRequest.aria.imagePreview")} className="w-full h-full object-cover" />
                                    {/* Uploading overlay */}
                                    {uploadingImage && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <div className="flex flex-col items-center text-white text-xs gap-1">
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                {t("restaurant.notificationRequest.upload.uploading")}
                                            </div>
                                        </div>
                                    )}
                                    {/* Uploaded badge */}
                                    {!uploadingImage && imageUrl && (
                                        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                                            {t("restaurant.notificationRequest.upload.uploaded")}
                                        </div>
                                    )}
                                    {/* Remove button */}
                                    {!formDisabled && (
                                        <button
                                            type="button"
                                            onClick={clearImage}
                                            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
                                            aria-label={t("restaurant.notificationRequest.aria.removeImage")}
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>
                            )}

                            {imageError && (
                                <p className="text-xs text-red-600 mt-1">{imageError}</p>
                            )}
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
                        )}
                        {success && (
                            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700">{success}</div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting || formDisabled || uploadingImage}
                            className="flex items-center gap-2 px-6 py-2.5 bg-[#FF5200] text-white text-sm font-medium rounded-lg hover:bg-[#E64A00] transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Send className="w-4 h-4" />
                            {submitting
                                ? t("restaurant.notificationRequest.actions.submitting")
                                : uploadingImage
                                    ? t("restaurant.notificationRequest.actions.imageUploading")
                                    : t("restaurant.notificationRequest.actions.submitRequest")}
                        </button>
                    </form>
                </div>

                {/* My Requests */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">{t("restaurant.notificationRequest.requests.title")}</h2>

                    {loading ? (
                        <div className="text-center py-8 text-slate-400 text-sm">{t("restaurant.notificationRequest.common.loading")}</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">{t("restaurant.notificationRequest.requests.empty")}</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((req) => {
                                const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                                const Icon = cfg.icon;
                                return (
                                    <div key={req._id} className="flex items-start gap-4 p-4 rounded-lg border border-slate-100 bg-slate-50">
                                        {/* Thumbnail (if image attached) */}
                                        {req.imageUrl && (
                                            <img
                                                src={req.imageUrl}
                                                alt=""
                                                className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-slate-200"
                                            />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-900 truncate">{req.title}</p>
                                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{req.description}</p>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {new Date(req.createdAt).toLocaleDateString(i18n.language === "bn" ? "bn-IN" : i18n.language === "hi" ? "hi-IN" : "en-IN", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.color}`}>
                                                <Icon className="w-3 h-3" />
                                                {t(cfg.labelKey)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(req._id)}
                                                className="p-1.5 rounded-full hover:bg-red-50 text-red-500 hover:text-red-600"
                                                aria-label={t("restaurant.notificationRequest.aria.deleteRequest")}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                            {requests.length > PAGE_SIZE && (
                                <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-xs text-slate-500">
                                    <span>
                                        {t("restaurant.notificationRequest.pagination.pageOf", {
                                            page,
                                            total: Math.max(1, Math.ceil(requests.length / PAGE_SIZE)),
                                        })}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={page === 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
                                        >
                                            {t("restaurant.notificationRequest.pagination.prev")}
                                        </button>
                                        <button
                                            type="button"
                                            disabled={page >= Math.ceil(requests.length / PAGE_SIZE)}
                                            onClick={() => setPage((p) => Math.min(Math.ceil(requests.length / PAGE_SIZE), p + 1))}
                                            className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
                                        >
                                            {t("restaurant.notificationRequest.pagination.next")}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

