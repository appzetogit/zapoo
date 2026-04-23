import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyPageTemplate from "./PolicyPageTemplate";

export default function CodeOfConductPage() {
  return (
    <PolicyPageTemplate
      title="Code of Conduct"
      endpoint={API_ENDPOINTS.ADMIN.CODE_OF_CONDUCT_PUBLIC}
    />
  );
}

