import { useState, useMemo, useEffect } from "react"
import { Search, CheckCircle2, XCircle, Eye, Clock, Loader2, Star } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"

export default function FoodApproval() {
  const [standardRequests, setStandardRequests] = useState([])
  const [specialRequests, setSpecialRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState("")
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState("standard")

  // Fetch pending food approval requests
  const fetchFoodRequests = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getPendingFoodApprovals()
      const data = response?.data?.data || response?.data || {}

      setStandardRequests(data.standardRequests || [])
      setSpecialRequests(data.specialRequests || [])
    } catch (error) {
      console.error('Error fetching food approval requests:', error)
      toast.error('Failed to load food approval requests')
      setStandardRequests([])
      setSpecialRequests([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFoodRequests()
  }, [])

  // Current requests based on active tab
  const currentRequests = activeTab === "standard" ? standardRequests : specialRequests

  // Filter requests based on search query
  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) {
      return currentRequests
    }
    const query = searchQuery.toLowerCase().trim()
    return currentRequests.filter((request) =>
      request.itemName?.toLowerCase().includes(query) ||
      request.category?.toLowerCase().includes(query) ||
      request.restaurantName?.toLowerCase().includes(query) ||
      request.restaurantId?.toLowerCase().includes(query) ||
      request.sectionName?.toLowerCase().includes(query)
    )
  }, [currentRequests, searchQuery])

  // Handle approve food item
  const handleApprove = async (request) => {
    try {
      setProcessing(true)

      if (activeTab === "special") {
        await adminAPI.approveSpecialRecommendation(request._id || request.id)
        toast.success('Special recommendation approved successfully')
      } else {
        await adminAPI.approveFoodItem(request._id || request.id)
        toast.success('Food item approved successfully')
      }

      await fetchFoodRequests()
      setShowDetailModal(false)
      setSelectedRequest(null)
    } catch (error) {
      console.error('Error approving food item:', error)
      toast.error(error?.response?.data?.message || 'Failed to approve food item')
    } finally {
      setProcessing(false)
    }
  }

  // Handle reject food item
  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a rejection reason')
      return
    }

    try {
      setProcessing(true)

      if (activeTab === "special") {
        await adminAPI.rejectSpecialRecommendation(selectedRequest._id || selectedRequest.id, rejectReason)
        toast.success('Special recommendation rejected')
      } else {
        await adminAPI.rejectFoodItem(selectedRequest._id || selectedRequest.id, rejectReason)
        toast.success('Food item rejected')
      }

      await fetchFoodRequests()
      setShowRejectModal(false)
      setShowDetailModal(false)
      setSelectedRequest(null)
      setRejectReason("")
    } catch (error) {
      console.error('Error rejecting food item:', error)
      toast.error(error?.response?.data?.message || 'Failed to reject food item')
    } finally {
      setProcessing(false)
    }
  }

  // View food item details
  const handleViewDetails = (request) => {
    setSelectedRequest(request)
    setShowDetailModal(true)
  }

  // Open reject modal
  const handleRejectClick = (request) => {
    setSelectedRequest(request)
    setShowRejectModal(true)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
            Food Approval
          </h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 mb-4 bg-gray-100 p-1">
          <TabsTrigger
            value="standard"
            className="data-[state=active]:bg-white data-[state=active]:text-[#FF5200] data-[state=active]:shadow-sm"
          >
            Standard Requests ({standardRequests.length})
          </TabsTrigger>
          <TabsTrigger
            value="special"
            className="data-[state=active]:bg-white data-[state=active]:text-[#FF5200] data-[state=active]:shadow-sm flex items-center gap-2"
          >
            <Star className="w-3.5 h-3.5 fill-current" />
            Special Requests ({specialRequests.length})
          </TabsTrigger>
        </TabsList>

        <Card className="border border-gray-200 shadow-sm">
          <div className="p-4">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative flex-1">
                <span className="absolute inset-y-0 left-2.5 flex items-center text-gray-400">
                  <Search className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  placeholder={`Search in ${activeTab === 'standard' ? 'standard' : 'special'} requests...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-9 pr-3 text-sm focus:outline-none focus:border-[#FF5200] focus:ring-1 focus:ring-[#FF5200]"
                />
              </div>
            </div>

            {/* Table/Content */}
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#FF5200]" />
              </div>
            ) : (
              <div className="border-t border-gray-200">
                <div className="w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-sm">
                    <thead style={{ backgroundColor: activeTab === 'special' ? "rgba(255, 193, 7, 0.1)" : "rgba(255, 82, 0, 0.1)" }}>
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-12">
                          S.No
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Restaurant
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Food Name
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Category/Section
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Requested
                        </th>
                        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                          Action
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                      {filteredRequests.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="px-3 py-8 text-center text-sm text-gray-500">
                            No pending {activeTab} food approval requests found.
                          </td>
                        </tr>
                      ) : (
                        filteredRequests.map((request, index) => (
                          <tr key={request._id || request.id} className="hover:bg-gray-50">
                            <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-500 font-medium">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="text-sm">
                                <div className="font-semibold text-gray-900 line-clamp-1">{request.restaurantName || '-'}</div>
                                <div className="text-gray-500 text-[10px] uppercase tracking-wider">{request.restaurantId || '-'}</div>
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-gray-900">{request.itemName || '-'}</span>
                                {activeTab === 'special' && (
                                  <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-xs text-gray-600">
                              <div>{request.category || '-'}</div>
                              <div className="text-[10px] opacity-70">{request.sectionName || '-'}</div>
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-sm text-gray-900 font-bold">
                              ₹{request.price || '0.00'}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-[11px] text-gray-500 italic">
                              {request.requestedAt ? new Date(request.requestedAt).toLocaleDateString() : '-'}
                            </td>
                            <td className="px-3 py-3 whitespace-nowrap text-right text-sm">
                              <div className="flex justify-end gap-1.5">
                                <button
                                  onClick={() => handleViewDetails(request)}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                                  title="View Details"
                                >
                                  <Eye className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleApprove(request)}
                                  disabled={processing}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-green-50 text-green-600 hover:bg-green-100 transition-colors disabled:opacity-50"
                                  title="Approve"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleRejectClick(request)}
                                  disabled={processing}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                                  title="Reject"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      </Tabs>

      {/* Food Details Modal */}
      <Dialog open={showDetailModal} onOpenChange={setShowDetailModal}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-0 bg-white border-none shadow-2xl">
          <DialogHeader className={`p-6 pb-4 border-b ${activeTab === 'special' ? 'bg-yellow-50/50 border-yellow-100' : 'bg-orange-50/30 border-orange-100'}`}>
            <div className="flex items-center gap-3">
              <DialogTitle className="text-xl font-bold text-gray-900">
                {activeTab === 'special' ? 'Premium Special Request' : 'Food Item Details'}
              </DialogTitle>
              {activeTab === 'special' && (
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-bold text-yellow-700 uppercase tracking-wider">
                  <Star className="w-3 h-3 fill-current" />
                  Premium
                </span>
              )}
            </div>
            <DialogDescription className="text-sm text-gray-500 mt-1">
              Review carefully before taking any action.
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="p-6 space-y-6">
              {/* Info Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Restaurant</h3>
                  <p className="text-sm font-bold text-gray-900">{selectedRequest.restaurantName || '-'}</p>
                  <p className="text-xs text-gray-500">{selectedRequest.restaurantId || '-'}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Pricing</h3>
                  <p className="text-lg font-black text-[#FF5200]">₹{selectedRequest.price || '0.00'}</p>
                </div>
              </div>

              {/* Form Details */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Item Name</label>
                    <p className="text-sm text-gray-900 font-medium">{selectedRequest.itemName || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 uppercase">Category</label>
                    <p className="text-sm text-gray-900 font-medium">{selectedRequest.category || selectedRequest.item?.category || '-'}</p>
                  </div>
                </div>

                {selectedRequest.description && (
                  <div className="pt-2">
                    <label className="text-xs font-bold text-gray-400 uppercase">Description</label>
                    <p className="text-sm text-gray-700 leading-relaxed mt-1">{selectedRequest.description}</p>
                  </div>
                )}

                {/* Images */}
                {(() => {
                  const allImages = [
                    ...(selectedRequest.images || []),
                    ...(selectedRequest.item?.images || []),
                    selectedRequest.image || selectedRequest.item?.image
                  ].filter(img => img && typeof img === 'string' && img.trim() !== '');

                  // Unique images only
                  const uniqueImages = [...new Set(allImages)];

                  return uniqueImages.length > 0 ? (
                    <div className="pt-2">
                      <label className="text-xs font-bold text-gray-400 uppercase block mb-3">Item Images ({uniqueImages.length})</label>
                      <div className="grid grid-cols-3 gap-3">
                        {uniqueImages.map((img, idx) => (
                          <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 group">
                            <img
                              src={img}
                              alt="Food Item"
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                            <div
                              onClick={() => window.open(img, '_blank')}
                              className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer"
                            >
                              <Eye className="w-6 h-6 text-white" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null;
                })()}
              </div>
            </div>
          )}

          <DialogFooter className="p-6 pt-4 border-t border-gray-100 bg-gray-50/50 flex gap-3">
            <button
              onClick={() => {
                setShowDetailModal(false)
                setSelectedRequest(null)
              }}
              className="px-6 py-2 text-sm font-bold text-gray-600 hover:text-gray-900 transition-colors"
            >
              Cancel
            </button>
            <div className="flex gap-2 ml-auto">
              <button
                onClick={() => handleRejectClick(selectedRequest)}
                className="px-6 py-2 text-sm font-bold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={() => handleApprove(selectedRequest)}
                disabled={processing}
                className="px-8 py-2 text-sm font-bold text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-200 disabled:opacity-50"
              >
                {processing ? "..." : "Approve Now"}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Modal - Simplified */}
      <Dialog open={showRejectModal} onOpenChange={setShowRejectModal}>
        <DialogContent className="max-w-md p-6 bg-white rounded-2xl shadow-2xl border-none">
          <div className="space-y-4">
            <div className="h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-gray-900">Provide Rejection Reason</DialogTitle>
              <DialogDescription className="text-sm text-gray-500 mt-1">
                Let the restaurant know why this item was rejected.
              </DialogDescription>
            </div>

            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex: Image quality is low or description is unclear..."
              rows={4}
              className="w-full rounded-xl border-gray-200 bg-gray-50 px-4 py-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all outline-none"
            />

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleReject}
                disabled={processing || !rejectReason.trim()}
                className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

