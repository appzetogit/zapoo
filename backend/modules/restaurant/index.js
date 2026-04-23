// Restaurant module
import express from 'express';
import { authenticate } from './middleware/restaurantAuth.js';
import { uploadMiddleware } from '../../shared/utils/cloudinaryService.js';
import restaurantAuthRoutes from './routes/restaurantAuthRoutes.js';
import { validate } from '../../shared/middleware/validate.js';
import Joi from 'joi';
import { getOnboarding, upsertOnboarding, createRestaurantFromOnboardingManual } from './controllers/restaurantOnboardingController.js';
import { getRestaurants, getRestaurantById, getRestaurantByOwner, updateRestaurantProfile, uploadProfileImage, uploadMenuImage, deleteRestaurantAccount, updateDeliveryStatus, getRestaurantsWithDishesUnder250, getDeliveryPricingConfig, updateDeliveryPricingConfig, getRestaurantPreferences, updateRestaurantPreferences } from './controllers/restaurantController.js';
import { getRestaurantFinance } from './controllers/restaurantFinanceController.js';
import { getRestaurantAnalytics } from './controllers/analyticsController.js';
import { getWallet, getWalletTransactions, getWalletStats } from './controllers/restaurantWalletController.js';
import { createWithdrawalRequest, getRestaurantWithdrawalRequests } from './controllers/withdrawalController.js';
import { getMyChallenges } from './controllers/restaurantChallengeController.js';
import { getMenu, updateMenu, getMenuByRestaurantId, addSection, addItemToSection, addSubsectionToSection, addItemToSubsection, addAddon, getAddons, getAddonsByRestaurantId, updateAddon, deleteAddon } from './controllers/menuController.js';
import { scheduleItemAvailability, cancelScheduledAvailability, getItemSchedule } from './controllers/menuScheduleController.js';
import { getInventory, updateInventory, getInventoryByRestaurantId } from './controllers/inventoryController.js';
import { addStaff, getStaff, getStaffById, updateStaff, deleteStaff } from './controllers/staffManagementController.js';
import { createOffer, getOffers, getOfferById, updateOfferStatus, deleteOffer, getCouponsByItemId, getCouponsByItemIdPublic, getPublicOffers, getOfferPerformance } from './controllers/offerController.js';
import { getRecommendedPreview } from './controllers/recommendedPreviewController.js';
import categoryRoutes from './routes/categoryRoutes.js';
import restaurantOrderRoutes from './routes/restaurantOrderRoutes.js';
import outletTimingsRoutes from './routes/outletTimingsRoutes.js';
import complaintRoutes from './routes/complaintRoutes.js';
import { getOutletTimingsByRestaurantId } from './controllers/outletTimingsController.js';
import { requestRMCall, getRMCallHistory } from './controllers/relationshipManagerController.js';
import { checkFeatureAccess } from './middleware/subscriptionGuard.js';

const router = express.Router();

// Validation schemas
const onboardingSchema = Joi.object({
    step1: Joi.object({
        restaurantName: Joi.string().required(),
        ownerName: Joi.string().required(),
        ownerEmail: Joi.string().email().required(),
        ownerPhone: Joi.string().required(),
        primaryContactNumber: Joi.string().required(),
        location: Joi.object().optional()
    }).optional(),
    step2: Joi.object().optional(),
    step3: Joi.object({
        pan: Joi.object({
            panNumber: Joi.string().uppercase().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required(),
            nameOnPan: Joi.string().required(),
            image: Joi.object().required()
        }).required(),
        gst: Joi.object({
            isRegistered: Joi.boolean().required(),
            gstNumber: Joi.string().allow('', null).when('isRegistered', {
                is: true,
                then: Joi.string().uppercase().pattern(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/).required()
            }),
            legalName: Joi.string().allow('', null).when('isRegistered', { is: true, then: Joi.required() }),
            address: Joi.string().allow('', null).when('isRegistered', { is: true, then: Joi.required() }),
            image: Joi.object().allow(null).when('isRegistered', { is: true, then: Joi.required() })
        }).required(),
        fssai: Joi.object({
            registrationNumber: Joi.string().pattern(/^\d{14}$/).required(),
            expiryDate: Joi.string().required(),
            image: Joi.object().required()
        }).required(),
        bank: Joi.object({
            accountNumber: Joi.string().pattern(/^\d{9,18}$/).required(),
            ifscCode: Joi.string().uppercase().pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required(),
            accountHolderName: Joi.string().required(),
            accountType: Joi.string().required()
        }).required()
    }).optional(),
    step4: Joi.object().optional(),
    completedSteps: Joi.number().optional()
});

