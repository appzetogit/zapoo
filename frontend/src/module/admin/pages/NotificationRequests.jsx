import { useState, useEffect, useCallback } from 'react';
import {
    Bell, Clock, CheckCircle2, XCircle, Search, ChevronDown, Settings,
    Megaphone, AlertCircle
} from 'lucide-react';
import apiClient from '@/lib/api';

const STATUS_TABS = ['all', 'pending', 'approved', 'rejected'];

const STATUS_CONFIG = {
    pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock },
    approved: { label: 'Approved', color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle2 },
    rejected: { label: 'Rejected', color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle },
};

export default function AdminNotificationRequests() {
    const [activeTab, setActiveTab] = useState('pending');
    const [requests, setRequests] = useState([]);
    const [pagination, setPagination] = useState({ total: 0, page: 1, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [actionId, setActionId] = useState(null);

    // Settings
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [dailyLimit, setDailyLimit] = useState(2);
    const [savingLimit, setSavingLimit] = useState(false);
    const [limitMsg, setLimitMsg] = useState('');

    // Approve modal
    const [approveModal, setApproveModal] = useState(null); // { request }
    const [editedTitle, setEditedTitle] = useState('');
    const [editedDesc, setEditedDesc] = useState('');

    const fetchRequests = useCallback(async (tab = activeTab, page = 1) => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            if (tab !== 'all') params.status = tab;
            const res = await apiClient.get('/notification/admin/requests', { params });
            setRequests(res.data.data.requests || []);
            setPagination(res.data.data.pagination || { total: 0, page: 1, totalPages: 1 });
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    const fetchSettings = async () => {
        try {
            const res = await apiClient.get('/notification/admin/settings');
            setDailyLimit(res.data.data.restaurantNotificationDailyLimit ?? 2);
        } catch { }
    };

    useEffect(() => {
        fetchRequests(activeTab, 1);
    }, [activeTab]);

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleApprove = async () => {
        if (!approveModal) return;
        setActionId(approveModal.request._id);
        try {
            await apiClient.patch(`/notification/admin/requests/${approveModal.request._id}/approve`, {
                title: editedTitle,
                description: editedDesc,
            });
            setApproveModal(null);
            fetchRequests(activeTab);
        } catch (err) {
            alert(err.response?.data?.message || 'Approval failed');
        } finally {
            setActionId(null);
        }
    };

    const handleReject = async (id) => {
        if (!window.confirm('Reject this notification request?')) return;
        setActionId(id);
        try {
            await apiClient.patch(`/notification/admin/requests/${id}/reject`);
            fetchRequests(activeTab);
        } catch (err) {
            alert(err.response?.data?.message || 'Rejection failed');
        } finally {
            setActionId(null);
        }
    };

    const handleSaveLimit = async () => {
        setSavingLimit(true);
        setLimitMsg('');
        try {
            await apiClient.patch('/notification/admin/settings', {
                restaurantNotificationDailyLimit: Number(dailyLimit),
            });
            setLimitMsg('Saved successfully!');
        } catch {
            setLimitMsg('Failed to save.');
        } finally {
            setSavingLimit(false);
        }
    };

    const openApprove = (req) => {
        setEditedTitle(req.title);
        setEditedDesc(req.description);
        setApproveModal({ request: req });
    };

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Megaphone className="w-6 h-6 text-[#FF5200]" />
                        <h1 className="text-2xl font-bold text-slate-900">Notification Requests</h1>
                    </div>
                    <button
                        onClick={() => setSettingsOpen(v => !v)}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
                    >
                        <Settings className="w-4 h-4" />
                        Settings
                        <ChevronDown className={`w-3 h-3 transition-transform ${settingsOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>

                {/* Settings Panel */}
                {settingsOpen && (
                    <div className="bg-white rounded-xl border border-slate-200 p-5">
                        <h2 className="text-base font-semibold text-slate-900 mb-3">Request Settings</h2>
                        <div className="flex items-center gap-4">
                            <div>
                                <label className="block text-sm text-slate-600 mb-1">Max requests per restaurant per day</label>
                                <input
                                    type="number"
                                    min={0}
                                    max={20}
                                    value={dailyLimit}
                                    onChange={e => setDailyLimit(e.target.value)}
                                    className="w-24 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5200]"
                                />
                            </div>
                            <button
                                onClick={handleSaveLimit}
                                disabled={savingLimit}
                                className="mt-5 px-4 py-2 bg-[#FF5200] text-white text-sm font-medium rounded-lg hover:bg-[#E64A00] transition-all disabled:opacity-50"
                            >
                                {savingLimit ? 'Saving...' : 'Save'}
                            </button>
                            {limitMsg && <p className={`mt-5 text-sm ${limitMsg.includes('success') ? 'text-green-600' : 'text-red-600'}`}>{limitMsg}</p>}
                        </div>
                    </div>
                )}

                {/* Tabs + Table */}
                <div className="bg-white rounded-xl border border-slate-200">
                    {/* Tabs */}
                    <div className="flex border-b border-slate-200 px-4 pt-4">
                        {STATUS_TABS.map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`px-4 py-2 text-sm font-medium rounded-t-lg capitalize mr-1 transition-colors ${activeTab === tab
                                    ? 'bg-[#FF5200] text-white'
                                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                                    }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    {/* Table */}
                    <div className="p-4">
                        {loading ? (
                            <div className="text-center py-12 text-slate-400 text-sm">Loading...</div>
                        ) : requests.length === 0 ? (
                            <div className="text-center py-12 text-slate-400">
                                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                <p className="text-sm">No {activeTab === 'all' ? '' : activeTab} requests.</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Restaurant</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Title</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Description</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Requested</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold text-slate-600 uppercase tracking-wider">Status</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {requests.map(req => {
                                            const cfg = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                                            const Icon = cfg.icon;
                                            const isPending = req.status === 'pending';
                                            return (
                                                <tr key={req._id} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-4">
                                                        <p className="text-sm font-medium text-slate-900">
                                                            {req.restaurantId?.name || '[Deleted]'}
                                                        </p>
                                                        <p className="text-xs text-slate-400">{req.restaurantId?.restaurantId || ''}</p>
                                                    </td>
                                                    <td className="px-4 py-4 max-w-[200px]">
                                                        <p className="text-sm text-slate-800 font-medium truncate">{req.title}</p>
                                                    </td>
                                                    <td className="px-4 py-4 max-w-[280px]">
                                                        <p className="text-sm text-slate-600 line-clamp-2">{req.description}</p>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <p className="text-xs text-slate-500">
                                                            {new Date(req.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                        </p>
                                                    </td>
                                                    <td className="px-4 py-4 whitespace-nowrap">
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
                                                            <Icon className="w-3 h-3" />
                                                            {cfg.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-4 text-center">
                                                        {isPending ? (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button
                                                                    onClick={() => openApprove(req)}
                                                                    disabled={actionId === req._id}
                                                                    className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
                                                                >
                                                                    Approve
                                                                </button>
                                                                <button
                                                                    onClick={() => handleReject(req._id)}
                                                                    disabled={actionId === req._id}
                                                                    className="px-3 py-1.5 text-xs font-medium bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 transition-all disabled:opacity-50"
                                                                >
                                                                    Reject
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <span className="text-xs text-slate-400">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Approve Modal */}
            {approveModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
                        <div className="p-6">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Approve & Send Notification</h3>
                            <p className="text-sm text-slate-500 mb-4">You can edit the content before sending to all users.</p>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
                                    <input
                                        type="text"
                                        value={editedTitle}
                                        onChange={e => setEditedTitle(e.target.value)}
                                        maxLength={120}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5200]"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                    <textarea
                                        value={editedDesc}
                                        onChange={e => setEditedDesc(e.target.value)}
                                        rows={4}
                                        maxLength={500}
                                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#FF5200] resize-none"
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setApproveModal(null)}
                                    className="px-5 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleApprove}
                                    disabled={actionId !== null}
                                    className="px-5 py-2 text-sm font-medium bg-[#FF5200] text-white rounded-lg hover:bg-[#E64A00] transition-all shadow-md disabled:opacity-50"
                                >
                                    {actionId !== null ? 'Sending...' : 'Send to All Users'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
