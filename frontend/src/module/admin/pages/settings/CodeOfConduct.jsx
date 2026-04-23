import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyEditor from "./PolicyEditor";

export default function CodeOfConduct() {
  return (
    <PolicyEditor
      endpoint={API_ENDPOINTS.ADMIN.CODE_OF_CONDUCT}
      pageTitle="Code of Conduct"
      pageSubtitle="Manage your Code of Conduct content"
      placeholder="Enter code of conduct content..."
      loadErrorMessage="Failed to load code of conduct"
      saveSuccessMessage="Code of conduct updated successfully"
      saveErrorMessage="Failed to save code of conduct"
      defaultTitle="Code of Conduct"
      policyKey="code-of-conduct"
      allowedModules={["restaurant"]}
    />
  );
}
