import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyPageTemplate from "./PolicyPageTemplate";

export default function TermsPage() {
  return (
    <PolicyPageTemplate
      title="Terms of Service"
      endpoint={API_ENDPOINTS.ADMIN.TERMS_PUBLIC}
    />
  );
}
