import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Loader2, Package } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import OrdersTopbar from "../../components/orders/OrdersTopbar"
import OrdersTable from "../../components/orders/OrdersTable"
import FilterPanel from "../../components/orders/FilterPanel"
import ViewOrderDialog from "../../components/orders/ViewOrderDialog"
import SettingsDialog from "../../components/orders/SettingsDialog"
import RefundModal from "../../components/orders/RefundModal"
import { useOrdersManagement } from "../../components/orders/useOrdersManagement"

const PAGE_SIZE = 10

const statusConfig = {
  all: {
    title: "All Orders",
    color: "emerald",
    icon: FileText,
  },
  pending: {
    title: "Pending Orders",
    color: "amber",
    icon: Package,
  },
  accepted: {
    title: "Accepted Orders",
    color: "green",
    icon: Package,
  },
  processing: {
    title: "Processing Orders",
    color: "orange",
    icon: Package,
  },
  "food-on-the-way": {
    title: "Food On The Way Orders",
    color: "amber",
    icon: Package,
  },
  delivered: {
    title: "Delivered Orders",
    color: "emerald",
    icon: Package,
  },
  canceled: {
    title: "Canceled Orders",
    color: "rose",
    icon: Package,
  },
  "restaurant-cancelled": {
    title: "Restaurant Cancelled Orders",
    color: "red",
    icon: Package,
  },
  "payment-failed": {
    title: "Payment Failed Orders",
    color: "red",
    icon: Package,
  },
  refunded: {
    title: "Refunded Orders",
    color: "sky",
    icon: Package,
  },
  "offline-payments": {
    title: "Offline Payments",
    color: "slate",
    icon: Package,
  },
}