// Restaurant authentication routes
router.use('/auth', restaurantAuthRoutes);

// Onboarding routes for restaurant (authenticated)
router.get('/onboarding', authenticate, getOnboarding);
router.put('/onboarding', authenticate, validate(onboardingSchema), upsertOnboarding);
router.post('/onboarding/create-restaurant', authenticate, createRestaurantFromOnboardingManual);

// Menu routes (authenticated - for restaurant module)
router.get('/menu', authenticate, checkFeatureAccess('menu_control'), getMenu);
router.put('/menu', authenticate, checkFeatureAccess('menu_control'), updateMenu);
router.post('/menu/section', authenticate, checkFeatureAccess('menu_control'), addSection);
router.post('/menu/section/item', authenticate, checkFeatureAccess('menu_control'), addItemToSection);
router.post('/menu/section/subsection', authenticate, checkFeatureAccess('menu_control'), addSubsectionToSection);
router.post('/menu/subsection/item', authenticate, checkFeatureAccess('menu_control'), addItemToSubsection);

// Add-on routes
router.post('/menu/addon', authenticate, checkFeatureAccess('menu_control'), addAddon);
router.get('/menu/addons', authenticate, checkFeatureAccess('menu_control'), getAddons);
router.put('/menu/addon/:id', authenticate, checkFeatureAccess('menu_control'), updateAddon);
router.delete('/menu/addon/:id', authenticate, checkFeatureAccess('menu_control'), deleteAddon);

// Menu item scheduling routes
router.post('/menu/item/schedule', authenticate, checkFeatureAccess('menu_control'), scheduleItemAvailability);
router.delete('/menu/item/schedule/:scheduleId', authenticate, checkFeatureAccess('menu_control'), cancelScheduledAvailability);
router.get('/menu/item/schedule/:sectionId/:itemId', authenticate, checkFeatureAccess('menu_control'), getItemSchedule);

// Inventory routes (authenticated - for restaurant module)
router.get('/inventory', authenticate, getInventory);
router.put('/inventory', authenticate, updateInventory);

// Category routes (authenticated - for restaurant module)
router.use('/categories', categoryRoutes);

// Offer routes (authenticated - for restaurant module)
router.post('/offers', authenticate, checkFeatureAccess('marketing_tools'), createOffer);
router.get('/offers', authenticate, checkFeatureAccess('marketing_tools'), getOffers);
router.get('/offers/performance', authenticate, checkFeatureAccess('marketing_tools'), getOfferPerformance);
router.get('/offers/item/:itemId/coupons', authenticate, checkFeatureAccess('marketing_tools'), getCouponsByItemId);
// Public offers route - must come before /offers/:id to avoid route conflict
router.get('/offers/public', getPublicOffers);
router.get('/offers/:id', authenticate, checkFeatureAccess('marketing_tools'), getOfferById);
router.put('/offers/:id/status', authenticate, checkFeatureAccess('marketing_tools'), updateOfferStatus);
router.delete('/offers/:id', authenticate, checkFeatureAccess('marketing_tools'), deleteOffer);

// Staff Management routes (authenticated - for restaurant module)
// Must come before /:id to avoid route conflicts
router.post('/staff', authenticate, uploadMiddleware.single('photo'), addStaff);
router.get('/staff', authenticate, getStaff);
router.get('/staff/:id', authenticate, getStaffById);
router.put('/staff/:id', authenticate, updateStaff);
router.delete('/staff/:id', authenticate, deleteStaff);

