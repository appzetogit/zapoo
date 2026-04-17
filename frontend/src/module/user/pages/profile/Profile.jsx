import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, ChevronRight, Wallet, Tag, User, Leaf, Palette, Bookmark, Building2, Moon, Sun, Check, Info, PenSquare, AlertTriangle, Settings as SettingsIcon, Power, ShoppingCart, UtensilsCrossed, Languages, Trash2 } from "lucide-react";
import AnimatedPage from "../../components/AnimatedPage";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProfile } from "../../context/ProfileContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCompanyName } from "@/lib/hooks/useCompanyName";
import OptimizedImage from "@/components/OptimizedImage";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authAPI, userAPI } from "@/lib/api";
import { firebaseAuth } from "@/lib/firebase";
import { clearModuleAuth } from "@/lib/utils/auth";
import { revokeFcmTokenOnLogout } from "@/lib/utils/fcmTokenLifecycle";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
export default function Profile() {
  const {
    userProfile,
    vegMode,
    setVegMode,
    appearance,
    setAppearance
  } = useProfile();
  const navigate = useNavigate();
  const companyName = useCompanyName();
  const { t } = useTranslation();

  // Popup states
  const [vegModeOpen, setVegModeOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);


  // Get first letter of name for avatar
  const avatarInitial = userProfile?.name?.charAt(0)?.toUpperCase() || userProfile?.phone?.charAt(1)?.toUpperCase() || 'U';
  const displayName = userProfile?.name || userProfile?.phone || t("user.profile.defaultUserName");
  // Only show email if it exists and is valid, otherwise show phone or "Not available"
  const hasValidEmail = userProfile?.email && userProfile.email.trim() !== '' && userProfile.email.includes('@');
  const displayEmail = hasValidEmail ? userProfile.email : userProfile?.phone || t("user.profile.notAvailable");

  // Calculate profile completion percentage
  const calculateProfileCompletion = () => {
    if (!userProfile) return 0;

    // Helper function to check if date field is filled (handles Date objects, date strings, ISO strings)
    const isDateFilled = dateField => {
      if (!dateField) return false;

      // Check if it's a Date object
      if (dateField instanceof Date) {
        return !isNaN(dateField.getTime());
      }

      // Check if it's a string
      if (typeof dateField === 'string') {
        const trimmed = dateField.trim();
        if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return false;

        // Try to parse as date (handles various formats: YYYY-MM-DD, ISO strings, etc.)
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          // Valid date
          return true;
        }
      }
      return false;
    };

    // Check name - must have value
    const hasName = !!(userProfile.name && typeof userProfile.name === 'string' && userProfile.name.trim() !== '');

    // Check contact - phone OR email (at least one)
    const hasPhone = !!(userProfile.phone && typeof userProfile.phone === 'string' && userProfile.phone.trim() !== '');
    const hasContact = hasPhone || hasValidEmail;

    // Check profile image - must have URL string
    const hasImage = !!(userProfile.profileImage && typeof userProfile.profileImage === 'string' && userProfile.profileImage.trim() !== '' && userProfile.profileImage !== 'null' && userProfile.profileImage !== 'undefined');

    // Check date oef birth
    const hasDateOfBirth = isDateFilled(userProfile.dateOfBirth);

    // Check gender - must be valid value
    const validGenders = ['male', 'female', 'other', 'prefer-not-to-say'];
    const hasGender = !!(userProfile.gender && typeof userProfile.gender === 'string' && userProfile.gender.trim() !== '' && validGenders.includes(userProfile.gender.trim().toLowerCase()));
    // Required fields only (anniversary is NOT counted - it's optional)
    // Only these 5 fields count towards 100%
    const requiredFields = {
      name: hasName,
      contact: hasContact,
      profileImage: hasImage,
      dateOfBirth: hasDateOfBirth,
      gender: hasGender
    };
    const totalRequiredFields = 5; // Fixed: name, contact, profileImage, dateOfBirth, gender
    const completedRequiredFields = Object.values(requiredFields).filter(Boolean).length;

    // Calculate percentage based ONLY on required fields (anniversary NOT included)
    const percentage = Math.round(completedRequiredFields / totalRequiredFields * 100);

    // Always log for debugging (remove in production if needed)

    return percentage;
  };
  const profileCompletion = calculateProfileCompletion();
  const isComplete = profileCompletion === 100;

  // Handle logout
  const handleLogout = async () => {
    if (isLoggingOut) return; // Prevent multiple clicks

    setIsLoggingOut(true);
    try {
      // Call backend logout API to invalidate refresh token
      try {
        await revokeFcmTokenOnLogout("user");
        await authAPI.logout();
      } catch (apiError) {
        // Continue with logout even if API call fails (network issues, etc.)
        console.warn("Logout API call failed, continuing with local cleanup:", apiError);
      }

      // Sign out from Firebase if user logged in via Google
      try {
        const {
          signOut
        } = await import("firebase/auth");
        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
          await signOut(firebaseAuth);
        }
      } catch (firebaseError) {
        // Continue even if Firebase logout fails
        console.warn("Firebase logout failed, continuing with local cleanup:", firebaseError);
      }

      // Clear user module authentication data using utility function
      clearModuleAuth("user");

      // Clear legacy token data for backward compatibility
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");

      // Dispatch auth change event to notify other components
      window.dispatchEvent(new Event("userAuthChanged"));

      // Navigate to sign in page
      navigate("/user/auth/sign-in", {
        replace: true
      });
    } catch (err) {
      // Even if there's an error, we should still clear local data and logout
      console.error("Error during logout:", err);

      // Clear local data anyway using utility function
      clearModuleAuth("user");

      // Clear legacy token data for backward compatibility
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("userAuthChanged"));

      // Still navigate to login page
      navigate("/user/auth/sign-in", {
        replace: true
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleLogoutClick = () => {
    setLogoutConfirmOpen(true);
  };

  const confirmLogout = async () => {
    setLogoutConfirmOpen(false);
    await handleLogout();
  };

  const cancelLogout = () => {
    setLogoutConfirmOpen(false);
  };

  const handleDeleteConfirmationChange = (event) => {
    setDeleteConfirmationText((event.target.value || "").toUpperCase());
  };

  const handleDeleteDialogOpenChange = (open) => {
    if (isDeletingAccount) return;
    setDeleteConfirmOpen(open);
    if (!open) {
      setDeleteConfirmationText("");
    }
  };

  const handleDeleteAccount = async () => {
    if (isDeletingAccount || deleteConfirmationText !== "DELETE") return;

    setIsDeletingAccount(true);
    try {
      await revokeFcmTokenOnLogout("user");
      await userAPI.deleteAccount();

      try {
        const { signOut } = await import("firebase/auth");
        if (firebaseAuth.currentUser) {
          await signOut(firebaseAuth);
        }
      } catch (firebaseError) {
        console.warn("Firebase logout failed after account deletion:", firebaseError);
      }

      clearModuleAuth("user");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("user_authenticated");
      localStorage.removeItem("user_user");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("userAuthChanged"));

      setDeleteConfirmationText("");
      setDeleteConfirmOpen(false);
      toast.success("Account deleted successfully");
      navigate("/user/auth/sign-in", { replace: true });
    } catch (error) {
      toast.error(error?.response?.data?.message || "Failed to delete account. Please try again.");
      setIsDeletingAccount(false);
    }
  };

  return <AnimatedPage className="min-h-screen bg-[#f5f5f5] dark:bg-[#0a0a0a]">
      <div className="max-w-md md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 xl:px-12 py-4 sm:py-6 md:py-8 lg:py-10 pb-28">
        {/* Back Arrow */}
        <div className="mb-4">
          <Link to="/user">
            <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
              <ArrowLeft className="h-5 w-5 text-black dark:text-white" />
            </Button>
          </Link>
        </div>

        {/* Profile Info Card */}
        <Card className="bg-white dark:bg-[#1a1a1a] rounded-2xl py-0 pt-1 shadow-sm mb-0 border-0 dark:border-gray-800 overflow-hidden">
          <CardContent className="p-4 py-0 pt-2">
            <div className="flex items-start gap-4 mb-4">
              <motion.div whileHover={{
              scale: 1.1,
              rotate: 5
            }} transition={{
              duration: 0.3,
              type: "spring",
              stiffness: 300
            }}>
                <Avatar className="h-16 w-16 bg-orange-600 border-0">
                  {userProfile?.profileImage && <AvatarImage src={userProfile.profileImage && userProfile.profileImage.trim() ? userProfile.profileImage : undefined} alt={displayName} />}
                  <AvatarFallback className="bg-orange-600 text-white text-2xl font-semibold">
                    {avatarInitial}
                  </AvatarFallback>
                </Avatar>
              </motion.div>
              <div className="flex-1 pt-1">
                <h2 className="text-xl font-bold text-black dark:text-white mb-1">{displayName}</h2>
                {hasValidEmail && <p className="text-sm text-black dark:text-gray-300 mb-1">{userProfile.email}</p>}
                {userProfile?.phone && <p className={`text-sm ${hasValidEmail ? 'text-gray-600 dark:text-gray-400' : 'text-black dark:text-white'} mb-3`}>
                    {userProfile.phone}
                  </p>}
                {!hasValidEmail && !userProfile?.phone && <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">{t("user.profile.notAvailable")}</p>}
                {/* <Link to="/user/profile/activity" className="flex items-center gap-1 text-green-600 text-sm font-medium">
                  View activity
                  <ChevronRight className="h-4 w-4" />
                 </Link> */}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Appzeto Money and Coupons - Side by Side */}
        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 lg:gap-5 mt-3 mb-3">
          <Link to="/user/wallet" className="h-full">
            <motion.div whileHover={{
            y: -4,
            scale: 1.02
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer h-full">
                <CardContent className="p-4 h-full flex items-center gap-3">
                  <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 flex-shrink-0" whileHover={{
                  rotate: 360,
                  scale: 1.1
                }} transition={{
                  duration: 0.5
                }}>
                    <Wallet className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{t("user.profile.walletMoney", { companyName })}</span>
                    <span className="text-base font-semibold text-orange-600 dark:text-orange-400">₹{userProfile?.wallet?.balance?.toFixed(0) || '0'}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <Link to="/user/profile/coupons" className="h-full">
            <motion.div whileHover={{
            y: -4,
            scale: 1.02
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer h-full">
                <CardContent className="p-4 h-full flex items-center gap-3">
                  <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2 flex-shrink-0" whileHover={{
                  rotate: 360,
                  scale: 1.1
                }} transition={{
                  duration: 0.5
                }}>
                    <Tag className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{t("user.profile.yourCoupons")}</p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>
        </div>

        {/* Account Options */}
        <div className="space-y-2 mb-3">

          <Link to="/user/cart" className="block">
            <motion.div whileHover={{
            x: 4,
            scale: 1.01
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                    rotate: 15,
                    scale: 1.1
                  }} transition={{
                    duration: 0.3
                  }}>
                      <ShoppingCart className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.yourCart")}</span>
                  </div>
                  <motion.div whileHover={{
                  x: 4
                }} transition={{
                  duration: 0.2
                }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>


          <Link to="/user/profile/edit" className="block">
            <motion.div whileHover={{
            x: 4,
            scale: 1.01
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                    rotate: 15,
                    scale: 1.1
                  }} transition={{
                    duration: 0.3
                  }}>
                      <User className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.yourProfile")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.span className={`text-xs font-medium px-2 py-1 rounded ${isComplete ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-yellow-200 text-yellow-800'}`} whileHover={{
                    scale: 1.1
                  }} transition={{
                    duration: 0.2
                  }}>
                      {t("user.profile.profileCompletion", { percent: profileCompletion })}
                    </motion.span>
                    <motion.div whileHover={{
                    x: 4
                  }} transition={{
                    duration: 0.2
                  }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>

          <motion.div whileHover={{
          x: 4,
          scale: 1.01
        }} transition={{
          duration: 0.2,
          type: "spring",
          stiffness: 300
        }}>
            <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer" onClick={() => setVegModeOpen(true)}>
              <CardContent className="p-4  flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                  rotate: 15,
                  scale: 1.1
                }} transition={{
                  duration: 0.3
                }}>
                    <Leaf className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.vegMode")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.span className="text-base font-medium text-gray-900 dark:text-white" whileHover={{
                  scale: 1.1
                }} transition={{
                  duration: 0.2
                }}>
                    {vegMode ? t("user.profile.on") : t("user.profile.off")}
                  </motion.span>
                  <motion.div whileHover={{
                  x: 4
                }} transition={{
                  duration: 0.2
                }}>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div whileHover={{
          x: 4,
          scale: 1.01
        }} transition={{
          duration: 0.2,
          type: "spring",
          stiffness: 300
        }}>
            <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer" onClick={() => setAppearanceOpen(true)}>
              <CardContent className="p-4  flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                  rotate: 15,
                  scale: 1.1
                }} transition={{
                  duration: 0.3
                }}>
                    <Palette className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                  </motion.div>
                  <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.appearance.title")}</span>
                </div>
                <div className="flex items-center gap-2">
                  <motion.span className="text-base font-medium text-gray-900 dark:text-white capitalize" whileHover={{
                  scale: 1.1
                }} transition={{
                  duration: 0.2
                }}>
                    {t(`user.profile.appearance.value.${appearance}`, { defaultValue: appearance })}
                  </motion.span>
                  <motion.div whileHover={{
                  x: 4
                }} transition={{
                  duration: 0.2
                }}>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </motion.div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </div>

        {/* Collections Section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-orange-600 rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("user.profile.collections")}</h3>
          </div>
          <Link to="/user/profile/favorites">
            <motion.div whileHover={{
            x: 4,
            scale: 1.01
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                <CardContent className="p-4  flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                    rotate: 15,
                    scale: 1.1
                  }} transition={{
                    duration: 0.3
                  }}>
                      <Bookmark className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.yourCollections")}</span>
                  </div>
                  <motion.div whileHover={{
                  x: 4
                }} transition={{
                  duration: 0.2
                }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </Link>
        </div>
      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3">
              <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">Confirm Logout</DialogTitle>
              <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
                Are you sure you want to log out? You will need to sign in again to access your account.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 px-5 pb-5">
              <Button onClick={confirmLogout} className="w-full h-12 bg-red-600 hover:bg-red-700 text-white">
                Yes, log out
              </Button>
              <Button variant="outline" onClick={cancelLogout} className="w-full h-12">
                No, stay logged in
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteConfirmOpen} onOpenChange={handleDeleteDialogOpenChange}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-sm rounded-2xl p-4 sm:p-5 [&>button]:hidden">
          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="text-base sm:text-lg font-bold text-red-600">Delete Your Account?</DialogTitle>
            <DialogDescription className="text-sm leading-5 text-gray-600">
              Are you sure you want to delete your account? All your data will be permanently lost. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Type DELETE to confirm"
            value={deleteConfirmationText}
            onChange={handleDeleteConfirmationChange}
            disabled={isDeletingAccount}
            className="h-11 mt-2"
          />
          <DialogFooter className="mt-4 flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleDeleteDialogOpenChange(false)}
              disabled={isDeletingAccount}
              className="h-11 w-full"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleDeleteAccount}
              disabled={isDeletingAccount || deleteConfirmationText !== "DELETE"}
              className="h-11 w-full bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
            >
              {isDeletingAccount ? "Deleting..." : "Delete Account"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
        {/* Food Orders Section */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-orange-600 rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("user.profile.foodOrders")}</h3>
          </div>
          <div className="space-y-2">
            <Link to="/user/orders" className="block">
              <motion.div whileHover={{
              x: 4,
              scale: 1.01
            }} transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300
            }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                      rotate: 15,
                      scale: 1.1
                    }} transition={{
                      duration: 0.3
                    }}>
                        <Building2 className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.yourOrders")}</span>
                    </div>
                    <motion.div whileHover={{
                    x: 4
                  }} transition={{
                    duration: 0.2
                  }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>
          </div>
        </div>


        {/* More Section */}
        <div className="mb-6 pb-4">
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-1 h-4 bg-orange-600 rounded"></div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">{t("user.profile.more")}</h3>
          </div>
          <div className="space-y-2">
            <Link to="/user/profile/about" className="block">
              <motion.div whileHover={{
              x: 4,
              scale: 1.01
            }} transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300
            }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                      rotate: 15,
                      scale: 1.1
                    }} transition={{
                      duration: 0.3
                    }}>
                        <Info className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.about")}</span>
                    </div>
                    <motion.div whileHover={{
                    x: 4
                  }} transition={{
                    duration: 0.2
                  }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/user/profile/send-feedback" className="block">
              <motion.div whileHover={{
              x: 4,
              scale: 1.01
            }} transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300
            }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                      rotate: 15,
                      scale: 1.1
                    }} transition={{
                      duration: 0.3
                    }}>
                        <PenSquare className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.sendFeedback")}</span>
                    </div>
                    <motion.div whileHover={{
                    x: 4
                  }} transition={{
                    duration: 0.2
                  }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/user/profile/report-safety-emergency" className="block">
              <motion.div whileHover={{
              x: 4,
              scale: 1.01
            }} transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300
            }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                      rotate: 15,
                      scale: 1.1
                    }} transition={{
                      duration: 0.3
                    }}>
                        <AlertTriangle className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">{t("user.profile.reportSafetyEmergency")}</span>
                    </div>
                    <motion.div whileHover={{
                    x: 4
                  }} transition={{
                    duration: 0.2
                  }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <Link to="/user/profile/settings" className="block">
              <motion.div whileHover={{
              x: 4,
              scale: 1.01
            }} transition={{
              duration: 0.2,
              type: "spring",
              stiffness: 300
            }}>
                <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                      rotate: 15,
                      scale: 1.1
                    }} transition={{
                      duration: 0.3
                    }}>
                        <Languages className="h-5 w-5 text-gray-700 dark:text-gray-300" />
                      </motion.div>
                      <span className="text-base font-medium text-gray-900 dark:text-white">{t("common.language")}</span>
                    </div>
                    <motion.div whileHover={{
                    x: 4
                  }} transition={{
                    duration: 0.2
                  }}>
                      <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                    </motion.div>
                  </CardContent>
                </Card>
              </motion.div>
            </Link>

            <motion.div whileHover={{
            x: 4,
            scale: 1.01
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mb-6" onClick={handleLogoutClick}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="bg-gray-100 dark:bg-gray-800 rounded-full p-2" whileHover={{
                    rotate: 15,
                    scale: 1.1
                  }} transition={{
                    duration: 0.3
                  }}>
                      <Power className={`h-5 w-5 text-gray-700 dark:text-gray-300 ${isLoggingOut ? 'animate-pulse' : ''}`} />
                    </motion.div>
                    <span className="text-base font-medium text-gray-900 dark:text-white">
                      {isLoggingOut ? t("user.profile.loggingOut") : t("user.profile.logOut")}
                    </span>
                  </div>
                  <motion.div whileHover={{
                  x: 4
                }} transition={{
                  duration: 0.2
                }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div whileHover={{
            x: 4,
            scale: 1.01
          }} transition={{
            duration: 0.2,
            type: "spring",
            stiffness: 300
          }}>
              <Card className="bg-white dark:bg-[#1a1a1a] py-0 rounded-xl shadow-sm border-0 dark:border-gray-800 cursor-pointer mb-6" onClick={() => handleDeleteDialogOpenChange(true)}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="bg-red-50 dark:bg-red-900/20 rounded-full p-2" whileHover={{
                    rotate: 15,
                    scale: 1.1
                  }} transition={{
                    duration: 0.3
                  }}>
                      <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                    </motion.div>
                    <span className="text-base font-medium text-red-600 dark:text-red-400">Delete Account</span>
                  </div>
                  <motion.div whileHover={{
                  x: 4
                }} transition={{
                  duration: 0.2
                }}>
                    <ChevronRight className="h-5 w-5 text-gray-400 dark:text-gray-500" />
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Veg Mode Popup */}
      <Dialog open={vegModeOpen} onOpenChange={setVegModeOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">{t("user.profile.vegMode")}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              {t("user.profile.vegModeDescription")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 pb-5">
            <button onClick={() => {
            setVegMode(true);
            setVegModeOpen(false);
          }} className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${vegMode ? 'border-orange-600 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${vegMode ? 'border-orange-600 bg-orange-600' : 'border-gray-300'}`}>
                  {vegMode && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{t("user.profile.vegModeOnTitle")}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.profile.vegModeOnDescription")}</p>
                </div>
              </div>
              <Leaf className={`h-5 w-5 ${vegMode ? 'text-orange-600' : 'text-gray-400 dark:text-gray-500'}`} />
            </button>
            <button onClick={() => {
            setVegMode(false);
            setVegModeOpen(false);
          }} className={`w-full p-3 rounded-xl border-2 transition-all flex items-center justify-between ${!vegMode ? 'border-red-600 bg-red-50 dark:bg-red-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${!vegMode ? 'border-red-600 bg-red-600' : 'border-gray-300'}`}>
                  {!vegMode && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{t("user.profile.vegModeOffTitle")}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.profile.vegModeOffDescription")}</p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Appearance Popup */}
      <Dialog open={appearanceOpen} onOpenChange={setAppearanceOpen}>
        <DialogContent className="max-w-sm md:max-w-md lg:max-w-lg w-[calc(100%-2rem)] rounded-2xl p-0 overflow-hidden bg-white dark:bg-[#1a1a1a] border-gray-200 dark:border-gray-800">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle className="text-lg font-bold text-gray-900 dark:text-white">{t("user.profile.appearance.title")}</DialogTitle>
            <DialogDescription className="text-sm text-gray-500 dark:text-gray-400">
              {t("user.profile.appearance.description")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-5 pb-5">
            <button onClick={() => {
            setAppearance('light');
            setAppearanceOpen(false);
          }} className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${appearance === 'light' ? 'border-orange-600 bg-orange-50 dark:border-orange-500 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === 'light' ? 'border-orange-600 bg-orange-600 dark:border-orange-500 dark:bg-orange-500' : 'border-gray-300 dark:border-gray-600'}`}>
                {appearance === 'light' && <Check className="h-3 w-3 text-white" />}
              </div>
              <Sun className="h-5 w-5 text-yellow-500 dark:text-yellow-400 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm">{t("user.profile.appearance.light")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.profile.appearance.lightDescription")}</p>
              </div>
            </button>
            <button onClick={() => {
            setAppearance('dark');
            setAppearanceOpen(false);
          }} className={`w-full p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${appearance === 'dark' ? 'border-orange-600 dark:border-orange-500 bg-orange-50 dark:bg-orange-900/20' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'}`}>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${appearance === 'dark' ? 'border-orange-600 bg-orange-600 dark:border-orange-500 dark:bg-orange-500' : 'border-gray-300 dark:border-gray-600'}`}>
                {appearance === 'dark' && <Check className="h-3 w-3 text-white" />}
              </div>
              <Moon className="h-5 w-5 text-gray-600 dark:text-gray-300 flex-shrink-0" />
              <div className="text-left">
                <p className="font-medium text-gray-900 dark:text-white text-sm">{t("user.profile.appearance.dark")}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("user.profile.appearance.darkDescription")}</p>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

    </AnimatedPage>;
}
