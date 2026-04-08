import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyEditor from "./PolicyEditor";

export default function PrivacyPolicy() {
  return (
    <PolicyEditor
      endpoint={API_ENDPOINTS.ADMIN.PRIVACY}
      pageTitle="Privacy Policy"
      pageSubtitle="Manage your Privacy Policy content"
      placeholder="Enter privacy policy content..."
      loadErrorMessage="Failed to load privacy policy"
      saveSuccessMessage="Privacy policy updated successfully"
      saveErrorMessage="Failed to save privacy policy"
      defaultTitle="Privacy Policy"
    />
  );
}
