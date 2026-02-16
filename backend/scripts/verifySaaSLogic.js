
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import SubscriptionPlan from '../modules/admin/models/SubscriptionPlan.js';
import Restaurant from '../modules/restaurant/models/Restaurant.js';
import { calculateOrderPricing } from '../modules/order/services/orderCalculationService.js';
import { calculateOrderSettlement } from '../modules/order/services/orderSettlementService.js';

async function verify() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected.');

        console.log('\n--- 1. Verification: Subscription Plans ---');
        const plans = await SubscriptionPlan.find({ isActive: true });
        console.log(`Found ${plans.length} active plans.`);
        if (plans.length === 0) throw new Error("No plans found!");
        console.log('Sample Plan:', plans[0].name, '-', plans[0].price);

        console.log('\n--- 2. Verification: Order Pricing Logic ---');
        // Mock Data
        const mockItems = [{ price: 100, quantity: 2 }]; // Subtotal 200
        const mockRestaurant = {
            _id: new mongoose.Types.ObjectId(),
            name: "Test Restro",
            location: { coordinates: [77.2090, 28.6139] }, // New Delhi
            gst: { isRegistered: true }
        };
        const mockAddressShort = { location: { coordinates: [77.2190, 28.6139] } }; // ~1km away
        const mockAddressFar = { location: { coordinates: [77.3090, 28.6139] } }; // ~10km away

        // Case A: Short Distance (0-3km) -> Expect ₹20 Delivery
        const pricingA = await calculateOrderPricing({
            items: mockItems,
            restaurantId: mockRestaurant._id, // Mock pass, function might refetch but we can mock that too if needed. 
            // Actually calculateOrderPricing fetches restaurant by ID. We need a real restaurant or mock the service.
            // For this script, lets just rely on the pure math logic if exported, or create a temp restaurant.
        });
        // Since calculateOrderPricing fetches DB, we better create a temp restaurant.

        // Create Temp Restaurant
        const tempRestro = await Restaurant.create({
            name: "Verification Restaurant",
            ownerName: "Verify Owner",
            email: `verify_${Date.now()}@test.com`,
            password: "password123",
            phone: "9999999999",
            ownerPhone: "9999999999",
            businessModel: "Commission Base", // Start with commission
            commissionRate: 20,
            location: {
                type: "Point",
                coordinates: [77.2090, 28.6139],
                address: "Connaught Place, New Delhi"
            },
            gst: { isRegistered: true, number: "GST123" }
        });

        console.log('Created Temp Restaurant:', tempRestro._id);

        const pricingShort = await calculateOrderPricing({
            items: mockItems,
            restaurantId: tempRestro._id,
            deliveryAddress: { location: { coordinates: [77.2120, 28.6139] } } // ~300m
        });

        console.log('Pricing (Short Dist):', pricingShort);
        if (pricingShort.deliveryFee !== 20) console.error("❌ Delivery Fee mismatch for short distance. Expected 20, got", pricingShort.deliveryFee);
        else console.log("✅ Delivery Fee correct for short distance (20)");

        if (pricingShort.platformFee < 5) console.error("❌ Platform Fee too low. Expected min 5.");
        else console.log("✅ Platform Fee correct (>= 5)");

        const pricingFar = await calculateOrderPricing({
            items: mockItems,
            restaurantId: tempRestro._id,
            deliveryAddress: { location: { coordinates: [77.3090, 28.6139] } } // ~10km
        });
        // 10km > 9km. Fee = 30 + (10-9)*10 = 40.
        console.log('Pricing (Far Dist ~10km):', pricingFar.deliveryFee);

        console.log('\n--- 3. Verification: Commission vs Subscription ---');

        // Case 1: Commission Base
        const settlementComm = await calculateOrderSettlement({
            orderId: "mock_order_1",
            restaurantId: tempRestro._id,
            paymentMethod: "online",
            paymentStatus: "completed",
            subtotal: 200,
            total: 250, // rough
            deliveryFee: 20,
            platformFee: 5,
            tax: 10,
            discount: 0
        });
        console.log('Settlement (Commission Base):', settlementComm.restaurant.commission);

        // Case 2: Subscription Base
        tempRestro.businessModel = "Subscription Base";
        await tempRestro.save();

        const settlementSub = await calculateOrderSettlement({
            orderId: "mock_order_2",
            restaurantId: tempRestro._id,
            paymentMethod: "online",
            paymentStatus: "completed",
            subtotal: 200,
            total: 250,
            deliveryFee: 20,
            platformFee: 5,
            tax: 10,
            discount: 0
        });
        console.log('Settlement (Subscription Base):', settlementSub.restaurant.commission);

        if (settlementSub.restaurant.commission === 0) console.log("✅ Zero Commission for Subscription model confirmed.");
        else console.error("❌ Commission charged for Subscription model!");

        // Cleanup
        await Restaurant.findByIdAndDelete(tempRestro._id);
        console.log('\n✅ Verification Complete. Temp data cleaned up.');

    } catch (err) {
        console.error('❌ Verification Failed:', err);
    } finally {
        await mongoose.connection.close();
    }
}

verify();
