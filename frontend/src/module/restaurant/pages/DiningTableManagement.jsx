import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, Edit, Save, X, Utensils, Users, CheckCircle, XCircle, ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"

export default function DiningTableManagement() {
    const navigate = useNavigate()
    const [tables, setTables] = useState([])
    const [bookedTables, setBookedTables] = useState([])
    const [loading, setLoading] = useState(true)
    const [isAdding, setIsAdding] = useState(false)
    const [editingId, setEditingId] = useState(null)

    // Form states
    const [newTable, setNewTable] = useState({ tableNumber: "", capacity: "" })
    const [editForm, setEditForm] = useState({ tableNumber: "", capacity: "", isActive: true })

    useEffect(() => {
        fetchTables()
        fetchBookedTables()
    }, [])

    const fetchTables = async () => {
        try {
            setLoading(true)
            const response = await api.get("/restaurant/dining/tables")
            setTables(response.data.data.tables)
        } catch (error) {
            toast.error("Failed to fetch tables")
        } finally {
            setLoading(false)
        }
    }

    const fetchBookedTables = async () => {
        try {
            const response = await api.get("/restaurant/dining/booked-tables")
            setBookedTables(response.data.data.bookings)
        } catch (error) {
            console.error("Failed to fetch booked tables", error)
        }
    }

    const handleCreateTable = async (e) => {
        e.preventDefault()
        try {
            await api.post("/restaurant/dining/tables", newTable)
            toast.success("Table created successfully")
            setNewTable({ tableNumber: "", capacity: "" })
            setIsAdding(false)
            fetchTables()
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create table")
        }
    }

    const handleUpdateTable = async (id) => {
        try {
            await api.put(`/restaurant/dining/tables/${id}`, editForm)
            toast.success("Table updated successfully")
            setEditingId(null)
            fetchTables()
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update table")
        }
    }

    const handleDeleteTable = async (id) => {
        if (!window.confirm("Are you sure you want to delete this table?")) return
        try {
            await api.delete(`/restaurant/dining/tables/${id}`)
            toast.success("Table deleted successfully")
            fetchTables()
        } catch (error) {
            toast.error("Failed to delete table")
        }
    }

    const handleCancelBooking = async (id) => {
        if (!window.confirm("Cancel this booking?")) return
        try {
            // Reusing existing status update logic
            await api.patch(`/restaurant/dining/reservations/${id}/status`, { status: 'cancelled' })
            toast.success("Booking cancelled")
            fetchBookedTables()
            fetchTables() // Refresh table status
        } catch (error) {
            toast.error("Failed to cancel booking")
        }
    }

    const startEditing = (table) => {
        setEditingId(table._id)
        setEditForm({
            tableNumber: table.tableNumber,
            capacity: table.capacity,
            isActive: table.isActive
        })
    }

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                        aria-label="Go back"
                    >
                        <ArrowLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manage Tables</h1>
                        <p className="text-sm text-gray-500">Add and manage your dining tables</p>
                    </div>
                </div>
                {!isAdding && (
                    <button
                        onClick={() => setIsAdding(true)}
                        className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl transition-all font-semibold shadow-sm"
                    >
                        <Plus className="w-5 h-5" /> Add Table
                    </button>
                )}
            </div>

            {/* Add Table Form */}
            {isAdding && (
                <div className="bg-white border-2 border-orange-100 rounded-2xl p-6 mb-8 shadow-sm animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900">New Table Details</h3>
                        <button onClick={() => setIsAdding(false)} className="text-gray-400 hover:text-gray-600">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <form onSubmit={handleCreateTable} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Table No.</label>
                            <input
                                type="text"
                                required
                                value={newTable.tableNumber}
                                onChange={e => setNewTable({ ...newTable, tableNumber: e.target.value })}
                                placeholder="e.g. T1"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Capacity</label>
                            <input
                                type="number"
                                required
                                value={newTable.capacity}
                                onChange={e => setNewTable({ ...newTable, capacity: e.target.value })}
                                placeholder="e.g. 4"
                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-500 outline-none"
                            />
                        </div>
                        <div className="flex items-end">
                            <button
                                type="submit"
                                className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 rounded-xl transition-all shadow-md active:scale-95"
                            >
                                Create Table
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Tables List */}
            <h2 className="text-lg font-bold text-gray-800 mb-4">Live Table Status</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {loading ? (
                    <div className="col-span-full py-10 text-center">
                        <div className="inline-block animate-spin w-8 h-8 border-4 border-orange-600 border-t-transparent rounded-full mb-2"></div>
                    </div>
                ) : tables.length === 0 ? (
                    <div className="col-span-full py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200 text-center">
                        <p className="text-gray-500">No tables added yet</p>
                    </div>
                ) : (
                    tables.map(table => (
                        <div key={table._id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                            <div className="p-5">
                                {editingId === table._id ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-orange-600">EDITING TABLE</span>
                                            <div className="flex gap-2">
                                                <button onClick={() => setEditingId(null)} className="p-1.5 text-gray-400 hover:text-gray-600">
                                                    <X className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => handleUpdateTable(table._id)} className="p-1.5 text-green-600 hover:text-green-700 bg-green-50 rounded-lg">
                                                    <Save className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Number</label>
                                                <input
                                                    type="text"
                                                    value={editForm.tableNumber}
                                                    onChange={e => setEditForm({ ...editForm, tableNumber: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase">Capacity</label>
                                                <input
                                                    type="number"
                                                    value={editForm.capacity}
                                                    onChange={e => setEditForm({ ...editForm, capacity: e.target.value })}
                                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-orange-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                id={`active-${table._id}`}
                                                checked={editForm.isActive}
                                                onChange={e => setEditForm({ ...editForm, isActive: e.target.checked })}
                                                className="w-4 h-4 text-orange-600 accent-orange-600 rounded"
                                            />
                                            <label htmlFor={`active-${table._id}`} className="text-sm font-medium text-gray-700">Available for booking</label>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="flex items-start justify-between mb-4">
                                            <div className="bg-orange-50 px-3 py-1 rounded-lg">
                                                <span className="text-orange-700 font-bold text-lg">#{table.tableNumber}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <button onClick={() => startEditing(table)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-xl transition-colors">
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => handleDeleteTable(table._id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-1.5 text-gray-600">
                                                    <Users className="w-4 h-4" />
                                                    <span className="text-sm font-semibold">{table.capacity}</span>
                                                </div>
                                                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider uppercase ${table.isBookedNow ? 'bg-red-100 text-red-700' : table.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {table.isBookedNow ? <XCircle className="w-3 h-3" /> : table.isActive ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                                    {table.isBookedNow ? 'Booked' : table.isActive ? 'Active' : 'Inactive'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Booked Tables List Section */}
            <div className="mt-8">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-gray-900 uppercase tracking-tight">Booked Tables</h2>
                    <span className="bg-orange-100 text-orange-600 px-2 py-0.5 rounded text-xs font-bold">{bookedTables.length} TOTAL</span>
                </div>

                {bookedTables.length === 0 ? (
                    <div className="bg-white border-2 border-dashed border-gray-100 rounded-2xl p-10 text-center">
                        <p className="text-gray-400 italic">No bookings found for your tables</p>
                    </div>
                ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden overflow-x-auto shadow-sm">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 border-b border-gray-100">
                                <tr>
                                    <th className="px-4 py-3 font-bold text-gray-600">Table</th>
                                    <th className="px-4 py-3 font-bold text-gray-600">Guest Details</th>
                                    <th className="px-4 py-3 font-bold text-gray-600">Date & Time</th>
                                    <th className="px-4 py-3 font-bold text-gray-600">Status</th>
                                    <th className="px-4 py-3 font-bold text-gray-600 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {bookedTables.map((booking) => (
                                    <tr key={booking._id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-4 font-bold text-gray-900">#{booking.tableNumber}</td>
                                        <td className="px-4 py-4">
                                            <div className="font-bold text-gray-800">{booking.userName}</div>
                                            <div className="text-xs text-gray-500 font-medium">{booking.userPhone}</div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <div className="font-medium text-gray-700">{booking.bookingDate}</div>
                                            <div className="text-xs text-gray-500">{booking.time} ({booking.guests} guests)</div>
                                        </td>
                                        <td className="px-4 py-4 text-xs">
                                            <span className={`px-2 py-0.5 rounded uppercase font-bold tracking-tight ${booking.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                booking.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                {booking.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {booking.status !== 'cancelled' && (
                                                <button
                                                    onClick={() => handleCancelBooking(booking._id)}
                                                    className="text-xs text-red-500 font-bold hover:underline"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
