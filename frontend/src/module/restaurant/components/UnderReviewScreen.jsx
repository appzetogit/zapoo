import { Clock3, ShieldCheck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { clearModuleAuth } from "@/lib/utils/auth";
import { useCompanyName } from "@/lib/hooks/useCompanyName";

export default function UnderReviewScreen({ restaurantId }) {
  const navigate = useNavigate();
  const companyName = useCompanyName() || "Foodelo";

  const handleBackToLogin = () => {
    clearModuleAuth("restaurant");
    sessionStorage.removeItem("restaurant_onboarding_session");
    navigate("/restaurant/login", { replace: true });
  };

  return (
    <div className="min-h-screen w-full bg-[#EEF0F5] flex items-center justify-center px-3 py-6">
      <div className="w-full max-w-[340px] bg-white rounded-[28px] border border-[#E4E6EB] shadow-sm p-5 sm:max-w-md sm:rounded-[36px] sm:p-8">
        <div className="mx-auto h-20 w-20 rounded-[22px] bg-[#F7EEF9] flex items-center justify-center shadow-[0_14px_30px_-22px_rgba(236,210,98,0.9)] sm:h-28 sm:w-28 sm:rounded-[28px]">
          <Clock3 className="w-9 h-9 text-[#8A4B7E] sm:w-12 sm:h-12" />
        </div>

        <p className="text-center mt-5 text-[#7A3C72] text-[11px] tracking-[0.3em] font-bold uppercase sm:mt-7 sm:text-sm sm:tracking-[0.38em]">
          Verification Pending
        </p>
        <h1 className="text-center mt-1.5 text-[#070A23] text-[46px] font-extrabold leading-tight sm:mt-2 sm:text-4xl">
          Under Review
        </h1>

        <p className="text-center mt-4 text-[#5F6D86] text-[15px] leading-7 font-medium sm:mt-5 sm:text-[18px] sm:leading-8">
          {companyName} received your onboarding details successfully. Our team will verify your restaurant soon.
        </p>

        <div className="mt-6 rounded-2xl border border-[#E9EAEE] bg-[#F9FAFC] p-4 flex gap-3 sm:mt-8 sm:rounded-3xl sm:p-5 sm:gap-4">
          <div className="h-9 w-9 rounded-lg bg-white border border-[#E7E8EC] flex items-center justify-center shrink-0 mt-0.5 sm:h-10 sm:w-10 sm:rounded-xl">
            <ShieldCheck className="w-4 h-4 text-[#7A3C72] sm:w-5 sm:h-5" />
          </div>
          <div>
            <p className="text-[#0B0E24] text-[20px] font-bold leading-tight sm:text-[36px]">What&apos;s next?</p>
            <p className="text-[#5F6D86] text-[15px] leading-7 mt-1.5 sm:text-[18px] sm:leading-8 sm:mt-2">
              We&apos;ll notify you via SMS/Email once verified.
            </p>
            {restaurantId && (
              <p className="text-[#2B3448] text-[15px] font-semibold mt-2 break-all sm:text-[24px] sm:mt-3">ID: {restaurantId}</p>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={handleBackToLogin}
          className="mt-6 w-full h-12 rounded-xl bg-[#7A3C72] text-white text-base font-bold shadow-[0_10px_24px_-14px_rgba(122,60,114,0.8)] active:scale-[0.99] transition-transform sm:mt-8 sm:h-14 sm:rounded-2xl sm:text-lg"
        >
          Back to Login
        </button>
      </div>
    </div>
  );
}
