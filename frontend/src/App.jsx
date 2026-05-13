import { Routes, Route, Navigate, useLocation } from "react-router-dom"
import ProtectedRoute from "@/components/ProtectedRoute"
import AuthRedirect from "@/components/AuthRedirect"
import FaviconManager from "@/components/FaviconManager"

import { Suspense, lazy, useMemo } from "react"
import Loader from "@/components/Loader"

// Lazy Loading Components
const UserRouter = lazy(() => import("@/module/user/components/UserRouter"))

// Restaurant Module
const AllOrdersPage = lazy(() => import("@/module/restaurant/pages/AllOrdersPage"))
const EditRestaurantPage = lazy(() => import("@/module/restaurant/pages/EditRestaurantPage"))
const FoodDetailsPage = lazy(() => import("@/module/restaurant/pages/FoodDetailsPage"))
const EditFoodPage = lazy(() => import("@/module/restaurant/pages/EditFoodPage"))
const RestaurantNotifications = lazy(() => import("@/module/restaurant/pages/Notifications"))
const RestaurantNotificationRequest = lazy(() => import("@/module/restaurant/pages/NotificationRequest"))
const OrderDetails = lazy(() => import("@/module/restaurant/pages/OrderDetails"))
const OrdersMain = lazy(() => import("@/module/restaurant/pages/OrdersMain"))
const RestaurantOnboarding = lazy(() => import("@/module/restaurant/pages/Onboarding"))

const RestaurantSignIn = lazy(() => import("@/module/restaurant/pages/auth/SignIn"))
const RestaurantLogin = lazy(() => import("@/module/restaurant/pages/auth/Login"))
const RestaurantSignup = lazy(() => import("@/module/restaurant/pages/auth/Signup"))
const RestaurantSignupEmail = lazy(() => import("@/module/restaurant/pages/auth/SignupEmail"))
const RestaurantForgotPassword = lazy(() => import("@/module/restaurant/pages/auth/ForgotPassword"))
const RestaurantOTP = lazy(() => import("@/module/restaurant/pages/auth/OTP"))
const RestaurantGoogleCallback = lazy(() => import("@/module/restaurant/pages/auth/GoogleCallback"))
const RestaurantWelcome = lazy(() => import("@/module/restaurant/pages/auth/Welcome"))
const RestaurantLegalTerms = lazy(() => import("@/module/restaurant/pages/legal/TermsPage"))
const RestaurantLegalPrivacy = lazy(() => import("@/module/restaurant/pages/legal/PrivacyPage"))
const RestaurantLegalSupport = lazy(() => import("@/module/restaurant/pages/legal/Support"))
const RestaurantLegalCodeOfConduct = lazy(() => import("@/module/restaurant/pages/legal/CodeOfConductPage"))

