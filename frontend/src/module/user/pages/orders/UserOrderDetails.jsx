import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ShoppingBag, Phone, Copy, Download, User, CreditCard, Calendar, MapPin, RotateCcw, FileText } from "lucide-react";
import { orderAPI, restaurantAPI, api, telephonyAPI } from "@/lib/api";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getCompanyNameAsync } from "@/lib/utils/businessSettings";
import GstBreakdownDialog from "../../components/GstBreakdownDialog";
import { useTranslation } from "react-i18next";
export default function UserOrderDetails() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const {
    orderId
  } = useParams();
  const [order, setOrder] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [callingRestaurant, setCallingRestaurant] = useState(false);
  const [callingDeliveryPartner, setCallingDeliveryPartner] = useState(false);
  const [showGstBreakdown, setShowGstBreakdown] = useState(false);
  useEffect(() => {
    const fetchOrderDetails = async () => {
      try {
        setLoading(true);
        const response = await orderAPI.getOrderDetails(orderId);
        let orderData = null;
        if (response?.data?.success && response.data.data?.order) {
          orderData = response.data.data.order;
        } else if (response?.data?.order) {
          orderData = response.data.order;
        } else {
          toast.error(t("user.orderDetailsPage.orderNotFound"));
          navigate("/user/orders");
          return;
        }
        setOrder(orderData);

        // If restaurantId is just a string (not populated), fetch restaurant details separately
        const restaurantId = orderData.restaurantId;
        if (restaurantId && typeof restaurantId === 'string' && !orderData.restaurant) {
          try {
            const restaurantResponse = await restaurantAPI.getRestaurantById(restaurantId);
            if (restaurantResponse?.data?.success && restaurantResponse.data.data?.restaurant) {
              setRestaurant(restaurantResponse.data.data.restaurant);
            } else if (restaurantResponse?.data?.restaurant) {
              setRestaurant(restaurantResponse.data.restaurant);
            }
          } catch (restaurantError) {
            console.warn("Failed to fetch restaurant details:", restaurantError);
            // Don't show error toast, just log it - order details can still be shown
          }
        }
      } catch (error) {
        console.error("Error fetching order details:", error);
        toast.error(error?.response?.data?.message || t("user.orderDetailsPage.failedToLoadOrderDetails"));
        navigate("/user/orders");
      } finally {
        setLoading(false);
      }
    };
    fetchOrderDetails();
  }, [orderId, navigate, t]);
  const handleCopyOrderId = async () => {
    if (!order) return;
    const id = order.orderId || order._id || orderId;
    try {
      await navigator.clipboard.writeText(String(id));
      toast.success(t("user.orderDetailsPage.toast.orderIdCopied"));
    } catch {
      toast.error(t("user.orderDetailsPage.toast.failedToCopyOrderId"));
    }
  };
  if (loading) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-gray-600 dark:text-gray-300 text-sm">{t("user.orderDetailsPage.loadingOrderDetails")}</p>
      </div>;
  }
  if (!order) {
    return <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center space-y-3">
          <p className="text-gray-700 dark:text-gray-200 text-sm font-medium">{t("user.orderDetailsPage.orderNotFound")}</p>
          <button onClick={() => navigate("/user/orders")} className="px-4 py-2 rounded-lg bg-[#E23744] text-white text-sm font-semibold">
            {t("user.orderDetailsPage.backToOrders")}
          </button>
        </div>
      </div>;
  }
  const orderIdDisplay = order.orderId || order._id || orderId;
  // Use fetched restaurant data if available, otherwise use order.restaurantId or order.restaurant
  const restaurantObj = restaurant || order.restaurantId || order.restaurant || {};
  const restaurantName = order.restaurantName || restaurantObj.name || t("user.orderDetailsPage.restaurantFallback");

  // Build restaurant address (try restaurant fields first, then fall back)
  const restaurantLocation = (() => {
    const loc = restaurantObj.location || {};

    // Priority 1: direct address on restaurant object
    if (restaurantObj.address) return restaurantObj.address;

    // Priority 2: formattedAddress from location
    if (loc.formattedAddress) return loc.formattedAddress;

    // Priority 3: generic address / street-style fields
    if (loc.address) return loc.address;
    if (loc.street || loc.city) {
      const parts = [loc.street, loc.area, loc.city, loc.state, loc.zipCode || loc.pincode || loc.postalCode].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }

    // Priority 4: addressLine1 / addressLine2 style
    if (loc.addressLine1) {
      const parts = [loc.addressLine1, loc.addressLine2, loc.city, loc.state].filter(Boolean);
      if (parts.length) return parts.join(", ");
    }

    // Priority 5: order-level restaurantAddress if present
    if (order.restaurantAddress) return order.restaurantAddress;

    // Don't fallback to user delivery address - show empty or "Address not available"
    return t("user.orderDetailsPage.addressNotAvailable");
  })();
  const items = Array.isArray(order.items) ? order.items : [];
  const pricing = order.pricing || {};
  const userName = order.userName || "";
  const userPhone = order.userPhone || "";
  const paymentMethod = (() => {
    const m = (order.payment?.method || '').toLowerCase();
    if (m === 'cash' || m === 'cod') return t("user.orderDetailsPage.paymentMethods.cashOnDelivery");
    if (m === 'wallet') return t("user.orderDetailsPage.paymentMethods.wallet");
    return t("user.orderDetailsPage.paymentMethods.online");
  })();
  const paymentDate = order.createdAt ? new Date(order.createdAt).toLocaleString(i18n?.language === "hi" ? "hi-IN" : i18n?.language === "bn" ? "bn-BD" : "en-IN", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }) : "";
  const addressText = order.address?.formattedAddress || [order.address?.street, order.address?.city, order.address?.state, order.address?.zipCode].filter(Boolean).join(", ");
  const savings = (pricing.discount || 0) + (pricing.originalItemTotal || 0) - (pricing.subtotal || 0);

  const normalizeId = (value) => {
    if (!value && value !== 0) return "";
    if (typeof value === "object") return String(value._id || value.id || value);
    return String(value);
  };

  const deliveryPartnerId = normalizeId(order.deliveryPartnerId || order.deliveryPartner || order.assignmentInfo?.deliveryPartnerId);

  const handleCallRestaurant = async () => {
    const businessOrderId = order.orderId || order._id || orderId;
    if (!businessOrderId) {
      toast.error(t("user.orderDetailsPage.toast.orderIdNotAvailable"));
      return;
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      toast.error(t("user.orderDetailsPage.toast.callsNotAllowed"));
      return;
    }

    try {
      // DEBUG: trace the masked-call button click for restaurant calls from the order details screen
      console.log("[MASKING][FRONTEND][CLICK]", {
        screen: "UserOrderDetails",
        targetRole: "restaurant",
        orderId: businessOrderId,
        timestamp: new Date(),
      });
      setCallingRestaurant(true);
      await telephonyAPI.initiateMaskedCall({
        orderId: businessOrderId,
        targetRole: "restaurant",
      });
      toast.success(t("user.orderDetailsPage.toast.callConnectingRestaurant"));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("user.orderDetailsPage.toast.failedToInitiateMaskedCall"));
    } finally {
      setCallingRestaurant(false);
    }
  };

  const handleCallDeliveryPartner = async () => {
    const businessOrderId = order.orderId || order._id || orderId;
    if (!businessOrderId) {
      toast.error(t("user.orderDetailsPage.toast.orderIdNotAvailable"));
      return;
    }

    if (order.status === "cancelled" || order.status === "delivered") {
      toast.error(t("user.orderDetailsPage.toast.callsNotAllowed"));
      return;
    }

    try {
      // DEBUG: trace the masked-call button click for delivery-partner calls from the order details screen
      console.log("[MASKING][FRONTEND][CLICK]", {
        screen: "UserOrderDetails",
        targetRole: "delivery_partner",
        orderId: businessOrderId,
        timestamp: new Date(),
      });
      setCallingDeliveryPartner(true);
      await telephonyAPI.initiateMaskedCall({
        orderId: businessOrderId,
        targetRole: "delivery_partner",
      });
      toast.success(t("user.orderDetailsPage.toast.callConnectingDeliveryPartner"));
    } catch (error) {
      toast.error(error?.response?.data?.message || t("user.orderDetailsPage.toast.failedToInitiateMaskedCall"));
    } finally {
      setCallingDeliveryPartner(false);
    }
  };
  const handleDownloadSummary = async () => {
    try {
      const companyName = await getCompanyNameAsync();
      const doc = new jsPDF({
        unit: "pt",
        format: "a4"
      });
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 40;
      const contentWidth = pageWidth - margin * 2;
      const rightX = pageWidth - margin;
      const formatCurrency = amount => `INR ${Number(amount || 0).toFixed(2)}`;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text(t("user.orderDetailsPage.pdf.summaryAndReceipt", {
        companyName
      }), pageWidth / 2, 44, {
        align: "center"
      });

      let yPos = 84;
      const labelX = margin + 6;
      const valueX = margin + 180;
      const valueWidth = rightX - valueX;
      const deliveryPartnerName = order.deliveryPartnerName || order.deliveryPartner?.name || order.assignmentInfo?.deliveryPartnerName || "";
      const detailRows = [
        [t("user.orderDetailsPage.pdf.orderId"), orderIdDisplay],
        [t("user.orderDetailsPage.pdf.orderTime"), paymentDate || t("user.orderDetailsPage.na")],
        [t("user.orderDetailsPage.pdf.customerName"), userName || t("user.orderDetailsPage.customer")],
        [t("user.orderDetailsPage.pdf.deliveryAddress"), addressText || t("user.orderDetailsPage.na")],
        [t("user.orderDetailsPage.pdf.restaurantName"), restaurantName || t("user.orderDetailsPage.na")],
        [t("user.orderDetailsPage.pdf.restaurantAddress"), restaurantLocation || t("user.orderDetailsPage.na")],
        ["Payment Method", paymentMethod || t("user.orderDetailsPage.na")]
      ];
      if (deliveryPartnerName) {
        detailRows.push(["Delivery partner's Name", deliveryPartnerName]);
      }

      detailRows.forEach(([label, value]) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10.5);
        doc.setTextColor(25, 25, 25);
        doc.text(`${label}:`, labelX, yPos);

        doc.setFont("helvetica", "normal");
        doc.setTextColor(107, 114, 128);
        const valueLines = doc.splitTextToSize(String(value || t("user.orderDetailsPage.na")), valueWidth);
        doc.text(valueLines, valueX, yPos);
        yPos += Math.max(22, valueLines.length * 14);
      });

      yPos += 8;
      const tableData = items.map(item => {
        const qty = Number(item.quantity || item.qty || 1);
        const unitPrice = Number(item.price || 0);
        return [item.name || t("user.orderDetailsPage.item"), String(qty), formatCurrency(unitPrice), formatCurrency(unitPrice * qty)];
      });
      autoTable(doc, {
        startY: yPos,
        head: [[t("user.orderDetailsPage.pdf.item"), t("user.orderDetailsPage.pdf.quantity"), t("user.orderDetailsPage.pdf.unitPrice"), t("user.orderDetailsPage.pdf.totalPrice")]],
        body: tableData,
        theme: "plain",
        margin: {
          left: margin,
          right: margin
        },
        headStyles: {
          fillColor: [182, 182, 182],
          textColor: 255,
          fontStyle: "bold",
          fontSize: 11,
          halign: "left",
          cellPadding: {
            top: 8,
            right: 10,
            bottom: 8,
            left: 10
          }
        },
        bodyStyles: {
          textColor: [33, 33, 33],
          fontSize: 11
        },
        styles: {
          lineColor: [221, 221, 221],
          lineWidth: 0,
          cellPadding: {
            top: 10,
            right: 10,
            bottom: 10,
            left: 10
          }
        },
        columnStyles: {
          0: {
            cellWidth: contentWidth * 0.58
          },
          1: {
            cellWidth: contentWidth * 0.12,
            halign: "center"
          },
          2: {
            cellWidth: contentWidth * 0.15,
            halign: "right"
          },
          3: {
            cellWidth: contentWidth * 0.15,
            halign: "right",
            fontStyle: "bold"
          }
        },
        didDrawCell: data => {
          // horizontal dividers only
          if (data.section === "head" && data.column.index === 0) {
            doc.setDrawColor(214, 214, 214);
            doc.setLineWidth(0.7);
            doc.line(margin, data.cell.y + data.cell.height, rightX, data.cell.y + data.cell.height);
          }
          if (data.section === "body" && data.column.index === 0) {
            doc.setDrawColor(228, 228, 228);
            doc.setLineWidth(0.7);
            doc.line(margin, data.cell.y + data.cell.height, rightX, data.cell.y + data.cell.height);
          }
        }
      });

      const subtotal = Number(pricing.subtotal || 0);
      const discount = Number(pricing.discount || 0);
      const deliveryFee = Number(pricing.deliveryFee || 0);
      const platformFee = Number(pricing.platformFee || 0);
      const tax = Number(pricing.tax || pricing.gstCollected || 0);
      const total = Number(pricing.total || 0);
      const itemTotal = items.reduce((sum, item) => {
        const qty = Number(item.quantity || item.qty || 1);
        const unitPrice = Number(item.price || 0);
        return sum + unitPrice * qty;
      }, 0);
      const effectiveSubtotal = subtotal > 0 ? subtotal : itemTotal;
      const breakdownRows = [["Item total", formatCurrency(effectiveSubtotal)]];
      if (discount > 0) breakdownRows.push(["Discount", `- ${formatCurrency(discount)}`]);
      if (deliveryFee > 0) breakdownRows.push(["Restaurant Delivery Fee", formatCurrency(deliveryFee)]);
      if (platformFee > 0) breakdownRows.push(["Platform Fee", formatCurrency(platformFee)]);
      if (tax > 0) breakdownRows.push(["GST / Tax", formatCurrency(tax)]);
      breakdownRows.push([t("user.orderDetailsPage.pdf.total"), formatCurrency(total)]);

      const breakdownStartY = (doc.lastAutoTable?.finalY || yPos) + 12;
      autoTable(doc, {
        startY: breakdownStartY,
        theme: "plain",
        margin: {
          left: rightX - 300,
          right: margin
        },
        body: breakdownRows,
        styles: {
          fontSize: 11,
          textColor: [33, 33, 33],
          cellPadding: {
            top: 7,
            right: 0,
            bottom: 7,
            left: 0
          }
        },
        columnStyles: {
          0: {
            cellWidth: 210,
            halign: "right"
          },
          1: {
            cellWidth: 90,
            halign: "right"
          }
        }
      });

      const summaryEndY = doc.lastAutoTable?.finalY || breakdownStartY;
      autoTable(doc, {
        startY: summaryEndY + 6,
        theme: "plain",
        margin: {
          left: rightX - 300,
          right: margin
        },
        body: [[t("user.orderDetailsPage.pdf.total"), formatCurrency(total)]],
        styles: {
          fontSize: 13,
          fontStyle: "bold",
          textColor: [20, 20, 20],
          fillColor: [226, 226, 226],
          cellPadding: {
            top: 9,
            right: 10,
            bottom: 9,
            left: 10
          }
        },
        columnStyles: {
          0: {
            cellWidth: 210,
            halign: "right"
          },
          1: {
            cellWidth: 90,
            halign: "right"
          }
        }
      });

      const fileName = `Order_Summary_${orderIdDisplay}_${Date.now()}.pdf`;
      doc.save(fileName);
      toast.success(t("user.orderDetailsPage.toast.summaryDownloaded"));
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error(t("user.orderDetailsPage.toast.failedToDownloadSummary"));
    }
  };
  return <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a] pb-24 font-sans relative">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] p-4 flex items-center sticky top-0 z-20 shadow-sm border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <ArrowLeft className="w-6 h-6 text-gray-700 dark:text-gray-200 cursor-pointer" />
          </button>
          <h1 className="text-lg font-semibold text-gray-800 dark:text-white">{t("user.orderDetailsPage.title")}</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="p-4 space-y-4">
        {/* Status Card */}
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl flex items-center gap-3 shadow-sm border border-transparent dark:border-gray-800">
          <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded-lg">
            <ShoppingBag className="w-6 h-6 text-gray-600 dark:text-gray-300" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-800 dark:text-white">
              {order.status === "delivered" ? t("user.orderDetailsPage.orderWasDelivered") : t("user.orderDetailsPage.orderStatusWithValue", {
              status: order.status || t("user.orderDetailsPage.processing")
            })}
            </h2>
          </div>
        </div>

        {/* Restaurant Info Card */}
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm border border-transparent dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <img src={
            // Prefer the food image from the first ordered item
            Array.isArray(items) && items[0]?.image || restaurantObj.profileImage?.url || restaurantObj.profileImage || order.restaurantImage || "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=100&q=80"} alt={restaurantName} className="w-10 h-10 rounded-lg object-cover" />
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white">{restaurantName}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{restaurantLocation}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCallRestaurant}
                disabled={callingRestaurant}
                title={t("user.orderDetailsPage.callRestaurantMasked")}
                className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-[#E23744] hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Phone className="w-4 h-4" />
              </button>
              {deliveryPartnerId ? (
                <button
                  type="button"
                  onClick={handleCallDeliveryPartner}
                  disabled={callingDeliveryPartner}
                  title={t("user.orderDetailsPage.callDeliveryPartnerMasked")}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700 flex items-center justify-center text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Phone className="w-4 h-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide font-medium">
              {t("user.orderDetailsPage.orderIdLabel", {
              id: orderIdDisplay
            })}
            </span>
            <button type="button" onClick={handleCopyOrderId}>
              <Copy className="w-3 h-3 text-gray-400 dark:text-gray-500 cursor-pointer" />
            </button>
          </div>

          <div className="border-t border-dashed border-gray-200 dark:border-gray-700 my-3" />

          {/* Items */}
          {items.map((item, idx) => <div key={idx} className="flex justify-between items-start mt-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 border ${item.isVeg ? "border-green-600" : "border-red-600"} flex items-center justify-center p-[1px]`}>
                  <div className={`w-full h-full rounded-full ${item.isVeg ? "bg-green-600" : "bg-red-600"}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-gray-200 font-medium">
                  {item.quantity || item.qty || 1} x {item.name}
                </span>
              </div>
              <span className="text-sm text-gray-800 dark:text-gray-100 font-medium">
                ₹{(item.price || 0).toFixed(2)}
              </span>
            </div>)}
        </div>

        {/* Bill Summary Card */}
        <div className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm overflow-hidden border border-transparent dark:border-gray-800">
          <div className="p-4 flex justify-between items-center border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              <h3 className="font-semibold text-gray-800 dark:text-white">{t("user.orderDetailsPage.billSummary")}</h3>
            </div>
            <button type="button" onClick={handleDownloadSummary} className="w-7 h-7 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-[#E23744] hover:bg-red-100 dark:hover:bg-red-900/30">
              <Download className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t("user.orderDetailsPage.itemTotal")}</span>
              <div>
                {pricing.originalItemTotal && <span className="text-gray-400 dark:text-gray-500 line-through mr-1">
                    ₹{Number(pricing.originalItemTotal).toFixed(2)}
                  </span>}
                <span className="text-gray-800 dark:text-gray-100">
                  ₹{Number(pricing.subtotal || pricing.total || 0).toFixed(2)}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGstBreakdown(true)}
              className="flex w-full justify-between text-left"
            >
              <span className="text-gray-500 dark:text-gray-400 underline underline-offset-4 decoration-dotted">{t("user.orderDetailsPage.gstGovTaxes")}</span>
              <span className="text-gray-800 dark:text-gray-100">
                ₹{Number(pricing.tax || 0).toFixed(2)}
              </span>
            </button>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t("user.orderDetailsPage.deliveryPartnerFee")}</span>
              <div>
                {pricing.originalDeliveryFee && <span className="text-gray-400 dark:text-gray-500 line-through mr-1">
                    ₹{Number(pricing.originalDeliveryFee).toFixed(2)}
                  </span>}
                <span className="text-blue-500 font-medium uppercase">
                  {pricing.deliveryFee ? `₹${Number(pricing.deliveryFee).toFixed(2)}` : t("user.orderDetailsPage.free")}
                </span>
              </div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t("user.orderDetailsPage.platformFee")}</span>
              <span className="text-gray-800 dark:text-gray-100">
                ₹{Number(pricing.platformFee || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">{t("user.orderDetailsPage.subscriptionOtherFees")}</span>
              <span className="text-gray-800 dark:text-gray-100">
                ₹{Number(pricing.subscriptionFee || 0).toFixed(2)}
              </span>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-800 my-2 pt-2 flex justify-between items-center">
              <span className="font-bold text-gray-800 dark:text-white">{t("user.orderDetailsPage.paid")}</span>
              <span className="font-bold text-gray-800 dark:text-white">
                ₹{Number(pricing.total || 0).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Savings Banner */}
          {savings > 0 && <div className="relative bg-blue-50 p-3 pb-4 mt-2">
              <div className="absolute -top-1.5 left-0 w-full overflow-hidden leading-none">
                <svg className="relative block w-[calc(100%+1.3px)] h-[8px]" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120" preserveAspectRatio="none">
                  <path d="M0,0V46.29c47,0,47,69.5,94,69.5s47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5,47-69.5,94-69.5,47,69.5,94,69.5V0Z" fill="#ffffff" className="fill-white dark:fill-[#1a1a1a]" />
                </svg>
              </div>

              <div className="flex items-center justify-center gap-2 pt-1 text-blue-600 font-bold text-sm">
                <span>🎉</span>
                <span>
                  {t("user.orderDetailsPage.savedOnOrder", {
                  amount: Number(savings).toFixed(2)
                })}
                </span>
              </div>
            </div>}
        </div>

        <GstBreakdownDialog
          open={showGstBreakdown}
          onOpenChange={setShowGstBreakdown}
          pricing={{
            subtotal: pricing.subtotal,
            discount: pricing.discount,
            deliveryFee: pricing.deliveryFee,
            platformFee: pricing.platformFee,
          }}
        />

        {/* User & Delivery Details */}
        <div className="bg-white dark:bg-[#1a1a1a] p-4 rounded-xl shadow-sm space-y-5 border border-transparent dark:border-gray-800">
          {/* User */}
          <div className="flex gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-800 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                {userName || t("user.orderDetailsPage.customer")}
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs">{userPhone}</p>
            </div>
          </div>

          {/* Payment */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <CreditCard className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                {t("user.orderDetailsPage.paymentMethod")}
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                {t("user.orderDetailsPage.paidViaWithValue", {
                method: paymentMethod
              })}
              </p>
            </div>
          </div>

          {/* Date */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <Calendar className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                {t("user.orderDetailsPage.paymentDate")}
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5">{paymentDate}</p>
            </div>
          </div>

          {/* Address */}
          <div className="flex gap-3">
            <div className="mt-0.5">
              <MapPin className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-800 dark:text-white text-sm">
                {t("user.orderDetailsPage.deliveryAddress")}
              </h4>
              <p className="text-gray-500 dark:text-gray-400 text-xs mt-0.5 leading-relaxed">
                {addressText || t("user.orderDetailsPage.addressNotAvailable")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Buttons */}
      <div className="fixed bottom-0 w-full bg-white dark:bg-[#1a1a1a] border-t border-gray-200 dark:border-gray-800 p-4 flex gap-3 z-20">
        <button type="button" onClick={() => navigate(`/user/restaurants/${order.restaurantId || ""}`)} className="flex-1 bg-[#E23744] text-white py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-600 transition-colors">
          <RotateCcw className="w-4 h-4" />
          {t("user.orderDetailsPage.reorder")}
        </button>
        <button type="button" onClick={handleDownloadSummary} className="flex-1 bg-white dark:bg-[#0f0f0f] border border-[#E23744] text-[#E23744] py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
          <Download className="w-4 h-4" />
          {t("user.orderDetailsPage.invoice")}
        </button>
      </div>

      {/* Restaurant Complaint Button - Below Order Details */}
      {order && <div className="p-4 pb-24">
          <button type="button" onClick={() => {
        // Use MongoDB _id (ObjectId) for the API call - backend complaint controller expects ObjectId
        // Priority: order._id (MongoDB ObjectId) > orderId from route params
        const orderMongoId = order._id || orderId;
        if (!orderMongoId) {
          console.error("Order ID not available:", {
            order: order ? {
              _id: order._id,
              orderId: order.orderId
            } : null,
            routeOrderId: orderId
          });
          toast.error(t("user.orderDetailsPage.toast.orderIdNotAvailableRefresh"));
          return;
        }

        // Convert to string if it's an ObjectId object
        const orderIdString = typeof orderMongoId === 'object' && orderMongoId.toString ? orderMongoId.toString() : String(orderMongoId);
        navigate(`/user/complaints/submit/${encodeURIComponent(orderIdString)}`);
      }} className="w-full bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-300 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-colors">
            <FileText className="w-4 h-4" />
            {t("user.orderDetailsPage.restaurantComplaint")}
          </button>
        </div>}
    </div>;
}
