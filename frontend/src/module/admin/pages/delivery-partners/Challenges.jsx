import React, { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Edit, Plus, ToggleLeft, ToggleRight, Trophy, X } from "lucide-react"
import { adminAPI, tierAPI } from "@/lib/api"
import { toast } from "sonner"

const USER_TYPES = [
  { value: "restaurant", label: "Restaurant" },
  { value: "delivery_partner", label: "Delivery Partner" },
]

const FREQUENCY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
]

const OPERATOR_OPTIONS = [
  { value: ">=", label: "Greater than or equal to" },
  { value: "<=", label: "Less than or equal to" },
  { value: "==", label: "Equal to" },
]

const REWARD_OPTIONS = [
  { value: "wallet_credit", label: "Wallet Credit" },
  { value: "bonus", label: "Bonus" },
  { value: "top_10", label: "Top 10 (1 day)" },
  { value: "free_banner", label: "Free Banner (1 day)" },
  { value: "featured_listing", label: "Featured Listing" },
  { value: "ad_credits", label: "Ad Credits" },
  { value: "wallet", label: "Wallet" },
]

const HIDDEN_REWARD_TYPES_BY_TARGET = {
  restaurant: ["bonus", "wallet", "featured_listing", "ad_credits"],
  delivery_partner: ["top_10", "free_banner", "featured_listing", "ad_credits"],
}

const LEGACY_METRIC_TO_KEY = {
  completed_orders: "order_count",
  completed_deliveries: "delivery_count",
  total_revenue: "order_revenue",
}

const TEMPLATE_FALLBACK = {
  restaurant: [
    {
      name: "restaurant_order_count",
      metricKey: "order_count",
      targetType: "restaurant",
      title: "Complete Orders",
      subtitle: "Set target number of completed orders",
      defaultRewardType: "wallet_credit",
    },
    {
      name: "restaurant_revenue_target",
      metricKey: "order_revenue",
      targetType: "restaurant",
      title: "Revenue Target",
      subtitle: "Set target revenue for the selected period",
      defaultRewardType: "wallet_credit",
    },
    {
      name: "restaurant_rating_threshold",
      metricKey: "average_rating",
      targetType: "restaurant",
      title: "Rating Threshold",
      subtitle: "Maintain a minimum average rating",
      defaultRewardType: "featured_listing",
    },
    {
      name: "restaurant_new_customer_count",
      metricKey: "new_customer_count",
      targetType: "restaurant",
      title: "New Customer Target",
      subtitle: "Acquire target number of new customers",
      defaultRewardType: "ad_credits",
    },
  ],
  delivery_partner: [
    {
      name: "partner_delivery_count",
      metricKey: "delivery_count",
      targetType: "delivery_partner",
      title: "Delivery Count",
      subtitle: "Set target completed deliveries",
      defaultRewardType: "wallet_credit",
    },
    {
      name: "partner_acceptance_rate",
      metricKey: "acceptance_rate",
      targetType: "delivery_partner",
      title: "Acceptance Rate",
      subtitle: "Maintain minimum acceptance percentage",
      defaultRewardType: "bonus",
    },
    {
      name: "partner_active_days",
      metricKey: "active_days",
      targetType: "delivery_partner",
      title: "Active Days",
      subtitle: "Set number of active days in cycle",
      defaultRewardType: "bonus",
    },
  ],
}

const TEMPLATE_FORM_CONFIG = {
  order_count: {
    targetLabel: "Order Target",
    targetPlaceholder: "e.g. 30",
    helper: "Set how many completed orders are required.",
  },
  order_revenue: {
    targetLabel: "Revenue Target (INR)",
    targetPlaceholder: "e.g. 20000",
    helper: "Set revenue goal for the selected cycle.",
  },
  average_rating: {
    targetLabel: "Minimum Rating",
    targetPlaceholder: "e.g. 4.5",
    helper: "Use decimal value between 1 and 5.",
  },
  new_customer_count: {
    targetLabel: "New Customer Target",
    targetPlaceholder: "e.g. 10",
    helper: "Count only new customers acquired in cycle.",
  },
  delivery_count: {
    targetLabel: "Delivery Target",
    targetPlaceholder: "e.g. 20",
    helper: "Set required completed deliveries.",
  },
  acceptance_rate: {
    targetLabel: "Acceptance Rate Target (%)",
    targetPlaceholder: "e.g. 95",
    helper: "Use percentage value, e.g. 95 for 95%.",
  },
  active_days: {
    targetLabel: "Active Days Target",
    targetPlaceholder: "e.g. 6",
    helper: "Set number of active days in cycle.",
  },
  weekly_delivery_count: {
    targetLabel: "Weekly Delivery Target",
    targetPlaceholder: "e.g. 100",
    helper: "Set weekly completed deliveries goal.",
  },
}

