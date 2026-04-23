import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyEditor from "./PolicyEditor";

export default function ShippingPolicy() {
  return (
    <PolicyEditor
      endpoint={API_ENDPOINTS.ADMIN.SHIPPING}
      pageTitle="Shipping Policy"
      pageSubtitle="Manage your Shipping Policy content"
      placeholder="Enter shipping policy content..."
      loadErrorMessage="Failed to load shipping policy"
      saveSuccessMessage="Shipping policy updated successfully"
      saveErrorMessage="Failed to save shipping policy"
      defaultTitle="Shipping Policy"
      policyKey="shipping"
      allowedModules={["user"]}
    />
  );
}