export default function OrdersPage({ statusKey = "all" }) {
  const config = statusConfig[statusKey] || statusConfig.all
  const prefetchedPagesRef = useRef(new Map())

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isPageLoading, setIsPageLoading] = useState(false)
  const [isPrefetching, setIsPrefetching] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [processingRefund, setProcessingRefund] = useState(null)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null)

  const buildOrdersParams = useCallback(
    (page) => ({
      page,
      limit: PAGE_SIZE,
      status:
        statusKey === "all" || statusKey === "offline-payments"
          ? undefined
          : statusKey === "restaurant-cancelled"
            ? "cancelled"
            : statusKey,
      cancelledBy: statusKey === "restaurant-cancelled" ? "restaurant" : undefined,
      paymentType: statusKey === "offline-payments" ? "cod" : undefined,
    }),
    [statusKey],
  )

  const fetchPage = useCallback(
    async (page, options = {}) => {
      const { background = false } = options

      if (background) {
        setIsPrefetching(true)
      } else if (page === 1) {
        setIsLoading(true)
      } else {
        setIsPageLoading(true)
      }

      try {
        const response = await adminAPI.getOrders(buildOrdersParams(page))
        const pageOrders = response.data?.data?.orders || []
        const pagination = response.data?.data?.pagination || {}
        const pageData = {
          orders: pageOrders,
          total: pagination.total || pageOrders.length,
          pages: pagination.pages || 1,
          limit: pagination.limit || PAGE_SIZE,
        }

        if (background) {
          prefetchedPagesRef.current.set(page, pageData)
          return pageData
        }

        setOrders(pageData.orders)
        setTotalCount(pageData.total)
        setTotalPages(pageData.pages)
        return pageData
      } catch (error) {
        if (!background) {
          console.error("Error fetching orders:", error)
          toast.error(error.response?.data?.message || "Failed to fetch orders")
          setOrders([])
          setTotalCount(0)
          setTotalPages(1)
        }
        throw error
      } finally {
        if (background) {
          setIsPrefetching(false)
        } else {
          setIsLoading(false)
          setIsPageLoading(false)
        }
      }
    },
    [buildOrdersParams],
  )

  const prefetchNextPage = useCallback(
    async (page, pages) => {
      const nextPage = page + 1
      if (nextPage > pages || prefetchedPagesRef.current.has(nextPage)) {
        return
      }

      try {
        await fetchPage(nextPage, { background: true })
      } catch (error) {
        console.error(`Error prefetching page ${nextPage}:`, error)
      }
    },
    [fetchPage],
  )

  useEffect(() => {
    prefetchedPagesRef.current.clear()
    setCurrentPage(1)
    fetchPage(1)
  }, [fetchPage])

  useEffect(() => {
    if (!isLoading && !isPageLoading && totalPages > 1) {
      prefetchNextPage(currentPage, totalPages)
    }
  }, [currentPage, isLoading, isPageLoading, prefetchNextPage, totalPages])

  const handlePageChange = async (page) => {
    if (page === currentPage || page < 1 || page > totalPages) {
      return
    }

    setCurrentPage(page)

    const prefetched = prefetchedPagesRef.current.get(page)
    if (prefetched) {
      setOrders(prefetched.orders)
      setTotalCount(prefetched.total)
      setTotalPages(prefetched.pages)
      prefetchedPagesRef.current.delete(page)
      return
    }

    await fetchPage(page)
  }

  const handleRefund = (order) => {
    const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet"
    if (isWalletPayment) {
      setSelectedOrderForRefund(order)
      setRefundModalOpen(true)
    } else {
      const confirmMessage = `Are you sure you want to process refund for order ${order.orderId}?\n\nThis will initiate a Razorpay refund to the customer's original payment method.`
      if (!confirm(confirmMessage)) {
        return
      }
      processRefund(order, null)
    }
  }

  const processRefund = async (order, refundAmount = null) => {
    const orderIdToUse = order.id || order._id || order.orderId
    if (!orderIdToUse) {
      toast.error("Order ID not found. Please refresh the page and try again.")
      return
    }

    try {
      setProcessingRefund(orderIdToUse)
      const requestData = refundAmount !== null ? { refundAmount: parseFloat(refundAmount) } : {}
      const response = await adminAPI.processRefund(orderIdToUse, requestData)
      if (response.data?.success) {
        const isWalletPayment = order.paymentType === "Wallet" || order.payment?.method === "wallet"
        toast.success(
          response.data?.message ||
            (isWalletPayment
              ? `Wallet refund of Rs.${refundAmount || order.totalAmount} processed successfully for order ${order.orderId}`
              : `Refund initiated successfully for order ${order.orderId}`),
        )

        setOrders((prevOrders) =>
          prevOrders.map((existingOrder) =>
            existingOrder.id === order.id || existingOrder.orderId === order.orderId
              ? { ...existingOrder, refundStatus: "processed" }
              : existingOrder,
          ),
        )
      } else {
        toast.error(response.data?.message || "Failed to process refund")
      }
    } catch (error) {
      console.error("Error processing refund:", error)

      let errorMessage = "Failed to process refund"
      if (error.response) {
        if (error.response.status === 404) {
          errorMessage = `Order not found (ID: ${orderIdToUse}). Please check if the order exists.`
        } else if (error.response.status === 400) {
          errorMessage = error.response.data?.message || "Invalid request. Please check the refund amount."
        } else if (error.response.status === 500) {
          errorMessage = error.response.data?.message || "Server error. Please try again later."
        } else if (error.response.data?.message) {
          errorMessage = error.response.data.message
        } else {
          errorMessage = `Error ${error.response.status}: ${error.response.statusText || "Unknown error"}`
        }
      } else if (error.request) {
        errorMessage = "Network error. Please check your internet connection and try again."
      } else {
        errorMessage = error.message || "Failed to process refund"
      }

      toast.error(errorMessage)
    } finally {
      setProcessingRefund(null)
      setRefundModalOpen(false)
      setSelectedOrderForRefund(null)
    }
  }

  const handleRefundConfirm = (amount) => {
    if (selectedOrderForRefund) {
      processRefund(selectedOrderForRefund, amount)
    }
  }

  const {
    searchQuery,
    setSearchQuery,
    isFilterOpen,
    setIsFilterOpen,
    isSettingsOpen,
    setIsSettingsOpen,
    isViewOrderOpen,
    setIsViewOrderOpen,
    selectedOrder,
    filters,
    setFilters,
    visibleColumns,
    filteredOrders,
    count,
    activeFiltersCount,
    restaurants,
    handleApplyFilters,
    handleResetFilters,
    handleExport,
    handleViewOrder,
    handlePrintOrder,
    toggleColumn,
    resetColumns,
  } = useOrdersManagement(orders, statusKey, config.title)

  if (isLoading) {
    return (
      <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <OrdersTopbar
        title={config.title}
        count={totalCount || count}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onFilterClick={() => setIsFilterOpen(true)}
        activeFiltersCount={activeFiltersCount}
        onExport={handleExport}
        onSettingsClick={() => setIsSettingsOpen(true)}
      />

      <FilterPanel
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
        restaurants={restaurants}
      />

      <SettingsDialog
        isOpen={isSettingsOpen}
        onOpenChange={setIsSettingsOpen}
        visibleColumns={visibleColumns}
        toggleColumn={toggleColumn}
        resetColumns={resetColumns}
      />

      <ViewOrderDialog isOpen={isViewOrderOpen} onOpenChange={setIsViewOrderOpen} order={selectedOrder} />

      <RefundModal
        isOpen={refundModalOpen}
        onOpenChange={setRefundModalOpen}
        order={selectedOrderForRefund}
        onConfirm={handleRefundConfirm}
        isProcessing={processingRefund !== null}
      />

      <OrdersTable
        orders={filteredOrders}
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        onRefund={handleRefund}
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalCount}
        itemsPerPage={PAGE_SIZE}
        onPageChange={handlePageChange}
        isPageLoading={isPageLoading}
        isPrefetching={isPrefetching}
      />
    </div>
  )
}
