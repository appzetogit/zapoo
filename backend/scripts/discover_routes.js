import app from '../server.js';
import fs from 'fs';

/**
 * Recursively extract routes from Express router
 */
function getRoutes(stack, prefix = '') {
    const routes = [];
    stack.forEach(layer => {
        if (layer.route) {
            // Direct route
            const methods = Object.keys(layer.route.methods).map(m => m.toUpperCase());
            routes.push({
                method: methods.join(','),
                path: prefix + layer.route.path
            });
        } else if (layer.name === 'router' && layer.handle.stack) {
            // Sub-router
            const newPrefix = prefix + (layer.regexp.source.replace('\\/?(?=\\/|$)', '').replace('^', '').replace('\\/', '/').replace('\\', ''));
            routes.push(...getRoutes(layer.handle.stack, newPrefix));
        }
    });
    return routes;
}

const allRoutes = getRoutes(app._router.stack);

// Deduplicate and filter out internal express routes
const filteredRoutes = allRoutes.filter(r => !r.path.includes('socket.io') && r.path !== '*');

console.log(`Found ${filteredRoutes.length} routes.`);

// Write to JSON for the benchmark suite to consume
fs.writeFileSync('discovered_routes.json', JSON.stringify(filteredRoutes, null, 2));

console.log('Routes saved to discovered_routes.json');
process.exit(0);