const initialForm = {
  title: "",
  frequency: "daily",
  target_value: "",
  reward_type: "wallet_credit",
  reward_value: "",
  tier_ids: [],
}

const toLabel = (value = "") =>
  value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())

const getTemplateTitle = (template) => template?.title || toLabel(template?.name || "")
const getTemplateSubtitle = (template) => template?.subtitle || template?.description || toLabel(template?.metricKey || "")

const getRewardLabel = (rewardType) => {
  const match = REWARD_OPTIONS.find((opt) => opt.value === rewardType)
  return match?.label || toLabel(rewardType)
}

const getRewardOptionsByTarget = (targetType) => {
  const hidden = HIDDEN_REWARD_TYPES_BY_TARGET[targetType] || []
  return REWARD_OPTIONS.filter((opt) => !hidden.includes(opt.value))
}

const getSafeRewardType = (targetType, rewardType) => {
  const options = getRewardOptionsByTarget(targetType)
  const isAllowed = options.some((opt) => opt.value === rewardType)
  if (isAllowed) return rewardType
  return options[0]?.value || "wallet_credit"
}

const computeAutoWindowForFrequency = (frequency, now = new Date()) => {
  const start = new Date(now)
  const end = new Date(start)

  if (frequency === "daily") {
    end.setTime(start.getTime() + 24 * 60 * 60 * 1000 - 1)
  } else if (frequency === "weekly") {
    end.setTime(start.getTime() + 7 * 24 * 60 * 60 * 1000 - 1)
  } else if (frequency === "monthly") {
    const month = end.getMonth()
    end.setMonth(month + 1)
    end.setTime(end.getTime() - 1)
  }

  return { start, end }
}

const formatDateTime = (d) => {
  if (!d) return ""
  return new Date(d).toLocaleString()
}