const AdvertisementsPage = lazy(() => import("@/module/restaurant/pages/AdvertisementsPage"))
const AdDetailsPage = lazy(() => import("@/module/restaurant/pages/AdDetailsPage"))
const NewAdvertisementPage = lazy(() => import("@/module/restaurant/pages/NewAdvertisementPage"))
const EditAdvertisementPage = lazy(() => import("@/module/restaurant/pages/EditAdvertisementPage"))
const MenuCategoriesPage = lazy(() => import("@/module/restaurant/pages/MenuCategoriesPage"))
const RestaurantStatus = lazy(() => import("@/module/restaurant/pages/RestaurantStatus"))
const RestaurantChangeLanguage = lazy(() => import("@/module/restaurant/pages/ChangeLanguage"))
const DeliveryPricing = lazy(() => import("@/module/restaurant/pages/DeliveryPricing"))
const ExploreMore = lazy(() => import("@/module/restaurant/pages/ExploreMore"))
const RushHour = lazy(() => import("@/module/restaurant/pages/RushHour"))
const OutletTimings = lazy(() => import("@/module/restaurant/pages/OutletTimings"))
const DaySlots = lazy(() => import("@/module/restaurant/pages/DaySlots"))
const OutletInfo = lazy(() => import("@/module/restaurant/pages/OutletInfo"))
const RatingsReviews = lazy(() => import("@/module/restaurant/pages/RatingsReviews"))
const ContactDetails = lazy(() => import("@/module/restaurant/pages/ContactDetails"))
const EditOwner = lazy(() => import("@/module/restaurant/pages/EditOwner"))
const InviteUser = lazy(() => import("@/module/restaurant/pages/InviteUser"))
const EditCuisines = lazy(() => import("@/module/restaurant/pages/EditCuisines"))
const Inventory = lazy(() => import("@/module/restaurant/pages/Inventory"))
const Feedback = lazy(() => import("@/module/restaurant/pages/Feedback"))
const ShareFeedback = lazy(() => import("@/module/restaurant/pages/ShareFeedback"))
const DishRatings = lazy(() => import("@/module/restaurant/pages/DishRatings"))
const HelpCentre = lazy(() => import("@/module/restaurant/pages/HelpCentre"))
const FssaiDetails = lazy(() => import("@/module/restaurant/pages/FssaiDetails"))
const FssaiUpdate = lazy(() => import("@/module/restaurant/pages/FssaiUpdate"))
const Hyperpure = lazy(() => import("@/module/restaurant/pages/Hyperpure"))
const HubGrowth = lazy(() => import("@/module/restaurant/pages/HubGrowth"))
const CreateOffers = lazy(() => import("@/module/restaurant/pages/CreateOffers"))
const ChooseDiscountType = lazy(() => import("@/module/restaurant/pages/ChooseDiscountType"))
const ChooseMenuDiscountType = lazy(() => import("@/module/restaurant/pages/ChooseMenuDiscountType"))
const CreatePercentageDiscount = lazy(() => import("@/module/restaurant/pages/CreatePercentageDiscount"))
const CreateFreebies = lazy(() => import("@/module/restaurant/pages/CreateFreebies"))
const FreebiesTiming = lazy(() => import("@/module/restaurant/pages/FreebiesTiming"))
const CreatePercentageMenuDiscount = lazy(() => import("@/module/restaurant/pages/CreatePercentageMenuDiscount"))
const CreateFlatPriceMenuDiscount = lazy(() => import("@/module/restaurant/pages/CreateFlatPriceMenuDiscount"))
const CreateBOGOMenuDiscount = lazy(() => import("@/module/restaurant/pages/CreateBOGOMenuDiscount"))
const MenuDiscountTiming = lazy(() => import("@/module/restaurant/pages/MenuDiscountTiming"))
const HubMenu = lazy(() => import("@/module/restaurant/pages/HubMenu"))
const ItemDetailsPage = lazy(() => import("@/module/restaurant/pages/ItemDetailsPage"))
const HubFinance = lazy(() => import("@/module/restaurant/pages/HubFinance"))
const FinanceDetailsPage = lazy(() => import("@/module/restaurant/pages/FinanceDetailsPage"))
const WithdrawalHistoryPage = lazy(() => import("@/module/restaurant/pages/WithdrawalHistoryPage"))
const PhoneNumbersPage = lazy(() => import("@/module/restaurant/pages/PhoneNumbersPage"))
const DownloadReport = lazy(() => import("@/module/restaurant/pages/DownloadReport"))
const ToHub = lazy(() => import("@/module/restaurant/pages/ToHub"))
const ManageOutlets = lazy(() => import("@/module/restaurant/pages/ManageOutlets"))
const UpdateBankDetails = lazy(() => import("@/module/restaurant/pages/UpdateBankDetails"))
const ZoneSetup = lazy(() => import("@/module/restaurant/pages/ZoneSetup"))
const SubscriptionPlans = lazy(() => import("@/module/restaurant/pages/SubscriptionPlans"))
const SubscriptionCheckout = lazy(() => import("@/module/restaurant/pages/SubscriptionCheckout"))
const RestaurantChallenges = lazy(() => import("@/module/restaurant/pages/Challenges"))

