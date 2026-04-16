import { Link } from "react-router-dom"
import { ArrowLeft, Shield } from "lucide-react"
import { motion } from "framer-motion"
import AnimatedPage from "../../components/AnimatedPage"
import { Button } from "@/components/ui/button"

export default function ContentPolicy() {
  return (
    <AnimatedPage className="min-h-screen bg-linear-to-b from-gray-50 to-white dark:from-[#0a0a0a] dark:to-[#1a1a1a]">
      <div className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex items-center gap-3 md:gap-4 mb-6 md:mb-8">
          <Link to="/user/profile/about">
            <Button variant="ghost" size="icon" className="h-9 w-9 md:h-10 md:w-10 p-0 hover:bg-gray-100 dark:hover:bg-gray-800">
              <ArrowLeft className="h-5 w-5 md:h-6 md:w-6 text-gray-900 dark:text-white" />
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white">Content Policy</h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="p-6 md:p-8 lg:p-10 bg-white dark:bg-[#1a1a1a] rounded-3xl shadow-lg border border-gray-200 dark:border-gray-800"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="rounded-2xl bg-green-100 dark:bg-green-900 p-3">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-300" />
            </div>
            <div>
              <h2 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white">Content Policy</h2>
            </div>
          </div>

          <div className="space-y-6 prose prose-slate dark:prose-invert max-w-none
              prose-headings:text-gray-900 dark:prose-headings:text-white
              prose-p:text-gray-700 dark:prose-p:text-gray-300
              prose-strong:text-gray-900 dark:prose-strong:text-white
              prose-ul:text-gray-700 dark:prose-ul:text-gray-300
              prose-ol:text-gray-700 dark:prose-ol:text-gray-300
              prose-li:text-gray-700 dark:prose-li:text-gray-300
              leading-relaxed"
          >
            <p>Our Content Policy is designed to keep Zapoo safe, respectful, and compliant with applicable laws. It applies to all user-generated content, reviews, chats, images, and any media shared through the platform.</p>
            <p>Please do not post or share content that is unlawful, abusive, hateful, sexually explicit, defamatory, or otherwise violates our community standards. We reserve the right to remove or restrict access to any content that does not meet these requirements.</p>
            <p>When you submit content on our platform, you grant us the license to use, modify, and display that content in accordance with our service terms. We may also take action against accounts that repeatedly violate this policy.</p>
            <p>If you have questions about content moderation or believe something was removed in error, please contact our support team.</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="text-center mt-8 mb-4"
        >
          <p className="text-sm text-gray-500 dark:text-gray-500">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </motion.div>
      </div>
    </AnimatedPage>
  )
}
