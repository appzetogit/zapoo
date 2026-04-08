import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
export default function UpdateBankDetails() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [isEditMode, setIsEditMode] = useState(false);

  // Bank details state
  const [bankDetails, setBankDetails] = useState({
    beneficiaryName: "Mr. Rajkumar Chouhan",
    accountNumber: "42479177517",
    confirmAccountNumber: "42479177517",
    ifscCode: "SBIN0018764",
    lastUpdated: "9 Dec, 2023"
  });
  const [formData, setFormData] = useState({
    beneficiaryName: bankDetails.beneficiaryName,
    accountNumber: bankDetails.accountNumber,
    confirmAccountNumber: bankDetails.confirmAccountNumber,
    ifscCode: bankDetails.ifscCode
  });
  const [errors, setErrors] = useState({
    beneficiaryName: "",
    accountNumber: "",
    confirmAccountNumber: "",
    ifscCode: ""
  });
  const [touched, setTouched] = useState({
    beneficiaryName: false,
    accountNumber: false,
    confirmAccountNumber: false,
    ifscCode: false
  });

  // Validation functions
  const validateBeneficiaryName = name => {
    if (!name.trim()) {
      return t("restaurant.updateBank.validation.beneficiaryRequired");
    }
    if (name.trim().length < 3) {
      return t("restaurant.updateBank.validation.beneficiaryMinLength");
    }
    if (name.trim().length > 100) {
      return t("restaurant.updateBank.validation.beneficiaryMaxLength");
    }
    // Allow letters, spaces, dots, and common title prefixes
    const nameRegex = /^[A-Za-z\s.]+$/;
    if (!nameRegex.test(name.trim())) {
      return t("restaurant.updateBank.validation.beneficiaryPattern");
    }
    return "";
  };
  const validateAccountNumber = accountNumber => {
    if (!accountNumber.trim()) {
      return t("restaurant.updateBank.validation.accountRequired");
    }
    // Remove spaces and hyphens for validation
    const cleanAccountNumber = accountNumber.replace(/[\s\-]/g, "");
    // Account numbers are typically 9-18 digits
    if (!/^\d+$/.test(cleanAccountNumber)) {
      return t("restaurant.updateBank.validation.accountDigitsOnly");
    }
    if (cleanAccountNumber.length < 9) {
      return t("restaurant.updateBank.validation.accountMinLength");
    }
    if (cleanAccountNumber.length > 18) {
      return t("restaurant.updateBank.validation.accountMaxLength");
    }
    return "";
  };
  const validateConfirmAccountNumber = (confirmAccountNumber, accountNumber) => {
    if (!confirmAccountNumber.trim()) {
      return t("restaurant.updateBank.validation.confirmRequired");
    }
    const cleanConfirm = confirmAccountNumber.replace(/[\s\-]/g, "");
    const cleanAccount = accountNumber.replace(/[\s\-]/g, "");
    if (cleanConfirm !== cleanAccount) {
      return t("restaurant.updateBank.validation.accountMismatch");
    }
    return "";
  };
  const validateIFSC = ifsc => {
    if (!ifsc.trim()) {
      return t("restaurant.updateBank.validation.ifscRequired");
    }
    const trimmedIFSC = ifsc.trim().toUpperCase();

    // IFSC format: exactly 11 characters - 4 uppercase letters + 0 + 6 alphanumeric characters
    // Pattern: AAAA0XXXXXX where AAAA is bank code (4 letters) and XXXXXX is branch code (6 alphanumeric)
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (trimmedIFSC.length !== 11) {
      return t("restaurant.updateBank.validation.ifscLength");
    }
    if (!ifscRegex.test(trimmedIFSC)) {
      return t("restaurant.updateBank.validation.ifscInvalid");
    }
    return "";
  };
  const handleInputChange = (field, value) => {
    let processedValue = value;

    // Auto-uppercase for IFSC
    if (field === "ifscCode") {
      processedValue = value.toUpperCase();
    }
    setFormData(prev => ({
      ...prev,
      [field]: processedValue
    }));

    // Real-time validation
    let error = "";
    if (field === "beneficiaryName") {
      error = validateBeneficiaryName(processedValue);
    } else if (field === "accountNumber") {
      error = validateAccountNumber(processedValue);
      // Also re-validate confirm account number if it's been touched
      if (touched.confirmAccountNumber) {
        setErrors(prev => ({
          ...prev,
          accountNumber: error,
          confirmAccountNumber: validateConfirmAccountNumber(formData.confirmAccountNumber, processedValue)
        }));
        return;
      }
    } else if (field === "confirmAccountNumber") {
      error = validateConfirmAccountNumber(processedValue, formData.accountNumber);
    } else if (field === "ifscCode") {
      error = validateIFSC(processedValue);
    }
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };
  const handleBlur = field => {
    setTouched(prev => ({
      ...prev,
      [field]: true
    }));

    // Validate on blur
    let error = "";
    if (field === "beneficiaryName") {
      error = validateBeneficiaryName(formData.beneficiaryName);
    } else if (field === "accountNumber") {
      error = validateAccountNumber(formData.accountNumber);
      // Re-validate confirm account number
      if (touched.confirmAccountNumber || formData.confirmAccountNumber) {
        setErrors(prev => ({
          ...prev,
          accountNumber: error,
          confirmAccountNumber: validateConfirmAccountNumber(formData.confirmAccountNumber, formData.accountNumber)
        }));
        return;
      }
    } else if (field === "confirmAccountNumber") {
      error = validateConfirmAccountNumber(formData.confirmAccountNumber, formData.accountNumber);
    } else if (field === "ifscCode") {
      error = validateIFSC(formData.ifscCode);
    }
    setErrors(prev => ({
      ...prev,
      [field]: error
    }));
  };
  const handleSubmit = e => {
    e.preventDefault();

    // Mark all fields as touched
    setTouched({
      beneficiaryName: true,
      accountNumber: true,
      confirmAccountNumber: true,
      ifscCode: true
    });

    // Validate all fields
    const validationErrors = {
      beneficiaryName: validateBeneficiaryName(formData.beneficiaryName),
      accountNumber: validateAccountNumber(formData.accountNumber),
      confirmAccountNumber: validateConfirmAccountNumber(formData.confirmAccountNumber, formData.accountNumber),
      ifscCode: validateIFSC(formData.ifscCode)
    };
    setErrors(validationErrors);

    // Check if there are any errors
    const hasErrors = Object.values(validationErrors).some(error => error !== "");
    if (hasErrors) {
      return;
    }

    // Update bank details
    setBankDetails({
      beneficiaryName: formData.beneficiaryName.trim(),
      accountNumber: formData.accountNumber.replace(/[\s\-]/g, ""),
      confirmAccountNumber: formData.confirmAccountNumber.replace(/[\s\-]/g, ""),
      ifscCode: formData.ifscCode.trim().toUpperCase(),
      lastUpdated: new Date().toLocaleDateString(i18n.language === "bn" ? "bn-IN" : i18n.language === "hi" ? "hi-IN" : "en-GB", {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      })
    });

    // Switch back to view mode
    setIsEditMode(false);

    // Reset touched state
    setTouched({
      beneficiaryName: false,
      accountNumber: false,
      confirmAccountNumber: false,
      ifscCode: false
    });

    // Here you would typically save to backend
  };
  const handleEditClick = () => {
    // Reset form data to current bank details when entering edit mode
    setFormData({
      beneficiaryName: bankDetails.beneficiaryName,
      accountNumber: bankDetails.accountNumber,
      confirmAccountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode
    });
    // Reset errors and touched state
    setErrors({
      beneficiaryName: "",
      accountNumber: "",
      confirmAccountNumber: "",
      ifscCode: ""
    });
    setTouched({
      beneficiaryName: false,
      accountNumber: false,
      confirmAccountNumber: false,
      ifscCode: false
    });
    setIsEditMode(true);
  };
  return <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center gap-3 border-b border-gray-200">
        <button onClick={() => navigate(-1)} className="p-2 rounded-full hover:bg-gray-100" aria-label={t("restaurant.updateBank.aria.back")}>
          <ArrowLeft className="w-5 h-5 text-gray-900" />
        </button>
        <h1 className="text-lg font-bold text-gray-900">{t("restaurant.updateBank.title")}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-4 pt-4 pb-6">
        {!isEditMode ? (/* View Mode */
      <>
            {/* Account Information Section */}
            <div className="mb-6">
              <h2 className="text-base font-bold text-gray-900 mb-2">{t("restaurant.updateBank.sections.accountInformation")}</h2>
              <p className="text-sm text-gray-500 mb-4">{t("restaurant.updateBank.labels.lastUpdatedOn", { date: bankDetails.lastUpdated })}</p>
              
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-600">{t("restaurant.updateBank.labels.beneficiaryName")}:</span>
                  <span className="text-sm font-medium text-gray-900 text-right ml-4">{bankDetails.beneficiaryName}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-600">{t("restaurant.updateBank.labels.accountNumber")}:</span>
                  <span className="text-sm font-medium text-gray-900 text-right ml-4">{bankDetails.accountNumber}</span>
                </div>
                <div className="flex justify-between items-start">
                  <span className="text-sm text-gray-600">{t("restaurant.updateBank.labels.ifscCode")}:</span>
                  <span className="text-sm font-medium text-gray-900 text-right ml-4">{bankDetails.ifscCode}</span>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-gray-200 my-6"></div>

            {/* Issue Query Section */}
            <div className="mb-6">
              <p className="text-base font-bold text-gray-900">{t("restaurant.updateBank.labels.issueHelp")}</p>
            </div>
          </>) : (/* Edit Mode */
      <>
            {/* Form Title */}
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900">{t("restaurant.updateBank.title")}</h2>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Beneficiary Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.updateBank.fields.enterBeneficiaryName")}<span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.beneficiaryName} onChange={e => handleInputChange("beneficiaryName", e.target.value)} onBlur={() => handleBlur("beneficiaryName")} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-base transition-colors ${errors.beneficiaryName && touched.beneficiaryName ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-blue-500 focus:border-transparent"}`} required />
                {errors.beneficiaryName && touched.beneficiaryName && <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.beneficiaryName}</span>
                  </div>}
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.updateBank.fields.enterAccountNumber")}<span className="text-red-500">*</span>
                </label>
                <input type="text" inputMode="numeric" value={formData.accountNumber} onChange={e => handleInputChange("accountNumber", e.target.value)} onBlur={() => handleBlur("accountNumber")} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-base transition-colors ${errors.accountNumber && touched.accountNumber ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-blue-500 focus:border-transparent"}`} required />
                {errors.accountNumber && touched.accountNumber && <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.accountNumber}</span>
                  </div>}
              </div>

              {/* Confirm Account Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.updateBank.fields.confirmAccountNumber")}<span className="text-red-500">*</span>
                </label>
                <input type="text" inputMode="numeric" value={formData.confirmAccountNumber} onChange={e => handleInputChange("confirmAccountNumber", e.target.value)} onBlur={() => handleBlur("confirmAccountNumber")} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-base transition-colors ${errors.confirmAccountNumber && touched.confirmAccountNumber ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-blue-500 focus:border-transparent"}`} required />
                {errors.confirmAccountNumber && touched.confirmAccountNumber && <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.confirmAccountNumber}</span>
                  </div>}
              </div>

              {/* IFSC Code */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {t("restaurant.updateBank.fields.enterIfsc")}<span className="text-red-500">*</span>
                </label>
                <input type="text" value={formData.ifscCode} onChange={e => handleInputChange("ifscCode", e.target.value)} onBlur={() => handleBlur("ifscCode")} maxLength={11} className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 text-base transition-colors uppercase ${errors.ifscCode && touched.ifscCode ? "border-red-500 focus:ring-red-500 focus:border-red-500" : "border-gray-300 focus:ring-blue-500 focus:border-transparent"}`} required />
                {errors.ifscCode && touched.ifscCode && <div className="flex items-center gap-1 mt-1.5 text-xs text-red-600">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.ifscCode}</span>
                  </div>}
              </div>
            </form>
          </>)}
      </div>

      {/* Action Button */}
      <div className="px-4 pb-6 pt-4">
        {!isEditMode ? <button onClick={handleEditClick} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-base transition-colors">
            {t("restaurant.updateBank.actions.editBankDetails")}
          </button> : <button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg text-base transition-colors">
            {t("restaurant.updateBank.actions.submit")}
          </button>}
      </div>
    </div>;
}
