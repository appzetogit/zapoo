import React from "react";

export default function DeleteAccountModal({
  isOpen,
  onClose,
  onConfirm,
  walletAmount = 0,
  moduleName = "delivery",
}) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[1100] bg-black/60 flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-black text-gray-900 mb-2">Delete account?</h3>
        <p className="text-sm text-gray-600 mb-3">
          This action is permanent. Your {moduleName} profile will be removed.
        </p>
        {Number(walletAmount) > 0 ? (
          <p className="text-sm text-red-600 mb-4">
            Wallet balance ₹{Number(walletAmount).toFixed(2)} detected. Withdraw before deleting.
          </p>
        ) : (
          <p className="text-sm text-gray-500 mb-4">No wallet balance detected.</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-gray-200 text-gray-700 font-bold"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 h-11 rounded-xl bg-red-600 text-white font-bold"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
