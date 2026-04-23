import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trash2, Check, ChevronDown, Edit as EditIcon, Plus, X, Camera, Upload, ThumbsUp, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
// Removed getAllFoods and saveFood - now using menu API
import api from "@/lib/api";
import { restaurantAPI, uploadAPI } from "@/lib/api";
import { toast } from "sonner";

const isFlutterInAppWebViewAvailable = () =>
  typeof window !== "undefined" &&
  typeof window.flutter_inappwebview?.callHandler === "function";

const flutterImageResultToFile = async (result, fallbackName) => {
  if (!result || result.success === false) return null;

  const base64 = result.base64 ? String(result.base64) : "";
  if (!base64) return null;

  const mimeType = result.mimeType || "image/jpeg";
  const normalizedBase64 = base64.includes(",") ? base64.split(",")[1] : base64;
  const dataUrl = `data:${mimeType};base64,${normalizedBase64}`;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], result.fileName || fallbackName, {
    type: mimeType || blob.type || "image/jpeg"
  });
};
export default function ItemDetailsPage() {
  const navigate = useNavigate();
  const {
    id
  } = useParams();
  const location = useLocation();
  const isNewItem = id === "new";
  const groupId = location.state?.groupId;
  const defaultCategory = location.state?.category || "Varieties";
  const fileInputRef = useRef(null);

  // Initialize state with empty values - will be populated from API
  const [itemData, setItemData] = useState(null); // Store the full item data for saving
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState(defaultCategory);
  const [categoryFoodType, setCategoryFoodType] = useState("Non-Veg");
  const [subCategory, setSubCategory] = useState("");
  const [servesInfo, setServesInfo] = useState("");
  const [itemSizeQuantity, setItemSizeQuantity] = useState("");
  const [itemSizeUnit, setItemSizeUnit] = useState("piece");
  const [itemDescription, setItemDescription] = useState("");
  const [foodType, setFoodType] = useState("Non-Veg");
  const [basePrice, setBasePrice] = useState("");
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [showBasePriceError, setShowBasePriceError] = useState(false);
  const [preparationTime, setPreparationTime] = useState("");
  const [showPreparationTimeError, setShowPreparationTimeError] = useState(false);
  const [gst, setGst] = useState("5.0");
  const [isRecommended, setIsRecommended] = useState(false);
  const [isInStock, setIsInStock] = useState(true);
  const [weightPerServing, setWeightPerServing] = useState("");
  const [calorieCount, setCalorieCount] = useState("");
  const [proteinCount, setProteinCount] = useState("");
  const [carbohydrates, setCarbohydrates] = useState("");
  const [fatCount, setFatCount] = useState("");
  const [fibreCount, setFibreCount] = useState("");
  const [allergens, setAllergens] = useState("");
  const [isRecommendationRequest, setIsRecommendationRequest] = useState(false);
  const [recommendationStatus, setRecommendationStatus] = useState("none");
  const [showMoreNutrition, setShowMoreNutrition] = useState(false);
  const [selectedTags, setSelectedTags] = useState([]);
  const [images, setImages] = useState([]);
  const [imageFiles, setImageFiles] = useState(new Map()); // Track File objects by preview URL
  const [uploadingImages, setUploadingImages] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [direction, setDirection] = useState(0);
  const carouselRef = useRef(null);
  const [isCategoryPopupOpen, setIsCategoryPopupOpen] = useState(false);
  const [isServesPopupOpen, setIsServesPopupOpen] = useState(false);
  const [isItemSizePopupOpen, setIsItemSizePopupOpen] = useState(false);
  const [isGstPopupOpen, setIsGstPopupOpen] = useState(false);
  const [isTagsPopupOpen, setIsTagsPopupOpen] = useState(false);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingItem, setLoadingItem] = useState(false);
  const maxNameLength = 40;
  const maxDescriptionWords = 100;
  const getWordCount = (text) => {
    const trimmed = String(text || "").trim();
    if (!trimmed) return 0;
    return trimmed.split(/\s+/).filter(Boolean).length;
  };

  const limitWords = (text, maxWords) => {
    const raw = String(text || "");
    const trimmed = raw.trim();
    if (!trimmed) return "";
    const words = trimmed.split(/\s+/).filter(Boolean);
    if (words.length <= maxWords) return raw;
    return words.slice(0, maxWords).join(" ");
  };

  const descriptionWordCount = getWordCount(itemDescription);
  const nameLength = itemName.length;

  // Fetch item data from menu API when editing
  useEffect(() => {
    const fetchItemData = async () => {
      // If itemData is already in location.state, use it
      if (location.state?.item) {
        const item = location.state.item;
        // Store the full item data for saving
        setItemData(item);
        setItemName(item.name || "");
        setCategory(item.category || defaultCategory);
        setSubCategory(item.subCategory || item.category || "Starters");
        setServesInfo(item.servesInfo || "");
        setItemSizeQuantity(item.itemSizeQuantity || "");
        setItemSizeUnit(item.itemSizeUnit || "piece");
        setItemDescription(limitWords(item.description || "", maxDescriptionWords));
        setFoodType(item.foodType === "Veg" ? "Veg" : item.foodType === "Egg" ? "Egg" : "Non-Veg");
        setBasePrice(item.price === 0 || item.price ? item.price.toString() : "");
        setPreparationTime(item.preparationTime || "");
        setGst(item.gst?.toString() || "5.0");
        setIsRecommended(item.isRecommended || false);
        setIsRecommendationRequest(item.isRecommendationRequest || false);
        setRecommendationStatus(item.recommendationStatus || "none");
        setIsInStock(item.isAvailable !== false);
        setSelectedTags(item.tags || []);
        setImages(item.images && item.images.length > 0 ? [item.images[0]] : item.image ? [item.image] : []);

        // Parse nutrition data
        if (item.nutrition && Array.isArray(item.nutrition)) {
          item.nutrition.forEach(nut => {
            if (typeof nut === 'string') {
              if (nut.includes('Weight per serving')) {
                const match = nut.match(/(\d+)\s*grams?/i);
                if (match) setWeightPerServing(match[1]);
              } else if (nut.includes('Calorie count')) {
                const match = nut.match(/(\d+)\s*Kcal/i);
                if (match) setCalorieCount(match[1]);
              } else if (nut.includes('Protein count')) {
                const match = nut.match(/(\d+)\s*mg/i);
                if (match) setProteinCount(match[1]);
              } else if (nut.includes('Carbohydrates')) {
                const match = nut.match(/(\d+)\s*mg/i);
                if (match) setCarbohydrates(match[1]);
              } else if (nut.includes('Fat count')) {
                const match = nut.match(/(\d+)\s*mg/i);
                if (match) setFatCount(match[1]);
              } else if (nut.includes('Fibre count')) {
                const match = nut.match(/(\d+)\s*mg/i);
                if (match) setFibreCount(match[1]);
              }
            }
          });
        }

        // Set allergens
        if (item.allergies && Array.isArray(item.allergies) && item.allergies.length > 0) {
          setAllergens(item.allergies.join(", "));
        }
        return;
      }

      // If no item in location.state but we have an id, fetch from menu API
      if (!isNewItem && id) {
        try {
          setLoadingItem(true);
          const menuResponse = await restaurantAPI.getMenu();
          const menu = menuResponse.data?.data?.menu;
          const sections = menu?.sections || [];

          // Find the item across all sections
          let foundItem = null;
          const searchId = String(id).trim();
          for (const section of sections) {
            // Check items in section
            const item = section.items?.find(i => {
              const itemId = String(i.id || i._id || '').trim();
              return itemId === searchId || itemId === id;
            });
            if (item) {
              foundItem = item;
              break;
            }
            // Check items in subsections
            if (section.subsections) {
              for (const subsection of section.subsections) {
                const subItem = subsection.items?.find(i => {
                  const itemId = String(i.id || i._id || '').trim();
                  return itemId === searchId || itemId === id;
                });
                if (subItem) {
                  foundItem = subItem;
                  break;
                }
              }
              if (foundItem) break;
            }
          }
          if (foundItem) {
            // Store the full item data for saving
            setItemData(foundItem);
            setItemName(foundItem.name || "");
            setCategory(foundItem.category || defaultCategory);
            setSubCategory(foundItem.subCategory || foundItem.category || "Starters");
            setServesInfo(foundItem.servesInfo || "");
            setItemSizeQuantity(foundItem.itemSizeQuantity || "");
            setItemSizeUnit(foundItem.itemSizeUnit || "piece");
            setItemDescription(limitWords(foundItem.description || "", maxDescriptionWords));
            setFoodType(foundItem.foodType === "Veg" ? "Veg" : foundItem.foodType === "Egg" ? "Egg" : "Non-Veg");
            setBasePrice(foundItem.price === 0 || foundItem.price ? foundItem.price.toString() : "");
            setPreparationTime(foundItem.preparationTime || "");
            setGst(foundItem.gst?.toString() || "5.0");
            setIsRecommended(foundItem.isRecommended || false);
            setIsRecommendationRequest(foundItem.isRecommendationRequest || false);
            setRecommendationStatus(foundItem.recommendationStatus || "none");
            setIsInStock(foundItem.isAvailable !== false);
            setSelectedTags(foundItem.tags || []);
            setImages(foundItem.images && foundItem.images.length > 0 ? [foundItem.images[0]] : foundItem.image ? [foundItem.image] : []);

            // Parse nutrition data
            if (foundItem.nutrition && Array.isArray(foundItem.nutrition)) {
              foundItem.nutrition.forEach(nut => {
                if (typeof nut === 'string') {
                  if (nut.includes('Weight per serving')) {
                    const match = nut.match(/(\d+)\s*grams?/i);
                    if (match) setWeightPerServing(match[1]);
                  } else if (nut.includes('Calorie count')) {
                    const match = nut.match(/(\d+)\s*Kcal/i);
                    if (match) setCalorieCount(match[1]);
                  } else if (nut.includes('Protein count')) {
                    const match = nut.match(/(\d+)\s*mg/i);
                    if (match) setProteinCount(match[1]);
                  } else if (nut.includes('Carbohydrates')) {
                    const match = nut.match(/(\d+)\s*mg/i);
                    if (match) setCarbohydrates(match[1]);
                  } else if (nut.includes('Fat count')) {
                    const match = nut.match(/(\d+)\s*mg/i);
                    if (match) setFatCount(match[1]);
                  } else if (nut.includes('Fibre count')) {
                    const match = nut.match(/(\d+)\s*mg/i);
                    if (match) setFibreCount(match[1]);
                  }
                }
              });
            }

            // Set allergens
            if (foundItem.allergies && Array.isArray(foundItem.allergies) && foundItem.allergies.length > 0) {
              setAllergens(foundItem.allergies.join(", "));
            }
          } else {
            toast.error("Item not found");
          }
        } catch (error) {
          console.error('Error fetching item data:', error);
          toast.error("Failed to load item data");
        } finally {
          setLoadingItem(false);
        }
      }
    };
    fetchItemData();
  }, [id, isNewItem, location.state, defaultCategory]);

  // Fetch categories from both the dedicated API and existing menu sections
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        // Fetch from both sources to ensure we have everything
        const [catResponse, menuResponse] = await Promise.all([restaurantAPI.getCategories().catch(() => ({
          data: {
            success: false
          }
        })), restaurantAPI.getMenu().catch(() => ({
          data: {
            success: false
          }
        }))]);
        let allCategories = [];

        // 1. Get from existing menu sections (most reliable for what user sees)
        if (menuResponse.data?.success && menuResponse.data.data?.menu?.sections) {
          const sectionCategories = menuResponse.data.data.menu.sections.map(sec => ({
            id: sec.id || sec._id,
            name: sec.name,
            foodType: sec.foodType === "Veg" ? "Veg" : "Non-Veg"
          }));
          allCategories = [...sectionCategories];
        }

        // 2. Add from categories API if not already present
        if (catResponse.data?.success && catResponse.data.data?.categories) {
          catResponse.data.data.categories.forEach(cat => {
            if (!allCategories.find(existing => existing.name === cat.name)) {
              allCategories.push({
                id: cat._id || cat.id,
                name: cat.name,
                foodType: cat.foodType === "Veg" ? "Veg" : "Non-Veg"
              });
            }
          });
        }

        // 3. Ensure Varieties is there if nothing else (default)
        if (allCategories.length === 0) {
          allCategories.push({
            id: "default",
            name: "Varieties",
            foodType: "Non-Veg"
          });
        }
        setCategories(allCategories);
        const matchedCategory = allCategories.find(c => c.name === category);
        if (matchedCategory?.foodType) {
          setCategoryFoodType(matchedCategory.foodType === "Veg" ? "Veg" : "Non-Veg");
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setCategories([{
          id: "default",
          name: "Varieties",
          foodType: "Non-Veg"
        }]);
        setCategoryFoodType("Non-Veg");
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [category]);

  // Serves info options
  const servesOptions = ["Serves eg. 1-2 people", "Serves eg. 2-3 people", "Serves eg. 3-4 people", "Serves eg. 4-5 people", "Serves eg. 5-6 people"];

  // Item size unit options
  const itemSizeUnits = ["slices", "kg", "litre", "ml", "serves", "cms", "piece"];

  // Item tags organized by categories
  const itemTagsCategories = [{
    category: "Speciality",
    tags: ["Freshly Frosted", "Pre Frosted", "Chef's Special"]
  }, {
    category: "Spice Level",
    tags: ["Medium Spicy", "Very Spicy"]
  }, {
    category: "Miscellaneous",
    tags: ["Gluten Free", "Sugar Free", "Jain"]
  }, {
    category: "Dietary Restrictions",
    tags: ["Vegan"]
  }];
  const handleImageAdd = e => {
    const files = Array.from(e.target.files);
    handleImageFiles(files);
  };

  const handleImageFiles = files => {
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    const validFiles = files.filter(file => {
      if (!allowedTypes.includes(file.type)) {
        toast.error(`${file.name}: Invalid file type. Please upload PNG, JPG, JPEG, or WEBP.`);
        return false;
      }
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        toast.error(`${file.name}: File size exceeds 5MB limit.`);
        return false;
      }
      return true;
    });
    if (validFiles.length === 0) return false;
    const selectedFile = validFiles[0];
    if (validFiles.length > 1) {
      toast.info("Only one image is allowed. Using the first selected image.");
    }

    // Replace old image with the newly selected one
    images.forEach((img) => {
      if (typeof img === "string" && img.startsWith("blob:")) {
        URL.revokeObjectURL(img);
      }
    });

    const previewUrl = URL.createObjectURL(selectedFile);
    const newImageFilesMap = new Map();
    newImageFilesMap.set(previewUrl, selectedFile);
    setImages([previewUrl]);
    setImageFiles(newImageFilesMap);
    setCurrentImageIndex(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    return true;
  };

  const pickImagesFromGallery = async () => {
    if (!isFlutterInAppWebViewAvailable()) return false;
    try {
      const result = await window.flutter_inappwebview.callHandler("openGallery", {
        source: "gallery",
        accept: "image/*",
        multiple: false,
        quality: 0.8
      });
      const file = await flutterImageResultToFile(result, `item-image-${Date.now()}.jpg`);
      if (!file) return false;
      return handleImageFiles([file]);
    } catch (error) {
      console.error("Failed to pick images from Flutter gallery:", error);
      return false;
    }
  };

  const captureImageFromCamera = async () => {
    if (!isFlutterInAppWebViewAvailable()) return false;
    try {
      const result = await window.flutter_inappwebview.callHandler("openCamera", {
        source: "camera",
        accept: "image/*",
        multiple: false,
        quality: 0.8
      });
      const file = await flutterImageResultToFile(result, `item-image-${Date.now()}.jpg`);
      if (!file) return false;
      return handleImageFiles([file]);
    } catch (error) {
      console.error("Failed to capture image from Flutter camera:", error);
      return false;
    }
  };
  const handleImageDelete = index => {
    if (index < 0 || index >= images.length) return;

    // Confirm deletion
    if (!window.confirm('Are you sure you want to delete this image?')) {
      return;
    }
    const imageToDelete = images[index];
    const newImages = images.filter((_, i) => i !== index);
    const newImageFilesMap = new Map(imageFiles);

    // Remove the file mapping and revoke the blob URL if it's a preview (new upload)
    if (imageToDelete && imageToDelete.startsWith('blob:')) {
      newImageFilesMap.delete(imageToDelete);
      URL.revokeObjectURL(imageToDelete);
    } else if (imageToDelete && (imageToDelete.startsWith('http://') || imageToDelete.startsWith('https://'))) {
      // For already uploaded images, we need to remove from imageFiles map if it exists
      // Find and remove the file entry if it exists
      for (const [previewUrl, file] of newImageFilesMap.entries()) {
        // This shouldn't happen for HTTP URLs, but just in case
        if (previewUrl === imageToDelete) {
          newImageFilesMap.delete(previewUrl);
          URL.revokeObjectURL(previewUrl);
        }
      }
    }
    setImages(newImages);
    setImageFiles(newImageFilesMap);

    // Adjust current image index after deletion
    if (newImages.length === 0) {
      setCurrentImageIndex(0);
    } else if (currentImageIndex >= newImages.length) {
      setCurrentImageIndex(newImages.length - 1);
    } else if (currentImageIndex > index) {
      // If we deleted an image before the current one, no need to change index
      // If we deleted the current one or after, index stays the same (shows next image)
    }
    toast.success('Image deleted successfully');
  };

  // Swipe handlers
  const minSwipeDistance = 50;
  const onTouchStart = e => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = e => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe && images.length > 0) {
      setDirection(1);
      setCurrentImageIndex(prev => (prev + 1) % images.length);
    }
    if (isRightSwipe && images.length > 0) {
      setDirection(-1);
      setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
    }
  };
  const goToNext = () => {
    setDirection(1);
    setCurrentImageIndex(prev => (prev + 1) % images.length);
  };
  const goToPrevious = () => {
    setDirection(-1);
    setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
  };
  const handleCategorySelect = (catId, subCat) => {
    const selectedCategory = categories.find(c => c.id === catId);
    if (!selectedCategory) return;
    setCategory(selectedCategory.name);
    setCategoryFoodType(selectedCategory.foodType === "Veg" ? "Veg" : "Non-Veg");
    setSubCategory(subCat);
    setShowCategoryError(false);
    setIsCategoryPopupOpen(false);
  };
  const handleServesSelect = option => {
    setServesInfo(option);
    setIsServesPopupOpen(false);
  };
  const handleItemSizeUnitSelect = unit => {
    setItemSizeUnit(unit);
    setIsItemSizePopupOpen(false);
  };
  const handleGstSelect = gstValue => {
    setGst(gstValue);
    setIsGstPopupOpen(false);
  };
  const handleTagToggle = tag => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };
  const handleSave = async () => {
    if (!category.trim()) {
      setShowCategoryError(true);
      toast.error("Please select a category");
      return;
    }
    if (!itemName.trim()) {
      toast.error("Please enter an item name");
      return;
    }
    if (!basePrice.trim() || Number(basePrice) <= 0) {
      setShowBasePriceError(true);
      toast.error("Please enter item price");
      return;
    }
    if (!preparationTime.trim()) {
      setShowPreparationTimeError(true);
      toast.error("Please select preparation time");
      return;
    }
    try {
      setUploadingImages(true);

      // Upload new images to Cloudinary
      const uploadedImageUrls = [];

      // Separate existing URLs (already uploaded) from new files (blob URLs)
      const existingImageUrls = images.filter(img => typeof img === 'string' && (img.startsWith('http://') || img.startsWith('https://')) && !img.startsWith('blob:'));
      // Upload new File objects to Cloudinary (files that are blob URLs)
      const filesToUpload = Array.from(imageFiles.values());
      if (filesToUpload.length > 0) {
        toast.info("Uploading image...");
        const file = filesToUpload[0];
        try {
          const uploadResponse = await uploadAPI.uploadMedia(file, {
            folder: 'appzeto/restaurant/menu-items'
          });
          const imageUrl = uploadResponse?.data?.data?.url || uploadResponse?.data?.url;
          if (imageUrl) {
            uploadedImageUrls.push(imageUrl);
          } else {
            console.error('Upload response:', uploadResponse);
            throw new Error("Failed to get uploaded image URL");
          }
        } catch (uploadError) {
          console.error(`Error uploading image (${file.name}):`, uploadError);
          toast.error(`Failed to upload ${file.name}. Please try again.`);
          setUploadingImages(false);
          return;
        }
      }

      // Single image mode: prefer newly uploaded image, else keep existing first image
      const finalImageUrl = uploadedImageUrls[0] || existingImageUrls[0] || "";
      const allImageUrls = finalImageUrl ? [finalImageUrl] : [];

      // Debug: Log image URLs

      // Get current menu
      const menuResponse = await restaurantAPI.getMenu();
      let menu = menuResponse.data?.data?.menu;
      let sections = menu?.sections || [];

      // Prepare item data according to menu model
      // For editing, use the existing ID; for new items, generate a new ID
      // Ensure we use the ID from itemData if available, otherwise use the URL param id
      let itemId;
      if (isNewItem) {
        itemId = `item-${Date.now()}-${Math.random()}`;
      } else {
        // Try to get ID from itemData first (most reliable), then from URL param
        itemId = itemData?.id || id;
        if (!itemId) {
          console.warn('No item ID found, generating new one');
          itemId = `item-${Date.now()}-${Math.random()}`;
        }
        // Ensure ID is a string
        itemId = String(itemId);
      }
      // If editing, remove item from its current location (in case category changed or it's in a subsection)
      if (!isNewItem && itemId) {
        const searchId = String(itemId).trim();
        const urlId = String(id || '').trim();
        let itemRemoved = false;
        for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
          const section = sections[sectionIndex];

          // Check items in section
          if (section.items && Array.isArray(section.items)) {
            const itemIndex = section.items.findIndex(item => {
              const itemIdStr = String(item.id || item._id || '').trim();
              // Try multiple ID formats
              return itemIdStr === searchId || itemIdStr === urlId || String(item.id) === String(itemId) || String(item.id) === String(id);
            });
            if (itemIndex !== -1) {
              section.items.splice(itemIndex, 1);
              itemRemoved = true;
              break;
            }
          }

          // Check items in subsections
          if (!itemRemoved && section.subsections && Array.isArray(section.subsections)) {
            for (let subIndex = 0; subIndex < section.subsections.length; subIndex++) {
              const subsection = section.subsections[subIndex];
              if (subsection.items && Array.isArray(subsection.items)) {
                const subItemIndex = subsection.items.findIndex(item => {
                  const itemIdStr = String(item.id || item._id || '').trim();
                  // Try multiple ID formats
                  return itemIdStr === searchId || itemIdStr === urlId || String(item.id) === String(itemId) || String(item.id) === String(id);
                });
                if (subItemIndex !== -1) {
                  subsection.items.splice(subItemIndex, 1);
                  itemRemoved = true;
                  break;
                }
              }
            }
            if (itemRemoved) break;
          }
        }
        if (!itemRemoved && !isNewItem) {
          // Fallback match for legacy/mismatched IDs: match by original snapshot only when unique.
          const originalName = String(itemData?.name || "").trim().toLowerCase();
          const originalCategory = String(itemData?.category || "").trim().toLowerCase();
          const originalFoodType = String(itemData?.foodType || "").trim().toLowerCase();
          const originalPrice = Number(itemData?.price);
          const matches = [];

          for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
            const section = sections[sectionIndex];
            const sectionItems = Array.isArray(section.items) ? section.items : [];
            for (let itemIndex = 0; itemIndex < sectionItems.length; itemIndex++) {
              const candidate = sectionItems[itemIndex];
              const candidateName = String(candidate?.name || "").trim().toLowerCase();
              const candidateCategory = String(candidate?.category || section?.name || "").trim().toLowerCase();
              const candidateFoodType = String(candidate?.foodType || "").trim().toLowerCase();
              const candidatePrice = Number(candidate?.price);
              const isMatch =
                candidateName &&
                candidateName === originalName &&
                candidateCategory === originalCategory &&
                candidateFoodType === originalFoodType &&
                candidatePrice === originalPrice;
              if (isMatch) {
                matches.push({ sectionIndex, itemIndex, inSubsection: false });
              }
            }

            const subsections = Array.isArray(section.subsections) ? section.subsections : [];
            for (let subIndex = 0; subIndex < subsections.length; subIndex++) {
              const subsection = subsections[subIndex];
              const subsectionItems = Array.isArray(subsection.items) ? subsection.items : [];
              for (let subItemIndex = 0; subItemIndex < subsectionItems.length; subItemIndex++) {
                const candidate = subsectionItems[subItemIndex];
                const candidateName = String(candidate?.name || "").trim().toLowerCase();
                const candidateCategory = String(candidate?.category || section?.name || "").trim().toLowerCase();
                const candidateFoodType = String(candidate?.foodType || "").trim().toLowerCase();
                const candidatePrice = Number(candidate?.price);
                const isMatch =
                  candidateName &&
                  candidateName === originalName &&
                  candidateCategory === originalCategory &&
                  candidateFoodType === originalFoodType &&
                  candidatePrice === originalPrice;
                if (isMatch) {
                  matches.push({ sectionIndex, subIndex, itemIndex: subItemIndex, inSubsection: true });
                }
              }
            }
          }

          if (matches.length === 1) {
            const match = matches[0];
            if (match.inSubsection) {
              sections[match.sectionIndex].subsections[match.subIndex].items.splice(match.itemIndex, 1);
            } else {
              sections[match.sectionIndex].items.splice(match.itemIndex, 1);
            }
            itemRemoved = true;
          }
        }

        if (!itemRemoved && !isNewItem) {
          console.error(`Edit blocked: Existing item not found for replacement. itemId=${itemId}, urlId=${id}`);
          toast.error("Unable to update existing item safely. Please reopen this item and try again.");
          setUploadingImages(false);
          return;
        }
      }

      // Find or create the category section
      let targetSection = sections.find(s => s.name === category);
      if (!targetSection) {
        const selectedCategoryMeta = categories.find(c => c.name === category);
        const resolvedCategoryFoodType = selectedCategoryMeta?.foodType === "Veg"
          ? "Veg"
          : categoryFoodType === "Veg"
            ? "Veg"
            : "Non-Veg";
        // Create new section for this category
        targetSection = {
          id: `section-${Date.now()}`,
          name: category,
          foodType: resolvedCategoryFoodType,
          items: [],
          subsections: [],
          isEnabled: true,
          order: sections.length
        };
        sections.push(targetSection);
      }

      // Ensure items array exists
      if (!targetSection.items) {
        targetSection.items = [];
      }

      // Prepare nutrition data as strings (as per menu model)
      const nutritionStrings = [];

      // Prepare item data according to menu model
      const itemDataToSave = {
        id: String(itemId),
        // Ensure ID is a string
        name: itemName.trim(),
        nameArabic: "",
        image: allImageUrls.length > 0 ? allImageUrls[0] : "",
        images: allImageUrls.length > 0 ? allImageUrls : [],
        // Single-image mode (kept as array for backend schema compatibility)
        category: category,
        rating: itemData?.rating || 0.0,
        reviews: itemData?.reviews || 0,
        price: parseFloat(basePrice) || 0,
        preparationTime: preparationTime || "",
        stock: "Unlimited",
        discount: null,
        originalPrice: null,
        foodType: foodType === "Egg" ? "Non-Veg" : foodType,
        // Menu model only supports Veg/Non-Veg
        availabilityTimeStart: "12:01 AM",
        availabilityTimeEnd: "11:57 PM",
        description: itemDescription.trim(),
        discountType: "Percent",
        discountAmount: 0.0,
        isAvailable: isInStock,
        isRecommended: isRecommended,
        isRecommendationRequest: isRecommendationRequest,
        recommendationStatus: recommendationStatus,
        variations: [],
        tags: [],
        nutrition: nutritionStrings,
        allergies: [],
        photoCount: allImageUrls.length || 1,
        // Additional fields for complete item details
        subCategory: subCategory || "",
        servesInfo: servesInfo || "",
        itemSize: `${itemSizeQuantity} ${itemSizeUnit}`.trim(),
        itemSizeQuantity: itemSizeQuantity || "",
        itemSizeUnit: itemSizeUnit || "piece",
        gst: parseFloat(gst) || 0
      };

      // Add or update item in target section
      // Since we already removed the item from its old location, we should always add it here
      // But check if it somehow still exists (shouldn't happen, but safety check)
      const existingItemIndex = targetSection.items.findIndex(item => {
        const itemIdStr = String(item.id || item._id || '').trim();
        return itemIdStr === String(itemId).trim();
      });
      if (existingItemIndex !== -1) {
        // Update existing item (shouldn't happen if removal worked, but handle it)

        targetSection.items[existingItemIndex] = itemDataToSave;
      } else {
        // Add new item (or re-add after removal)

        targetSection.items.push(itemDataToSave);
      }

      // Update menu with new sections

      // Verify sections structure

      const itemSection = sections.find(s => s.items?.some(item => item.id === itemId));
      if (itemSection) {
        const itemInSection = itemSection.items.find(item => item.id === itemId);
        if (itemInSection) { }
      }
      const updateResponse = await restaurantAPI.updateMenu({
        sections
      });
      if (updateResponse.data?.success) {
        const imageCount = allImageUrls.length;
        toast.success(isNewItem ? `Item created successfully with ${imageCount} image(s)` : `Item updated successfully with ${imageCount} image(s)`);
        // Small delay to ensure backend has processed the update
        await new Promise(resolve => setTimeout(resolve, 300));
        // Navigate back to HubMenu with replace to prevent back navigation issues
        navigate("/restaurant/hub-menu", {
          replace: true
        });
        // Trigger a page refresh event
        window.dispatchEvent(new CustomEvent('foodsChanged'));
      } else {
        console.error('Update failed:', updateResponse.data);
        toast.error(updateResponse.data?.message || "Failed to save item");
      }
    } catch (error) {
      console.error('Error saving menu:', error);
      if (error.code === 'ERR_NETWORK') {
        toast.error('Network error. Please check if backend server is running and try again.');
      } else {
        toast.error(error.response?.data?.message || error.message || "Failed to save item. Please try again.");
      }
    } finally {
      setUploadingImages(false);
    }
  };
  const handleDelete = async () => {
    if (isNewItem) {
      navigate(-1);
      return;
    }
    if (!window.confirm("Are you sure you want to delete this item?")) return;
    try {
      setIsDeleting(true);

      // Get current menu
      const menuResponse = await restaurantAPI.getMenu();
      if (!menuResponse.data?.success) {
        throw new Error(menuResponse.data?.message || "Failed to fetch menu");
      }
      let sections = menuResponse.data?.data?.menu?.sections || [];

      // Identify the item ID
      const itemId = itemData?.id || id;
      if (!itemId) {
        toast.error("Could not identify item to delete");
        return;
      }
      const searchId = String(itemId).trim();
      const urlId = String(id || "").trim();
      let itemRemoved = false;

      // Loop through sections to find and remove the item
      for (let sectionIndex = 0; sectionIndex < sections.length; sectionIndex++) {
        const section = sections[sectionIndex];

        // Check items in section
        if (section.items && Array.isArray(section.items)) {
          const itemIndex = section.items.findIndex(item => {
            const itemIdStr = String(item.id || item._id || "").trim();
            return itemIdStr === searchId || itemIdStr === urlId;
          });
          if (itemIndex !== -1) {
            section.items.splice(itemIndex, 1);
            itemRemoved = true;
            break;
          }
        }

        // Check items in subsections
        if (!itemRemoved && section.subsections && Array.isArray(section.subsections)) {
          for (let subIndex = 0; subIndex < section.subsections.length; subIndex++) {
            const subsection = section.subsections[subIndex];
            if (subsection.items && Array.isArray(subsection.items)) {
              const subItemIndex = subsection.items.findIndex(item => {
                const itemIdStr = String(item.id || item._id || "").trim();
                return itemIdStr === searchId || itemIdStr === urlId;
              });
              if (subItemIndex !== -1) {
                subsection.items.splice(subItemIndex, 1);
                itemRemoved = true;
                break;
              }
            }
          }
          if (itemRemoved) break;
        }
      }
      if (itemRemoved) {
        // Update menu with the item removed
        const updateResponse = await restaurantAPI.updateMenu({
          sections
        });
        if (updateResponse.data?.success) {
          toast.success("Item deleted successfully");
          // Small delay to ensure backend has processed the update
          await new Promise(resolve => setTimeout(resolve, 300));
          // Trigger refresh and navigate back
          window.dispatchEvent(new CustomEvent("foodsChanged"));
          navigate("/restaurant/hub-menu", {
            replace: true
          });
        } else {
          toast.error(updateResponse.data?.message || "Failed to delete item");
        }
      } else {
        toast.warning("Item already removed or not found");
        navigate("/restaurant/hub-menu", {
          replace: true
        });
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error(error.response?.data?.message || error.message || "Failed to delete item. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };
  return <div className="h-screen bg-white flex flex-col overflow-hidden">
    <style>{`
        [data-slot="switch"][data-state="checked"] {
          background-color: #16a34a !important;
        }
        [data-slot="switch-thumb"][data-state="checked"] {
          background-color: #ffffff !important;
        }
      `}</style>
    {/* Header */}
    <div className="sticky top-0 z-40 bg-white border-b border-gray-200 flex-shrink-0">
      <div className="px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-1 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Item details</h1>
      </div>
    </div>


    {/* Content */}
    <div className="flex-1 overflow-y-auto pb-24">
      {/* Image Carousel */}
      <div className="relative bg-white">
        {images.length > 0 ? <div className="relative w-full h-80 overflow-hidden bg-gray-100">
          {/* Image container with swipe support */}
          <div ref={carouselRef} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="relative w-full h-full">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div key={currentImageIndex} custom={direction} initial={{
                opacity: 0,
                x: direction > 0 ? 300 : -300
              }} animate={{
                opacity: 1,
                x: 0
              }} exit={{
                opacity: 0,
                x: direction > 0 ? -300 : 300
              }} transition={{
                duration: 0.3,
                ease: "easeInOut"
              }} className="absolute inset-0">
                {images[currentImageIndex] ? <img src={images[currentImageIndex]} alt={`${itemName} - Image ${currentImageIndex + 1}`} className="w-full h-full object-cover" /> : null}
              </motion.div>
            </AnimatePresence>

            {/* Navigation arrows */}
            {images.length > 1 && <>
              <button onClick={goToPrevious} className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10">
                <ChevronLeft className="w-5 h-5 text-gray-900" />
              </button>
              <button onClick={goToNext} className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10">
                <ChevronRight className="w-5 h-5 text-gray-900" />
              </button>
            </>}

            {/* Delete image button */}
            <button onClick={() => handleImageDelete(currentImageIndex)} className="absolute top-4 right-4 w-10 h-10 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all z-10">
              <Trash2 className="w-5 h-5 text-gray-900" />
            </button>

            {/* Image counter */}
            {images.length > 1 && <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full z-10">
              <span className="text-white text-xs font-medium">
                {currentImageIndex + 1} / {images.length}
              </span>
            </div>}
          </div>

          {/* Carousel dots */}
          {images.length > 1 && <div className="flex items-center justify-center gap-2 py-4 bg-white">
            {images.map((_, index) => <button key={index} onClick={() => {
              setDirection(index > currentImageIndex ? 1 : -1);
              setCurrentImageIndex(index);
            }} className={`transition-all duration-300 rounded-full ${index === currentImageIndex ? "w-8 h-2 bg-gray-900" : "w-2 h-2 bg-gray-300 hover:bg-gray-400"}`} />)}
          </div>}
        </div> : <div className="relative w-full h-80 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
          <div className="text-center">
            <div className="w-20 h-20 bg-white/80 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
              <Camera className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-600">No images added yet</p>
            <p className="text-xs text-gray-500 mt-1">Tap the button below to add an image</p>
          </div>
        </div>}

        {/* Add image buttons - redesigned */}
        <div className="px-4 py-4 bg-white border-t border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={async () => {
                if (isFlutterInAppWebViewAvailable()) {
                  const picked = await pickImagesFromGallery();
                  if (picked) return;
                }
                fileInputRef.current?.click();
              }}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-gray-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Upload className="w-4 h-4" />
              <span>Gallery</span>
            </button>
            <button
              type="button"
              onClick={async () => {
                if (isFlutterInAppWebViewAvailable()) {
                  const picked = await captureImageFromCamera();
                  if (picked) return;
                }
                fileInputRef.current?.click();
              }}
              className="flex items-center justify-center gap-2 px-3 py-3 bg-gray-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-gray-800 transition-all shadow-md hover:shadow-lg active:scale-95"
            >
              <Camera className="w-4 h-4" />
              <span>Camera</span>
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageAdd} className="hidden" id="image-upload" />
        </div>
      </div>

      {/* Form Fields */}
      <div className="p-4 space-y-3">
        {/* Category Selector */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Category <span className="text-red-500">*</span>
          </label>
          <button onClick={() => setIsCategoryPopupOpen(true)} aria-invalid={showCategoryError} className={`w-full px-4 py-3 border rounded-lg text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-all active:scale-[0.99] ${showCategoryError ? "border-red-500" : "border-gray-300"}`}>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-900">
                {category}
              </span>
              {subCategory && subCategory !== category && <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">
                {subCategory}
              </span>}
            </div>
            <ChevronDown className="w-5 h-5 text-gray-400" />
          </button>
          {showCategoryError && <p className="mt-1 text-xs text-red-500">Category is required.</p>}
        </div>

        {/* Item Name */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Item name
          </label>
          <div className="relative">
            <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} maxLength={maxNameLength} className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Enter item name" />
            <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
              <EditIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="text-right mt-1">
            <span className="text-xs text-gray-500">
              {nameLength} / {maxNameLength}
            </span>
          </div>
        </div>


        {/* Item Description */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Item description
          </label>
          <div className="relative">
            <textarea
              value={itemDescription}
              onChange={(e) => setItemDescription(limitWords(e.target.value, maxDescriptionWords))}
              rows={4}
              placeholder="Eg: Yummy veg paneer burger with a soft patty, veggies, cheese, and special sauce"
              className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <button className="absolute right-3 top-3 p-1 rounded-full hover:bg-gray-100">
              <EditIcon className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-xs text-gray-500">
              {descriptionWordCount} / {maxDescriptionWords} words
            </span>
          </div>
          {/* Dietary Options */}
          <div className="flex gap-2 mt-3">
            <button onClick={() => setFoodType("Veg")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Veg" ? "border-green-600 border-2 text-green-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {foodType === "Veg" && <Check className="w-4 h-4" />}
              <span>Veg</span>
            </button>
            <button onClick={() => setFoodType("Non-Veg")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Non-Veg" ? "border-red-600 border-2 text-red-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {foodType === "Non-Veg" && <Check className="w-4 h-4" />}
              <span>Non-Veg</span>
            </button>
            <button onClick={() => setFoodType("Egg")} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${foodType === "Egg" ? "border-yellow-600 border-2 text-yellow-600" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}`}>
              {foodType === "Egg" && <Check className="w-4 h-4" />}
              <span>Egg</span>
            </button>
          </div>
        </div>

        {/* Item Price */}
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-2">
            Item price
          </label>
          <div className="space-y-3">
            <div className="relative">
              <label className="block text-xs text-gray-600 mb-1">Base price <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type="text" value={basePrice} onChange={e => {
                  // Remove rupee symbol and any non-numeric characters except decimal point
                  const value = e.target.value.replace(/[₹\s,]/g, '').replace(/[^0-9.]/g, '');
                  // Allow only one decimal point
                  const parts = value.split('.');
                  const cleanedValue = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : value;
                  setBasePrice(cleanedValue);
                  setShowBasePriceError(false);
                }} onFocus={e => {
                  // Remove rupee symbol when focused for easier editing
                  if (e.target.value.startsWith('₹')) {
                    e.target.value = e.target.value.replace(/₹\s*/g, '');
                  }
                }} placeholder="Enter price" aria-invalid={showBasePriceError} className={`w-full pl-8 pr-12 py-3 border rounded-lg text-sm text-gray-900 bg-gray-50 focus:outline-none focus:ring-2 focus:border-transparent ${showBasePriceError ? "border-red-500 focus:ring-red-500" : "border-gray-300 focus:ring-blue-500"}`} />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-600">₹</span>
                <button className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-gray-100">
                  <EditIcon className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              {showBasePriceError && <p className="mt-1 text-xs text-red-500">Item price is required.</p>}
            </div>

            {/* Preparation Time */}
            <div className="relative">
              <label className="block text-xs text-gray-600 mb-1">Preparation Time <span className="text-red-500">*</span></label>
              <Select value={preparationTime || undefined} onValueChange={value => {
                setPreparationTime(value);
                setShowPreparationTimeError(false);
              }}>
                <SelectTrigger
                  aria-invalid={showPreparationTimeError}
                  className={`w-full rounded-lg bg-gray-50 dark:bg-[#1a1a1a] text-gray-900 dark:text-white ${showPreparationTimeError ? "border-red-500 focus:ring-red-500" : "border-gray-300 dark:border-gray-700"}`}
                >
                  <SelectValue placeholder="Select timing" />
                </SelectTrigger>
                <SelectContent
                  className="bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-700 max-h-[260px] overflow-y-auto"
                  position="popper"
                  align="start"
                >
                  <SelectItem value="10-20 mins">10-20 mins</SelectItem>
                  <SelectItem value="20-25 mins">20-25 mins</SelectItem>
                  <SelectItem value="25-35 mins">25-35 mins</SelectItem>
                  <SelectItem value="35-45 mins">35-45 mins</SelectItem>
                </SelectContent>
              </Select>
              {showPreparationTimeError && (
                <p className="mt-1 text-xs text-red-500">Preparation time is required.</p>
              )}
            </div>
            {/* <div>
                <label className="block text-xs text-gray-600 mb-1">GST</label>
                <button
                  onClick={() => setIsGstPopupOpen(true)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                >
                  <span className="text-sm text-gray-900">GST {gst}%</span>
                  <ChevronDown className="w-5 h-5 text-gray-500" />
                </button>
               </div> */}
          </div>

        </div>

        {/* In Stock */}
        <div className="flex items-center justify-between py-3 border-t border-gray-200">
          <span className="text-sm font-medium text-gray-900">Item Availability</span>
          <div className="flex items-center gap-2">
            <Switch checked={isInStock} onCheckedChange={setIsInStock} className="data-[state=unchecked]:bg-gray-300" />
            <span className="text-sm text-gray-700">In stock</span>
          </div>
        </div>

        {/* Special Item Request */}
        <div className="py-4 border-t border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-gray-900">Special Item Status</h3>
              {recommendationStatus !== 'none' && <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${recommendationStatus === 'approved' ? 'bg-green-100 text-green-700' : recommendationStatus === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}>
                {recommendationStatus}
              </span>}
            </div>
            <Switch checked={isRecommendationRequest} onCheckedChange={setIsRecommendationRequest} disabled={recommendationStatus === 'approved'} className="data-[state=unchecked]:bg-gray-300" />
          </div>
          <p className="text-xs text-gray-500">
            Request to mark this as a "Special Item" to boost its visibility on the menu.
            {recommendationStatus === 'approved' ? ' This item is currently a Special Item.' : ' This request requires admin approval.'}
          </p>
        </div>


      </div>
    </div>

    {/* Category Selection Popup */}
    <AnimatePresence>
      {isCategoryPopupOpen && <>
        <motion.div initial={{
          opacity: 0
        }} animate={{
          opacity: 1
        }} exit={{
          opacity: 0
        }} onClick={() => setIsCategoryPopupOpen(false)} className="fixed inset-0 bg-black/50 z-50" />
        <motion.div initial={{
          y: "100%"
        }} animate={{
          y: 0
        }} exit={{
          y: "100%"
        }} transition={{
          type: "spring",
          damping: 30,
          stiffness: 300
        }} className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900">Select category</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => {
                setIsCategoryPopupOpen(false);
                navigate('/restaurant/menu-categories');
              }} className="p-2 rounded-lg bg-black text-white hover:bg-gray-800 transition-colors flex items-center gap-1.5" title="Add Category">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Add</span>
              </button>
              <button onClick={() => setIsCategoryPopupOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {loadingCategories ? <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-600" />
            </div> : categories.length === 0 ? <div className="text-center py-12 space-y-4">
              <p className="text-sm text-gray-500">No categories available</p>
              <button onClick={() => {
                setIsCategoryPopupOpen(false);
                navigate('/restaurant/menu-categories');
              }} className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg font-semibold hover:bg-gray-800 transition-colors">
                <Plus className="w-5 h-5" />
                Add Category
              </button>
            </div> : <div className="space-y-2">
              {categories.map(cat => <button key={cat.id} onClick={() => handleCategorySelect(cat.id, cat.name)} className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${category === cat.name ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900 hover:bg-gray-100"}`}>
                {cat.name}
              </button>)}
            </div>}
          </div>
        </motion.div>
      </>}
    </AnimatePresence>


    {/* GST Popup */}
    {/* <AnimatePresence>
        {isGstPopupOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGstPopupOpen(false)}
              className="fixed inset-0 bg-black/50 z-50"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl z-50 max-h-[60vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Select GST</h2>
                <button
                  onClick={() => setIsGstPopupOpen(false)}
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <div className="space-y-2">
                  {gstOptions.map((gstValue) => (
                    <button
                      key={gstValue}
                      onClick={() => handleGstSelect(gstValue)}
                      className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        gst === gstValue
                          ? "bg-gray-900 text-white"
                          : "bg-gray-50 text-gray-900 hover:bg-gray-100"
                      }`}
                    >
                      {gstValue}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
       </AnimatePresence> */}


    {/* Bottom Sticky Buttons */}
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200  z-40">
      <div className={`flex gap-3 px-4 py-4 ${isNewItem ? 'justify-end' : ''}`}>
        {!isNewItem && <button onClick={handleDelete} disabled={isDeleting || uploadingImages} className="flex-1 py-3 px-4 border border-black rounded-lg text-sm font-semibold text-black bg-white hover:bg-gray-50 transition-colors flex items-center justify-center disabled:opacity-50">
          {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
        </button>}
        <button onClick={handleSave} disabled={uploadingImages || isDeleting} className={`${isNewItem ? 'w-full' : 'flex-1'} py-3 px-4 rounded-lg text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${!uploadingImages && !isDeleting ? "bg-black text-white hover:bg-black" : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}>
          {uploadingImages ? <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Saving...</span>
          </> : "Save"}
        </button>
      </div>
    </div>
  </div>;
}
