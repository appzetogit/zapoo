import { useState, useEffect } from "react"
import { Edit2, Loader2, Save, X, Layers } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { tierAPI } from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const TIER_COLORS = {
    1: { bg: "bg-white", border: "border-orange-200", badge: "bg-orange-100 text-orange-700", dot: "bg-orange-500", number: "text-orange-600" },
    2: { bg: "bg-white", border: "border-amber-200", badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500", number: "text-amber-600" },
    3: { bg: "bg-white", border: "border-rose-200", badge: "bg-rose-100 text-rose-700", dot: "bg-rose-500", number: "text-rose-600" },
    4: { bg: "bg-white", border: "border-purple-200", badge: "bg-purple-100 text-purple-700", dot: "bg-purple-500", number: "text-purple-600" },
}

export default function SlotConfiguration() {
    const [tiers, setTiers] = useState([])
    const [loading, setLoading] = useState(true)
    const [editingTier, setEditingTier] = useState(null)
    const [editValue, setEditValue] = useState(5)
    const [saving, setSaving] = useState(false)

    const fetchTiers = async (force = false) => {
        try {
            setLoading(true)
            const res = await tierAPI.getAllTiers({ force })
            // getAllTiers returns data as a flat array via successResponse
            const tiersData = res.data.data
            setTiers(Array.isArray(tiersData) ? tiersData : tiersData?.tiers || [])
        } catch (error) {
            toast.error("Failed to fetch tiers")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchTiers() }, [])

    const handleSave = async (tierId) => {
        if (!editValue || editValue < 1) {
            toast.error("Minimum 1 banner required")
            return
        }
        try {
            setSaving(true)
            await tierAPI.updateTier(tierId, { maxBanners: editValue })
            toast.success("Banner limit updated!")
            setEditingTier(null)
            fetchTiers(true)
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update")
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Banner Slot Configuration</h1>
                <p className="text-sm text-gray-500 mt-1">
                    Set the maximum number of concurrent promoted listings per tier per day.
                    Minimum 1 banner is always guaranteed.
                </p>
            </div>

            {/* Tier cards */}
            {tiers.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-200">
                    <Layers className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <h3 className="text-lg font-bold text-gray-900">No Tiers Found</h3>
                    <p className="text-gray-500 mt-1">
                        <a href="/admin/tiers" className="text-orange-600 font-semibold underline">Go to Tiers → Create a tier first</a>
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <AnimatePresence mode="popLayout">
                        {tiers.map((tier) => {
                            const colors = TIER_COLORS[tier.rank] || TIER_COLORS[1]
                            const isEditing = editingTier === tier._id

                            return (
                                <motion.div
                                    key={tier._id}
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                >
                                    <Card className={`border-2 ${colors.border} ${colors.bg} h-full`}>
                                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
                                                <CardTitle className="text-base font-bold text-gray-900">
                                                    {tier.name}
                                                </CardTitle>
                                            </div>
                                            <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${colors.badge}`}>
                                                Tier {tier.rank}
                                            </span>
                                        </CardHeader>

                                        <CardContent className="pt-3 space-y-4">
                                            <p className="text-xs text-gray-500">
                                                {tier.description || `Zones with ${tier.minArea}–${tier.maxArea} km² area`}
                                            </p>

                                            <div className="flex items-center justify-between py-1">
                                                <span className="text-sm font-medium text-gray-600">Max Banners / Day</span>
                                                {isEditing ? (
                                                    <Input
                                                        type="number"
                                                        value={editValue}
                                                        onChange={e => setEditValue(Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="w-24 h-8 text-center font-bold border-orange-300 focus:ring-orange-500"
                                                        min="1"
                                                        autoFocus
                                                    />
                                                ) : (
                                                    <span className={`text-3xl font-black ${colors.number ?? "text-gray-900"}`}>
                                                        {tier.maxBanners ?? 5}
                                                    </span>
                                                )}
                                            </div>

                                            <p className="text-[11px] text-gray-400">
                                                Minimum 1 banner always guaranteed
                                            </p>

                                            <div className="pt-2 border-t border-dashed border-gray-200">
                                                {isEditing ? (
                                                    <div className="flex gap-2">
                                                        <Button
                                                            className="flex-1 bg-orange-600 hover:bg-orange-700 h-9"
                                                            onClick={() => handleSave(tier._id)}
                                                            disabled={saving}
                                                        >
                                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4 mr-2" />Save</>}
                                                        </Button>
                                                        <Button
                                                            variant="outline"
                                                            className="h-9"
                                                            onClick={() => setEditingTier(null)}
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ) : (
                                                    <Button
                                                        variant="ghost"
                                                        className="w-full text-orange-600 hover:text-orange-700 hover:bg-orange-50 font-bold"
                                                        onClick={() => {
                                                            setEditingTier(tier._id)
                                                            setEditValue(tier.maxBanners ?? 5)
                                                        }}
                                                    >
                                                        <Edit2 className="w-4 h-4 mr-2" />
                                                        Edit Limit
                                                    </Button>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            )}
        </div>
    )
}
