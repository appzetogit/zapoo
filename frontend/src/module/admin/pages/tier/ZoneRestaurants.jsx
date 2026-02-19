import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { tierAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Star, TrendingUp, TrendingDown, Filter } from "lucide-react";

export default function ZoneRestaurants() {
    const { zoneId } = useParams();
    const [data, setData] = useState({ zone: null, restaurants: [], meta: {} });
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("all");
    const navigate = useNavigate();

    useEffect(() => {
        fetchRestaurants();
    }, [zoneId, filter]);

    const fetchRestaurants = async () => {
        try {
            setLoading(true);
            const filterParam = filter !== "all" ? filter : null;
            const res = await tierAPI.getRestaurantsByZone(zoneId, filterParam);
            if (res.data.success) {
                setData(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching restaurants:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading && !data.zone) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
                        {data.zone ? `${data.zone.name} Restaurants` : "Zone Restaurants"}
                    </h1>
                    <p className="text-neutral-500 text-sm">
                        Performance analysis for restaurants in this zone
                    </p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white border-neutral-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-500">Average Revenue</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">₹{data.meta?.avgRevenue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || 0}</div>
                        <p className="text-xs text-neutral-500 mt-1">Zone Average Revenue</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-neutral-200">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-neutral-500">Total Restaurants</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.meta?.totalRestaurants || 0}</div>
                        <p className="text-xs text-neutral-500 mt-1">Active in this zone</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Restaurant Performance</CardTitle>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-neutral-500" />
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Filter Performance" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Restaurants</SelectItem>
                                <SelectItem value="best">Best Performing</SelectItem>
                                <SelectItem value="underperforming">Underperforming</SelectItem>
                                <SelectItem value="average">Average</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Restaurant</TableHead>
                                <TableHead>Owner</TableHead>
                                <TableHead>Rating</TableHead>
                                <TableHead>Total Orders</TableHead>
                                <TableHead>Total Revenue</TableHead>
                                <TableHead>Performance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto text-orange-600" />
                                    </TableCell>
                                </TableRow>
                            ) : data.restaurants?.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-8 text-neutral-500">
                                        No restaurants found matching the criteria.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                (data.restaurants || []).map((restaurant) => (
                                    <TableRow key={restaurant._id}>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-neutral-100 overflow-hidden">
                                                    <img src={restaurant.image || '/placeholder.png'} alt="" className="w-full h-full object-cover" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-neutral-900">{restaurant.name}</div>
                                                    <div className="text-xs text-neutral-500">{restaurant.location?.address}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">{restaurant.ownerName}</div>
                                            <div className="text-xs text-neutral-500">{restaurant.ownerPhone}</div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                                <span className="font-medium">{restaurant.rating || 0}</span>
                                                <span className="text-xs text-neutral-400">({restaurant.totalRatings || 0})</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{restaurant.metrics?.orders || 0}</TableCell>
                                        <TableCell className="font-medium">₹{restaurant.metrics?.revenue?.toLocaleString('en-IN') || 0}</TableCell>
                                        <TableCell>
                                            {restaurant.metrics?.performance === 'best' && (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    <TrendingUp className="w-3 h-3 mr-1" /> Best Performing
                                                </Badge>
                                            )}
                                            {restaurant.metrics?.performance === 'underperforming' && (
                                                <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-red-200">
                                                    <TrendingDown className="w-3 h-3 mr-1" /> Underperforming
                                                </Badge>
                                            )}
                                            {restaurant.metrics?.performance === 'average' && (
                                                <Badge variant="secondary" className="bg-neutral-100 text-neutral-600">Average</Badge>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
