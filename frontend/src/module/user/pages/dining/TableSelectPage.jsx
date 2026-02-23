import { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, Users, CheckCircle2, RefreshCcw, Loader2, UtensilsCrossed } from "lucide-react"
import { Button } from "@/components/ui/button"
import AnimatedPage from "../../components/AnimatedPage"
import api from "@/lib/api"

// Convert "12:30 PM" → "12:30" (24-hour HH:mm)
function to24Hour(timeStr) {
    if (!timeStr) return "12:00"
    const [time, modifier] = timeStr.split(" ")
    let [hours, minutes] = time.split(":").map(Number)
    if (modifier === "PM" && hours !== 12) hours += 12
    if (modifier === "AM" && hours === 12) hours = 0
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

// Format date object to YYYY-MM-DD
function toYMD(date) {
    if (!date) return ""
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
}

export default function TableSelectPage() {
    const { state } = useLocation()
    const navigate = useNavigate()

    const { restaurant, guests, date, timeSlot, discount } = state || {}

    const [tables, setTables] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [selectedTable, setSelectedTable] = useState(null)

    const formattedDate = toYMD(date)
    const startTime24 = to24Hour(timeSlot)

    useEffect(() => {
        if (!restaurant || !date || !timeSlot || !guests) {
            navigate("/dining")
            return
        }
        fetchTables()
    }, [])

    const fetchTables = async () => {
        try {
            setLoading(true)
            setError(null)
            setSelectedTable(null)
            const res = await api.get("/available-tables", {
                params: {
                    restaurantId: restaurant._id,
                    date: formattedDate,
                    startTime: startTime24,
                    guestCount: guests,
                },
            })
            if (res.data?.success) {
                // Use the new 'tables' array which includes isBooked flag
                setTables(res.data.data?.tables || res.data.data?.availableTables || [])
            } else {
                setTables([])
            }
        } catch (err) {
            console.error("Table fetch error:", err)
            setTables([])
        } finally {
            setLoading(false)
        }
    }

    const handleTableClick = (table) => {
        if (table.isBooked) {
            alert("This table is already booked for the selected time.")
            return
        }
        setSelectedTable(table)
    }

    const handleContinue = () => {
        if (!selectedTable || selectedTable.isBooked) return
        navigate("/dining/book-confirmation", {
            state: {
                restaurant,
                guests,
                date,
                timeSlot,
                discount,
                tableId: selectedTable._id,
                tableNumber: selectedTable.tableNumber,
                tableCapacity: selectedTable.capacity,
            },
        })
    }

    return (
        <AnimatedPage className="bg-slate-50 min-h-screen pb-28">
            {/* Header */}
            <div className="bg-white px-4 pt-5 pb-6 relative overflow-hidden border-b border-slate-100">
                <div className="absolute top-0 right-0 w-48 h-48 bg-orange-50 rounded-full blur-3xl opacity-60 -mr-16 -mt-16" />
                <div className="relative z-10">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 -ml-2 mb-4 bg-white shadow-sm rounded-full border border-slate-100"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-700" />
                    </button>
                    <h1 className="text-2xl font-bold text-gray-900">Select a Table</h1>
                    <p className="text-gray-500 text-sm mt-1 font-medium">{restaurant?.name}</p>
                </div>
            </div>

            {/* Booking Summary Strip */}
            <div className="mx-4 mt-4 bg-orange-50 border border-orange-100 rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="bg-orange-500 rounded-xl p-2 flex-shrink-0">
                    <Users className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-800 truncate">
                        {guests} guests · {timeSlot}
                    </p>
                    <p className="text-xs text-orange-600 font-medium">
                        {new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", weekday: "short" })}
                    </p>
                </div>
                <button
                    onClick={() => navigate(-1)}
                    className="text-xs text-orange-600 font-bold underline flex-shrink-0"
                >
                    Change
                </button>
            </div>

            {/* Tables Section */}
            <div className="px-4 mt-5">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-bold text-gray-800">Seating Options</h2>
                    <button
                        onClick={fetchTables}
                        className="flex items-center gap-1.5 text-orange-500 text-sm font-semibold"
                    >
                        <RefreshCcw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
                        <p className="text-sm text-gray-500 font-medium">Checking availability…</p>
                    </div>
                ) : tables.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                        <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center">
                            <UtensilsCrossed className="w-8 h-8 text-orange-300" />
                        </div>
                        <div>
                            <p className="text-gray-800 font-bold text-base">No Tables Available</p>
                            <p className="text-gray-500 text-sm mt-1">
                                No tables found for {guests} guests at {timeSlot}. Try a different time.
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate(-1)}
                            className="bg-orange-500 hover:bg-orange-600 text-white rounded-2xl px-6"
                        >
                            Change Time
                        </Button>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-3">
                        {tables.map((table) => {
                            const isSelected = selectedTable?._id === table._id
                            const isBooked = table.isBooked

                            return (
                                <button
                                    key={table._id}
                                    onClick={() => handleTableClick(table)}
                                    className={`relative p-4 rounded-2xl border-2 text-left transition-all duration-200 ${isBooked
                                            ? "border-slate-100 bg-slate-50 opacity-60 grayscale cursor-not-allowed"
                                            : isSelected
                                                ? "border-orange-500 bg-orange-50 shadow-lg shadow-orange-100"
                                                : "border-slate-200 bg-white hover:border-orange-200"
                                        }`}
                                >
                                    {isBooked ? (
                                        <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-gray-200 text-gray-500 text-[8px] font-bold rounded uppercase tracking-wider">
                                            Already Booked
                                        </div>
                                    ) : isSelected && (
                                        <div className="absolute top-3 right-3">
                                            <CheckCircle2 className="w-5 h-5 text-orange-500 fill-orange-100" />
                                        </div>
                                    )}

                                    {/* Table Icon */}
                                    <div
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${isBooked ? "bg-gray-200" : isSelected ? "bg-orange-500" : "bg-slate-100"
                                            }`}
                                    >
                                        <UtensilsCrossed
                                            className={`w-5 h-5 ${isBooked ? "text-gray-400" : isSelected ? "text-white" : "text-slate-500"}`}
                                        />
                                    </div>
                                    <p
                                        className={`font-bold text-base ${isBooked ? "text-gray-400" : isSelected ? "text-orange-600" : "text-gray-800"}`}
                                    >
                                        Table {table.tableNumber}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-0.5 font-medium">
                                        Seats {table.capacity} guests
                                    </p>
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Sticky Footer Button */}
            {tables.length > 0 && !loading && (
                <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-100 p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.05)] z-50">
                    <Button
                        disabled={!selectedTable || selectedTable.isBooked}
                        onClick={handleContinue}
                        className={`w-full h-14 rounded-2xl font-bold text-lg transition-all ${selectedTable && !selectedTable.isBooked
                                ? "bg-orange-500 hover:bg-orange-600 text-white shadow-xl shadow-orange-200"
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            }`}
                    >
                        {selectedTable && !selectedTable.isBooked ? `Continue with Table ${selectedTable.tableNumber}` : "Select a Table"}
                    </Button>
                </div>
            )}
        </AnimatedPage>
    )
}
