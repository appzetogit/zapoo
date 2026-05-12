import { ArrowLeft, Clock3, Mail, MessageSquare, Phone, ShieldCheck } from "lucide-react"
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { publicAPI } from "@/lib/api"

const DEFAULT_SUPPORT_EMAIL = "zapoosupport@gmail.com"
const DEFAULT_SUPPORT_PHONE = "8919142335"

const faqItems = [
  {
    question: "How do I track my order?",
    answer: "You can track your order in real-time through the 'My Orders' section in your profile.",
  },
  {
    question: "What if I receive a wrong item?",
    answer: "Please contact our support immediately via call or email with your order ID for a quick resolution.",
  },
  {
    question: "Can I cancel my order?",
    answer: "Orders can only be cancelled before the restaurant starts preparing your food.",
  },
]

function ContactCard({ icon, title, value, actionLabel, actionHref }) {
  return (
    <div className="rounded-[26px] border border-[#ececf0] bg-[#f7f7fa] p-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[#e8e8ec] bg-white shadow-sm">
        {icon}
      </div>
      <h3 className="text-xl sm:text-2xl font-black tracking-wide text-[#161b2d]">{title}</h3>
      <p className="mt-2 break-all text-base sm:text-lg font-medium text-[#656a77]">{value}</p>
      <a href={actionHref} className="mt-4 inline-block text-sm sm:text-base font-extrabold uppercase tracking-wider text-[#e23744]">
        {actionLabel}
      </a>
    </div>
  )
}

export default function SupportPage({ subtitle = "ZAPOO INFORMATION", backTo = null }) {
  const navigate = useNavigate()
  const [supportContact, setSupportContact] = useState({
    email: DEFAULT_SUPPORT_EMAIL,
    phone: DEFAULT_SUPPORT_PHONE,
  })

  useEffect(() => {
    const fetchSupportContact = async () => {
      try {
        const response = await publicAPI.getSupportContact()
        const payload = response?.data?.data || {}
        setSupportContact({
          email: payload.email || DEFAULT_SUPPORT_EMAIL,
          phone: payload.phone || DEFAULT_SUPPORT_PHONE,
        })
      } catch (error) {
        console.error("Failed to fetch support contact:", error)
      }
    }

    fetchSupportContact()
  }, [])

  return (
    <div className="min-h-screen bg-[#fdf7f7] text-[#111827]">
      <header className="sticky top-0 z-10 border-b border-[#f1d6d8] bg-[#fdf7f7]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[760px] items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => (backTo ? navigate(backTo) : navigate(-1))}
            className="rounded-full p-2 transition hover:bg-white"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-[#202533]" />
          </button>

          <div>
            <h1 className="text-2xl sm:text-3xl font-black leading-none text-[#171d2f]">Help & Support</h1>
            <p className="mt-1 text-[11px] font-bold tracking-[0.22em] text-[#d32f2f] sm:text-[12px]">{subtitle}</p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] px-4 py-6 sm:px-6">
        <section className="rounded-[34px] border border-[#f3dbde] bg-[#fff9f9] p-4 sm:p-6">
          <div className="space-y-4">
            <ContactCard
              icon={<Mail className="h-7 w-7 text-[#e23744]" />}
              title="EMAIL US"
              value={supportContact.email}
              actionLabel="SEND MESSAGE"
              actionHref={`mailto:${supportContact.email}`}
            />

            <ContactCard
              icon={<Phone className="h-7 w-7 text-[#e23744]" />}
              title="CALL US"
              value={supportContact.phone}
              actionLabel="CALL NOW"
              actionHref={`tel:${supportContact.phone}`}
            />
          </div>

          <hr className="my-8 border-[#e2e2e7]" />

          <section>
            <h2 className="text-3xl sm:text-4xl font-black leading-tight text-[#151d2e]">Frequently Asked Questions</h2>

            <div className="mt-5 space-y-5">
              {faqItems.map((item) => (
                <div key={item.question} className="flex gap-3">
                  <MessageSquare className="mt-1 h-5 w-5 shrink-0 text-[#e23744]" />
                  <div>
                    <h3 className="text-lg sm:text-xl font-black text-[#1a2133]">{item.question}</h3>
                    <p className="mt-1 text-base sm:text-lg leading-relaxed text-[#646a77]">{item.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 space-y-3">
            <div className="rounded-2xl bg-[#f7f7fa] p-4">
              <div className="flex gap-3">
                <Clock3 className="mt-1 h-5 w-5 shrink-0 text-[#e23744]" />
                <div>
                  <h3 className="text-[20px] font-black uppercase tracking-[0.1em] text-[#1a2133]">Operational Hours</h3>
                  <p className="mt-1 text-sm text-[#686e7b]">Available 24/7 for emergency support. General inquiries: 9 AM - 11 PM.</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-[#f7f7fa] p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-1 h-5 w-5 shrink-0 text-[#e23744]" />
                <div>
                  <h3 className="text-[20px] font-black uppercase tracking-[0.1em] text-[#1a2133]">Data Privacy</h3>
                  <p className="mt-1 text-sm text-[#686e7b]">Your conversations with our support team are encrypted and secure.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="px-2 py-8 text-center text-[11px] font-bold uppercase tracking-[0.3em] text-[#9ca3af]">
          <p>Last Updated: May 7, 2026</p>
          <p className="mt-2">&copy; 2026 Zapoo. All rights reserved.</p>
        </footer>
      </main>
    </div>
  )
}
