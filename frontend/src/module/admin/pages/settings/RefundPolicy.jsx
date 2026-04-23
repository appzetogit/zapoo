import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyEditor from "./PolicyEditor";

export default function RefundPolicy() {
  return (
    <PolicyEditor
      endpoint={API_ENDPOINTS.ADMIN.REFUND}
      pageTitle="Refund Policy"
      pageSubtitle="Manage your Refund Policy content"
      placeholder="Enter refund policy content..."
      loadErrorMessage="Failed to load refund policy"
      saveSuccessMessage="Refund policy updated successfully"
      saveErrorMessage="Failed to save refund policy"
      defaultTitle="Refund Policy"
      policyKey="refund"
      allowedModules={["user"]}
    />
  );
}
