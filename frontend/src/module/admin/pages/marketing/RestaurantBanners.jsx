import { useState, useMemo, useEffect, useRef } from "react"
import { Search, Building2, Upload, Loader2, Image as ImageIcon, CheckCircle2, AlertCircle } from "lucide-react"
import apiClient from "@/lib/api/axios"
import { marketingAPI } from "@/lib/api"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"

export default function RestaurantBanners() {
    const [searchQuery, setSearchQuery] = useState("")
    const [requests, setRequests] = useState([])
    const [loading, setLoading] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [selectedAd, setSelectedAd] = useState(null)
    const [isUploadOpen, setIsUploadOpen] = useState(false)
    const [selectedFile, setSelectedFile] = useState(null)
    const [previewUrl, setPreviewUrl] = useState(null)

    const fileInputRef = useRef(null)

    const fetchRequests = async (force = false) => {
        try {
            setLoading(true)
            const res = await marketingAPI.getAllRequests({ force })
            const data = res.data.data || []
            // Filter for ads that are paid but pending banner
            const pendingAds = data.filter(ad => ad.status === "Banner Pending")
            setRequests(pendingAds)
        } catch (err) {
            toast.error("Failed to load restaurant banner requests")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { fetchRequests() }, [])

    const filteredRequests = useMemo(() => {
        let result = [...requests]
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim()
            result = result.filter(request =>
                request._id.toLowerCase().includes(query) ||
                request.restaurant?.name?.toLowerCase().includes(query) ||
                request.title?.toLowerCase().includes(query)
            )
        }
        return result
    }, [requests, searchQuery])

    const handleFileSelect = (e) => {
        const file = e.target.files[0]
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error("File size exceeds 5MB")
                return
            }
            setSelectedFile(file)
            setPreviewUrl(URL.createObjectURL(file))
        }
    }

    const handleUploadBanner = async () => {
        if (!selectedFile || !selectedAd) return

        try {
            setUploading(true)
            const formData = new FormData()
            formData.append("bannerImage", selectedFile)

            await apiClient.post(`/marketing/ads/${selectedAd._id}/banner`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            })

            toast.success("Banner uploaded successfully!")
            setIsUploadOpen(false)
            setSelectedAd(null)
            setSelectedFile(null)
            setPreviewUrl(null)
            fetchRequests(true)
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to upload banner")
        } finally {
            setUploading(false)
        }
    }

    const openUploadModal = (ad) => {
        setSelectedAd(ad)
        setIsUploadOpen(true)
        setSelectedFile(null)
        setPreviewUrl(null)
    }

    return (
        <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-slate-900">Restaurant Banners</h1>
                    <p className="text-slate-500 text-sm mt-1">Upload final banners for paid ad requests</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            placeholder="Search by Ad ID, Title or Restaurant..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-10"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200">
                        <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
                        <p className="text-slate-500">Loading pending banners...</p>
                    </div>
                ) : filteredRequests.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl border border-slate-200 text-center px-4">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <ImageIcon className="w-8 h-8 text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900">No Pending Banners</h3>
                        <p className="text-slate-500 max-w-sm mt-2">There are currently no ad requests waiting for banner upload. Paid ads will appear here.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredRequests.map((ad) => (
                            <Card key={ad._id} className="overflow-hidden border-slate-200 hover:shadow-md transition-shadow">
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center shrink-0">
                                                <Building2 className="w-5 h-5 text-orange-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className="font-bold text-slate-900 truncate">{ad.restaurant?.name}</h3>
                                                <p className="text-[10px] text-slate-400 font-mono uppercase">ID: {ad._id.slice(-8).toUpperCase()}</p>
                                            </div>
                                        </div>
                                        <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                                            Paid
                                        </span>
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Title</p>
                                            <p className="text-sm text-slate-700 font-medium">{ad.title}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Description</p>
                                            <p className="text-sm text-slate-600 line-clamp-2">{ad.description || "No description provided"}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Start Date</p>
                                                <p className="text-xs text-slate-700">{new Date(ad.startDate).toLocaleDateString()}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">End Date</p>
                                                <p className="text-xs text-slate-700">{new Date(ad.endDate).toLocaleDateString()}</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Button
                                        onClick={() => openUploadModal(ad)}
                                        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold"
                                    >
                                        <Upload className="w-4 h-4 mr-2" />
                                        Upload Banner
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}

                <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
                    <DialogContent className="max-w-5xl bg-white border-0 shadow-2xl p-0 overflow-hidden rounded-2xl">
                        <DialogHeader className="p-6 bg-slate-50 border-b border-slate-100">
                            <DialogTitle className="text-slate-900 flex items-center gap-2">
                                <ImageIcon className="w-5 h-5 text-orange-500" />
                                Upload Restaurant Banner
                            </DialogTitle>
                        </DialogHeader>

                        <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-0">
                            <div className="p-6">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    onChange={handleFileSelect}
                                    accept="image/*"
                                    className="hidden"
                                />

                                <div
                                    onClick={() => fileInputRef.current.click()}
                                    className={`
                  relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition-all min-h-[200px]
                  ${previewUrl ? 'border-orange-500 bg-orange-50' : 'border-slate-200 hover:border-orange-300 hover:bg-slate-50'}
                `}
                                >
                                    {previewUrl ? (
                                        <div className="relative w-full h-full flex flex-col items-center">
                                            <img
                                                src={previewUrl}
                                                alt="Preview"
                                                className="max-h-40 rounded-lg shadow-sm mb-3 object-contain"
                                            />
                                            <p className="text-sm font-bold text-orange-600">{selectedFile?.name}</p>
                                            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center text-white text-xs font-bold">
                                                Click to Change
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                                <Upload className="w-6 h-6 text-slate-400" />
                                            </div>
                                            <p className="text-sm font-bold text-slate-900">Select Banner Image</p>
                                            <p className="text-xs text-slate-500 mt-1">Recommended size: 1200x600px</p>
                                        </>
                                    )}
                                </div>

                                <div className="mt-6 bg-orange-50 rounded-xl p-4 border border-orange-100">
                                    <div className="flex gap-3">
                                        <div className="shrink-0 p-1 bg-white rounded-full h-fit shadow-sm">
                                            <AlertCircle className="w-4 h-4 text-orange-500" />
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-xs font-bold text-orange-900 uppercase tracking-wider">Note</p>
                                            <p className="text-[11px] text-orange-800 leading-relaxed font-medium">
                                                Uploading this banner will immediately activate the ad if the start date has passed, or schedule it for the future.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="p-6 pr-8 bg-slate-50 border-l border-slate-100">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Mobile Preview</p>
                                <div className="mx-auto w-[300px] h-[620px] rounded-[32px] bg-white border border-slate-200 shadow-[0_10px_40px_rgba(15,23,42,0.15)] overflow-hidden relative">
                                    {/* Top bar */}
                                    <div className="h-10 px-3 flex items-center justify-between bg-white border-b border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-3 w-24 rounded-full bg-slate-200 animate-pulse" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-5 w-5 rounded-full bg-slate-200 animate-pulse" />
                                        </div>
                                    </div>

                                    <div className="p-3 space-y-3">
                                        {/* Search row */}
                                        <div className="flex items-center gap-2">
                                            <div className="flex-1 h-8 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-6 w-10 rounded-full bg-emerald-200 animate-pulse" />
                                        </div>

                                        {/* Hero banner skeleton */}
                                        <div className="h-32 rounded-2xl bg-slate-200 animate-pulse relative overflow-hidden">
                                            <div className="absolute left-3 top-3 h-6 w-16 rounded-full bg-orange-200 animate-pulse" />
                                        </div>

                                        {/* Banner preview slot - actual look */}
                                        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white">
                                            {previewUrl ? (
                                                <>
                                                    <div className="w-full aspect-[16/6]">
                                                        <img
                                                            src={previewUrl}
                                                            alt="Customer preview"
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </div>
                                                    <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent" />
                                                    <div className="absolute inset-0 p-3 flex flex-col justify-center text-white">
                                                        <div className="inline-flex items-center gap-1 bg-white/20 text-[10px] font-bold px-2 py-0.5 rounded-full w-fit">
                                                            AD
                                                        </div>
                                                        <div className="mt-1 text-sm font-bold line-clamp-1">
                                                            {selectedAd?.title || "Sponsored"}
                                                        </div>
                                                        <div className="text-[11px] text-white/90 line-clamp-2">
                                                            {selectedAd?.description || "Promoted content"}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full aspect-[16/6] bg-slate-200 animate-pulse" />
                                            )}
                                        </div>

                                        {/* Meals under 200 + chips */}
                                        <div className="flex gap-2">
                                            <div className="h-16 w-16 rounded-xl bg-blue-200 animate-pulse" />
                                            <div className="flex-1 grid grid-cols-3 gap-2">
                                                <div className="h-10 rounded-full bg-slate-200 animate-pulse" />
                                                <div className="h-10 rounded-full bg-slate-200 animate-pulse" />
                                                <div className="h-10 rounded-full bg-slate-200 animate-pulse" />
                                            </div>
                                        </div>

                                        {/* Filter chips */}
                                        <div className="grid grid-cols-3 gap-2">
                                            <div className="h-8 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-8 rounded-full bg-slate-200 animate-pulse" />
                                            <div className="h-8 rounded-full bg-slate-200 animate-pulse" />
                                        </div>
                                    </div>

                                    {/* Bottom nav */}
                                    <div className="absolute bottom-0 left-0 right-0 h-10 border-t border-slate-100 bg-white flex items-center justify-around">
                                        <div className="h-4 w-6 rounded-full bg-slate-200 animate-pulse" />
                                        <div className="h-4 w-6 rounded-full bg-slate-200 animate-pulse" />
                                        <div className="h-4 w-6 rounded-full bg-slate-200 animate-pulse" />
                                        <div className="h-4 w-6 rounded-full bg-slate-200 animate-pulse" />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-4 bg-slate-50 border-t border-slate-100 gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsUploadOpen(false)}
                                className="bg-white border-slate-200 hover:bg-slate-50 font-bold"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleUploadBanner}
                                disabled={!selectedFile || uploading}
                                className="bg-orange-500 hover:bg-orange-600 text-white font-bold min-w-[120px]"
                            >
                                {uploading ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Uploading...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="w-4 h-4 mr-2" />
                                        Confirm & Publish
                                    </>
                                )}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    )
}