// Admin Module
const AdminRouter = lazy(() => import("@/module/admin/components/AdminRouter"))
const AdminLogin = lazy(() => import("@/module/admin/pages/auth/AdminLogin"))
const AdminSignup = lazy(() => import("@/module/admin/pages/auth/AdminSignup"))
const AdminForgotPassword = lazy(() => import("@/module/admin/pages/auth/AdminForgotPassword"))

// Delivery Module
const DeliveryV2Router = lazy(() => import("@/module/deliveryV2"))
const DeliveryChallenges = lazy(() => import("@/module/delivery/pages/Challenges"))

function UserPathRedirect() {
  const location = useLocation()
  const newPath = useMemo(
    () => location.pathname.replace(/^\/user/, "") || "/",
    [location.pathname]
  )
  return <Navigate to={newPath} replace />
}

const LoaderFallback = <Loader />

export default function App() {
  return (
    <Suspense fallback={<Loader />}>
      <FaviconManager />
      <Routes>
        <Route path="/user" element={<Navigate to="/" replace />} />
        <Route path="/user/*" element={<UserPathRedirect />} />
        {/* Removed /routes route - Home should be accessed through UserRouter */}

        {/* Restaurant Public Routes */}
        <Route path="/restaurant/welcome" element={<RestaurantWelcome />} />
        <Route path="/restaurant/auth/sign-in" element={<RestaurantSignIn />} />
        <Route path="/restaurant/login" element={<RestaurantLogin />} />
        <Route path="/restaurant/signup" element={<RestaurantSignup />} />
        <Route path="/restaurant/signup-email" element={<RestaurantSignupEmail />} />
        <Route path="/restaurant/forgot-password" element={<RestaurantForgotPassword />} />
        <Route path="/restaurant/otp" element={<RestaurantOTP />} />
        <Route path="/restaurant/auth/google-callback" element={<RestaurantGoogleCallback />} />
        <Route path="/restaurant/legal/terms" element={<RestaurantLegalTerms />} />
        <Route path="/restaurant/legal/privacy" element={<RestaurantLegalPrivacy />} />
        <Route path="/restaurant/support" element={<RestaurantLegalSupport />} />
        <Route path="/restaurant/legal/code-of-conduct" element={<RestaurantLegalCodeOfConduct />} />

        {/* Restaurant Protected Routes */}
        <Route path="/restaurant/onboarding" element={<RestaurantOnboarding />} />

        {/* Restaurant Protected Routes - Old Routes */}
        <Route
          path="/restaurant"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <OrdersMain />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/notifications"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RestaurantNotifications />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/notify-customers"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RestaurantNotificationRequest />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/orders/all"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <AllOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/orders/:orderId"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <OrderDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/edit"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <EditRestaurantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/food/:id"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <FoodDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/food/:id/edit"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <EditFoodPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/food/new"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <EditFoodPage />
            </ProtectedRoute>
          }
        />
        {/* Restaurant Protected Routes - Continued */}
        <Route
          path="/restaurant/advertisements"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <AdvertisementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/advertisements/new"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <NewAdvertisementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/advertisements/:id"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <AdDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/advertisements/:id/edit"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <EditAdvertisementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/rush-hour"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RushHour />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/menu-categories"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <MenuCategoriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/delivery-pricing"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <DeliveryPricing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/status"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RestaurantStatus />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/change-language"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RestaurantChangeLanguage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/explore"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ExploreMore />
            </ProtectedRoute>
          }
        />

        <Route path="/restaurant/switch-outlet" element={<Navigate to="/restaurant/explore" replace />} />
        <Route
          path="/restaurant/outlet-timings"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <OutletTimings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/outlet-timings/:day"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <DaySlots />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/outlet-info"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <OutletInfo />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/ratings-reviews"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RatingsReviews />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/contact-details"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ContactDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/edit-owner"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <EditOwner />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/invite-user"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <InviteUser />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/edit-cuisines"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <EditCuisines />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/inventory"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <Inventory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/feedback"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <Feedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/share-feedback"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ShareFeedback />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/dish-ratings"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <DishRatings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/help-centre"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <HelpCentre />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/fssai"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <FssaiDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/fssai/update"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <FssaiUpdate />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hyperpure"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <Hyperpure />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <HubGrowth />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <CreateOffers />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ChooseMenuDiscountType />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/freebies"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <CreateFreebies />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/freebies/timings"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <FreebiesTiming />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/percentage"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <CreatePercentageMenuDiscount />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/percentage/timings"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <MenuDiscountTiming />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/flat-price"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <CreateFlatPriceMenuDiscount />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/flat-price/timings"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <MenuDiscountTiming />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/bogo"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <CreateBOGOMenuDiscount />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/delight-customers/bogo/timings"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <MenuDiscountTiming />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/:goalId/:discountType/create"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <CreatePercentageDiscount />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-growth/create-offers/:goalId"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ChooseDiscountType />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-menu"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <HubMenu />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-menu/item/:id"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ItemDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/hub-finance"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <HubFinance />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/withdrawal-history"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <WithdrawalHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/finance-details"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <FinanceDetailsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/phone"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <PhoneNumbersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/download-report"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <DownloadReport />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/to-hub"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ToHub />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/manage-outlets"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ManageOutlets />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/update-bank-details"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <UpdateBankDetails />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/zone-setup"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <ZoneSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/subscription/checkout"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <SubscriptionCheckout />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/subscription"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <SubscriptionPlans />
            </ProtectedRoute>
          }
        />
        <Route
          path="/restaurant/challenges"
          element={
            <ProtectedRoute requiredRole="restaurant" loginPath="/restaurant/login">
              <RestaurantChallenges />
            </ProtectedRoute>
          }
        />
        {/* Delivery Public Routes */}
        <Route path="/food/delivery/*" element={<DeliveryV2Router />} />
        <Route path="/delivery/sign-in" element={<Navigate to="/food/delivery/login" replace />} />
        <Route path="/delivery/signup" element={<Navigate to="/food/delivery/signup" replace />} />
        <Route path="/delivery/otp" element={<Navigate to="/food/delivery/otp" replace />} />
        <Route path="/delivery/welcome" element={<Navigate to="/food/delivery/welcome" replace />} />
        <Route path="/delivery/terms" element={<Navigate to="/food/delivery/terms" replace />} />
        <Route path="/delivery/privacy" element={<Navigate to="/food/delivery/privacy" replace />} />
        <Route path="/delivery/support" element={<Navigate to="/food/delivery/support" replace />} />

        {/* Delivery Signup Routes (Protected - require authentication) */}
        <Route
          path="/delivery/signup/details"
          element={<Navigate to="/food/delivery/signup/details" replace />}
        />
        <Route
          path="/delivery/signup/documents"
          element={<Navigate to="/food/delivery/signup/documents" replace />}
        />

        {/* Delivery Protected Routes */}
        <Route path="/delivery/*" element={<DeliveryV2Router />} />

        {/* Admin Public Routes */}
        <Route path="/admin/login" element={<AuthRedirect module="admin"><AdminLogin /></AuthRedirect>} />
        <Route path="/admin/signup" element={<AuthRedirect module="admin"><AdminSignup /></AuthRedirect>} />
        <Route path="/admin/forgot-password" element={<AuthRedirect module="admin"><AdminForgotPassword /></AuthRedirect>} />

        {/* Admin Protected Routes */}
        <Route
          path="/admin/*"
          element={
            <ProtectedRoute requiredRole="admin" loginPath="/admin/login">
              <AdminRouter />
            </ProtectedRoute>
          }
        />

        <Route
          path="/*"
          element={<UserRouter />}
        />
      </Routes>
    </Suspense>
  )
}
