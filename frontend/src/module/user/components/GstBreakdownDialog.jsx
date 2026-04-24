import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { calculateCustomerGstBreakdown } from "@/lib/utils/gstBreakdown";
import { useTranslation } from "react-i18next";

function formatCurrency(value) {
  return `₹${Number(value || 0).toFixed(2)}`;
}

export default function GstBreakdownDialog({
  open,
  onOpenChange,
  pricing = {},
}) {
  const { t } = useTranslation();
  const breakdown = calculateCustomerGstBreakdown({
    subtotal: pricing.subtotal,
    discount: pricing.discount,
    deliveryFee: pricing.deliveryFee,
    platformFee: pricing.platformFee,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md w-[92vw] rounded-2xl border border-gray-200 bg-white p-0 shadow-2xl dark:border-gray-700 dark:bg-gray-900">
        <DialogHeader className="border-b border-gray-100 px-5 py-4 text-left dark:border-gray-700">
          <DialogTitle className="text-lg font-semibold text-gray-900 dark:text-gray-100">{t("user.home.gstDialog.title")}</DialogTitle>
          <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
            {t("user.home.gstDialog.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="px-5 py-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("user.home.gstDialog.foodPriceGst")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.home.gstDialog.onAmountAfterDiscount", {
                amount: formatCurrency(breakdown.taxableFoodAmount)
              })}</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(breakdown.foodGst)}</p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("user.home.gstDialog.deliveryFeeGst")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.home.gstDialog.onAmount", {
                amount: formatCurrency(pricing.deliveryFee)
              })}</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(breakdown.deliveryGst)}</p>
          </div>

          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{t("user.home.gstDialog.platformFeeGst")}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.home.gstDialog.onAmount", {
                amount: formatCurrency(pricing.platformFee)
              })}</p>
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(breakdown.platformGst)}</p>
          </div>

          <div className="border-t border-gray-100 pt-3 flex items-center justify-between dark:border-gray-700">
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{t("user.home.gstDialog.totalGst")}</p>
            <p className="text-base font-bold text-gray-900 dark:text-gray-100">{formatCurrency(breakdown.total)}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
