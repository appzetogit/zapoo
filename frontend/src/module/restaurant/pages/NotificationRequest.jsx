import { useState, useEffect, useRef } from 'react';
import { Bell, Send, Clock, CheckCircle2, XCircle, AlertCircle, ImagePlus, X, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api';

const STATUS_CONFIG = {
    pending: { label: 'Pending Review', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    approved: { label: 'Approved & Sent', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

export default function RestaurantNotificationRequest() {
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
            setImageError('Only JPG, PNG, or WEBP images are allowed.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setImageError('Image must be under 5 MB.');
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
            if (!url) throw new Error('No URL returned');
            setImageUrl(url);
        } catch {
            setImageError('Image upload failed. You can still submit without an image.');
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
    };

    // ── Form submit ───────────────────────────────────────────────────────────
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!form.title.trim() || !form.description.trim()) {
            setError('Title and description are required.');
            return;
        }
        if (uploadingImage) {
            setError('Image is still uploading, please wait.');
            return;
        }
        setSubmitting(true);
        try {
            await apiClient.post('/notification/requests', {
                ...form,
                imageUrl: imageUrl || null,
            });
            setSuccess('Request submitted successfully! Admin will review it shortly.');
            setForm({ title: '', description: '' });
            clearImage();
            fetchRequests();
        } catch (err) {
            const msg = err.response?.data?.message || 'Failed to submit request. Please try again.';
            setError(msg);
        } finally {
            setSubmitting(false);
        }
    };

    const isLimitReached = quota.remaining <= 0;
    const hasPending = requests.some(r => r.status === 'pending');
    const formDisabled = isLimitReached || hasPending;

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-3xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center gap-3">
                    <Bell className="w-6 h-6 text-[#FF5200]" />
                    <h1 className="text-2xl font-bold text-slate-900">Notify Customers</h1>
                </div>

                {/* Quota Bar */}
                <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-700">Today's Request Quota</p>
                        <p className="text-xs text-slate-500 mt-0.5">Resets at midnight</p>
                    </div>
                    <div className="flex items-center gap-2">
                        {[...Array(quota.limit)].map((_, i) => (
                            <div
                                key={i}
                                className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold ${i < quota.used
                                    ? 'bg-[#FF5200] border-[#FF5200] text-white'
                                    : 'bg-slate-100 border-slate-300 text-slate-400'
                                    }`}
                            >
                                {i < quota.used ? '✓' : i + 1}
                            </div>
                        ))}
                        <span className="ml-2 text-sm text-slate-600 font-medium">
                            {quota.used}/{quota.limit} used
                        </span>
                    </div>
                </div>

                {/* Submit Form */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">Submit a Notification Request</h2>

                    {(isLimitReached || hasPending) && (
                        <div className="mb-4 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-amber-700">
                                {isLimitReached
                                    ? 'Daily request limit reached. You can submit again tomorrow.'
                                    : 'You already have a pending request. Wait for admin review.'}
                            </p>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Notification Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={form.title}
                                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                                placeholder="e.g. 30% off all items today!"
                                maxLength={60}
                                disabled={formDisabled}
                                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] disabled:opacity-50 disabled:bg-slate-50"
                            />
                            <p className="text-xs text-slate-400 mt-1 text-right">{form.title.length}/60</p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">
                                Description <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={form.description}
                                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                                placeholder="Write a clear, attractive message for customers..."
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
                                Image <span className="text-slate-400 font-normal">(optional)</span>
                            </label>

                            {!imagePreview ? (
                                /* Upload zone */
                                <label
                                    className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${formDisabled
                                        ? 'border-slate-200 bg-slate-50 cursor-not-allowed opacity-50'
                                        : 'border-slate-300 bg-slate-50 hover:border-[#FF5200] hover:bg-orange-50'
                                        }`}
                                >
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/jpeg,image/jpg,image/png,image/webp"
                                        disabled={formDisabled}
                                        onChange={handleImageChange}
                                        className="hidden"
                                    />
                                    <ImagePlus className="w-7 h-7 text-slate-400 mb-1" />
                                    <p className="text-xs text-slate-500">Click to upload — JPG, PNG or WEBP, max 5 MB</p>
                                </label>
                            ) : (
                                /* Preview */
                                <div className="relative w-full h-40 rounded-lg overflow-hidden border border-slate-200">
                                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                    {/* Uploading overlay */}
                                    {uploadingImage && (
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                            <div className="flex flex-col items-center text-white text-xs gap-1">
                                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                Uploading…
                                            </div>
                                        </div>
                                    )}
                                    {/* Uploaded badge */}
                                    {!uploadingImage && imageUrl && (
                                        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
                                            ✓ Uploaded
                                        </div>
                                    )}
                                    {/* Remove button */}
                                    {!formDisabled && (
                                        <button
                                            type="button"
                                            onClick={clearImage}
                                            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black/80 transition-colors"
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
                            {submitting ? 'Submitting...' : uploadingImage ? 'Image uploading...' : 'Submit Request'}
                        </button>
                    </form>
                </div>

                {/* My Requests */}
                <div className="bg-white rounded-xl border border-slate-200 p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">My Requests</h2>

                    {loading ? (
                        <div className="text-center py-8 text-slate-400 text-sm">Loading...</div>
                    ) : requests.length === 0 ? (
                        <div className="text-center py-8 text-slate-400">
                            <Bell className="w-10 h-10 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">No requests submitted yet.</p>
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
                                                {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border whitespace-nowrap ${cfg.color}`}>
                                                <Icon className="w-3 h-3" />
                                                {cfg.label}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(req._id)}
                                                className="p-1.5 rounded-full hover:bg-red-50 text-red-500 hover:text-red-600"
                                                aria-label="Delete request"
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
                                        Page {page} of {Math.max(1, Math.ceil(requests.length / PAGE_SIZE))}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={page === 1}
                                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                                            className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
                                        >
                                            Prev
                                        </button>
                                        <button
                                            type="button"
                                            disabled={page >= Math.ceil(requests.length / PAGE_SIZE)}
                                            onClick={() => setPage((p) => Math.min(Math.ceil(requests.length / PAGE_SIZE), p + 1))}
                                            className="px-2 py-1 rounded-lg border border-slate-200 disabled:opacity-40"
                                        >
                                            Next
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
