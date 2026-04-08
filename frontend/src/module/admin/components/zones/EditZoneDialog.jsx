import { Pencil } from "lucide-react"
import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"

const languageTabs = [
  { key: "default", label: "Default" },
  { key: "en", label: "English(EN)" },
  { key: "hi", label: "Hindi - हिंदी(HI)" },
  { key: "bn", label: "Bengali - বাংলা(BN)" }
]

export default function EditZoneDialog({ isOpen, onOpenChange, zone, onSave }) {
  const [activeLanguage, setActiveLanguage] = useState("default")
  const [localizedZoneName, setLocalizedZoneName] = useState({ en: "", hi: "", bn: "" })
  const [localizedDisplayName, setLocalizedDisplayName] = useState({ en: "", hi: "", bn: "" })

  useEffect(() => {
    if (zone) {
      const zoneNameFallback = zone.name || ""
      const displayNameFallback = zone.displayName || zone.zoneName || zone.name || ""
      setLocalizedZoneName({
        en: zone.localizedName?.en || zoneNameFallback,
        hi: zone.localizedName?.hi || "",
        bn: zone.localizedName?.bn || ""
      })
      setLocalizedDisplayName({
        en: zone.localizedZoneName?.en || zone.zoneName || displayNameFallback,
        hi: zone.localizedZoneName?.hi || "",
        bn: zone.localizedZoneName?.bn || ""
      })
      setActiveLanguage("default")
    }
  }, [zone])

  const currentLocaleKey = activeLanguage === "default" ? "en" : activeLanguage
  const zoneName = localizedZoneName[currentLocaleKey] || ""
  const zoneDisplayName = localizedDisplayName[currentLocaleKey] || ""

  const handleReset = () => {
    if (zone) {
      const zoneNameFallback = zone.name || ""
      const displayNameFallback = zone.displayName || zone.zoneName || zone.name || ""
      setLocalizedZoneName({
        en: zone.localizedName?.en || zoneNameFallback,
        hi: zone.localizedName?.hi || "",
        bn: zone.localizedName?.bn || ""
      })
      setLocalizedDisplayName({
        en: zone.localizedZoneName?.en || zone.zoneName || displayNameFallback,
        hi: zone.localizedZoneName?.hi || "",
        bn: zone.localizedZoneName?.bn || ""
      })
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (onSave && zone) {
      onSave({
        ...zone,
        name: localizedZoneName.en || zone.name,
        zoneName: localizedDisplayName.en || zone.zoneName || zone.displayName,
        displayName: localizedDisplayName.en || zone.displayName || zone.zoneName,
        localizedName: localizedZoneName,
        localizedZoneName: localizedDisplayName,
        locale: currentLocaleKey,
        autoTranslate: currentLocaleKey === "en",
      })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-white p-0 opacity-0 data-[state=open]:opacity-100 data-[state=closed]:opacity-0 transition-opacity duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:scale-100 data-[state=closed]:scale-100">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-200">
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="w-5 h-5 text-blue-600" />
            Edit Zone
          </DialogTitle>
          <DialogDescription>
            Update zone information
          </DialogDescription>
        </DialogHeader>
        
        {zone && (
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-6 space-y-6">
              {/* Language Tabs */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-4 overflow-x-auto">
                {languageTabs.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveLanguage(tab.key)}
                    className={`px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeLanguage === tab.key
                        ? "border-blue-600 text-blue-600"
                        : "border-transparent text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Business Zone Name ({activeLanguage === "default" ? "Default" : languageTabs.find(t => t.key === activeLanguage)?.label})
                  </label>
                  <input
                    type="text"
                    value={zoneName}
                    onChange={(e) =>
                      setLocalizedZoneName((prev) => ({
                        ...prev,
                        [currentLocaleKey]: e.target.value,
                      }))
                    }
                    placeholder="Type zone name here"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Zone Display Name ({activeLanguage === "default" ? "Default" : languageTabs.find(t => t.key === activeLanguage)?.label})
                  </label>
                  <input
                    type="text"
                    value={zoneDisplayName}
                    onChange={(e) =>
                      setLocalizedDisplayName((prev) => ({
                        ...prev,
                        [currentLocaleKey]: e.target.value,
                      }))
                    }
                    placeholder="Write display zone name"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
              </div>

              {/* Zone Info Display */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="font-semibold text-slate-700">Zone ID:</span>
                    <span className="ml-2 text-slate-600">{zone.zoneId}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Restaurants:</span>
                    <span className="ml-2 text-slate-600">{zone.restaurants}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Deliverymen:</span>
                    <span className="ml-2 text-slate-600">{zone.deliverymen}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-700">Status:</span>
                    <span className={`ml-2 ${zone.status ? "text-emerald-600" : "text-red-600"}`}>
                      {zone.status ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-2 text-xs font-medium bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Reset
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
