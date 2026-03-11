import { useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { Search, Download, ChevronDown, Plus, MoreVertical, Building2, Settings, Filter, FileDown, FileSpreadsheet, FileText, Code, Eye, Edit, Trash2, Loader2, Upload, X, Image as ImageIcon } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import SettingsDialog from "../../components/orders/SettingsDialog"
import { exportAdvertisementsToCSV, exportAdvertisementsToExcel, exportAdvertisementsToPDF, exportAdvertisementsToJSON } from "../../components/advertisements/advertisementsExportUtils"
import apiClient from "@/lib/api/axios"
import { marketingAPI } from "@/lib/api"
import { toast } from "sonner"

export default function AdsList() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [adsType, setAdsType] = useState("all")
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(true)
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isViewOpen, setIsViewOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedAd, setSelectedAd] = useState(null)
  const [editFile, setEditFile] = useState(null)
  const [editFilePreview, setEditFilePreview] = useState(null)
  const [editStatus, setEditStatus] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [filters, setFilters] = useState({
    status: "Active", // Default to Active for "Active Campaigns" page
    restaurant: "",
    priority: "",
  })
  const [visibleColumns, setVisibleColumns] = useState({
    si: true,
    adsId: true,
    adsTitle: true,
    restaurantInfo: true,
    adsType: true,
    duration: true,
    status: true,
    priority: true,
    actions: true,
  })

  // Map DB fields to table-friendly shape
  const mapAd = (ad, idx) => ({
    sl: idx + 1,
    _id: ad._id,
    adsId: String(ad._id).slice(-8).toUpperCase(),
    adsTitle: ad.title || "Untitled",
    restaurantName: ad.restaurant?.name || "Unknown",
    restaurantEmail: "", // Could populate if backend returns it
    adsType: ad.targetZones?.map(z => z.name || z).join(", ") || "Banner",
    duration: `${new Date(ad.startDate).toLocaleDateString("en-IN")} – ${new Date(ad.endDate).toLocaleDateString("en-IN")}`,
    status: ad.status,
    priority: ad.priority || null,
    raw: ad,
  })

  // Force actions to be visible even if local storage is stale
  useEffect(() => {
    if (!visibleColumns.actions) {
      setVisibleColumns(prev => ({ ...prev, actions: true }))
    }
  }, [visibleColumns.actions])

  const fetchAds = async (force = false) => {
    try {
      setLoading(true)
      const res = await marketingAPI.getAllRequests({ force })
      const data = res.data.data || []
      setAds(data.map(mapAd))
    } catch (err) {
      console.error("Failed to fetch ads:", err)
      toast.error("Failed to load advertisements")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAds()
  }, [])

  const columnsConfig = {
    si: "Serial Number",
    adsId: "Ads ID",
    adsTitle: "Ads Title",
    restaurantInfo: "Restaurant Info",
    adsType: "Ads Type",
    duration: "Duration",
    status: "Status",
    priority: "Priority",
    actions: "Actions",
  }

  const filteredAds = useMemo(() => {
    let result = [...ads]

    if (adsType !== "all") {
      result = result.filter(ad => ad.adsType === adsType)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(ad =>
        ad.adsId?.toLowerCase().includes(query) ||
        ad.restaurantName?.toLowerCase().includes(query) ||
        ad.adsTitle?.toLowerCase().includes(query)
      )
    }

    if (filters.status) {
      result = result.filter(ad => ad.status === filters.status)
    }

    if (filters.restaurant) {
      result = result.filter(ad => ad.restaurantName === filters.restaurant)
    }

    if (filters.priority) {
      result = result.filter(ad => ad.priority === filters.priority)
    }

    return result
  }, [ads, searchQuery, adsType, filters])

  const activeFiltersCount = Object.values(filters).filter(v => v).length

  const handleExport = (format) => {
    const filename = "ads_list"
    switch (format) {
      case "csv":
        exportAdvertisementsToCSV(filteredAds, filename)
        break
      case "excel":
        exportAdvertisementsToExcel(filteredAds, filename)
        break
      case "pdf":
        exportAdvertisementsToPDF(filteredAds, filename)
        break
      case "json":
        exportAdvertisementsToJSON(filteredAds, filename)
        break
      default:
        break
    }
  }

  const handlePriorityChange = async (adId, newPriority) => {
    try {
      await apiClient.put(`/marketing/ads/${adId}/status`, { priority: newPriority })
      toast.success("Priority updated")
      fetchAds(true)
    } catch (err) {
      toast.error("Failed to update priority")
    }
  }

  const handleViewAd = (ad) => {
    setSelectedAd(ad)
    setIsViewOpen(true)
  }

  const handleEditAd = (ad) => {
    setSelectedAd(ad)
    setEditStatus(ad.status)
    setEditFile(null)
    setEditFilePreview(ad.raw?.bannerImage?.url || ad.raw?.bannerImage || null)
    setIsEditOpen(true)
  }

  const handleEditSubmit = async () => {
    if (!selectedAd) return

    try {
      setIsSubmitting(true)

      // Update status if changed
      if (editStatus && editStatus !== selectedAd.status) {
        await apiClient.put(`/marketing/ads/${selectedAd._id}/status`, { status: editStatus })
      }

      // Update banner image if a new file is selected
      if (editFile) {
        const formData = new FormData()
        formData.append("bannerImage", editFile)
        await apiClient.post(`/marketing/ads/${selectedAd._id}/banner`, formData, {
          headers: { "Content-Type": "multipart/form-data" }
        })
      }

      toast.success("Advertisement updated successfully")
      setIsEditOpen(false)
      setSelectedAd(null)
      fetchAds(true)
    } catch (err) {
      toast.error(err?.response?.data?.message || "Failed to update advertisement")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setEditFile(file)
      setEditFilePreview(URL.createObjectURL(file))
    }
  }

  const handleDeleteClick = (ad) => {
    setSelectedAd(ad)
    setIsDeleteOpen(true)
  }

  const handleDelete = async () => {
    if (selectedAd) {
      try {
        await apiClient.delete(`/marketing/ads/${selectedAd._id}`)
        toast.success("Ad deleted")
        setIsDeleteOpen(false)
        setSelectedAd(null)
      fetchAds(true)
      } catch (err) {
        toast.error("Failed to delete ad")
      }
    }
  }

  const toggleColumn = (key) => {
    setVisibleColumns(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const resetColumns = () => {
    setVisibleColumns({
      si: true,
      adsId: true,
      adsTitle: true,
      restaurantInfo: true,
      adsType: true,
      duration: true,
      status: true,
      priority: true,
      actions: true,
    })
  }

  const handleApplyFilters = () => {
    setIsFilterOpen(false)
  }

  const handleResetFilters = () => {
    setFilters({
      status: "Active",
      restaurant: "",
      priority: "",
    })
  }

  const restaurants = [...new Set(ads.map(ad => ad.restaurantName))].filter(Boolean)
  const statuses = ["Pending", "Approved", "Active", "Scheduled", "Rejected"]

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#FF5200] flex items-center justify-center">
              <Plus className="w-5 h-5 text-white" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900">Ads List</h1>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredAds.length}
              </span>
            </div>
          </div>

          <button
            onClick={() => navigate("/admin/new-advertisement")}
            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-[#FF5200] text-white hover:bg-[#E64A00] flex items-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            New Advertisement
          </button>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={adsType}
            onChange={(e) => setAdsType(e.target.value)}
            className="px-4 py-2.5 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
          >
            <option value="all">All Ads</option>
            <option value="Restaurant Promotion">Restaurant Promotion</option>
            <option value="Video promotion">Video promotion</option>
          </select>

          <div className="relative flex-1 sm:flex-initial min-w-[250px]">
            <input
              type="text"
              placeholder="Search by ads ID or restaurant"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200]"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all">
                <Download className="w-4 h-4" />
                <span className="text-black font-bold">Export</span>
                <ChevronDown className="w-3 h-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
              <DropdownMenuLabel>Export Format</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleExport("csv")} className="cursor-pointer">
                <FileDown className="w-4 h-4 mr-2" />
                Export as CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("excel")} className="cursor-pointer">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("pdf")} className="cursor-pointer">
                <FileText className="w-4 h-4 mr-2" />
                Export as PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")} className="cursor-pointer">
                <Code className="w-4 h-4 mr-2" />
                Export as JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <button
            onClick={() => setIsFilterOpen(true)}
            className={`px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all relative ${activeFiltersCount > 0 ? "border-emerald-500 bg-emerald-50" : ""
              }`}
          >
            <Filter className="w-4 h-4" />
            <span className="text-black font-bold">Filters</span>
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 text-white rounded-full text-[10px] flex items-center justify-center font-bold">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 transition-all"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {visibleColumns.si && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>}
                {visibleColumns.adsId && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Ads ID</th>}
                {visibleColumns.adsTitle && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Ads Title</th>}
                {visibleColumns.restaurantInfo && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Restaurant Info</th>}
                {visibleColumns.adsType && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Ads Type</th>}
                {visibleColumns.duration && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Duration</th>}
                {visibleColumns.status && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>}
                {visibleColumns.priority && <th className="px-4 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Priority</th>}
                <th className="px-4 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-20 text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">Loading active campaigns...</p>
                  </td>
                </tr>
              ) : filteredAds.length === 0 ? (
                <tr>
                  <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-20 text-center">
                    <p className="text-lg font-semibold text-slate-700 mb-1">No Data Found</p>
                    <p className="text-sm text-slate-500">No ads match your search</p>
                  </td>
                </tr>
              ) : (
                filteredAds.map((ad) => (
                  <tr
                    key={ad.sl}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {visibleColumns.si && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{ad.sl}</span>
                      </td>
                    )}
                    {visibleColumns.adsId && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleViewAd(ad)}
                          className="text-sm font-medium text-[#FF5200] hover:text-[#E64A00]"
                        >
                          {ad.adsId}
                        </button>
                      </td>
                    )}
                    {visibleColumns.adsTitle && (
                      <td className="px-4 py-4">
                        <span className="text-sm font-medium text-slate-900">{ad.adsTitle}</span>
                      </td>
                    )}
                    {visibleColumns.restaurantInfo && (
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-orange-600" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-slate-900 leading-tight">{ad.restaurantName}</span>
                          </div>
                        </div>
                      </td>
                    )}
                    {visibleColumns.adsType && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{ad.adsType}</span>
                      </td>
                    )}
                    {visibleColumns.duration && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="text-xs text-slate-700">{ad.duration}</span>
                      </td>
                    )}
                    {visibleColumns.status && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-orange-100 text-[#FF5200]">
                          {ad.status}
                        </span>
                      </td>
                    )}
                    {visibleColumns.priority && (
                      <td className="px-4 py-4 whitespace-nowrap">
                        <select
                          value={ad.priority || ""}
                          onChange={(e) => handlePriorityChange(ad._id, e.target.value)}
                          className="px-1 py-0.5 text-[11px] border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-[#FF5200]"
                        >
                          <option value="">N/A</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </td>
                    )}
                    <td className="px-4 py-4 whitespace-nowrap text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="p-1.5 rounded text-slate-600 hover:bg-slate-100 transition-colors">
                            <MoreVertical className="w-4 h-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 bg-white border border-slate-200 rounded-lg shadow-lg z-50">
                          <DropdownMenuItem
                            onClick={() => handleViewAd(ad)}
                            className="cursor-pointer"
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEditAd(ad)}
                            className="cursor-pointer"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(ad)}
                            className="cursor-pointer text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Panel */}
      <Dialog open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5" />
              Filter Ads
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
              >
                <option value="">All Statuses</option>
                {statuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Restaurant
              </label>
              <select
                value={filters.restaurant}
                onChange={(e) => setFilters(prev => ({ ...prev, restaurant: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
              >
                <option value="">All Restaurants</option>
                {restaurants.map(restaurant => (
                  <option key={restaurant} value={restaurant}>{restaurant}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Priority
              </label>
              <select
                value={filters.priority}
                onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
              >
                <option value="">All Priorities</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
              </select>
            </div>
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                onClick={handleResetFilters}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset
              </button>
              <button
                onClick={handleApplyFilters}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF5200] text-white hover:bg-[#E64A00] transition-all shadow-md"
              >
                Apply
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Settings Dialog */}
      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
        columnsConfig={columnsConfig}
      />

      {/* View Ad Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-2xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Advertisement Details</DialogTitle>
          </DialogHeader>
          {selectedAd && (
            <div className="px-6 pb-6 space-y-4">
              {selectedAd.raw?.bannerImage && (
                <div className="w-full h-48 border border-slate-200 rounded-lg overflow-hidden mb-4 bg-slate-50 flex items-center justify-center">
                  <img src={selectedAd.raw.bannerImage.url || selectedAd.raw.bannerImage} alt="Banner Preview" className="w-full h-full object-contain" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads ID</p>
                  <p className="text-sm text-slate-900">{selectedAd.adsId}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads Title</p>
                  <p className="text-sm text-slate-900">{selectedAd.adsTitle}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Restaurant Name</p>
                  <p className="text-sm text-slate-900">{selectedAd.restaurantName}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Restaurant Email</p>
                  <p className="text-sm text-slate-900">{selectedAd.restaurantEmail || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Ads Type</p>
                  <p className="text-sm text-slate-900">{selectedAd.adsType}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Duration</p>
                  <p className="text-sm text-slate-900">{selectedAd.duration}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Status</p>
                  <p className="text-sm text-slate-900">{selectedAd.status}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-700">Priority</p>
                  <p className="text-sm text-slate-900">{selectedAd.priority || "N/A"}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Ad Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Edit Advertisement</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            {selectedAd && (
              <>
                <div className="text-sm text-slate-500 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-700">Title: </span>{selectedAd.adsTitle} <br />
                  <span className="font-semibold text-slate-700">Restaurant: </span>{selectedAd.restaurantName}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] text-sm"
                  >
                    {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Banner Image (Admin Upload)
                  </label>
                  <div className="mt-2 flex justify-center rounded-lg border border-dashed border-gray-900/25 px-6 py-10">
                    <div className="text-center">
                      {editFilePreview ? (
                        <div className="mb-4 relative h-32 w-full mx-auto">
                          <img src={editFilePreview} alt="Preview" className="h-full w-full object-contain mx-auto rounded-md" />
                          <button onClick={(e) => { e.preventDefault(); setEditFile(null); setEditFilePreview(selectedAd?.raw?.bannerImage?.url || selectedAd?.raw?.bannerImage || null); }} type="button" className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 border border-red-200">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <ImageIcon aria-hidden="true" className="mx-auto size-12 text-gray-300" />
                      )}

                      <div className="mt-4 flex text-sm/6 justify-center text-gray-600">
                        <label
                          htmlFor="banner-upload"
                          className="relative cursor-pointer rounded-md bg-white font-semibold text-[#FF5200] focus-within:outline-none focus-within:ring-2 focus-within:ring-[#FF5200] focus-within:ring-offset-2 hover:text-[#E64A00]"
                        >
                          <span>Upload a file</span>
                          <input id="banner-upload" name="banner-upload" type="file" className="sr-only" onChange={handleFileChange} accept="image/*" />
                        </label>
                        <p className="pl-1">or drag and drop</p>
                      </div>
                      <p className="text-xs/5 text-gray-600 mt-1">PNG, JPG, WEBP up to 5MB</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 mt-6">
              <button
                onClick={() => setIsEditOpen(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleEditSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 text-sm font-medium rounded-lg bg-[#FF5200] text-white hover:bg-[#E64A00] transition-all shadow-md flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Delete Advertisement</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this advertisement? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 pb-6 flex items-center justify-end gap-3">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md"
            >
              Delete
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
