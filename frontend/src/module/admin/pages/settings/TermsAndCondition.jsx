import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyEditor from "./PolicyEditor";

export default function TermsAndCondition() {
  return (
    <PolicyEditor
      endpoint={API_ENDPOINTS.ADMIN.TERMS}
      pageTitle="Terms And Condition"
      pageSubtitle="Manage your Terms and Conditions content"
      placeholder="Enter terms and conditions content..."
      loadErrorMessage="Failed to load terms and conditions"
      saveSuccessMessage="Terms and conditions updated successfully"
      saveErrorMessage="Failed to save terms and conditions"
      defaultTitle="Terms and Conditions"
      policyKey="terms"
      allowedModules={["user", "restaurant", "delivery"]}
    />
  );
}