export default function Challenges() {
  const [tiers, setTiers] = useState([])
  const [templates, setTemplates] = useState([])
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState("")

  const [selectedType, setSelectedType] = useState("restaurant")
  const [selectedTemplateName, setSelectedTemplateName] = useState("")
  const [applyAllTiers, setApplyAllTiers] = useState(true)
  const [form, setForm] = useState(initialForm)
  const [statusFilter, setStatusFilter] = useState("all")
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 1,
  })

  const [expandedProgressId, setExpandedProgressId] = useState(null)
  const [progressData, setProgressData] = useState({})
  const [progressLoading, setProgressLoading] = useState(false)

  // Auto validity preview for daily/weekly/monthly (only recomputed when admin changes frequency)
  const [autoWindowPreview, setAutoWindowPreview] = useState(() =>
    computeAutoWindowForFrequency(initialForm.frequency, new Date()),
  )
  const [isAutoWindowLocked, setIsAutoWindowLocked] = useState(false)

  const availableTemplates = useMemo(() => {
    const fromApi = templates.filter((t) => t.targetType === selectedType)
    if (fromApi.length) {
      return fromApi.map((t) => ({
        ...t,
        title: t.title || toLabel(t.name),
        subtitle: t.description,
      }))
    }
    return TEMPLATE_FALLBACK[selectedType] || []
  }, [templates, selectedType])

  const selectedTemplate = useMemo(
    () => availableTemplates.find((t) => t.name === selectedTemplateName) || null,
    [availableTemplates, selectedTemplateName],
  )
  const selectedTemplateConfig = useMemo(
    () => TEMPLATE_FORM_CONFIG[selectedTemplate?.metricKey] || null,
    [selectedTemplate],
  )
  const rewardOptions = useMemo(
    () => getRewardOptionsByTarget(selectedType),
    [selectedType],
  )

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    if (!availableTemplates.length) {
      setSelectedTemplateName("")
      return
    }
    const exists = availableTemplates.some((t) => t.name === selectedTemplateName)
    if (!exists) setSelectedTemplateName("")
  }, [availableTemplates, selectedTemplateName])

  const fetchChallenges = async (page = pagination.page, limit = pagination.limit, status = statusFilter) => {
    const params = { page, limit }
    if (status && status !== "all") params.status = status
    const res = await adminAPI.getChallenges(params)
    const challengeList = res.data?.data?.challenges || []
    const pager = res.data?.data?.pagination || {}
    setChallenges(Array.isArray(challengeList) ? challengeList : [])
    setPagination((prev) => ({
      ...prev,
      page: Number(pager.page || page),
      limit: Number(pager.limit || limit),
      total: Number(pager.total || 0),
      pages: Number(pager.pages || 1),
    }))
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const [tiersRes, templatesRes] = await Promise.all([
        tierAPI.getAllTiers(),
        adminAPI.getChallengeTemplates(),
      ])

      const tierList = tiersRes.data?.data?.tiers || tiersRes.data?.data || []
      const templateList = templatesRes.data?.data?.templates || []

      setTiers(Array.isArray(tierList) ? tierList : [])
      setTemplates(
        Array.isArray(templateList)
          ? templateList.map((t) => ({
            ...t,
            targetType: t.targetType === "partner" ? "delivery_partner" : t.targetType,
          }))
          : [],
      )

      await fetchChallenges(1, pagination.limit, statusFilter)
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load challenges")
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setEditingId("")
    setIsFormOpen(false)
    setApplyAllTiers(true)
    setForm(initialForm)
    setIsAutoWindowLocked(false)
    setAutoWindowPreview(computeAutoWindowForFrequency(initialForm.frequency, new Date()))
  }

  const handleTierSelect = (e) => {
    const values = Array.from(e.target.selectedOptions).map((opt) => opt.value)
    setForm((prev) => ({ ...prev, tier_ids: values }))
  }

  const handleTypeChange = (type) => {
    if (type === selectedType) return
    setSelectedType(type)
    setSelectedTemplateName("")
    setEditingId("")
    setApplyAllTiers(true)
    setIsAutoWindowLocked(false)
    setForm({
      ...initialForm,
      reward_type: getSafeRewardType(type, initialForm.reward_type),
    })
  }

  const handleTemplateSelect = (template) => {
    setSelectedTemplateName(template.name)
    setEditingId("")
    setIsFormOpen(true)
    setApplyAllTiers(true)
    setIsAutoWindowLocked(false)
    setForm((prev) => ({
      ...initialForm,
      title: getTemplateTitle(template),
      reward_type: getSafeRewardType(selectedType, template.defaultRewardType || prev.reward_type),
    }))
  }

  const handleEdit = (challenge) => {
    const challengeType = challenge.applicableUserType || "restaurant"
    const metricKey = challenge.metricKey || LEGACY_METRIC_TO_KEY[challenge.metricType]

    setEditingId(challenge._id)
    setSelectedType(challengeType)

    const allTemplates = [...(TEMPLATE_FALLBACK.restaurant || []), ...(TEMPLATE_FALLBACK.delivery_partner || []), ...templates]
    const match = allTemplates.find((t) => t.name === challenge.templateId?.name) ||
      allTemplates.find((t) => t.metricKey === metricKey && t.targetType === challengeType)

    if (match?.name) setSelectedTemplateName(match.name)

    const tierIds = (challenge.tierIds || []).map((t) => String(t._id || t))
    setApplyAllTiers(tierIds.length === 0)
    setForm({
      title: challenge.challengeName || getTemplateTitle(match),
      frequency: challenge.frequency || "daily",
      target_value: String(challenge.targetValue ?? ""),
      reward_type: getSafeRewardType(challengeType, challenge.rewardType || "wallet_credit"),
      reward_value: String(challenge.rewardValue ?? ""),
      tier_ids: tierIds,
    })

    // Lock preview to stored validity when editing.
    // This prevents misleading "recomputed now" values until admin changes frequency.
    setIsAutoWindowLocked(true)
    setAutoWindowPreview({
      start: challenge.startDate ? new Date(challenge.startDate) : computeAutoWindowForFrequency(challenge.frequency || "daily").start,
      end: challenge.endDate ? new Date(challenge.endDate) : computeAutoWindowForFrequency(challenge.frequency || "daily").end,
    })

    setIsFormOpen(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  // Recompute preview only when modal is open and admin changes frequency
  useEffect(() => {
    if (!isFormOpen) return
    if (isAutoWindowLocked) return
    setAutoWindowPreview(computeAutoWindowForFrequency(form.frequency, new Date()))
  }, [form.frequency, isFormOpen, isAutoWindowLocked])

  const submit = async (e) => {
    e.preventDefault()

    if (!form.target_value || Number(form.target_value) < 0) return toast.error("Valid target value is required")
    const rewardVal = ["top_10", "free_banner"].includes(form.reward_type) ? 0 : Number(form.reward_value)
    if (!["top_10", "free_banner"].includes(form.reward_type) && (form.reward_value === "" || Number(form.reward_value) < 0)) {
      return toast.error("Valid reward value is required")
    }

    const payload = {
      title: form.title.trim(),
      target_type: selectedType,
      template_id: selectedTemplate._id,
      template_name: selectedTemplate.name,
      metric_key: selectedTemplate.metricKey,
      frequency: form.frequency,
      target_value: Number(form.target_value),
      reward_type: form.reward_type,
      reward_value: rewardVal,
      tiers: applyAllTiers ? [] : form.tier_ids,
    }

    try {
      setSaving(true)
      if (editingId) {
        await adminAPI.updateChallenge(editingId, payload)
        toast.success("Challenge updated")
      } else {
        await adminAPI.createChallenge(payload)
        toast.success("Challenge created")
      }
      resetForm()
      await fetchChallenges(1, pagination.limit, statusFilter)
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to save challenge")
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (challenge) => {
    const status = challenge.status === "active" ? "inactive" : "active"
    try {
      await adminAPI.updateChallengeStatus(challenge._id, status)
      toast.success(`Challenge ${status}`)
      fetchChallenges(pagination.page, pagination.limit, statusFilter)
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update status")
    }
  }

  const changePage = (nextPage) => {
    if (nextPage < 1 || nextPage > pagination.pages || nextPage === pagination.page) return
    fetchChallenges(nextPage, pagination.limit, statusFilter)
  }

  const changeLimit = (nextLimit) => {
    fetchChallenges(1, Number(nextLimit), statusFilter)
  }

  const applyStatusFilter = (nextStatus) => {
    setStatusFilter(nextStatus)
    fetchChallenges(1, pagination.limit, nextStatus)
  }

  const fetchProgress = async (challengeId) => {
    try {
      setProgressLoading(true)
      const res = await adminAPI.getChallengeProgress(challengeId)
      const list = res.data?.data?.progress || []
      setProgressData((prev) => ({ ...prev, [challengeId]: list }))
    } catch (error) {
      toast.error("Failed to load progress")
    } finally {
      setProgressLoading(false)
    }
  }

  const toggleProgress = (id) => {
    if (expandedProgressId === id) {
      setExpandedProgressId(null)
    } else {
      setExpandedProgressId(id)
      if (!progressData[id]) {
        fetchProgress(id)
      }
    }
  }

  return (
    <div className="p-4 lg:p-6 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-100 text-[#FF5200] flex items-center justify-center">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Challenges</h1>
            <p className="text-sm text-slate-600">Choose target, select challenge type, set values and launch.</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">1. Select Target</p>
            <div className="grid grid-cols-2 gap-2">
              {USER_TYPES.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => handleTypeChange(type.value)}
                  className={`px-4 py-3 rounded-lg border text-sm font-semibold ${selectedType === type.value
                    ? "border-[#FF5200] bg-orange-50 text-[#FF5200]"
                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                    }`}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-600 mb-2">2. Select Challenge Type</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {availableTemplates.map((template) => (
                <button
                  key={template.name}
                  type="button"
                  onClick={() => handleTemplateSelect(template)}
                  className={`text-left p-3 rounded-lg border ${selectedTemplateName === template.name
                    ? "border-[#FF5200] bg-orange-50"
                    : "border-slate-200 hover:bg-slate-50"
                    }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{getTemplateTitle(template)}</p>
                  <p className="text-xs text-slate-600 mt-1">{getTemplateSubtitle(template)}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200">
          <div className="px-4 py-3 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-2 py-1 rounded-md bg-slate-100 text-slate-700 font-medium">
                Total: {pagination.total}
              </span>
              <span className="px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">
                Active: {challenges.filter((c) => c.status === "active").length}
              </span>
              <span className="px-2 py-1 rounded-md bg-gray-100 text-gray-700 font-medium">
                Inactive: {challenges.filter((c) => c.status === "inactive").length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => applyStatusFilter(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <select
                value={pagination.limit}
                onChange={(e) => changeLimit(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
              >
                <option value={10}>10 / page</option>
                <option value={20}>20 / page</option>
                <option value={50}>50 / page</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Target</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Frequency</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Metric</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Reward</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Validity</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Tiers</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!loading && challenges.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-500">No challenges found</td>
                  </tr>
                )}
                {challenges.map((challenge) => {
                  const metricKey = challenge.metricKey || LEGACY_METRIC_TO_KEY[challenge.metricType] || challenge.metricType
                  return (
                    <React.Fragment key={challenge._id}>
                      <tr className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-sm font-medium text-slate-900">{challenge.challengeName}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{toLabel(challenge.applicableUserType)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{toLabel(challenge.frequency)}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{toLabel(metricKey)} {challenge.operator} {challenge.targetValue}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">{getRewardLabel(challenge.rewardType)} {challenge.rewardValue}</td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {challenge.startDate && challenge.endDate
                            ? `${new Date(challenge.startDate).toLocaleDateString()} → ${new Date(challenge.endDate).toLocaleDateString()}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-700">
                          {(challenge.tierIds || []).length
                            ? challenge.tierIds.map((tier) => tier.name || "Tier").join(", ")
                            : "All"}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${challenge.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                              }`}
                          >
                            {challenge.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => toggleProgress(challenge._id)}
                            className="text-[#FF5200] hover:underline font-medium flex items-center gap-1"
                          >
                            {expandedProgressId === challenge._id ? "Hide" : "Show"}
                            <ChevronRight className={`w-4 h-4 transition-transform ${expandedProgressId === challenge._id ? "rotate-90" : ""}`} />
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleEdit(challenge)} className="p-1.5 rounded hover:bg-orange-100" title="Edit">
                              <Edit className="w-4 h-4 text-blue-600" />
                            </button>
                            <button onClick={() => toggleStatus(challenge)} className="p-1.5 rounded hover:bg-orange-100" title="Toggle status">
                              {challenge.status === "active" ? (
                                <ToggleRight className="w-5 h-5 text-green-600" />
                              ) : (
                                <ToggleLeft className="w-5 h-5 text-gray-500" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedProgressId === challenge._id && (
                        <tr className="bg-orange-50/30">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="bg-white rounded-lg border border-orange-100 shadow-sm overflow-hidden">
                              <div className="p-3 border-b border-orange-50 bg-orange-50/50 flex items-center justify-between">
                                <span className="text-xs font-bold text-slate-700">User Progress ({progressData[challenge._id]?.length || 0})</span>
                                {progressLoading && expandedProgressId === challenge._id && <span className="text-[10px] text-orange-600 animate-pulse">Loading...</span>}
                              </div>
                            <div className="p-0 overflow-x-auto no-scrollbar">
                                <table className="w-full text-xs">
                                  <thead className="bg-slate-50 text-slate-600">
                                    <tr>
                                      <th className="px-4 py-2 text-left">User ID</th>
                                      <th className="px-4 py-2 text-left">Current</th>
                                      <th className="px-4 py-2 text-left">Target</th>
                                      <th className="px-4 py-2 text-left">Status</th>
                                      <th className="px-4 py-2 text-left">Reward</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {progressData[challenge._id]?.map((p) => (
                                      <tr key={p._id}>
                                        <td className="px-4 py-2 font-mono text-[10px]">{p.userId}</td>
                                        <td className="px-4 py-2 font-bold text-orange-600">{p.currentProgress}</td>
                                        <td className="px-4 py-2">{p.targetValue}</td>
                                        <td className="px-4 py-2">
                                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                                            {p.status}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2">
                                          <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${p.rewardStatus === 'issued' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                                            {p.rewardStatus}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                    {(!progressData[challenge._id] || progressData[challenge._id].length === 0) && !progressLoading && (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-slate-400">No user has started this challenge yet</td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {pagination.page} of {Math.max(1, pagination.pages)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => changePage(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              <button
                type="button"
                onClick={() => changePage(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm disabled:opacity-50 flex items-center gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {
        isFormOpen && selectedTemplate && (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
            onClick={resetForm}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto scrollbar-hide bg-white rounded-xl border border-orange-200 shadow-xl p-4 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-2 bg-orange-50 border border-orange-100 rounded-lg p-3">
                <div>
                  <p className="text-xs font-semibold text-orange-700">Configure Challenge</p>
                  <p className="text-lg font-semibold text-slate-900">{getTemplateTitle(selectedTemplate)}</p>
                  <p className="text-xs text-slate-600">{selectedTemplateConfig?.helper || getTemplateSubtitle(selectedTemplate)}</p>
                </div>
                <button
                  type="button"
                  onClick={resetForm}
                  className="p-2 rounded-lg hover:bg-orange-100"
                >
                  <X className="w-4 h-4 text-slate-600" />
                </button>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Challenge Name</label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder="Enter title"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Challenge Frequency</label>
                    <select
                      value={form.frequency}
                      onChange={(e) => {
                        setIsAutoWindowLocked(false)
                        setForm((prev) => ({ ...prev, frequency: e.target.value }))
                      }}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      {FREQUENCY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                    {autoWindowPreview?.start && autoWindowPreview?.end && (
                      <p className="text-[11px] text-slate-500 mt-2">
                        Validity (auto): {formatDateTime(autoWindowPreview.start)} → {formatDateTime(autoWindowPreview.end)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">
                      {selectedTemplateConfig?.targetLabel || "Target Threshold"}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={form.target_value}
                      onChange={(e) => setForm((prev) => ({ ...prev, target_value: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder={selectedTemplateConfig?.targetPlaceholder || "e.g. 30"}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reward Type</label>
                    <select
                      value={form.reward_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, reward_type: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                    >
                      {rewardOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Reward Amount (INR)</label>
                    <input
                      type="number"
                      min="0"
                      value={form.reward_value}
                      onChange={(e) => setForm((prev) => ({ ...prev, reward_value: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                      placeholder={["top_10", "free_banner"].includes(form.reward_type) ? "0 (N/A)" : "e.g. 500"}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      id="all-tiers"
                      type="checkbox"
                      checked={applyAllTiers}
                      onChange={(e) => setApplyAllTiers(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <label htmlFor="all-tiers" className="text-sm font-medium text-slate-700">
                      Apply to All Tiers
                    </label>
                  </div>

                  {!applyAllTiers && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Applicable Tiers (Multi-Select)</label>
                      <select
                        multiple
                        value={form.tier_ids}
                        onChange={handleTierSelect}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg min-h-24"
                      >
                        {tiers.map((tier) => (
                          <option key={tier._id} value={tier._id}>{tier.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-[#FF5200] text-white rounded-lg flex items-center gap-2 hover:bg-[#e24800] disabled:opacity-60"
                  >
                    <Plus className="w-4 h-4" />
                    {editingId ? "Update Challenge" : "Create Challenge"}
                  </button>
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )
      }
    </div >
  )
}