// Order routes (authenticated - for restaurant module)
// Must come BEFORE /:id route to avoid route conflicts (/:id would match /orders)
router.use('/', restaurantOrderRoutes);

// Complaint routes (authenticated - for restaurant module)
router.use('/complaints', complaintRoutes);

// Finance routes (authenticated - for restaurant module)
// Must come BEFORE /:id route to avoid route conflicts (/:id would match /finance)
router.get('/finance', authenticate, checkFeatureAccess('basic_reports'), getRestaurantFinance);
router.get('/analytics', authenticate, checkFeatureAccess('basic_reports'), getRestaurantAnalytics);

// Wallet routes (authenticated - for restaurant module)
// Must come BEFORE /:id route to avoid route conflicts (/:id would match /wallet)
router.get('/wallet', authenticate, checkFeatureAccess('basic_reports'), getWallet);
router.get('/wallet/transactions', authenticate, checkFeatureAccess('basic_reports'), getWalletTransactions);
router.get('/wallet/stats', authenticate, checkFeatureAccess('basic_reports'), getWalletStats);
router.get('/challenges', authenticate, checkFeatureAccess('basic_reports'), getMyChallenges);

// Withdrawal routes (authenticated - for restaurant module)
router.post('/withdrawal/request', authenticate, checkFeatureAccess('basic_reports'), createWithdrawalRequest);
router.get('/withdrawal/requests', authenticate, checkFeatureAccess('basic_reports'), getRestaurantWithdrawalRequests);
router.get('/delivery-pricing', authenticate, checkFeatureAccess('basic_reports'), getDeliveryPricingConfig);
router.put('/delivery-pricing', authenticate, checkFeatureAccess('basic_reports'), updateDeliveryPricingConfig);

// Relationship Manager routes (authenticated - for GROWTH/EXECUTIVE plans)
router.post('/rm/request-call', authenticate, checkFeatureAccess('relationship_manager'), requestRMCall);
router.get('/rm/call-history', authenticate, checkFeatureAccess('relationship_manager'), getRMCallHistory);

// Restaurant routes (public - for user module)
router.get('/list', getRestaurants);
router.get('/under-250', getRestaurantsWithDishesUnder250);
router.post('/recommended-preview', getRecommendedPreview);

// Restaurant routes (authenticated - for restaurant module)
router.get('/owner/me', authenticate, getRestaurantByOwner);

// Profile routes (authenticated - for restaurant module)
router.put('/profile', authenticate, updateRestaurantProfile);
router.get('/preferences', authenticate, getRestaurantPreferences);
router.put('/preferences', authenticate, validate(Joi.object({
    language: Joi.string().valid('en', 'hi', 'bn').required()
})), updateRestaurantPreferences);
router.delete('/profile', authenticate, deleteRestaurantAccount);
router.post('/profile/image', authenticate, uploadMiddleware.single('file'), uploadProfileImage);
router.post('/profile/menu-image', authenticate, uploadMiddleware.single('file'), uploadMenuImage);

// Delivery status route (authenticated - for restaurant module)
router.put('/delivery-status', authenticate, updateDeliveryStatus);

// Menu and inventory routes must come before /:id to avoid route conflicts
router.get('/:restaurantId/offers/item/:itemId/coupons', getCouponsByItemIdPublic);
router.get('/:restaurantId/outlet-timings', getOutletTimingsByRestaurantId);
router.get('/:id/menu', getMenuByRestaurantId);
router.get('/:id/addons', getAddonsByRestaurantId);
router.get('/:id/inventory', getInventoryByRestaurantId);
router.get('/:id', getRestaurantById);

// Outlet Timings routes (authenticated - for restaurant module)
// Must come after all /:id routes to avoid route conflicts
router.use('/', outletTimingsRoutes);

export default router;
