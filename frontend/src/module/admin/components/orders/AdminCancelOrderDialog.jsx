import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export default function AdminCancelOrderDialog({
  isOpen,
  onOpenChange,
  order,
  onConfirm,
  isSubmitting = false,
}) {
  const [reason, setReason] = useState("")

  useEffect(() => {
    if (!isOpen) {
      setReason("")
    }
  }, [isOpen])

  const handleConfirm = () => {
    if (!reason.trim() || !order) return
    onConfirm(order, reason.trim())
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 gap-0">
        <DialogHeader className="space-y-3 px-1 pb-2">
          <DialogTitle>Cancel Order</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-slate-600">
            {order ? (
              <>
                You are about to cancel order <span className="font-medium text-slate-800">#{order.orderId}</span>.
                This action will update the order status to cancelled.
                <br />
                <br />
                The restaurant and delivery partner will receive their applicable settlement amounts. No automatic refund will be processed for the customer.
                <br />
                <br />
                Please provide a cancellation reason below to continue.
              </>
            ) : (
              "Please confirm that you wish to cancel this order."
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 px-1 py-4">
          <label htmlFor="admin-cancel-reason" className="text-sm font-medium text-slate-700">
            Cancellation reason <span className="text-red-500">*</span>
          </label>
          <textarea
            id="admin-cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter the reason for cancellation..."
            rows={4}
            className="w-full px-3 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-none"
            disabled={isSubmitting}
          />
        </div>

        <DialogFooter className="gap-3 px-1 pt-2 sm:justify-end">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting || !reason.trim()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Cancel Order
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
