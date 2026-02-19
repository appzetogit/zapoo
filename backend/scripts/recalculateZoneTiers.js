
import mongoose from 'mongoose';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const require = createRequire(import.meta.url);
const area = require('@turf/area');
const { polygon } = require('@turf/helpers');

// Load env vars
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

// Define Minimal Schemas Locally to avoid import issues
const tierSchema = new mongoose.Schema({
    name: String,
    minArea: Number,
    maxArea: Number,
    rank: Number,
    deliveryPricing: {
        baseFee: Number,
        freeDeliveryThreshold: Number
    }
});
const Tier = mongoose.models.Tier || mongoose.model('Tier', tierSchema);

const coordinateSchema = new mongoose.Schema({
    latitude: Number,
    longitude: Number
}, { _id: false });

const zoneSchema = new mongoose.Schema({
    name: String,
    zoneName: String,
    coordinates: [coordinateSchema],
    area: Number,
    tierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Tier' },
    deliveryPricing: {
        baseFee: Number,
        freeDeliveryThreshold: Number,
        isOverridden: { type: Boolean, default: false },
        lastUpdated: Date
    },
    boundary: Object
});

// Pre-save logic copied manually
zoneSchema.pre('save', async function (next) {
    try {
        if (this.coordinates && this.coordinates.length >= 3) {
            const geoJsonCoords = this.coordinates.map(coord => [coord.longitude, coord.latitude]);
            if (geoJsonCoords[0][0] !== geoJsonCoords[geoJsonCoords.length - 1][0] ||
                geoJsonCoords[0][1] !== geoJsonCoords[geoJsonCoords.length - 1][1]) {
                geoJsonCoords.push(geoJsonCoords[0]);
            }

            this.boundary = {
                type: 'Polygon',
                coordinates: [geoJsonCoords]
            };

            const poly = polygon([geoJsonCoords]);
            const areaInSqMeters = area(poly);
            const areaInSqKm = areaInSqMeters / 1000000;
            this.area = parseFloat(areaInSqKm.toFixed(2));

            // Re-fetch Tier
            const tier = await Tier.findOne({
                minArea: { $lte: this.area },
                maxArea: { $gte: this.area }
            }).sort({ rank: 1 });

            if (tier) {
                this.tierId = tier._id;
                if (!this.deliveryPricing || !this.deliveryPricing.isOverridden) {
                    if (tier.deliveryPricing) {
                        this.deliveryPricing = {
                            baseFee: tier.deliveryPricing.baseFee !== undefined ? tier.deliveryPricing.baseFee : 0,
                            freeDeliveryThreshold: tier.deliveryPricing.freeDeliveryThreshold !== undefined ? tier.deliveryPricing.freeDeliveryThreshold : 0,
                            isOverridden: false,
                            lastUpdated: new Date()
                        };
                    } else {
                        // Default to 0 if tier has no pricing object
                        this.deliveryPricing = {
                            baseFee: 0,
                            freeDeliveryThreshold: 0,
                            isOverridden: false,
                            lastUpdated: new Date()
                        };
                    }
                }
            } else {
                this.tierId = null;
            }
        }
        next();
    } catch (error) {
        next(error);
    }
});

const Zone = mongoose.models.Zone || mongoose.model('Zone', zoneSchema);

const recalculate = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('Connected to MongoDB');

        const zones = await Zone.find({});
        console.log(`Found ${zones.length} zones.`);

        for (const zone of zones) {
            try {
                console.log(`Processing: ${zone.name || zone.zoneName}`);
                await zone.save();
                console.log(`  > Area: ${zone.area}, Tier: ${zone.tierId}`);
            } catch (innerError) {
                console.error(`Failed to process zone ${zone._id}:`, innerError.message);
                if (innerError.errors) {
                    Object.keys(innerError.errors).forEach(key => {
                        console.error(`  Validation Error on ${key}: ${innerError.errors[key].message}`);
                    });
                }
            }
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error during recalculation:');
        console.error(error); // Log full object
        if (error.errors) {
            Object.keys(error.errors).forEach(key => {
                console.error(`Validation Error on ${key}: ${error.errors[key].message}`);
            });
        }
        process.exit(1);
    }
};

recalculate();
