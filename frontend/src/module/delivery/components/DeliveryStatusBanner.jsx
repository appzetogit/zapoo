import React from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

const DeliveryStatusBanner = React.memo(({ mapViewMode, deliveryStatus, rejectionReason, handleReverify, isReverifying }) => {
  if (mapViewMode !== "hotspot" || (deliveryStatus !== "pending" && deliveryStatus !== "blocked")) {
    return null;
  }

  return (
    <motion.div initial={{
      opacity: 0,
      y: 20
    }} animate={{
      opacity: 1,
      y: 0
    }} transition={{
      delay: 0.2
    }} className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-white rounded-2xl shadow-sm px-6 py-4 z-20 min-w-[96%] text-center">
      {deliveryStatus === "pending" ? <>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Verification Done in 24 Hours</h3>
        <p className="text-sm text-gray-600">Your account is under verification. You'll be notified once approved.</p>
      </> : deliveryStatus === "blocked" ? <>
        <h3 className="text-lg font-bold text-red-600 mb-2">Denied Verification</h3>
        {rejectionReason && <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3 text-left">
          <p className="text-xs font-semibold text-red-800 mb-2">Reason for Rejection:</p>
          <div className="text-xs text-red-700 space-y-1">
            {rejectionReason.split('\n').filter(line => line.trim()).length > 1 ? <ul className="space-y-1 list-disc list-inside">
              {rejectionReason.split('\n').map((point, index) => point.trim() && <li key={index}>{point.trim()}</li>)}
            </ul> : <p className="text-red-700">{rejectionReason}</p>}
          </div>
        </div>}
        <p className="text-sm text-gray-700 mb-3">
          Please correct the above issues and click "Reverify" to resubmit your request for approval.
        </p>
        <button onClick={handleReverify} disabled={isReverifying} className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-semibold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mx-auto">
          {isReverifying ? <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Submitting...
          </> : "Reverify"}
        </button>
      </> : null}
    </motion.div>
  );
});

DeliveryStatusBanner.displayName = 'DeliveryStatusBanner';

export default DeliveryStatusBanner;
