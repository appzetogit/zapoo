import { useState, useEffect } from 'react';
import { X, Bell, ChevronRight } from 'lucide-react';

/**
 * NotificationPopup
 * Shown when a new promotional notification arrives via Firebase RTDB.
 * Auto-dismisses after 7s. Slides in from the top.
 */
export default function NotificationPopup({ notification, onClose }) {
    const [visible, setVisible] = useState(false);
    const [leaving, setLeaving] = useState(false);

    // Slide IN on mount
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), 50);
        return () => clearTimeout(t);
    }, []);

    // Auto-dismiss after 7s
    useEffect(() => {
        const t = setTimeout(() => dismiss(), 7000);
        return () => clearTimeout(t);
    }, []);

    const dismiss = () => {
        setLeaving(true);
        setTimeout(onClose, 350);
    };

    if (!notification) return null;

    return (
        <>
            <style>{`
                @keyframes notiSlideDown {
                    from { opacity: 0; transform: translateY(-110%) scale(0.96); }
                    to   { opacity: 1; transform: translateY(0)      scale(1);    }
                }
                @keyframes notiSlideUp {
                    from { opacity: 1; transform: translateY(0)      scale(1);    }
                    to   { opacity: 0; transform: translateY(-110%) scale(0.96); }
                }
                .noti-in  { animation: notiSlideDown 0.35s cubic-bezier(0.22,1,0.36,1) forwards; }
                .noti-out { animation: notiSlideUp   0.32s cubic-bezier(0.6,0,1,1)       forwards; }

                @keyframes notiProgress {
                    from { width: 100%; }
                    to   { width: 0%;   }
                }
                .noti-progress { animation: notiProgress 7s linear forwards; }
            `}</style>

            {/* Fixed overlay — sits above everything else */}
            <div
                className={`fixed top-4 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 ${visible ? (leaving ? 'noti-out' : 'noti-in') : 'opacity-0'}`}
            >
                <div className="relative rounded-2xl overflow-hidden shadow-2xl bg-white border border-orange-100">

                    {/* Auto-close progress bar */}
                    <div className="absolute top-0 left-0 h-[3px] bg-orange-500 noti-progress rounded-t-2xl" />

                    {/* Image (if present) */}
                    {notification.imageUrl && (
                        <img
                            src={notification.imageUrl}
                            alt=""
                            className="w-full h-28 object-cover"
                        />
                    )}

                    {/* Body */}
                    <div className="flex items-start gap-3 p-4">
                        {/* Icon */}
                        <div className="shrink-0 w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 flex items-center justify-center">
                            <Bell className="w-5 h-5 text-orange-500" />
                        </div>

                        {/* Text */}
                        <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-semibold text-orange-500 uppercase tracking-wide mb-0.5">
                                Special Offer
                            </p>
                            <p className="text-sm font-bold text-gray-900 leading-snug">
                                {notification.title}
                            </p>
                            {notification.description && (
                                <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                    {notification.description}
                                </p>
                            )}
                        </div>

                        {/* Close */}
                        <button
                            onClick={dismiss}
                            className="shrink-0 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                            aria-label="Close"
                        >
                            <X className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
