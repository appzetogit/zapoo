import { useState, useEffect, useCallback } from "react"
import { UtensilsCrossed, Check, X, RefreshCcw, Users, Calendar, Clock, ChevronDown } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

const API_BASE = "/admin/dining"

const STATUS_COLORS = {
    pending: "bg-yellow-100 text-yellow-700",
    confirmed: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    "no-show": "bg-gray-100 text-gray-600",
}

export default function DiningTableManagement() {
    // ---- Restaurants ----
    const [restaurants, setRestaurants] = useState([])
    const [selectedRestaurant, setSelectedRestaurant] = useState("")

    // ---- Reservations ----
    const [reservations, setReservations] = useState([])
    const [resLoading, setResLoading] = useState(false)
    const [resDate, setResDate] = useState("")
    const [resStatus, setResStatus] = useState("")

    // ---- Dining Settings ----
    const [isDiningEnabled, setIsDiningEnabled] = useState(false)
    const [toggling, setToggling] = useState(false)

    // Fetch restaurants for dropdown
    useEffect(() => {
        api.get(`${API_BASE}/restaurants-list`)
            .then(res => {
                if (res.data?.success) {
                    setRestaurants(res.data.data?.restaurants || [])
                }
            })
            .catch(() => { })
    }, [])

    // Update dining status state when restaurant changes
    useEffect(() => {
        const restaurant = restaurants.find(r => r._id === selectedRestaurant)
        if (restaurant) {
            setIsDiningEnabled(restaurant.diningSettings?.isEnabled || false)
        } else {
            setIsDiningEnabled(false)
        }
    }, [selectedRestaurant, restaurants])

    // Toggle Dining Status
    const handleToggleDining = async () => {
        if (!selectedRestaurant) return
        setToggling(true)
        try {
            const nextStatus = !isDiningEnabled
            await api.patch(`${API_BASE}/restaurants/${selectedRestaurant}/toggle-dining`, { isEnabled: nextStatus })
            setIsDiningEnabled(nextStatus)
            toast.success(`Dining ${nextStatus ? 'enabled' : 'disabled'} successfully`)

            // Update local restaurants list
            setRestaurants(prev => prev.map(r =>
                r._id === selectedRestaurant
                    ? { ...r, diningSettings: { ...r.diningSettings, isEnabled: nextStatus } }
                    : r
            ))
        } catch (error) {
            toast.error("Failed to update dining status")
        } finally {
            setToggling(false)
        }
    }

    // Fetch reservations
    const fetchReservations = useCallback(async () => {
        setResLoading(true)
        try {
            const params = {}
            if (selectedRestaurant) params.restaurantId = selectedRestaurant
            if (resDate) params.date = resDate
            if (resStatus) params.status = resStatus
            const res = await api.get(`${API_BASE}/reservations`, { params })
            if (res.data?.success) setReservations(res.data.data?.reservations || [])
        } catch { setReservations([]) } finally { setResLoading(false) }
    }, [selectedRestaurant, resDate, resStatus])

    useEffect(() => {
        fetchReservations()
    }, [fetchReservations])

    // Update Reservation Status — calls /dining/bookings/:id/status/admin
    const handleUpdateResStatus = async (id, status) => {
        try {
            await api.patch(`/dining/bookings/${id}/status/admin`, { status })
            fetchReservations()
        } catch { }
    }

    return (
        <div className="p-4 md:p-6 max-w-5xl mx-auto pb-24">
            {/* Page Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                    <UtensilsCrossed className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">Dining Management</h1>
                    <p className="text-sm text-gray-500">Enable/Disable dining and monitor reservations</p>
                </div>
            </div>

            {/* Restaurant Selector & Toggle */}
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select Restaurant</label>
                        <div className="relative">
                            <select
                                value={selectedRestaurant}
                                onChange={e => setSelectedRestaurant(e.target.value)}
                                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 pr-10 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 font-medium text-gray-800 appearance-none"
                            >
                                <option value="">-- Select a Restaurant --</option>
                                {restaurants.map(r => (
                                    <option key={r._id} value={r._id}>{r.name}</option>
                                ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {selectedRestaurant && (
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-xl border border-orange-100">
                            <div>
                                <p className="text-sm font-bold text-gray-800">Dining Feature</p>
                                <p className="text-xs text-gray-500">{isDiningEnabled ? 'Currently active' : 'Currently disabled'}</p>
                            </div>
                            <button
                                onClick={handleToggleDining}
                                disabled={toggling}
                                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${isDiningEnabled ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-green-500 hover:bg-green-600 text-white'} disabled:opacity-50`}
                            >
                                {toggling ? 'Updating...' : (isDiningEnabled ? 'Disable Dining' : 'Enable Dining')}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* ===================== RESERVATIONS ===================== */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h2 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-orange-600" />
                        Reservations {selectedRestaurant ? `(${reservations.length})` : '(All)'}
                    </h2>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap gap-3 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Date</label>
                        <input
                            type="date"
                            value={resDate}
                            onChange={e => setResDate(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                        />
                    </div>
                    <div className="flex-1 min-w-[150px]">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Status</label>
                        <select
                            value={resStatus}
                            onChange={e => setResStatus(e.target.value)}
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                        >
                            <option value="">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="no-show">No Show</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={fetchReservations}
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-lg transition-colors h-[38px]"
                        >
                            <RefreshCcw className="w-4 h-4" /> Refresh
                        </button>
                    </div>
                </div>

                {resLoading ? (
                    <div className="text-center py-20">
                        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                        <p className="text-gray-500">Fetching reservations...</p>
                    </div>
                ) : reservations.length === 0 ? (
                    <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
                        <Calendar className="w-12 h-12 text-gray-200 mx-auto mb-3" />
                        <h3 className="text-lg font-bold text-gray-900">No reservations found</h3>
                        <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or selecting a different restaurant</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {reservations.map(res => {
                            const userName = res.user?.name || "Guest"
                            const userPhone = res.user?.phone || ""
                            const userEmail = res.user?.email || ""
                            const restaurantName = res.restaurant?.name || "Unknown Restaurant"
                            const bookingDate = res.date ? new Date(res.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "—"
                            const bid = res.bookingId || res._id?.slice(-6).toUpperCase()

                            return (
                                <div key={res._id} className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider ${STATUS_COLORS[res.status] || "bg-gray-100 text-gray-600"}`}>
                                                    {res.status}
                                                </span>
                                                <span className="text-[10px] bg-gray-50 text-gray-400 px-2 py-1 rounded-full font-mono border border-gray-100">
                                                    #{bid}
                                                </span>
                                            </div>

                                            <div className="flex items-start justify-between">
                                                <div>
                                                    <h4 className="font-bold text-gray-900 text-base">{userName}</h4>
                                                    <p className="text-xs text-gray-500 mb-2">{userPhone}{userPhone && userEmail ? ' • ' : ''}{userEmail}</p>
                                                    <p className="text-sm font-semibold text-orange-600 mb-3">{restaurantName}</p>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap gap-4 pt-3 border-t border-gray-50">
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Calendar className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">{bookingDate}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Clock className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">{res.timeSlot || "—"}</span>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-sm text-gray-600">
                                                    <Users className="w-4 h-4 text-gray-400" />
                                                    <span className="font-medium">{res.guests || "—"} Guests</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex md:flex-col gap-2">
                                            {res.status === 'confirmed' && (
                                                <button
                                                    onClick={() => handleUpdateResStatus(res._id, "completed")}
                                                    className="flex-1 px-4 py-2 bg-green-50 hover:bg-green-100 text-green-700 text-xs font-bold rounded-xl transition-colors"
                                                >
                                                    Mark Completed
                                                </button>
                                            )}
                                            {['pending', 'confirmed'].includes(res.status) && (
                                                <button
                                                    onClick={() => handleUpdateResStatus(res._id, "cancelled")}
                                                    className="flex-1 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {res.specialRequest && (
                                        <div className="mt-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <p className="text-xs text-gray-500 leading-relaxed"><span className="font-bold text-gray-700">Special Request:</span> {res.specialRequest}</p>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}
