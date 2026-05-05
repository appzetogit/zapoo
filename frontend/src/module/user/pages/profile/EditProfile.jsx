import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X, Loader2, Camera, ImageUp, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "../../context/ProfileContext";
import { userAPI } from "@/lib/api";
import { toast } from "sonner";
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs from 'dayjs';

// Gender options
const genderOptions = [{
  value: "male",
  label: "Male"
}, {
  value: "female",
  label: "Female"
}, {
  value: "other",
  label: "Other"
}, {
  value: "prefer-not-to-say",
  label: "Prefer not to say"
}];

// Load profile data from localStorage
const loadProfileFromStorage = () => {
  try {
    const stored = localStorage.getItem('appzeto_user_profile');
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Error loading profile from localStorage:', error);
  }
  return null;
};

// Save profile data to localStorage
const saveProfileToStorage = data => {
  try {
    localStorage.setItem('appzeto_user_profile', JSON.stringify(data));
  } catch (error) {
    console.error('Error saving profile to localStorage:', error);
  }
};
export default function EditProfile() {
  const navigate = useNavigate();
  const {
    userProfile,
    updateUserProfile
  } = useProfile();

  // Load from localStorage or use context
  const storedProfile = loadProfileFromStorage();
  const initialProfile = storedProfile || userProfile || {};
  const initialFormData = {
    name: initialProfile.name ?? "",
    mobile: initialProfile.mobile ?? initialProfile.phone ?? "",
    email: initialProfile.email ?? "",
    dateOfBirth: initialProfile.dateOfBirth ? typeof initialProfile.dateOfBirth === 'string' ? dayjs(initialProfile.dateOfBirth) : dayjs(initialProfile.dateOfBirth) : null,
    gender: initialProfile.gender ?? ""
  };
  const [formData, setFormData] = useState(initialFormData);
  const [initialData, setInitialData] = useState(initialFormData);
  const [errors, setErrors] = useState({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [profileImage, setProfileImage] = useState(initialProfile?.profileImage || "");
  const [imagePreview, setImagePreview] = useState(initialProfile?.profileImage || "");
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const normalizeFormData = data => ({
    name: data.name ?? "",
    mobile: data.mobile ?? "",
    email: data.email ?? "",
    dateOfBirth: data.dateOfBirth ? dayjs(data.dateOfBirth).format("YYYY-MM-DD") : "",
    gender: data.gender ?? ""
  });

  const validateEmail = email => {
    const trimmed = email.trim();
    if (!trimmed) return true;
    return /^[^\s@]+@[^\s@]+\.[A-Za-z]{3,}$/.test(trimmed);
  };

  const validatePhone = phone => {
    const trimmed = phone.trim();
    if (!trimmed) return true;
    const digits = trimmed.replace(/\D/g, "");
    return /^[6-9]\d{9}$/.test(digits);
  };

  const validateDateOfBirth = dateValue => {
    if (!dateValue) return true;
    const dob = dayjs(dateValue);
    if (!dob.isValid()) return false;
    return !dob.isAfter(dayjs(), "day");
  };

  const clearFieldError = field => {
    setErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  // Update form data when profile changes
  useEffect(() => {
    const storedProfile = loadProfileFromStorage();
    const profile = storedProfile || userProfile || {};
    const newFormData = {
      name: profile.name ?? "",
      mobile: profile.mobile ?? profile.phone ?? "",
      email: profile.email ?? "",
      dateOfBirth: profile.dateOfBirth ? typeof profile.dateOfBirth === 'string' ? dayjs(profile.dateOfBirth) : dayjs(profile.dateOfBirth) : null,
      gender: profile.gender ?? ""
    };
    setFormData(newFormData);
    setInitialData(newFormData);

    // Update profile image
    if (profile.profileImage) {
      setProfileImage(profile.profileImage);
      setImagePreview(profile.profileImage);
    } else {
      setProfileImage("");
      setImagePreview("");
    }
  }, [userProfile]);

  // Get avatar initial
  const avatarInitial = formData.name?.charAt(0).toUpperCase() || 'A';

  // Check if form has changes
  useEffect(() => {
    const currentData = JSON.stringify(normalizeFormData(formData));
    const savedData = JSON.stringify(normalizeFormData(initialData));
    setHasChanges(currentData !== savedData);
  }, [formData, initialData]);
  const handleChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    clearFieldError(field);
  };
  const handleClear = field => {
    setFormData(prev => ({
      ...prev,
      [field]: ""
    }));
    clearFieldError(field);
  };
  const handleImageSelect = async e => {
    const input = e.target;
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select a valid image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Upload to server
    try {
      setIsUploadingImage(true);
      const response = await userAPI.uploadProfileImage(file);
      const imageUrl = response?.data?.data?.profileImage || response?.data?.profileImage;
      if (imageUrl) {
        setProfileImage(imageUrl);
        setImagePreview(imageUrl);
        toast.success('Profile image uploaded successfully');

        const savedProfile = loadProfileFromStorage() || userProfile || {};
        saveProfileToStorage({
          ...savedProfile,
          profileImage: imageUrl
        });

        // Update context
        updateUserProfile({
          profileImage: imageUrl
        });

        // Dispatch event to refresh profile
        window.dispatchEvent(new Event("userAuthChanged"));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error?.response?.data?.message || 'Failed to upload image');
      // Revert preview
      setImagePreview(profileImage);
    } finally {
      setIsUploadingImage(false);
      if (input) {
        input.value = "";
      }
    }
  };
  const handleRemoveImage = async () => {
    if (!profileImage && !imagePreview) return;

    try {
      setIsUploadingImage(true);
      const response = await userAPI.updateProfile({
        profileImage: null
      });
      const updatedUser = response?.data?.data?.user || response?.data?.user;
      const nextProfileImage = updatedUser?.profileImage ?? null;

      setProfileImage("");
      setImagePreview("");
      updateUserProfile({
        ...(updatedUser || {}),
        profileImage: nextProfileImage
      });

      saveProfileToStorage({
        ...(loadProfileFromStorage() || userProfile || {}),
        ...(updatedUser || {}),
        profileImage: nextProfileImage
      });

      window.dispatchEvent(new Event("userAuthChanged"));
      toast.success('Profile image removed successfully');
    } catch (error) {
      console.error('Error removing profile image:', error);
      toast.error(error?.response?.data?.message || 'Failed to remove profile image');
    } finally {
      setIsUploadingImage(false);
    }
  };
  const handleUpdate = async () => {
    if (isSaving) return;

    const nextErrors = {};
    if (!formData.name.trim()) {
      nextErrors.name = "Name is required";
    }
    if (formData.email && !validateEmail(formData.email)) {
      nextErrors.email = "Enter a valid email address";
    }
    if (formData.mobile && !validatePhone(formData.mobile)) {
      nextErrors.mobile = "Enter a valid phone number";
    }
    if (formData.dateOfBirth && !validateDateOfBirth(formData.dateOfBirth)) {
      nextErrors.dateOfBirth = "Date of birth cannot be in the future";
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }

    try {
      setIsSaving(true);

      // Prepare data for API
      const updateData = {
        name: formData.name,
        email: formData.email || undefined,
        phone: formData.mobile || undefined,
        dateOfBirth: formData.dateOfBirth ? formData.dateOfBirth.format('YYYY-MM-DD') : undefined,
        gender: formData.gender || undefined,
        profileImage: profileImage || undefined // Include profileImage in update
      };

      // Call API to update profile
      const response = await userAPI.updateProfile(updateData);
      const updatedUser = response?.data?.data?.user || response?.data?.user;
      if (updatedUser) {
        // Update context with all fields including profileImage
        updateUserProfile({
          ...updatedUser,
          phone: updatedUser.phone || formData.mobile,
          profileImage: updatedUser.profileImage || profileImage
        });

        // Save to localStorage with complete data
        saveProfileToStorage({
          name: updatedUser.name || formData.name,
          phone: updatedUser.phone || formData.mobile,
          email: updatedUser.email || formData.email,
          profileImage: updatedUser.profileImage || profileImage,
          dateOfBirth: updatedUser.dateOfBirth || formData.dateOfBirth?.format('YYYY-MM-DD'),
          gender: updatedUser.gender || formData.gender
        });

        // Dispatch event to refresh profile from API
        window.dispatchEvent(new Event("userAuthChanged"));
        toast.success('Profile updated successfully');

        // Navigate back
        navigate("/user/profile");
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(error?.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };
  const dateFieldSx = {
    '& .MuiOutlinedInput-root': {
      height: '48px',
      borderRadius: '8px',
      backgroundColor: '#ffffff',
      color: '#111827',
      '& fieldset': {
        borderColor: '#d1d5db'
      },
      '&:hover fieldset': {
        borderColor: '#9ca3af'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#16a34a',
        borderWidth: '1px'
      },
      '& .MuiSvgIcon-root': {
        color: '#6b7280'
      }
    },
    '& .MuiInputBase-input': {
      padding: '12px 14px',
      fontSize: '16px',
      color: '#111827'
    },
    '.dark & .MuiOutlinedInput-root': {
      backgroundColor: '#1a1a1a',
      color: '#f3f4f6',
      '& fieldset': {
        borderColor: '#374151'
      },
      '&:hover fieldset': {
        borderColor: '#4b5563'
      },
      '&.Mui-focused fieldset': {
        borderColor: '#22c55e',
        borderWidth: '1px'
      },
      '& .MuiSvgIcon-root': {
        color: '#9ca3af'
      },
      '& .MuiInputAdornment-root': {
        color: '#9ca3af'
      },
      '& .MuiPickersSectionList-root': {
        color: '#f3f4f6'
      },
      '& .MuiPickersInputBase-sectionsContainer': {
        color: '#f3f4f6'
      },
      '& .MuiPickersInputBase-input': {
        color: '#f3f4f6',
        WebkitTextFillColor: '#f3f4f6'
      },
      '& .MuiOutlinedInput-input': {
        color: '#f3f4f6',
        WebkitTextFillColor: '#f3f4f6'
      }
    },
    '.dark & .MuiInputBase-input': {
      color: '#f3f4f6',
      WebkitTextFillColor: '#f3f4f6'
    },
    '.dark & .MuiPickersSectionList-root': {
      color: '#f3f4f6'
    },
    '.dark & .MuiPickersInputBase-sectionsContainer': {
      color: '#f3f4f6'
    },
    '.dark & .MuiPickersInputBase-input': {
      color: '#f3f4f6',
      WebkitTextFillColor: '#f3f4f6'
    },
    '.dark & .MuiInputBase-input::placeholder': {
      color: '#9ca3af',
      opacity: 1
    }
  };
  return <div className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1a1a1a] sticky top-0 z-10 border-b border-gray-100 dark:border-gray-800">
        <div className="max-w-7xl mx-auto flex items-center gap-3 px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 md:py-5 lg:py-6">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors flex-shrink-0">
            <ArrowLeft className="h-5 w-5 text-gray-700 dark:text-white" />
          </button>
          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Your Profile</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-6 sm:py-8 md:py-10 lg:py-12 space-y-6 md:space-y-8 lg:space-y-10">
        {/* Avatar Section */}
        <div className="flex justify-center">
          <div className="relative">
            <Avatar className="h-24 w-24 bg-blue-400 border-0">
              {imagePreview && <AvatarImage src={imagePreview} alt={formData.name || 'User'} />}
              <AvatarFallback className="bg-blue-400 text-white text-3xl font-semibold">
                {avatarInitial}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" onClick={() => cameraInputRef.current?.click()} disabled={isUploadingImage} className="gap-2">
            {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            Take photo
          </Button>
          <Button type="button" variant="outline" onClick={() => galleryInputRef.current?.click()} disabled={isUploadingImage} className="gap-2">
            {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
            Choose from gallery
          </Button>
          {imagePreview && (
            <Button type="button" variant="ghost" onClick={handleRemoveImage} disabled={isUploadingImage} className="gap-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash2 className="h-4 w-4" />
              Remove photo
            </Button>
          )}
        </div>

        <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" onChange={handleImageSelect} className="hidden" />
        <input ref={galleryInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

        {/* Form Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-xl shadow-sm border-0 dark:border-gray-800">
          <CardContent className="p-4 sm:p-5 md:p-6 lg:p-8 space-y-4 md:space-y-5 lg:space-y-6">
            {/* Name Field */}
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700 dark:text-white">
                Name
              </Label>
              <div className="relative">
                <Input id="name" type="text" value={formData.name} onChange={e => handleChange('name', e.target.value)} className="pr-10 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white" placeholder="Name" />
                {formData.name && <button type="button" onClick={() => handleClear('name')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                    <X className="h-5 w-5" />
                  </button>}
              </div>
              {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
            </div>

            {/* Mobile Field */}
            <div className="space-y-1.5">
              <Label htmlFor="mobile" className="text-sm font-medium text-gray-700 dark:text-white">
                Mobile
              </Label>
              <div className="flex items-center gap-2">
                <Input id="mobile" type="tel" inputMode="numeric" maxLength={10} value={formData.mobile} onChange={e => handleChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} className="flex-1 h-12 text-base  border border-gray-300 dark:border-gray-700 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white" placeholder="Mobile" />
              </div>
              {errors.mobile && <p className="text-sm text-red-500">{errors.mobile}</p>}
            </div>

            {/* Email Field */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 dark:text-white">
                Email
              </Label>
              <div className="flex items-center gap-2">
                <Input id="email" type="email" value={formData.email} onChange={e => handleChange('email', e.target.value)} className="flex-1 h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white" placeholder="Email" />
              </div>
              {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
            </div>

            {/* Date of Birth Field */}
            <div className="space-y-1.5">
              <Label htmlFor="dateOfBirth" className="text-sm font-medium text-gray-700 dark:text-white">
                Date of birth
              </Label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker value={formData.dateOfBirth} onChange={newValue => handleChange('dateOfBirth', newValue)} disableFuture maxDate={dayjs()} slotProps={{
                textField: {
                  className: "w-full",
                  sx: dateFieldSx,
                  error: !!errors.dateOfBirth,
                  helperText: errors.dateOfBirth
                }
              }} />
              </LocalizationProvider>
            </div>

            {/* Gender Field */}
            <div className="space-y-1.5">
              <Label htmlFor="gender" className="text-sm font-medium text-gray-700 dark:text-white">
                Gender
              </Label>
              <Select value={formData.gender || ""} onValueChange={value => handleChange('gender', value)}>
                <SelectTrigger className="h-12 text-base border border-gray-300 dark:border-gray-700 focus:border-green-600 focus:ring-1 focus:ring-green-600 rounded-lg bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white">
                  <SelectValue placeholder="Gender" />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {genderOptions.map(option => <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Update Profile Button */}
        <Button onClick={handleUpdate} disabled={!hasChanges || isSaving || isUploadingImage} className={`w-full h-14 rounded-xl font-semibold text-base transition-all ${hasChanges && !isSaving && !isUploadingImage ? 'bg-green-600 hover:bg-green-700 text-white' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}>
          {isSaving ? <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Saving...
            </> : 'Update profile'}
        </Button>
      </div>
    </div>;
}
