import { useState, useEffect } from "react"
import { Search, MapPin, Edit2, Loader2, Save, X, AlertCircle } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import axios from "axios"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

export default function SlotConfiguration() {
    const [zones, setZones] = useState([])
    const [slotConfigs, setSlotConfigs] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingZone, setEditingZone] = useState(null)
    const [maxSlots, setMaxSlots] = useState(5)
    const [searchQuery, setSearchQuery] = useState("")

    const fetchInitialData = async () => {
        try {
            setLoading(true)
            const token = localStorage.getItem("adminToken")
            const config = { headers: { Authorization: `Bearer ${token}` } }

            const [zonesRes, configsRes] = await Promise.all([
                axios.get("/api/admin/zones", config),
                axios.get("/api/marketing/slots", config)
            ])

            setZones(zonesRes.data.data || [])
            setSlotConfigs(configsRes.data.data || [])
        } catch (error) {
            toast.error("Failed to fetch configurations")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchInitialData()
    }, [])

    const handleUpdateSlots = async (zoneId) => {
        try {
            const token = localStorage.getItem("adminToken")
            const config = { headers: { Authorization: `Bearer ${token}` } }

            await axios.post("/api/marketing/slots/configure", {
                zoneId,
                maxSlots,
                isActive: true
            }, config)

            toast.success("Slot configuration updated successfully")

            setEditingZone(null)
            fetchInitialData()
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update configuration")
        }
    }

    const filteredZones = zones.filter(zone =>
        zone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        zone.zoneName?.toLowerCase().includes(searchQuery.toLowerCase())
    )

    const getSlotCount = (zoneId) => {
        const config = slotConfigs.find(c => c.zone?._id === zoneId || c.zone === zoneId)
        return config ? config.maxSlots : "Not Configured"
    }

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Slot Configuration</h1>
                    <p className="text-sm text-gray-500">Manage daily advertisement capacity per delivery zone</p>
                </div>

                <div className="relative w-full md:w-96">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                        placeholder="Search zones..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <AnimatePresence mode="popLayout">
                    {filteredZones.map((zone) => (
                        <motion.div
                            key={zone._id}
                            layout
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <Card className="h-full border-gray-200 hover:border-orange-200 transition-colors">
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-bold truncate pr-4">
                                        {zone.name}
                                    </CardTitle>
                                    <div className="p-2 h-8 w-8 bg-orange-50 rounded-lg flex items-center justify-center">
                                        <MapPin className="w-4 h-4 text-orange-600" />
                                    </div>
                                </CardHeader>
                                <CardContent className="pt-4">
                                    <div className="space-y-4">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-500 font-medium">Daily Slots</span>
                                            {editingZone === zone._id ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        value={maxSlots}
                                                        onChange={(e) => setMaxSlots(parseInt(e.target.value))}
                                                        className="w-20 h-8"
                                                        min="1"
                                                    />
                                                </div>
                                            ) : (
                                                <span className="font-bold text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                                    {getSlotCount(zone._id)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="pt-4 border-t border-dashed border-gray-100">
                                            {editingZone === zone._id ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        className="flex-1 bg-orange-600 hover:bg-orange-700 h-9"
                                                        onClick={() => handleUpdateSlots(zone._id)}
                                                    >
                                                        <Save className="w-4 h-4 mr-2" />
                                                        Save
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        className="h-9"
                                                        onClick={() => setEditingZone(null)}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    variant="ghost"
                                                    className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold"
                                                    onClick={() => {
                                                        setEditingZone(zone._id)
                                                        const current = getSlotCount(zone._id)
                                                        setMaxSlots(current === "Not Configured" ? 5 : current)
                                                    }}
                                                >
                                                    <Edit2 className="w-4 h-4 mr-2" />
                                                    Configure Slots
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>

            {filteredZones.length === 0 && (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">No Zones Found</h3>
                    <p className="text-gray-500">Try adjusting your search criteria</p>
                </div>
            )}
        </div>
    )
}
