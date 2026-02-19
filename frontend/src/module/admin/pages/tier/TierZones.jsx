import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { tierAPI } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Store } from "lucide-react";

export default function TierZones() {
    const { id } = useParams(); // tierId
    const [zones, setZones] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        fetchZones();
    }, [id]);

    const fetchZones = async () => {
        try {
            setLoading(true);
            const res = await tierAPI.getZonesByTier(id);
            if (res.data.success) {
                setZones(res.data.data);
            }
        } catch (error) {
            console.error("Error fetching zones:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
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
                    <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Zones in Tier</h1>
                    <p className="text-neutral-500 text-sm">Zones classified under this tier rule</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Classified Zones ({zones.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Zone Name</TableHead>
                                <TableHead>Location</TableHead>
                                <TableHead>Area Size</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {zones.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-neutral-500">
                                        No zones found in this tier.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                zones.map((zone) => (
                                    <TableRow key={zone._id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => navigate(`/admin/tiers/zones/${zone._id}/restaurants`)}>
                                        <TableCell className="font-medium">{zone.name}</TableCell>
                                        <TableCell>{zone.serviceLocation}</TableCell>
                                        <TableCell>{zone.area} km²</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="text-orange-600 hover:text-orange-700 hover:bg-orange-50">
                                                View Restaurants <Store className="w-4 h-4 ml-2" />
                                            </Button>
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
