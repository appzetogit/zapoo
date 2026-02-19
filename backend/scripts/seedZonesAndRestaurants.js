
import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Zone from "../modules/admin/models/Zone.js";
import Restaurant from "../modules/restaurant/models/Restaurant.js";

// Setup environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected");
    } catch (err) {
        console.error("❌ MongoDB Connection Error:", err);
        process.exit(1);
    }
};

const zonesData = [
    {
        name: "Delhi Central",
        location: "Delhi",
        coordinates: [
            { latitude: 28.6139, longitude: 77.2090 },
            { latitude: 28.6448, longitude: 77.2167 },
            { latitude: 28.6448, longitude: 77.2410 },
            { latitude: 28.6139, longitude: 77.2410 },
            { latitude: 28.6139, longitude: 77.2090 }
        ]
    },
    {
        name: "Mumbai South",
        location: "Mumbai",
        coordinates: [
            { latitude: 18.9220, longitude: 72.8347 },
            { latitude: 18.9540, longitude: 72.8340 },
            { latitude: 18.9540, longitude: 72.8550 },
            { latitude: 18.9220, longitude: 72.8550 },
            { latitude: 18.9220, longitude: 72.8347 }
        ]
    },
    {
        name: "Bangalore Indiranagar",
        location: "Bangalore",
        coordinates: [
            { latitude: 12.9716, longitude: 77.6412 },
            { latitude: 12.9850, longitude: 77.6412 },
            { latitude: 12.9850, longitude: 77.6600 },
            { latitude: 12.9716, longitude: 77.6600 },
            { latitude: 12.9716, longitude: 77.6412 }
        ]
    }
];

const restaurantsData = [
    {
        name: "Spicy Delhi Bites",
        location: { latitude: 28.6200, longitude: 77.2150 },
        city: "Delhi",
        zoneName: "Delhi Central",
        cuisines: ["North Indian", "Mughlai"],
        ownerName: "Rajesh Kumar",
        email: "delhi.bites@example.com",
        phone: "+919876543210",
        ownerPhone: "+919876543210"
    },
    {
        name: "Mumbai Masala",
        location: { latitude: 18.9300, longitude: 72.8400 },
        city: "Mumbai",
        zoneName: "Mumbai South",
        cuisines: ["Maharashtrian", "Street Food"],
        ownerName: "Suresh Patil",
        email: "mumbai.masala@example.com",
        phone: "+919876543211",
        ownerPhone: "+919876543211"
    },
    {
        name: "Bangalore Brews",
        location: { latitude: 12.9780, longitude: 77.6500 },
        city: "Bangalore",
        zoneName: "Bangalore Indiranagar",
        cuisines: ["Continental", "Cafe"],
        ownerName: "Anita Rao",
        email: "bangalore.brews@example.com",
        phone: "+919876543212",
        ownerPhone: "+919876543212"
    }
];

const seedData = async () => {
    try {
        console.log("Starting data seeding...");

        // --- SEED ZONES ---
        console.log("Seeding Zones...");
        const createdZones = [];

        for (const zoneData of zonesData) {
            // Check if zone exists
            let zone = await Zone.findOne({ name: zoneData.name });
            if (!zone) {
                zone = await Zone.create({
                    name: zoneData.name,
                    coordinates: zoneData.coordinates,
                    serviceLocation: zoneData.location,
                    isActive: true
                });
                console.log(`✅ Created Zone: ${zone.name}`);
            } else {
                console.log(`ℹ️  Zone already exists: ${zone.name}`);
            }
            createdZones.push(zone);
        }

        // --- SEED RESTAURANTS ---
        console.log("Seeding Restaurants...");

        for (const resData of restaurantsData) {
            // Find corresponding zone
            const zone = createdZones.find(z => z.name === resData.zoneName);
            if (!zone) {
                console.warn(`⚠️  Zone not found for restaurant ${resData.name}, skipping...`);
                continue;
            }

            let restaurant = await Restaurant.findOne({ email: resData.email });
            if (!restaurant) {
                // GeoJSON point for restaurant location
                const geoJsonPoint = {
                    type: "Point",
                    coordinates: [resData.location.longitude, resData.location.latitude]
                };

                restaurant = await Restaurant.create({
                    name: resData.name,
                    email: resData.email,
                    phone: resData.phone,
                    ownerPhone: resData.ownerPhone,
                    ownerName: resData.ownerName,
                    cuisines: resData.cuisines,
                    zoneId: zone._id,
                    location: {
                        latitude: resData.location.latitude,
                        longitude: resData.location.longitude,
                        coordinates: [resData.location.longitude, resData.location.latitude], // GeoJSON
                        formattedAddress: `${resData.city}, India`,
                        city: resData.city,
                        country: "India"
                    },
                    isActive: true,
                    isAcceptingOrders: true
                });
                console.log(`✅ Created Restaurant: ${restaurant.name}`);
            } else {
                console.log(`ℹ️  Restaurant already exists: ${restaurant.name}`);
            }
        }

        console.log("✅ Seeding completed successfully!");
        process.exit(0);

    } catch (error) {
        console.error("❌ Seeding Error:", error);
        process.exit(1);
    }
};

connectDB().then(seedData);
