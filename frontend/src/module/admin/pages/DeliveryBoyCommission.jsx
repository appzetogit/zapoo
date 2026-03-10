import { useState, useMemo, useEffect } from "react"
import { Search, Edit, Trash2, IndianRupee, MapPin, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { adminAPI, tierAPI } from "@/lib/api"
import { API_BASE_URL } from "@/lib/api/config"
import { toast } from "sonner"

export default function DeliveryBoyCommission() {
  const [searchQuery, setSearchQuery] = useState("")
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [isAddEditOpen, setIsAddEditOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [selectedCommission, setSelectedCommission] = useState(null)
  const [selectedTier, setSelectedTier] = useState("")
  const [tiers, setTiers] = useState([])
  const [formData, setFormData] = useState({
    minDistance: "",
    maxDistance: "",
    commissionPerKm: "",
    basePayout: "",
  })
  const [formErrors, setFormErrors] = useState({})
  const [visibleColumns] = useState({
    si: true,
    name: true, // will display distance slab label (e.g. 0–4.2 km)
    commissionPerKm: true,
    basePayout: true,
    status: true,
    actions: true,
  })

  const availableTiers = useMemo(() => {
    const tierSet = new Set()
    // Add tiers from Tier Management API
    tiers.forEach((t) => {
      if (t?.name) tierSet.add(t.name)
    })
    // Also add any tiers that exist only in commission rules (fallback)
    commissions.forEach((c) => {
      if (c.tier) {
        tierSet.add(c.tier)
      }
    })
    return Array.from(tierSet)
  }, [tiers, commissions])

  const filteredCommissions = useMemo(() => {
    // If no tier is selected, don't show any rows
    if (!selectedTier) {
      return []
    }

    let baseList = commissions.filter(
      (commission) => (commission.tier || "default") === selectedTier
    )

    if (!searchQuery.trim()) {
      return baseList
    }

    const query = searchQuery.toLowerCase().trim()
    return baseList.filter(commission =>
      commission.name.toLowerCase().includes(query) ||
      commission.minDistance.toString().includes(query) ||
      (commission.maxDistance !== null && commission.maxDistance.toString().includes(query))
    )
  }, [commissions, searchQuery, selectedTier])

  // Calculate total commission for a given distance
  const calculateTotalCommission = (commission, distance) => {
    // Check if distance falls within this commission tier
    if (distance < commission.minDistance) return 0
    if (commission.maxDistance !== null && distance > commission.maxDistance) return 0
    
    // Calculate commission: base payout + (distance × commission per km)
    const distanceCommission = distance * commission.commissionPerKm
    return commission.basePayout + distanceCommission
  }

  // Calculate example commission for display (using mid-point of range)
  const getExampleCommission = (commission) => {
    if (commission.maxDistance === null) {
      const exampleDistance = commission.minDistance + 5 // Example: 10km for 10+ km tier
      return calculateTotalCommission(commission, exampleDistance)
    }
    const midDistance = (commission.minDistance + commission.maxDistance) / 2
    return calculateTotalCommission(commission, midDistance)
  }

  // Fetch tiers and commission rules on component mount
  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchTiers(), fetchCommissionRules()])
    }
    load()
  }, [])

  const fetchTiers = async () => {
    try {
      const res = await tierAPI.getAllTiers()
      if (res?.data?.success && Array.isArray(res.data.data)) {
        // Sort tiers by rank (ascending) so rank 1 comes first
        const sortedTiers = [...res.data.data].sort((a, b) => {
          const rankA = typeof a.rank === "number" ? a.rank : Number.MAX_SAFE_INTEGER
          const rankB = typeof b.rank === "number" ? b.rank : Number.MAX_SAFE_INTEGER
          return rankA - rankB
        })
        setTiers(sortedTiers)

        // If no tier is currently selected, default to the highest priority (rank 1)
        if (!selectedTier && sortedTiers.length > 0 && sortedTiers[0].name) {
          setSelectedTier(sortedTiers[0].name)
        }
      } else {
        setTiers([])
      }
    } catch (error) {
      console.error("Error fetching tiers for DeliveryBoyCommission:", error)
      setTiers([])
    }
  }

  const fetchCommissionRules = async () => {
    try {
      setLoading(true)
      const response = await adminAPI.getCommissionRules({ status: true })
      
      // Handle different response structures
      let commissionsData = null
      if (response?.data?.success && response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.data?.commissions) {
        commissionsData = response.data.data.commissions
      } else if (response?.data?.commissions) {
        commissionsData = response.data.commissions
      }
      
      if (commissionsData && Array.isArray(commissionsData)) {
        // Add serial numbers based on array index
        const commissionsWithSl = commissionsData.map((commission, index) => ({
          ...commission,
          sl: index + 1
        }))
      setCommissions(commissionsWithSl)
      } else {
        setCommissions([])
      }
    } catch (error) {
      console.error('Error fetching commission rules:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      })
      
      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const errorMessage = `Cannot connect to backend server. Please ensure the backend is running on ${API_BASE_URL.replace('/api', '')}`
        toast.error(errorMessage)
        console.error('💡 Backend connection issue. Check:')
        console.error('   1. Is backend server running? (npm start in backend folder)')
        console.error(`   2. Is backend running on ${API_BASE_URL.replace('/api', '')}?`)
        console.error('   3. Check browser console for CORS errors')
        setCommissions([])
        return
      }
      
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch commission rules'
      toast.error(errorMessage)
      setCommissions([])
    } finally {
      setLoading(false)
    }
  }

  const handleToggleStatus = async (commission) => {
    try {
      const newStatus = !commission.status
      await adminAPI.toggleCommissionRuleStatus(commission._id, newStatus)
      setCommissions(commissions.map(c =>
        c._id === commission._id ? { ...c, status: newStatus } : c
      ))
      toast.success('Commission rule status updated successfully')
    } catch (error) {
      console.error('Error toggling status:', error)
      toast.error(error.response?.data?.message || 'Failed to update status')
    }
  }

  const handleAdd = () => {
    setSelectedCommission(null)
    setFormData({ minDistance: "", maxDistance: "", commissionPerKm: "", basePayout: "" })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const handleEdit = (commission) => {
    setSelectedCommission(commission)
    setFormData({
      minDistance: commission.minDistance.toString(),
      maxDistance: commission.maxDistance === null ? "" : commission.maxDistance.toString(),
      commissionPerKm: commission.commissionPerKm.toString(),
      basePayout: commission.basePayout.toString(),
    })
    setFormErrors({})
    setIsAddEditOpen(true)
  }

  const handleDelete = (commission) => {
    setSelectedCommission(commission)
    setIsDeleteOpen(true)
  }

  const confirmDelete = async () => {
    if (!selectedCommission) return

    try {
      setDeleting(true)
      await adminAPI.deleteCommissionRule(selectedCommission._id)
      setCommissions(commissions.filter(commission => commission._id !== selectedCommission._id))
      setIsDeleteOpen(false)
      setSelectedCommission(null)
      toast.success('Commission rule deleted successfully')
    } catch (error) {
      console.error('Error deleting commission rule:', error)
      toast.error(error.response?.data?.message || 'Failed to delete commission rule')
    } finally {
      setDeleting(false)
    }
  }

  const validateForm = () => {
    const errors = {}
    if (!formData.minDistance.trim() || parseFloat(formData.minDistance) < 0) {
      errors.minDistance = "Minimum distance must be 0 or greater"
    }
    if (formData.maxDistance.trim() && parseFloat(formData.maxDistance) <= parseFloat(formData.minDistance || 0)) {
      errors.maxDistance = "Maximum distance must be greater than minimum distance"
    }
    if (!formData.commissionPerKm.trim() || parseFloat(formData.commissionPerKm) < 0) {
      errors.commissionPerKm = "Commission per km must be 0 or greater"
    }
    const minDist = parseFloat(formData.minDistance || "0")
    // Base payout is only required for the base slab starting at 0 km
    if (minDist === 0) {
      if (!formData.basePayout.trim() || parseFloat(formData.basePayout) < 0) {
        errors.basePayout = "Base payout must be 0 or greater for base slab"
      }
    }
    
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) return
    if (!selectedTier) {
      toast.error("Please select a tier before adding or editing commission rules.")
      return
    }
    
    try {
      setSaving(true)
      const minDistanceNum = parseFloat(formData.minDistance)
      const maxDistanceNum = formData.maxDistance.trim()
        ? parseFloat(formData.maxDistance)
        : null

      // Auto-generate name from effective distance slab (with +0.2km shift)
      const isFirstSlab = minDistanceNum === 0
      const effectiveMin = isFirstSlab ? minDistanceNum : minDistanceNum + 0.2
      const effectiveMax = maxDistanceNum === null ? null : maxDistanceNum + 0.2
      const autoName =
        effectiveMax === null
          ? `${selectedTier.toUpperCase()} ${effectiveMin.toFixed(1)}km+`
          : `${selectedTier.toUpperCase()} ${effectiveMin.toFixed(1)}-${effectiveMax.toFixed(1)}km`

      const commissionData = {
        name: autoName,
        minDistance: minDistanceNum,
        maxDistance: maxDistanceNum,
        commissionPerKm: parseFloat(formData.commissionPerKm),
        // Only base slab (minDistance === 0) has base payout; others use 0
        basePayout: minDistanceNum === 0
          ? parseFloat(formData.basePayout || "0")
          : 0,
        status: selectedCommission ? selectedCommission.status : true,
        tier: selectedTier,
      }
      
      if (selectedCommission) {
        // Update existing commission
        const response = await adminAPI.updateCommissionRule(selectedCommission._id, commissionData)
        let commission = null
        if (response?.data?.success && response?.data?.data?.commission) {
          commission = response.data.data.commission
        } else if (response?.data?.data?.commission) {
          commission = response.data.data.commission
        } else if (response?.data?.commission) {
          commission = response.data.commission
        }
        
        if (commission) {
          const updatedCommission = {
            ...commission,
            sl: selectedCommission.sl
          }
          setCommissions(commissions.map(c =>
            c._id === selectedCommission._id ? updatedCommission : c
          ))
          toast.success('Commission rule updated successfully')
        }
      } else {
        // Create new commission
        const response = await adminAPI.createCommissionRule(commissionData)
        let commission = null
        if (response?.data?.success && response?.data?.data?.commission) {
          commission = response.data.data.commission
        } else if (response?.data?.data?.commission) {
          commission = response.data.data.commission
        } else if (response?.data?.commission) {
          commission = response.data.commission
        }
        
        if (commission) {
          const newCommission = {
            ...commission,
            sl: commissions.length + 1
          }
          setCommissions([...commissions, newCommission])
          toast.success('Commission rule created successfully')
        }
      }
      
      setIsAddEditOpen(false)
      setFormData({ minDistance: "", maxDistance: "", commissionPerKm: "", basePayout: "" })
      setSelectedCommission(null)
    } catch (error) {
      console.error('Error saving commission rule:', error)
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL
      })
      
      // Log full response data for debugging
      if (error.response?.data) {
        console.error('Full error response:', JSON.stringify(error.response.data, null, 2))
      }
      
      // Handle network errors
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        const errorMessage = `Cannot connect to backend server. Please ensure the backend is running on ${API_BASE_URL.replace('/api', '')}`
        toast.error(errorMessage)
        console.error('💡 Backend connection issue. Check:')
        console.error('   1. Is backend server running? (npm start in backend folder)')
        console.error(`   2. Is backend running on ${API_BASE_URL.replace('/api', '')}?`)
        console.error('   3. Check browser console for CORS errors')
        return
      }
      
      // Handle other errors - extract message from different possible response structures
      let errorMessage = 'Failed to save commission rule'
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data
        } else if (error.response.data.errors) {
          // Handle validation errors
          const errors = error.response.data.errors
          if (Array.isArray(errors)) {
            errorMessage = errors.join(', ')
          } else if (typeof errors === 'object') {
            errorMessage = Object.values(errors).join(', ')
          }
        }
      } else {
        errorMessage = error.message || errorMessage
      }

      // Short, standard alert text for overlap errors
      if (typeof errorMessage === 'string' && errorMessage.toLowerCase().includes('overlap')) {
        errorMessage = 'Distance range overlaps with another slab for this tier.'
      }
      
      toast.error(errorMessage)
      
      // Set form errors if validation errors from backend
      if (error.response?.data?.errors) {
        setFormErrors(error.response.data.errors)
      } else if (error.response?.data?.message) {
        // If backend returns a single error message, try to parse it
        const message = error.response.data.message
        if (message.toLowerCase().includes('overlap')) {
          setFormErrors({ overlap: 'Distance range overlaps with another slab for this tier.' })
        } else if (message.toLowerCase().includes('name')) {
          setFormErrors({ name: message })
        } else if (message.toLowerCase().includes('distance')) {
          setFormErrors({ minDistance: message, maxDistance: message })
        }
      }
    } finally {
      setSaving(false)
    }
  }

  // Column visibility settings are fixed; table settings UI has been removed

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <IndianRupee className="w-5 h-5 text-slate-600" />
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">Delivery Boy Commission</h1>
                <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                  {filteredCommissions.length}
                </span>
              </div>
            </div>

            {/* Settings button removed as table settings are not used */}
          </div>

          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1 sm:flex-initial min-w-[250px]">
              <input
                type="text"
                placeholder="Ex: Search by name or distance."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-slate-600">Tier:</label>
              <select
                value={selectedTier}
                onChange={(e) => setSelectedTier(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
              >
                <option value="">Select Tier</option>
                {availableTiers.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {visibleColumns.si && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">SI</th>
                  )}
                  {visibleColumns.name && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                      Distance Slab
                    </th>
                  )}
                  {visibleColumns.commissionPerKm && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Amount Per/Km (₹)</th>
                  )}
                  {visibleColumns.basePayout && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Base Payout (₹)</th>
                  )}
                  {visibleColumns.status && (
                    <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Status</th>
                  )}
                  {visibleColumns.actions && (
                    <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Action</th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center">
                      <div className="flex items-center justify-center gap-2 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span>Loading commission rules...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredCommissions.length === 0 ? (
                  <tr>
                    <td colSpan={Object.values(visibleColumns).filter(v => v).length} className="px-6 py-8 text-center text-slate-500">
                      No commission rules found
                    </td>
                  </tr>
                ) : (
                  filteredCommissions.map((commission) => (
                    <tr key={commission.sl} className="hover:bg-slate-50 transition-colors">
                      {visibleColumns.si && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-medium text-slate-700">{commission.sl}</span>
                        </td>
                      )}
                      {visibleColumns.name && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const index = filteredCommissions.findIndex(c => c._id === commission._id)
                            const isFirst = index === 0
                            const rawMin = Number(commission.minDistance || 0)
                            const rawMax = commission.maxDistance === null || commission.maxDistance === undefined
                              ? null
                              : Number(commission.maxDistance)
                            const effectiveMin = isFirst ? rawMin : rawMin + 0.2
                            const effectiveMax = rawMax === null ? null : rawMax + 0.2

                            const label = effectiveMax === null
                              ? `${effectiveMin.toFixed(1)} km+`
                              : `${effectiveMin.toFixed(1)} - ${effectiveMax.toFixed(1)} km`

                            return (
                              <span className="text-sm font-medium text-slate-900">
                                {label}
                              </span>
                            )
                          })()}
                        </td>
                      )}
                      {visibleColumns.commissionPerKm && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-green-700">₹{commission.commissionPerKm}</span>
                        </td>
                      )}
                      {visibleColumns.basePayout && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-blue-700">₹{commission.basePayout}</span>
                        </td>
                      )}
                      {visibleColumns.status && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleToggleStatus(commission)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              commission.status ? "bg-blue-600" : "bg-slate-300"
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                commission.status ? "translate-x-6" : "translate-x-1"
                              }`}
                            />
                          </button>
                        </td>
                      )}
                      {visibleColumns.actions && (
                        <td className="px-6 py-4 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => handleEdit(commission)}
                              className="p-1.5 rounded text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Edit"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            {commissions.length > 1 && (
                              <button
                                onClick={() => handleDelete(commission)}
                                className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddEditOpen} onOpenChange={setIsAddEditOpen}>
        <DialogContent className="max-w-lg bg-white p-0 rounded-xl shadow-xl data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0">
          <DialogHeader className="px-5 pt-4 pb-2 border-b border-slate-100">
            <DialogTitle className="text-base font-semibold text-slate-900">
              {selectedCommission ? "Edit Commission Rule" : "Add Commission Rule"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-5 py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Minimum Distance (km) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.minDistance}
                  onChange={(e) => setFormData({ ...formData, minDistance: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    formErrors.minDistance ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="e.g., 0"
                />
                {formErrors.minDistance && <p className="text-[11px] text-red-500 mt-1">{formErrors.minDistance}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Maximum Distance (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.maxDistance}
                  onChange={(e) => setFormData({ ...formData, maxDistance: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                    formErrors.maxDistance ? "border-red-500" : "border-slate-300"
                  }`}
                  placeholder="e.g., 4"
                />
                {formErrors.maxDistance && <p className="text-[11px] text-red-500 mt-1">{formErrors.maxDistance}</p>}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Commission Per Kilometer (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.commissionPerKm}
                onChange={(e) => setFormData({ ...formData, commissionPerKm: e.target.value })}
                className={`w-full px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                  formErrors.commissionPerKm ? "border-red-500" : "border-slate-300"
                }`}
                placeholder="e.g., 15"
              />
              {formErrors.commissionPerKm && <p className="text-xs text-red-500 mt-1">{formErrors.commissionPerKm}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Base Payout (₹) {parseFloat(formData.minDistance || "0") === 0 && <span className="text-red-500">*</span>}
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={parseFloat(formData.minDistance || "0") === 0 ? formData.basePayout : "0"}
                onChange={(e) => setFormData({ ...formData, basePayout: e.target.value })}
                disabled={parseFloat(formData.minDistance || "0") !== 0}
                className={`w-full px-3 py-2 border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm ${
                  formErrors.basePayout ? "border-red-500" : "border-slate-300"
                } ${parseFloat(formData.minDistance || "0") !== 0 ? "text-slate-400 cursor-not-allowed" : ""}`}
                placeholder="e.g., 20"
              />
              {formErrors.basePayout && <p className="text-[11px] text-red-500 mt-1">{formErrors.basePayout}</p>}
              <p className="text-[11px] text-slate-500 mt-1">
                Base payout applies only to the base slab starting from 0 km. Other slabs always use 0.
              </p>
            </div>
          </div>
          <DialogFooter className="px-5 pb-4 pt-2 border-t border-slate-100">
            <button
              onClick={() => setIsAddEditOpen(false)}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {selectedCommission ? "Update" : "Add"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="max-w-md bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle>Delete Commission Rule</DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <p className="text-sm text-slate-700">
              Are you sure you want to delete "{selectedCommission?.name}"? This action cannot be undone.
            </p>
          </div>
          <DialogFooter className="px-6 pb-6">
            <button
              onClick={() => setIsDeleteOpen(false)}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={confirmDelete}
              disabled={deleting}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  )
}

