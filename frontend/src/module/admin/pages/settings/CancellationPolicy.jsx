import { API_ENDPOINTS } from "@/lib/api/config";
import PolicyEditor from "./PolicyEditor";

export default function CancellationPolicy() {
  return (
    <PolicyEditor
      endpoint={API_ENDPOINTS.ADMIN.CANCELLATION}
      pageTitle="Cancellation Policy"
      pageSubtitle="Manage your Cancellation Policy content"
      placeholder="Enter cancellation policy content..."
      loadErrorMessage="Failed to load cancellation policy"
      saveSuccessMessage="Cancellation policy updated successfully"
      saveErrorMessage="Failed to save cancellation policy"
      defaultTitle="Cancellation Policy"
    />
  );
}
