import { useState, useMemo, useEffect } from "react"
import { Search, Download, ChevronDown, Calendar, Eye, FileDown, FileSpreadsheet, FileText, X, Mail, Phone, MapPin, Package, DollarSign, Calendar as CalendarIcon, User, CheckCircle, XCircle } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { exportCustomersToCSV, exportCustomersToExcel, exportCustomersToPDF } from "../components/customers/customersExportUtils"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

export default function Customers() {
  const [searchQuery, setSearchQuery] = useState("")
  const [customers, setCustomers] = useState([])
  const [loading, setLoading] = useState(true)
  const [totalCustomers, setTotalCustomers] = useState(0)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [userDetails, setUserDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [showUserDetails, setShowUserDetails] = useState(false)
  const [filters, setFilters] = useState({
    orderDate: "",
    joiningDate: "",
    status: "",
    sortBy: "",
    chooseFirst: "",
  })

  const filteredCustomers = useMemo(() => {
    let result = [...customers]

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim()
      result = result.filter(customer =>
        customer.name.toLowerCase().includes(query) ||
        customer.email.toLowerCase().includes(query) ||
        customer.phone.includes(query)
      )
    }

    // Filter by order date (if customer has order date field, otherwise skip)
    // Note: customersDummy doesn't have orderDate, so this is a placeholder for future implementation

    // Filter by joining date
    if (filters.joiningDate) {
      result = result.filter(customer => {
        // Parse joining date from format "17 Oct 2021"
        const customerDate = new Date(customer.joiningDate)
        const filterDate = new Date(filters.joiningDate)
        return customerDate.toDateString() === filterDate.toDateString()
      })
    }

    // Filter by status
    if (filters.status) {
      if (filters.status === "active") {
        result = result.filter(customer => customer.status === true)
      } else if (filters.status === "inactive") {
        result = result.filter(customer => customer.status === false)
      }
    }

    // Sort by options
    if (filters.sortBy) {
      if (filters.sortBy === "name-asc") {
        result.sort((a, b) => a.name.localeCompare(b.name))
      } else if (filters.sortBy === "name-desc") {
        result.sort((a, b) => b.name.localeCompare(a.name))
      } else if (filters.sortBy === "orders-asc") {
        result.sort((a, b) => a.totalOrder - b.totalOrder)
      } else if (filters.sortBy === "orders-desc") {
        result.sort((a, b) => b.totalOrder - a.totalOrder)
      }
    }

    // Limit results if "Choose First" is set
    if (filters.chooseFirst && parseInt(filters.chooseFirst) > 0) {
      result = result.slice(0, parseInt(filters.chooseFirst))
    }

    return result
  }, [customers, searchQuery, filters])

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }))
  }

  // Fetch customers from API
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        setLoading(true)
        const params = {
          limit: 1000, // Get all customers
          offset: 0,
          ...(searchQuery && { search: searchQuery }),
          ...(filters.status && { status: filters.status }),
          ...(filters.joiningDate && { joiningDate: filters.joiningDate }),
          ...(filters.sortBy && { sortBy: filters.sortBy }),
        }

        const response = await adminAPI.getUsers(params)
        const data = response?.data?.data || response?.data

        if (data?.users) {
          setCustomers(data.users)
          setTotalCustomers(data.total || data.users.length)
        } else {
          setCustomers([])
          setTotalCustomers(0)
        }
      } catch (error) {
        console.error('Error fetching customers:', error)
        toast.error('Failed to load customers')
        setCustomers([])
        setTotalCustomers(0)
      } finally {
        setLoading(false)
      }
    }

    fetchCustomers()
  }, [searchQuery, filters.status, filters.joiningDate, filters.sortBy])

  const handleToggleStatus = async (customerId) => {
    try {
      // Find customer
      const customer = customers.find(c => c.id === customerId)
      if (!customer) return

      const newStatus = !customer.status

      // Optimistically update UI
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: newStatus } : c
      ))

      // Call API to update user status
      await adminAPI.updateUserStatus(customerId, newStatus)
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`)
    } catch (error) {
      console.error('Error updating status:', error)
      toast.error('Failed to update status')
      // Revert optimistic update
      setCustomers(customers.map(c =>
        c.id === customerId ? { ...c, status: !c.status } : c
      ))
    }
  }

  const handleViewDetails = async (customerId) => {
    try {
      setLoadingDetails(true)
      setShowUserDetails(true)
      setSelectedCustomer(customerId)

      const response = await adminAPI.getUserById(customerId)
      const data = response?.data?.data || response?.data

      if (data?.user) {
        setUserDetails(data.user)
      } else {
        toast.error('Failed to load user details')
        setShowUserDetails(false)
      }
    } catch (error) {
      console.error('Error fetching user details:', error)
      toast.error('Failed to load user details')
      setShowUserDetails(false)
    } finally {
      setLoadingDetails(false)
    }
  }

  const handleExport = (format) => {
    if (filteredCustomers.length === 0) {
      toast.error("No customers to export")
      return
    }

    const filename = "customers"
    try {
      switch (format) {
        case "csv":
          exportCustomersToCSV(filteredCustomers, filename)
          toast.success("CSV export started")
          break
        case "excel":
          exportCustomersToExcel(filteredCustomers, filename)
          toast.success("Excel export started")
          break
        case "pdf":
          exportCustomersToPDF(filteredCustomers, filename)
          toast.success("PDF download started")
          break
        default:
          toast.error("Invalid export format")
          break
      }
    } catch (error) {
      console.error("Export error:", error)
      toast.error("Failed to export customers")
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Filters Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Order Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.orderDate}
                  onChange={(e) => handleFilterChange("orderDate", e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Customer Joining Date
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={filters.joiningDate}
                  onChange={(e) => handleFilterChange("joiningDate", e.target.value)}
                  className="w-full px-4 py-2.5 pr-10 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
                />
                <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Customer status
              </label>
              <select
                value={filters.status}
                onChange={(e) => handleFilterChange("status", e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
              >
                <option value="">Select Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Sort By
              </label>
              <select
                value={filters.sortBy}
                onChange={(e) => handleFilterChange("sortBy", e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
              >
                <option value="">Select Customer Sorting Order</option>
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="orders-asc">Orders (Low to High)</option>
                <option value="orders-desc">Orders (High to Low)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Choose First
              </label>
              <input
                type="number"
                value={filters.chooseFirst}
                onChange={(e) => handleFilterChange("chooseFirst", e.target.value)}
                placeholder="Ex: 100"
                className="w-full px-4 py-2.5 border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:border-[#FF5200] text-sm"
              />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  // Filters are applied automatically via useMemo
                }}
                className="px-6 py-2.5 text-sm font-medium rounded-lg bg-[#FF5200] text-white hover:bg-[#E64A00] transition-all"
              >
                Apply Filters
              </button>
              <button
                onClick={() => {
                  setFilters({
                    orderDate: "",
                    joiningDate: "",
                    status: "",
                    sortBy: "",
                    chooseFirst: "",
                  })
                }}
                className="px-6 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition-all"
              >
                Reset Filters
              </button>
            </div>
            <div className="text-sm text-slate-600">
              {loading ? 'Loading...' : `Showing ${filteredCustomers.length} of ${totalCustomers} customers`}
            </div>
          </div>
        </div>

        {/* Customer List Section */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900">Customer list</h2>
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
                {filteredCustomers.length}
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1 sm:flex-initial min-w-[200px]">
                <input
                  type="text"
                  placeholder="Ex: Search by name"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400"
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
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Sl</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Contact Information</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Order</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Total Order Amount</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Joining Date</th>
                  <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">Active/Inactive</th>
                  <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="text-sm text-slate-500">Loading customers...</div>
                    </td>
                  </tr>
                ) : filteredCustomers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center">
                      <div className="text-sm text-slate-500">No customers found</div>
                    </td>
                  </tr>
                ) : (
                  filteredCustomers.map((customer) => (
                    <tr key={customer.id || customer.sl} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-700">{customer.sl}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm">👤</span>
                          </div>
                          <span className="text-sm font-medium text-slate-900">{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm text-slate-700">{customer.email}</span>
                          <span className="text-xs text-slate-500">{customer.phone}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{customer.totalOrder || 0}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900">$ {(customer.totalOrderAmount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-slate-700">{customer.joiningDate}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => handleToggleStatus(customer.id || customer.sl)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#FF5200] focus:ring-offset-2 ${customer.status ? "bg-[#FF5200]" : "bg-slate-300"
                            }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${customer.status ? "translate-x-6" : "translate-x-1"
                              }`}
                          />
                        </button>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <button
                          onClick={() => handleViewDetails(customer.id || customer.sl)}
                          className="p-1.5 rounded text-[#FF5200] hover:bg-orange-50 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* User Details Modal - Enhanced UI */}
      <Dialog open={showUserDetails} onOpenChange={setShowUserDetails}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl overflow-hidden bg-white">
          <DialogHeader className="sr-only">
            <DialogTitle>User Detail Insights</DialogTitle>
            <DialogDescription>
              Detailed view of customer profile, statistics, addresses, and recent order history.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-gradient-to-r from-orange-500 to-rose-500 h-24 w-full relative">
            <button
              onClick={() => setShowUserDetails(false)}
              className="absolute right-4 top-4 p-2 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-all z-20"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-6 pb-8 -mt-12 relative z-10">
            {loadingDetails ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4 bg-white rounded-t-3xl">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                <div className="text-slate-500 font-medium animate-pulse">Fetching premium insights...</div>
              </div>
            ) : userDetails ? (
              <div className="space-y-6">
                {/* Profile Header Card */}
                <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 p-6 border border-slate-100">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-slate-100 to-slate-50 border-4 border-white shadow-lg flex items-center justify-center flex-shrink-0 -mt-16 bg-white overflow-hidden">
                      {userDetails.profileImage ? (
                        <img src={userDetails.profileImage} alt={userDetails.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1">
                          <User className="w-10 h-10 text-slate-300" />
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Member</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 w-full pt-2">
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div>
                          <h3 className="text-2xl font-extrabold text-slate-900 tracking-tight">{userDetails.name}</h3>
                          <div className="flex items-center justify-center md:justify-start gap-1.5 mt-1">
                            <span className="text-xs font-medium text-slate-500">ID: {userDetails.id?.slice(-8).toUpperCase() || "N/A"}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-xs font-semibold text-orange-600">Premium User</span>
                          </div>
                        </div>
                        <div>
                          {userDetails.isActive ? (
                            <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-green-500 text-white shadow-lg shadow-green-200 inline-flex items-center gap-1.5">
                              <CheckCircle className="w-3.5 h-3.5" />
                              ACTIVE ACCOUNT
                            </span>
                          ) : (
                            <span className="px-4 py-1.5 rounded-full text-xs font-bold bg-slate-400 text-white shadow-lg shadow-slate-200 inline-flex items-center gap-1.5">
                              <XCircle className="w-3.5 h-3.5" />
                              SUSPENDED
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                            <Mail className="w-4 h-4" />
                          </div>
                          <div className="overflow-hidden">
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Email Address</p>
                            <p className="text-sm font-semibold text-slate-700 truncate">{userDetails.email || "Not Provided"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                            <Phone className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Phone Number</p>
                            <div className="flex items-center gap-1">
                              <p className="text-sm font-semibold text-slate-700">{userDetails.phone || "No Phone"}</p>
                              {userDetails.phoneVerified && <CheckCircle className="w-3 h-3 text-green-500" />}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
                            <CalendarIcon className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Join Date</p>
                            <p className="text-sm font-semibold text-slate-700">{userDetails.joiningDate}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50/50 hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100">
                          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-600">
                            <CheckCircle className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Signup Mode</p>
                            <p className="text-sm font-semibold text-slate-700 capitalize">{userDetails.signupMethod || 'Web Portal'}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Engagement Statistics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative group overflow-hidden bg-gradient-to-br from-[#FF5200] to-orange-400 rounded-2xl p-5 shadow-xl shadow-orange-100">
                    <div className="absolute top-0 right-0 p-3 opacity-20 transform group-hover:scale-110 transition-transform">
                      <Package className="w-16 h-16 text-white" />
                    </div>
                    <p className="text-xs font-bold text-white/80 uppercase tracking-widest mb-1">Total Orders</p>
                    <div className="flex items-baseline gap-1">
                      <h4 className="text-3xl font-black text-white">{userDetails.totalOrders || 0}</h4>
                      <span className="text-[10px] font-bold text-white/60">delivered</span>
                    </div>
                  </div>

                  <div className="relative group overflow-hidden bg-white border border-slate-100 rounded-2xl p-5 shadow-lg shadow-slate-100 hover:border-green-100 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 text-green-600 transform group-hover:scale-110 transition-transform">
                      <DollarSign className="w-16 h-16" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Wallet Spent</p>
                    <h4 className="text-3xl font-black text-slate-900">
                      <span className="text-xl text-green-500 mr-0.5">$</span>
                      {Math.floor(userDetails.totalOrderAmount || 0)}
                      <span className="text-lg text-slate-400">.{(userDetails.totalOrderAmount || 0).toFixed(2).split('.')[1]}</span>
                    </h4>
                  </div>

                  <div className="relative group overflow-hidden bg-white border border-slate-100 rounded-2xl p-5 shadow-lg shadow-slate-100 hover:border-purple-100 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 text-purple-600 transform group-hover:scale-110 transition-transform">
                      <Calendar className="w-16 h-16" />
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Member Age</p>
                    <h4 className="text-xl font-black text-slate-900 mt-2">
                      {userDetails.joiningDate.split(' ')[2] || 'Just'}{' Join'}
                    </h4>
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5">Established Entity</p>
                  </div>
                </div>

                {/* Dynamic Content Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Addresses Column */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-orange-500" />
                        Saved Addresses
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                        {userDetails.addresses?.length || 0} LOCATION{userDetails.addresses?.length !== 1 ? 'S' : ''}
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                      {userDetails.addresses && userDetails.addresses.length > 0 ? (
                        userDetails.addresses.map((address, index) => (
                          <div key={index} className={`relative p-4 rounded-xl border transition-all ${address.isDefault ? 'border-orange-200 bg-orange-50/30' : 'border-slate-100 bg-white hover:border-slate-200 shadow-sm'}`}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${address.isDefault ? 'bg-orange-500' : 'bg-slate-300'}`}></span>
                                <h5 className="text-xs font-bold text-slate-700 uppercase tracking-tight">{address.label || 'Other'}</h5>
                              </div>
                              {address.isDefault && (
                                <span className="text-[8px] font-black uppercase text-white bg-orange-500 px-1.5 py-0.5 rounded shadow-sm">Default</span>
                              )}
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed font-normal">
                              {address.street}{address.additionalDetails && `, ${address.additionalDetails}`}
                              <span className="block mt-1 font-semibold text-slate-500 text-xs">
                                {address.city && `${address.city}, `}{address.state && `${address.state}`}{address.zipCode && ` - ${address.zipCode}`}
                              </span>
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                          <MapPin className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-300 uppercase">No address data linked</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Orders Column */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-1">
                      <h4 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Package className="w-4 h-4 text-blue-500" />
                        Recent activity
                      </h4>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">LATEST 5</span>
                    </div>

                    <div className="space-y-3">
                      {userDetails.orders && userDetails.orders.length > 0 ? (
                        userDetails.orders.slice(0, 5).map((order, index) => (
                          <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 hover:border-blue-100 hover:shadow-md hover:shadow-blue-50/50 transition-all cursor-pointer group">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                                <Package className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{order.orderId}</p>
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{order.restaurantName}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-black text-slate-900">${(order.total || 0).toLocaleString()}</p>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-[1px] ${order.status === 'delivered' ? 'bg-green-100 text-green-600' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                                  'bg-orange-100 text-orange-600'
                                }`}>
                                {order.status}
                              </span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 border-2 border-dashed border-slate-100 rounded-2xl">
                          <Package className="w-8 h-8 text-slate-100 mx-auto mb-2" />
                          <p className="text-xs font-bold text-slate-300 uppercase">No order transactions</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Additional Metadata Footer */}
                {(userDetails.gender || userDetails.dateOfBirth) && (
                  <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-100">
                    {userDetails.gender && (
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">GENDER</span>
                        <span className="text-xs font-bold text-slate-700 capitalize">{userDetails.gender}</span>
                      </div>
                    )}
                    {userDetails.dateOfBirth && (
                      <div className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">BIRTHDAY</span>
                        <span className="text-xs font-bold text-slate-700">
                          {new Date(userDetails.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center">
                  <User className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Missing detailed user context</p>
                <button
                  onClick={() => setShowUserDetails(false)}
                  className="text-xs font-bold text-orange-500 hover:text-orange-600 underline"
                >
                  Return to directory
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
