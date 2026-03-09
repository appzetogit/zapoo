import axios from 'axios';

async function testRestaurantReport() {
    try {
        const response = await axios.get('http://localhost:5000/api/admin/orders/restaurant-report', {
            headers: {
                // We might need an admin token here if the route is protected
                // But let's see if it rejects or returns something
            }
        });
        console.log('Response status:', response.status);
        console.log('Response data:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error:', error.message);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

testRestaurantReport();
