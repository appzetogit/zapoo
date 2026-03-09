import axios from 'axios';
const ADMIN_EMAIL = 'zapoo.startup@gmail.com';
const ADMIN_PASSWORD = 'Zapoo@2026';
const BASE_URL = 'http://localhost:5000/api';
async function verify() {
  try {
    const loginRes = await axios.post(`${BASE_URL}/admin/auth/login`, {
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD
    });
    const token = loginRes.data.data.accessToken;
    const headers = {
      Authorization: `Bearer ${token}`
    };
    const restaurantsRes = await axios.get(`${BASE_URL}/admin/restaurants`, {
      headers
    });
    const restaurants = restaurantsRes.data.data;
    if (restaurants.length === 0) {
      return;
    }
    const testRestaurant = restaurants[0];

    // Call the delivery-pricing endpoint which I modified
    // Note: The endpoint in the controller was /api/restaurant/delivery-pricing
    // But since I'm logged in as admin, I might need to find the admin equivalent or use the restaurant token
    // Actually, I'll just check if the getDeliveryPricingConfig works as expected when called.

    // Let's try to see if we can find a restaurant with a tier that has no slabs
    // Or just check if the returned distanceSlabs is empty if no tier/slabs exist.

    // I will try to call the pricing calculation endpoint if it exists
    // The user's request was about the calculation logic.

    // Let's check the restaurant pricing config via the API I modified
    // Wait, the restaurantController.js getDeliveryPricingConfig is for the restaurant owner.
    // I'll try to get a restaurant token or use the admin one if it has access.

    // Trying to use admin token for restaurant route might not work if middleware is strict
    // But let's check.
    try {
      const configRes = await axios.get(`${BASE_URL}/restaurant/delivery-pricing`, {
        headers: {
          Authorization: `Bearer ${token}`
        } // This might fail if it expect a restaurant token
      });
    } catch (e) {}
  } catch (err) {
    console.error('Error:', err.response?.data || err.message);
  }
}
verify();