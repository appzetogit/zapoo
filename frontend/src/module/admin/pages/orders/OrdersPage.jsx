import { useCallback, useEffect, useRef, useState } from "react"
import { FileText, Loader2, Package } from "lucide-react"
import { adminAPI } from "@/lib/api"
import { toast } from "sonner"
import OrdersTopbar from "../../components/orders/OrdersTopbar"
import OrdersTable from "../../components/orders/OrdersTable"
import FilterPanel from "../../components/orders/FilterPanel"
import ViewOrderDialog from "../../components/orders/ViewOrderDialog"
import AdminCancelOrderDialog from "../../components/orders/AdminCancelOrderDialog"
import SettingsDialog from "../../components/orders/SettingsDialog"
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
    title: "Cancelled Orders",
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
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [orderToCancel, setOrderToCancel] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancellingOrderId, setCancellingOrderId] = useState(null)
  const showAdminCancel = statusKey === "food-on-the-way"

  const ordersColumnsConfig = showAdminCancel
    ? {
        si: "Serial Number",
        orderId: "Order ID",
        orderDate: "Order Date",
        customer: "Customer Information",
        restaurant: "Restaurant",
        foodItems: "Food Items",
        totalAmount: "Total Amount",
        paymentType: "Payment Type",
        paymentCollectionStatus: "Payment Status",
        orderStatus: "Order Status",
        cancelOrder: "Cancel Order",
        actions: "Actions",
      }
    : undefined

  const buildOrdersParams = useCallback(
    (page) => ({
      page,
      limit: PAGE_SIZE,
      status:
        statusKey === "all" || statusKey === "offline-payments"
          ? undefined
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

  const handleOpenCancelDialog = (order) => {
    setOrderToCancel(order)
    setCancelDialogOpen(true)
  }

  const handleConfirmCancel = async (order, reason) => {
    const orderId = order.id || order.orderId
    if (!orderId) return

    setIsCancelling(true)
    setCancellingOrderId(orderId)

    try {
      const response = await adminAPI.cancelOrderByAdmin(orderId, reason)
      toast.success(response.data?.message || "Order cancelled successfully")
      setCancelDialogOpen(false)
      setOrderToCancel(null)
      prefetchedPagesRef.current.clear()
      await fetchPage(currentPage)
    } catch (error) {
      console.error("Error cancelling order:", error)
      toast.error(error.response?.data?.message || "Failed to cancel order")
    } finally {
      setIsCancelling(false)
      setCancellingOrderId(null)
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
        columnsConfig={ordersColumnsConfig}
      />

      <ViewOrderDialog isOpen={isViewOrderOpen} onOpenChange={setIsViewOrderOpen} order={selectedOrder} />

      {showAdminCancel && (
        <AdminCancelOrderDialog
          isOpen={cancelDialogOpen}
          onOpenChange={(open) => {
            setCancelDialogOpen(open)
            if (!open) setOrderToCancel(null)
          }}
          order={orderToCancel}
          onConfirm={handleConfirmCancel}
          isSubmitting={isCancelling}
        />
      )}

      <OrdersTable
        orders={filteredOrders}
        visibleColumns={visibleColumns}
        onViewOrder={handleViewOrder}
        onPrintOrder={handlePrintOrder}
        onCancelOrder={showAdminCancel ? handleOpenCancelDialog : undefined}
        cancellingOrderId={cancellingOrderId}
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
