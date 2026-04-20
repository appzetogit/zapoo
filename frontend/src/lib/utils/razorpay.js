/**
 * Razorpay Payment Integration Utility
 * Handles Razorpay payment initialization and verification
 */

let razorpayLoaded = false;
const razorpayUiDebug = (step, meta = {}) => {
  try {
    console.log("[AD_RAZORPAY_UI_DEBUG]", step, meta);
  } catch (_) {
    // no-op
  }
};

/**
 * Load Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && window.Razorpay) {
      razorpayUiDebug("script_already_available");
      razorpayLoaded = true;
      resolve(true);
      return;
    }

    razorpayUiDebug("script_load_start");
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      razorpayUiDebug("script_load_success", {
        hasWindowRazorpay: Boolean(window.Razorpay)
      });
      razorpayLoaded = true;
      resolve(true);
    };
    script.onerror = () => {
      razorpayUiDebug("script_load_error");
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

/**
 * Initialize Razorpay payment
 * @param {Object} options - Payment options
 */
export const initRazorpayPayment = async (options) => {
  razorpayUiDebug("init_start", {
    amount: options?.amount || null,
    currency: options?.currency || null,
    order_id: options?.order_id || null
  });
  const res = await loadRazorpayScript();

  if (!res) {
    razorpayUiDebug("init_script_unavailable");
    if (options.onError) options.onError("Razorpay SDK failed to load. Are you online?");
    return;
  }

  if (!window.Razorpay) {
    razorpayUiDebug("init_window_razorpay_missing_after_load");
    if (options.onError) options.onError("Razorpay SDK unavailable in this browser/webview.");
    return;
  }

  const razorpayOptions = {
    key: options.key,
    amount: options.amount,
    currency: options.currency || 'INR',
    name: options.name || 'Appzeto Food',
    description: options.description || 'Order Payment',
    image: options.image || '/logo.png',
    order_id: options.order_id,
    handler: async function (response) {
      razorpayUiDebug("handler_called", {
        razorpay_payment_id: response?.razorpay_payment_id || null,
        razorpay_order_id: response?.razorpay_order_id || null,
        has_signature: Boolean(response?.razorpay_signature)
      });
      if (options.handler) await options.handler(response);
    },
    prefill: {
      name: options.prefill?.name || '',
      email: options.prefill?.email || '',
      contact: options.prefill?.contact || ''
    },
    notes: options.notes || {},
    theme: {
      color: '#E23744'
    },
    modal: {
      ondismiss: function () {
        razorpayUiDebug("modal_dismissed");
        if (options.onClose) options.onClose();
      }
    }
  };

  razorpayUiDebug("checkout_options_ready", {
    keyPrefix: options?.key ? String(options.key).slice(0, 6) : null,
    order_id: options?.order_id || null
  });

  try {
    const paymentObject = new window.Razorpay(razorpayOptions);
    paymentObject.on("payment.failed", (failure) => {
      razorpayUiDebug("payment_failed_event", {
        code: failure?.error?.code || null,
        description: failure?.error?.description || null,
        source: failure?.error?.source || null,
        step: failure?.error?.step || null,
        reason: failure?.error?.reason || null,
        order_id: failure?.error?.metadata?.order_id || null,
        payment_id: failure?.error?.metadata?.payment_id || null
      });
      if (options.onError) {
        options.onError(failure);
      }
    });

    paymentObject.open();
    razorpayUiDebug("checkout_open_called");
  } catch (error) {
    razorpayUiDebug("checkout_open_exception", {
      message: error?.message || null
    });
    if (options.onError) {
      options.onError(error);
    }
  }
};

/**
 * Format amount for display
 * @param {Number} amount - Amount in paise
 * @returns {String} Formatted amount string
 */
export const formatAmount = (amount) => {
  return `₹${(amount / 100).toFixed(2)}`;
};

