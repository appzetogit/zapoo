import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyPageTemplate from "./PolicyPageTemplate";

export default function PrivacyPage() {
  return (
    <PolicyPageTemplate
      title="Privacy Policy"
      endpoint={API_ENDPOINTS.ADMIN.PRIVACY_PUBLIC}
    />
  );
}

