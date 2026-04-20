import { useState, useMemo, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Download, ChevronDown, Plus, Edit, Trash2, Info, MapPin, SlidersHorizontal, ArrowDownUp, Timer, Star, IndianRupee, UtensilsCrossed, BadgePercent, ShieldCheck, X, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { adminAPI } from "@/lib/api";
import { API_BASE_URL } from "@/lib/api/config";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useTranslation } from "react-i18next";
export default function Category() {
  const { t } = useTranslation();
  const [activeLanguage, setActiveLanguage] = useState("en");
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState(new Set());
  const [sortBy, setSortBy] = useState(null);
  const [selectedCuisine, setSelectedCuisine] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilterTab, setActiveFilterTab] = useState('sort');
  const [activeScrollSection, setActiveScrollSection] = useState('sort');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    localizedName: { en: "", hi: "", bn: "" },
    localizedDescription: { en: "", hi: "", bn: "" },
    image: "https://via.placeholder.com/40",
    status: true,
    type: ""
  });
  const [selectedImageFile, setSelectedImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef(null);
  const filterSectionRefs = useRef({});
  const rightContentRef = useRef(null);

  // Simple filter toggle function
  const toggleFilter = filterId => {
    setActiveFilters(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filterId)) {
        newSet.delete(filterId);
      } else {
        newSet.add(filterId);
      }
      return newSet;
    });
  };

  // Fetch categories from API
  useEffect(() => {
    // Check if admin is authenticated
    const adminToken = localStorage.getItem('admin_accessToken');
    if (!adminToken) {
      console.warn('No admin token found. User may need to login.');
      toast.error(t("admin.category.errors.loginRequired"));
      setLoading(false);
      return;
    }

    // Log API base URL for debugging

    fetchCategories();
  }, []);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchCategories();
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Scroll tracking effect for filter modal
  useEffect(() => {
    if (!isFilterOpen || !rightContentRef.current) return;
    const observerOptions = {
      root: rightContentRef.current,
      rootMargin: '-20% 0px -70% 0px',
      threshold: 0
    };
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const sectionId = entry.target.getAttribute('data-section-id');
          if (sectionId) {
            setActiveScrollSection(sectionId);
            setActiveFilterTab(sectionId);
          }
        }
      });
    }, observerOptions);
    Object.values(filterSectionRefs.current).forEach(ref => {
      if (ref) observer.observe(ref);
    });
    return () => observer.disconnect();
  }, [isFilterOpen]);

  // Fetch categories
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchQuery) params.search = searchQuery;
      const response = await adminAPI.getCategories(params);
      if (response.data.success) {
        setCategories(response.data.data.categories || []);
      } else {
        toast.error(response.data.message || t("admin.category.errors.loadFailed"));
        setCategories([]);
      }
    } catch (error) {
      // More detailed error logging
      console.error('Error fetching categories:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null,
        request: error.request ? {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        } : null
      });
      if (error.response) {
        // Server responded with error status
        const status = error.response.status;
        const errorData = error.response.data;
        if (status === 401) {
          toast.error(t("admin.category.errors.authRequired"));
        } else if (status === 403) {
          toast.error(t("admin.category.errors.accessDenied"));
        } else if (status === 404) {
          toast.error(t("admin.category.errors.endpointNotFound"));
        } else if (status >= 500) {
          toast.error(t("admin.category.errors.serverError"));
        } else {
          toast.error(errorData?.message || t("admin.category.errors.loadWithStatus", { status }));
        }
      } else if (error.request) {
        // Request was made but no response received
        console.error('Network error - No response from server');
        console.error('Request URL:', error.config?.baseURL + error.config?.url);
        toast.error(t("admin.category.errors.network", { host: API_BASE_URL.replace('/api', '') }));
      } else {
        // Something else happened
        console.error('Request setup error:', error.message);
        toast.error(error.message || t("admin.category.errors.loadFailed"));
      }
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };
  const filteredCategories = useMemo(() => {
    let result = [...categories];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(cat => cat.name?.toLowerCase().includes(query) || cat.id?.toString().includes(query));
    }
    return result;
  }, [categories, searchQuery]);
  const handleToggleStatus = async id => {
    try {
      const response = await adminAPI.toggleCategoryStatus(id);
      if (response.data.success) {
        toast.success(t("admin.category.success.statusUpdated"));
        // Update local state immediately for better UX
        setCategories(prevCategories => prevCategories.map(cat => cat.id === id ? {
          ...cat,
          status: !cat.status
        } : cat));
        // Refresh from server to ensure consistency
        setTimeout(() => fetchCategories(), 500);
      }
    } catch (error) {
      console.error('Error toggling status:', error);
      const errorMessage = error.response?.data?.message || t("admin.category.errors.updateStatusFailed");
      toast.error(errorMessage);
    }
  };
  const handleDelete = async id => {
    const categoryName = categories.find(cat => cat.id === id)?.name || t("admin.category.common.thisCategory");
    if (window.confirm(t("admin.category.confirm.delete", { categoryName }))) {
      try {
        const response = await adminAPI.deleteCategory(id);
        if (response.data.success) {
          toast.success(t("admin.category.success.deleted"));
          // Remove from local state immediately for better UX
          setCategories(prevCategories => prevCategories.filter(cat => cat.id !== id));
          // Refresh from server to ensure consistency
          setTimeout(() => fetchCategories(), 500);
        }
      } catch (error) {
        console.error('Error deleting category:', error);
        const errorMessage = error.response?.data?.message || t("admin.category.errors.deleteFailed");
        toast.error(errorMessage);
      }
    }
  };
  const handleEdit = category => {
    setActiveLanguage("en");
    setEditingCategory(category);
    setFormData({
      name: category.name || "",
      description: category.description || "",
      localizedName: {
        en: category.localizedName?.en || category.name || "",
        hi: category.localizedName?.hi || "",
        bn: category.localizedName?.bn || "",
      },
      localizedDescription: {
        en: category.localizedDescription?.en || category.description || "",
        hi: category.localizedDescription?.hi || "",
        bn: category.localizedDescription?.bn || "",
      },
      image: category.image || "https://via.placeholder.com/40",
      status: category.status !== undefined ? category.status : true,
      type: category.type || ""
    });
    setSelectedImageFile(null);
    setImagePreview(category.image || null);
    setIsModalOpen(true);
  };
  const handleAddNew = () => {
    setActiveLanguage("en");
    setEditingCategory(null);
    setFormData({
      name: "",
      description: "",
      localizedName: { en: "", hi: "", bn: "" },
      localizedDescription: { en: "", hi: "", bn: "" },
      image: "https://via.placeholder.com/40",
      status: true,
      type: ""
    });
    setSelectedImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    setIsModalOpen(true);
  };
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF();

      // Add title
      doc.setFontSize(18);
      doc.setTextColor(30, 30, 30);
      doc.text(t("admin.category.title.list"), 14, 20);

      // Add date
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      const date = new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
      doc.text(t("admin.category.export.generatedOn", { date }), 14, 28);

      // Prepare table data
      const tableData = filteredCategories.map((category, index) => [category.sl || index + 1, category.name || t("admin.category.common.na"), category.type || t("admin.category.common.na"), category.status ? t("admin.category.status.active") : t("admin.category.status.inactive"), category.id || t("admin.category.common.na")]);

      // Add table
      autoTable(doc, {
        startY: 35,
        head: [[t("admin.category.table.sl"), t("admin.category.table.name"), t("admin.category.table.type"), t("admin.category.table.status"), t("admin.category.table.id")]],
        body: tableData,
        theme: 'striped',
        headStyles: {
          fillColor: [255, 82, 0],
          // Orange color
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 10
        },
        bodyStyles: {
          fontSize: 9,
          textColor: [30, 30, 30]
        },
        alternateRowStyles: {
          fillColor: [245, 247, 250]
        },
        styles: {
          cellPadding: 5,
          lineColor: [200, 200, 200],
          lineWidth: 0.5
        },
        columnStyles: {
          0: {
            cellWidth: 20
          },
          // SL
          1: {
            cellWidth: 70
          },
          // Category Name
          2: {
            cellWidth: 50
          },
          // Type
          3: {
            cellWidth: 40
          },
          // Status
          4: {
            cellWidth: 50
          } // ID
        }
      });

      // Add footer
      const pageCount = doc.internal.pages.length - 1;
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 10, {
          align: 'center'
        });
      }

      // Save PDF
      const fileName = `Categories_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
      toast.success(t("admin.category.success.exported"));
    } catch (error) {
      console.error('Error exporting PDF:', error);
      toast.error(t("admin.category.errors.exportFailed"));
    }
  };
  const handleImageSelect = e => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t("admin.category.errors.invalidFileType"));
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast.error(t("admin.category.errors.fileTooLarge"));
      return;
    }

    // Set file and create preview
    setSelectedImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);
  };
  const handleRemoveImage = () => {
    setSelectedImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setActiveLanguage("en");
    setEditingCategory(null);
    setSelectedImageFile(null);
    setImagePreview(null);
    setFormData({
      name: "",
      description: "",
      localizedName: { en: "", hi: "", bn: "" },
      localizedDescription: { en: "", hi: "", bn: "" },
      image: "https://via.placeholder.com/40",
      status: true,
      type: ""
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  const handleSubmit = async e => {
    e.preventDefault();
    try {
      setUploadingImage(true);

      // Prepare FormData for file upload
      const formDataToSend = new FormData();
      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description || "");
      formDataToSend.append('localizedName', JSON.stringify(formData.localizedName || {}));
      formDataToSend.append('localizedDescription', JSON.stringify(formData.localizedDescription || {}));
      formDataToSend.append('locale', activeLanguage);
      formDataToSend.append('autoTranslate', String(activeLanguage === 'en'));
      formDataToSend.append('type', formData.type);
      formDataToSend.append('status', formData.status.toString());

      // Add image file if selected, otherwise use existing image URL
      if (selectedImageFile) {
        formDataToSend.append('image', selectedImageFile);
      } else if (formData.image && formData.image !== 'https://via.placeholder.com/40') {
        // If no new file but existing image URL, send it as string
        formDataToSend.append('image', formData.image);
      }
      if (editingCategory) {
        const response = await adminAPI.updateCategory(editingCategory.id, formDataToSend);
        if (response.data.success) {
          toast.success(t("admin.category.success.updated"));
          // Update local state immediately for better UX
          const updatedCategory = response.data.data.category;
          setCategories(prevCategories => prevCategories.map(cat => cat.id === editingCategory.id ? {
            ...cat,
            ...updatedCategory,
            id: updatedCategory.id || cat.id
          } : cat));
        }
      } else {
        const response = await adminAPI.createCategory(formDataToSend);
        if (response.data.success) {
          toast.success(t("admin.category.success.created"));
        }
      }

      // Close modal and reset form
      handleCloseModal();

      // Refresh from server to ensure consistency
      setTimeout(() => fetchCategories(), 500);
    } catch (error) {
      console.error('Error saving category:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response ? {
          status: error.response.status,
          statusText: error.response.statusText,
          data: error.response.data
        } : null,
        request: error.request ? {
          url: error.config?.url,
          method: error.config?.method,
          baseURL: error.config?.baseURL
        } : null
      });
      if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
        toast.error(t("admin.category.errors.network", { host: API_BASE_URL.replace('/api', '') }));
      } else if (error.response) {
        toast.error(error.response.data?.message || t("admin.category.errors.saveWithStatus", { status: error.response.status }));
      } else {
        toast.error(error.message || t("admin.category.errors.saveFailed"));
      }
    } finally {
      setUploadingImage(false);
    }
  };
  return <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <div className="grid grid-cols-2 gap-0.5">
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
              <div className="w-2 h-2 bg-white rounded-sm"></div>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">{t("admin.category.title.page")}</h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-slate-900">{t("admin.category.title.list")}</h2>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-slate-100 text-slate-700">
              {filteredCategories.length}
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 sm:flex-initial min-w-[200px]">
              <input type="text" placeholder={t("admin.category.search.placeholder")} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2.5 w-full text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-slate-400 focus:border-slate-400" />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            </div>

            <button onClick={handleExportPDF} disabled={filteredCategories.length === 0} className="px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
              <Download className="w-4 h-4" />
              <span>{t("admin.category.actions.export")}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            <button onClick={handleAddNew} className="px-4 py-2.5 text-sm font-medium rounded-lg bg-orange-600 text-white hover:bg-orange-700 flex items-center gap-2 transition-all shadow-sm">
              <Plus className="w-4 h-4" />
              <span>{t("admin.category.actions.addNew")}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  {t("admin.category.table.sl")}
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  {t("admin.category.table.image")}
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  {t("admin.category.table.name")}
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  {t("admin.category.table.type")}
                </th>
                <th className="px-6 py-4 text-left text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  {t("admin.category.table.status")}
                </th>
                <th className="px-6 py-4 text-center text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                  {t("admin.category.table.action")}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-100">
              {loading ? <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-orange-600 mb-2" />
                      <p className="text-sm text-slate-500">{t("admin.category.loading.categories")}</p>
                    </div>
                  </td>
                </tr> : filteredCategories.length === 0 ? <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-lg font-semibold text-slate-700 mb-1">{t("admin.category.empty.noData")}</p>
                      <p className="text-sm text-slate-500">{t("admin.category.empty.noMatch")}</p>
                    </div>
                  </td>
                </tr> : filteredCategories.map((category, index) => <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{category.sl || index + 1}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center">
                        <img src={category.image} alt={category.name} className="w-full h-full object-cover" onError={e => {
                    e.target.src = "https://via.placeholder.com/40";
                  }} />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-900">{category.name}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-slate-700">{category.type || t("admin.category.common.na")}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button onClick={() => handleToggleStatus(category.id)} disabled={loading} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${category.status ? "bg-orange-600" : "bg-slate-300"}`} title={category.status ? t("admin.category.actions.clickToDeactivate") : t("admin.category.actions.clickToActivate")}>
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${category.status ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => handleEdit(category)} className="p-1.5 rounded text-orange-600 hover:bg-orange-50 transition-colors" title={t("admin.category.actions.edit")}>
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(category.id)} className="p-1.5 rounded text-red-600 hover:bg-red-50 transition-colors" title={t("admin.category.actions.delete")}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filter Modal - Bottom Sheet */}
      {typeof window !== "undefined" && createPortal(<AnimatePresence>
            {isFilterOpen && <div className="fixed inset-0 z-[100]">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/50" onClick={() => setIsFilterOpen(false)} />

                {/* Modal Content */}
                <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[85vh] flex flex-col animate-[slideUp_0.3s_ease-out]">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-4 border-b">
                    <h2 className="text-lg font-bold text-gray-900">{t("admin.category.filters.modalTitle")}</h2>
                    <button onClick={() => {
              setActiveFilters(new Set());
              setSortBy(null);
              setSelectedCuisine(null);
            }} className="text-orange-600 font-medium text-sm">
                      {t("admin.category.filters.clearAll")}
                    </button>
                  </div>

                  {/* Body */}
                  <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Tabs */}
                    <div className="w-24 sm:w-28 bg-gray-50 border-r flex flex-col">
                      {[{
                id: 'sort',
                label: t("admin.category.filters.tabs.sortBy"),
                icon: ArrowDownUp
              }, {
                id: 'time',
                label: t("admin.category.filters.tabs.time"),
                icon: Timer
              }, {
                id: 'rating',
                label: t("admin.category.filters.tabs.rating"),
                icon: Star
              }, {
                id: 'distance',
                label: t("admin.category.filters.tabs.distance"),
                icon: MapPin
              }, {
                id: 'price',
                label: t("admin.category.filters.tabs.dishPrice"),
                icon: IndianRupee
              }, {
                id: 'cuisine',
                label: t("admin.category.filters.tabs.cuisine"),
                icon: UtensilsCrossed
              }, {
                id: 'offers',
                label: t("admin.category.filters.tabs.offers"),
                icon: BadgePercent
              }, {
                id: 'trust',
                label: t("admin.category.filters.tabs.trust"),
                icon: ShieldCheck
              }].map(tab => {
                const Icon = tab.icon;
                const isActive = activeScrollSection === tab.id || activeFilterTab === tab.id;
                return <button key={tab.id} onClick={() => {
                  setActiveFilterTab(tab.id);
                  const section = filterSectionRefs.current[tab.id];
                  if (section) {
                    section.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start'
                    });
                  }
                }} className={`flex flex-col items-center gap-1 py-4 px-2 text-center relative transition-colors ${isActive ? 'bg-white text-orange-600' : 'text-gray-500 hover:bg-gray-100'}`}>
                            {isActive && <div className="absolute left-0 top-0 bottom-0 w-1 bg-orange-600 rounded-r" />}
                            <Icon className="h-5 w-5" strokeWidth={1.5} />
                            <span className="text-xs font-medium leading-tight">{tab.label}</span>
                          </button>;
              })}
                    </div>

                    {/* Right Content Area - Scrollable */}
                    <div ref={rightContentRef} className="flex-1 overflow-y-auto p-4">
                      {/* Sort By Tab */}
                      <div ref={el => filterSectionRefs.current['sort'] = el} data-section-id="sort" className="space-y-4 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.category.filters.sortBy")}</h3>
                        <div className="flex flex-col gap-3">
                          {[{
                    id: null,
                    label: t("admin.category.filters.options.relevance")
                  }, {
                    id: 'price-low',
                    label: t("admin.category.filters.options.priceLowToHigh")
                  }, {
                    id: 'price-high',
                    label: t("admin.category.filters.options.priceHighToLow")
                  }, {
                    id: 'rating-high',
                    label: t("admin.category.filters.options.ratingHighToLow")
                  }, {
                    id: 'rating-low',
                    label: t("admin.category.filters.options.ratingLowToHigh")
                  }].map(option => <button key={option.id || 'relevance'} onClick={() => setSortBy(option.id)} className={`px-4 py-3 rounded-xl border text-left transition-colors ${sortBy === option.id ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                              <span className={`text-sm font-medium ${sortBy === option.id ? 'text-orange-600' : 'text-gray-700'}`}>
                                {option.label}
                              </span>
                            </button>)}
                        </div>
                      </div>

                      {/* Time Tab */}
                      <div ref={el => filterSectionRefs.current['time'] = el} data-section-id="time" className="space-y-4 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.category.filters.deliveryTime")}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => toggleFilter('delivery-under-30')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('delivery-under-30') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <Timer className={`h-6 w-6 ${activeFilters.has('delivery-under-30') ? 'text-orange-600' : 'text-gray-600'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('delivery-under-30') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.under30")}</span>
                          </button>
                          <button onClick={() => toggleFilter('delivery-under-45')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('delivery-under-45') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <Timer className={`h-6 w-6 ${activeFilters.has('delivery-under-45') ? 'text-orange-600' : 'text-gray-600'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('delivery-under-45') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.under45")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Rating Tab */}
                      <div ref={el => filterSectionRefs.current['rating'] = el} data-section-id="rating" className="space-y-4 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.category.filters.restaurantRating")}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => toggleFilter('rating-35-plus')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-35-plus') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <Star className={`h-6 w-6 ${activeFilters.has('rating-35-plus') ? 'text-orange-600 fill-orange-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${activeFilters.has('rating-35-plus') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.rated35")}</span>
                          </button>
                          <button onClick={() => toggleFilter('rating-4-plus')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-4-plus') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <Star className={`h-6 w-6 ${activeFilters.has('rating-4-plus') ? 'text-orange-600 fill-orange-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${activeFilters.has('rating-4-plus') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.rated40")}</span>
                          </button>
                          <button onClick={() => toggleFilter('rating-45-plus')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('rating-45-plus') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <Star className={`h-6 w-6 ${activeFilters.has('rating-45-plus') ? 'text-orange-600 fill-orange-600' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${activeFilters.has('rating-45-plus') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.rated45")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Distance Tab */}
                      <div ref={el => filterSectionRefs.current['distance'] = el} data-section-id="distance" className="space-y-4 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.category.filters.distance")}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          <button onClick={() => toggleFilter('distance-under-1km')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('distance-under-1km') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <MapPin className={`h-6 w-6 ${activeFilters.has('distance-under-1km') ? 'text-orange-600' : 'text-gray-600'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('distance-under-1km') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.under1km")}</span>
                          </button>
                          <button onClick={() => toggleFilter('distance-under-2km')} className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors ${activeFilters.has('distance-under-2km') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <MapPin className={`h-6 w-6 ${activeFilters.has('distance-under-2km') ? 'text-orange-600' : 'text-gray-600'}`} strokeWidth={1.5} />
                            <span className={`text-sm font-medium ${activeFilters.has('distance-under-2km') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.under2km")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Price Tab */}
                      <div ref={el => filterSectionRefs.current['price'] = el} data-section-id="price" className="space-y-4 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.category.filters.dishPrice")}</h3>
                        <div className="flex flex-col gap-3">
                          <button onClick={() => toggleFilter('price-under-200')} className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-200') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <span className={`text-sm font-medium ${activeFilters.has('price-under-200') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.under200")}</span>
                          </button>
                          <button onClick={() => toggleFilter('price-under-500')} className={`px-4 py-3 rounded-xl border text-left transition-colors ${activeFilters.has('price-under-500') ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                            <span className={`text-sm font-medium ${activeFilters.has('price-under-500') ? 'text-orange-600' : 'text-gray-700'}`}>{t("admin.category.filters.options.under500")}</span>
                          </button>
                        </div>
                      </div>

                      {/* Cuisine Tab */}
                      <div ref={el => filterSectionRefs.current['cuisine'] = el} data-section-id="cuisine" className="space-y-4 mb-8">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">{t("admin.category.filters.cuisine")}</h3>
                        <div className="grid grid-cols-2 gap-3">
                          {['Chinese', 'American', 'Japanese', 'Italian', 'Mexican', 'Indian', 'Asian', 'Seafood', 'Desserts', 'Cafe', 'Healthy'].map(cuisine => <button key={cuisine} onClick={() => setSelectedCuisine(selectedCuisine === cuisine ? null : cuisine)} className={`px-4 py-3 rounded-xl border text-center transition-colors ${selectedCuisine === cuisine ? 'border-orange-600 bg-orange-50' : 'border-gray-200 hover:border-orange-600'}`}>
                              <span className={`text-sm font-medium ${selectedCuisine === cuisine ? 'text-orange-600' : 'text-gray-700'}`}>
                                {cuisine}
                              </span>
                            </button>)}
                        </div>
                      </div>

                      {/* Trust Markers Tab */}
                      {activeFilterTab === 'trust' && <div className="space-y-4">
                          <h3 className="text-lg font-semibold text-gray-900">{t("admin.category.filters.trustMarkers")}</h3>
                          <div className="flex flex-col gap-3">
                            <button className="px-4 py-3 rounded-xl border border-gray-200 hover:border-orange-600 text-left transition-colors">
                              <span className="text-sm font-medium text-gray-700">{t("admin.category.filters.options.topRated")}</span>
                            </button>
                            <button className="px-4 py-3 rounded-xl border border-gray-200 hover:border-orange-600 text-left transition-colors">
                              <span className="text-sm font-medium text-gray-700">{t("admin.category.filters.options.trustedByUsers")}</span>
                            </button>
                          </div>
                        </div>}
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="flex items-center gap-4 px-4 py-4 border-t bg-white">
                    <button onClick={() => setIsFilterOpen(false)} className="flex-1 py-3 text-center font-semibold text-gray-700">
                      {t("admin.category.actions.close")}
                    </button>
                    <button onClick={() => setIsFilterOpen(false)} className={`flex-1 py-3 font-semibold rounded-xl transition-colors ${activeFilters.size > 0 || sortBy || selectedCuisine ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-200 text-gray-500'}`}>
                      {t("admin.category.actions.showResults")}
                    </button>
                  </div>
                </div>
              </div>}
          </AnimatePresence>, document.body)}

      {/* Create/Edit Category Modal */}
      {typeof window !== "undefined" && createPortal(<AnimatePresence>
            {isModalOpen && <div className="fixed inset-0 z-[200]">
                {/* Backdrop */}
                <div className="absolute inset-0 bg-black/50" onClick={handleCloseModal} />

                {/* Modal Content */}
                <motion.div initial={{
          opacity: 0,
          scale: 0.95
        }} animate={{
          opacity: 1,
          scale: 1
        }} exit={{
          opacity: 0,
          scale: 0.95
        }} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                  {/* Header */}
                  <div className="flex items-center justify-between px-6 py-4 border-b">
                    <h2 className="text-xl font-bold text-slate-900">
                      {editingCategory ? t("admin.category.modal.editTitle") : t("admin.category.modal.createTitle")}
                    </h2>
                    <button onClick={handleCloseModal} className="p-1 rounded hover:bg-slate-100 transition-colors">
                      <X className="w-5 h-5 text-slate-500" />
                    </button>
                  </div>

                  {/* Form */}
                  <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      {[{ code: "en", label: t("common.languageNames.en") }, { code: "hi", label: t("common.languageNames.hi") }, { code: "bn", label: t("common.languageNames.bn") }].map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          onClick={() => setActiveLanguage(lang.code)}
                          className={`px-3 py-1.5 rounded-md text-xs font-semibold ${activeLanguage === lang.code ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-700"}`}
                        >
                          {lang.label}
                        </button>
                      ))}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("admin.category.modal.fields.categoryType")}
                      </label>
                      <select required value={formData.type} onChange={e => setFormData({
                ...formData,
                type: e.target.value
              })} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white">
                        <option value="">{t("admin.category.modal.fields.selectCategoryType")}</option>
                        <option value="Starters">{t("admin.category.modal.types.starters")}</option>
                        <option value="Main course">{t("admin.category.modal.types.mainCourse")}</option>
                        <option value="Desserts">{t("admin.category.modal.types.desserts")}</option>
                        <option value="Beverages">{t("admin.category.modal.types.beverages")}</option>
                        <option value="Varieties">{t("admin.category.modal.types.varieties")}</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("admin.category.modal.fields.categoryName")}
                      </label>
                      <input type="text" required={activeLanguage === 'en'} value={formData.localizedName?.[activeLanguage] || ""} onChange={e => {
                const value = e.target.value;
                setFormData(prev => {
                  const localizedName = {
                    en: prev.localizedName?.en || prev.name || "",
                    hi: prev.localizedName?.hi || "",
                    bn: prev.localizedName?.bn || "",
                    [activeLanguage]: value
                  };
                  return {
                    ...prev,
                    localizedName,
                    name: localizedName.en
                  };
                });
              }} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder={t("admin.category.modal.fields.categoryNamePlaceholder")} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("admin.category.modal.fields.description")}
                      </label>
                      <textarea value={formData.localizedDescription?.[activeLanguage] || ""} onChange={e => {
                const value = e.target.value;
                setFormData(prev => {
                  const localizedDescription = {
                    en: prev.localizedDescription?.en || prev.description || "",
                    hi: prev.localizedDescription?.hi || "",
                    bn: prev.localizedDescription?.bn || "",
                    [activeLanguage]: value
                  };
                  return {
                    ...prev,
                    localizedDescription,
                    description: localizedDescription.en
                  };
                });
              }} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500" placeholder={t("admin.category.modal.fields.descriptionPlaceholder")} rows={3} />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {t("admin.category.modal.fields.categoryImage")}
                      </label>
                      <div className="space-y-3">
                        {/* Image Preview */}
                        {(imagePreview || formData.image) && <div className="relative w-32 h-32 rounded-lg overflow-hidden border border-slate-300">
                            <img src={imagePreview || formData.image} alt={t("admin.category.modal.fields.categoryPreviewAlt")} className="w-full h-full object-cover" onError={e => {
                    e.target.src = "https://via.placeholder.com/128";
                  }} />
                            {imagePreview && <button type="button" onClick={handleRemoveImage} className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                                <X className="w-4 h-4" />
                              </button>}
                          </div>}

                        {/* File Input */}
                        <div className="flex items-center gap-3">
                          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp" onChange={handleImageSelect} className="hidden" id="category-image-upload" />
                          <label htmlFor="category-image-upload" className="flex items-center gap-2 px-4 py-2 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                            <Upload className="w-4 h-4 text-slate-600" />
                            <span className="text-sm text-slate-700">
                              {imagePreview ? t("admin.category.modal.fields.changeImage") : t("admin.category.modal.fields.uploadImage")}
                            </span>
                          </label>
                          {uploadingImage && <Loader2 className="w-5 h-5 animate-spin text-orange-600" />}
                        </div>
                        <p className="text-xs text-slate-500">
                          {t("admin.category.modal.fields.supportedFormats")}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <input type="checkbox" id="status" checked={formData.status} onChange={e => setFormData({
                ...formData,
                status: e.target.checked
              })} className="w-4 h-4 text-orange-600 border-slate-300 rounded focus:ring-orange-500" />
                      <label htmlFor="status" className="text-sm font-medium text-slate-700">
                        {t("admin.category.modal.fields.activeStatus")}
                      </label>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center gap-3 pt-4">
                      <button type="button" onClick={handleCloseModal} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors">
                        {t("admin.category.actions.cancel")}
                      </button>
                      <button type="submit" className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
                        {editingCategory ? t("admin.category.actions.update") : t("admin.category.actions.create")}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </div>}
          </AnimatePresence>, document.body)}

      <style>{`
        @keyframes slideUp {
          0% {
            transform: translateY(100%);
          }
          100% {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>;
}
