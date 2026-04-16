/**
 * Razorpay Payment Integration Utility
 * Handles Razorpay payment initialization and verification
 */

let razorpayLoaded = false;

/**
 * Load Razorpay checkout script
 */
export const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => {
      resolve(true);
    };
    script.onerror = () => {
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
  const res = await loadRazorpayScript();

  if (!res) {
    if (options.onError) options.onError("Razorpay SDK failed to load. Are you online?");
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
        if (options.onClose) options.onClose();
      }
    }
  };

  console.log("🔥 Passing order_id to Razorpay:", options.order_id);
  console.log("🔥 Razorpay options:", options);
  const paymentObject = new window.Razorpay(razorpayOptions);
  paymentObject.open();
};

/**
 * Format amount for display
 * @param {Number} amount - Amount in paise
 * @returns {String} Formatted amount string
 */
export const formatAmount = (amount) => {
  return `₹${(amount / 100).toFixed(2)}`;
};

