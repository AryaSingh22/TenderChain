"use client";
import Link from "next/link";
import { useState } from "react";

const auditEvents = [
    { id: 1, action: "TENDER_CREATED", actor: "0x7a3f...b29c", entity: "#8", time: "2 min ago", hash: "0xaa11...ff22" },
    { id: 2, action: "BID_COMMITTED", actor: "0x1e8c...4d7a", entity: "#7", time: "5 min ago", hash: "0xbb22...ee33" },
    { id: 3, action: "TENDER_PUBLISHED", actor: "0x9b2d...8f1e", entity: "#8", time: "8 min ago", hash: "0xcc33...dd44" },
    { id: 4, action: "BID_REVEALED", actor: "0x4c6e...2a5b", entity: "#6", time: "12 min ago", hash: "0xdd44...cc55" },
    { id: 5, action: "TENDER_AWARDED", actor: "0x7a3f...b29c", entity: "#5", time: "1 hour ago", hash: "0xee55...bb66" },
    { id: 6, action: "BID_COMMITTED", actor: "0x3d9f...7e8c", entity: "#7", time: "2 hours ago", hash: "0xff66...aa77" },
    { id: 7, action: "EVALUATION_COMPLETED", actor: "0x7a3f...b29c", entity: "#5", time: "3 hours ago", hash: "0x1177...9988" },
    { id: 8, action: "APPEAL_FILED", actor: "0x5b4a...1c3d", entity: "#4", time: "5 hours ago", hash: "0x2288...8877" },
];

const actionColors: Record<string, string> = {
    TENDER_CREATED: "text-authority-500",
    TENDER_PUBLISHED: "text-authority-500",
    TENDER_AWARDED: "text-contractor-500",
    TENDER_CANCELLED: "text-red-400",
    BID_COMMITTED: "text-yellow-400",
    BID_REVEALED: "text-green-400",
    BID_FORFEITED: "text-red-400",
    EVALUATION_STARTED: "text-orange-400",
    EVALUATION_COMPLETED: "text-orange-400",
    APPEAL_FILED: "text-red-400",
    APPEAL_RESOLVED: "text-blue-400",
};

export default function AuditDashboard() {
    const [activeTab, setActiveTab] = useState("live-feed");
    const [verifyHash, setVerifyHash] = useState("");
    const [verified, setVerified] = useState<boolean | null>(null);

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="border-b border-white/10" style={{ background: "var(--gradient-audit)" }}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">TC</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white">Public Audit Dashboard</h1>
                            <p className="text-xs text-white/60">Transparent Procurement Verification</p>
                        </div>
                    </div>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80">
                        🟢 Chain ID: 20240901 • Block #14,582
                    </span>
                </div>
            </header>

            {/* Navigation */}
            <nav className="border-b border-white/10 bg-gray-900/50">
                <div className="max-w-7xl mx-auto px-6 flex gap-1 py-2">
                    {["live-feed", "explorer", "commitments", "verifier", "statistics"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-audit-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tab.replace("-", " ")}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === "live-feed" && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-3 mb-6">
                            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <h2 className="text-xl font-bold text-white">Live On-Chain Events</h2>
                        </div>
                        <div className="glass-card overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {auditEvents.map((event) => (
                                    <div key={event.id} className="px-6 py-4 flex items-center gap-6 hover:bg-white/5 transition-colors animate-slide-up">
                                        <div className="w-2 h-2 rounded-full bg-audit-500" />
                                        <span className={`font-mono text-sm font-semibold w-52 ${actionColors[event.action] || "text-gray-400"}`}>
                                            {event.action}
                                        </span>
                                        <span className="text-sm text-gray-400 font-mono">{event.actor}</span>
                                        <span className="text-sm text-gray-500">Tender {event.entity}</span>
                                        <span className="text-xs text-gray-600 ml-auto">{event.time}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "explorer" && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-6">Tender Explorer</h2>
                        <input className="input-field focus:ring-audit-500 max-w-md mb-6" placeholder="🔍 Search by ID, title, or address..." />
                        <div className="grid gap-4">
                            {[
                                { id: 8, title: "Highway Bridge Construction", status: "PUBLISHED", phases: ["DRAFT", "PUBLISHED"], current: 1 },
                                { id: 7, title: "Water Treatment Plant", status: "EVALUATION", phases: ["DRAFT", "PUBLISHED", "CLOSED", "EVALUATION"], current: 3 },
                                { id: 5, title: "Solar Panel Installation", status: "AWARDED", phases: ["DRAFT", "PUBLISHED", "CLOSED", "EVALUATION", "AWARDED"], current: 4 },
                            ].map((tender) => (
                                <div key={tender.id} className="glass-card p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-white font-semibold">Tender #{tender.id}: {tender.title}</h3>
                                        </div>
                                        <span className="badge bg-audit-500/20 text-audit-400">{tender.status}</span>
                                    </div>
                                    {/* Timeline */}
                                    <div className="flex items-center gap-2">
                                        {tender.phases.map((phase, i) => (
                                            <div key={phase} className="flex items-center gap-2">
                                                <div className={`timeline-dot ${i <= tender.current ? "bg-audit-500 border-audit-500" : "border-gray-600"}`} />
                                                <span className={`text-xs ${i <= tender.current ? "text-audit-400" : "text-gray-600"}`}>{phase}</span>
                                                {i < tender.phases.length - 1 && <div className={`w-8 h-0.5 ${i < tender.current ? "bg-audit-500" : "bg-gray-700"}`} />}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "verifier" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <h2 className="text-xl font-bold text-white mb-6">🔍 Blockchain Verifier</h2>
                        <div className="glass-card p-8">
                            <p className="text-gray-400 mb-6">
                                Paste a commitment hash to verify it against the blockchain. Any citizen can independently verify that a bid commitment exists on-chain.
                            </p>
                            <div className="flex gap-3">
                                <input
                                    className="input-field focus:ring-audit-500 flex-1 font-mono text-sm"
                                    placeholder="0x... commitment hash"
                                    value={verifyHash}
                                    onChange={(e) => { setVerifyHash(e.target.value); setVerified(null); }}
                                />
                                <button className="btn-audit" onClick={() => setVerified(verifyHash.length > 10)}>
                                    Verify
                                </button>
                            </div>
                            {verified !== null && (
                                <div className={`mt-6 p-4 rounded-xl border ${verified ? "bg-contractor-500/10 border-contractor-500/30" : "bg-red-500/10 border-red-500/30"}`}>
                                    {verified ? (
                                        <div>
                                            <p className="text-contractor-400 font-semibold">✅ Commitment Verified</p>
                                            <p className="text-sm text-gray-400 mt-1">This commitment exists on-chain in block #14,231</p>
                                            <p className="text-xs text-gray-500 mt-1 font-mono">Tender #7 • Submitted 2024-11-28 14:32:01 UTC</p>
                                        </div>
                                    ) : (
                                        <p className="text-red-400 font-semibold">❌ Commitment Not Found</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "statistics" && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-6">Platform Statistics</h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                            {[
                                { label: "Total Tenders", value: "156", icon: "📋" },
                                { label: "Total Bids", value: "1,247", icon: "📨" },
                                { label: "Avg. Eval Time", value: "4.2 days", icon: "⏱️" },
                                { label: "Total Awarded", value: "₹2.1B", icon: "💰" },
                            ].map((stat) => (
                                <div key={stat.label} className="stat-card text-center">
                                    <span className="text-3xl mb-2">{stat.icon}</span>
                                    <span className="text-2xl font-bold text-white">{stat.value}</span>
                                    <span className="text-sm text-gray-400">{stat.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Chart placeholder */}
                        <div className="glass-card p-6">
                            <h3 className="text-lg font-semibold text-white mb-4">Tender Activity (Last 12 Months)</h3>
                            <div className="h-64 flex items-end gap-2 px-4">
                                {[30, 45, 38, 52, 67, 48, 75, 62, 80, 55, 70, 85].map((h, i) => (
                                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                                        <div
                                            className="w-full bg-gradient-to-t from-audit-700 to-audit-500 rounded-t-md transition-all hover:opacity-80"
                                            style={{ height: `${h}%` }}
                                        />
                                        <span className="text-[10px] text-gray-600">
                                            {["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"][i]}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "commitments" && (
                    <div className="animate-fade-in">
                        <h2 className="text-xl font-bold text-white mb-6">Commitment Tracker</h2>
                        <div className="glass-card overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10">
                                <select className="input-field focus:ring-audit-500 max-w-xs">
                                    <option>Tender #8 - Highway Bridge Construction</option>
                                    <option>Tender #7 - Water Treatment Plant</option>
                                    <option>Tender #6 - Hospital Equipment</option>
                                </select>
                            </div>
                            <div className="divide-y divide-white/5">
                                {[
                                    { bidder: "0x1e8c...4d7a", timestamp: "2024-11-28 14:32:01", commitment: "0xaa11...ff22" },
                                    { bidder: "0x4c6e...2a5b", timestamp: "2024-11-28 15:10:33", commitment: "0xbb22...ee33" },
                                    { bidder: "0x3d9f...7e8c", timestamp: "2024-11-29 09:05:17", commitment: "0xcc33...dd44" },
                                ].map((c, i) => (
                                    <div key={i} className="px-6 py-3 flex items-center gap-6 hover:bg-white/5">
                                        <span className="font-mono text-sm text-audit-400">{c.bidder}</span>
                                        <span className="text-xs text-gray-500">{c.timestamp}</span>
                                        <span className="font-mono text-xs text-gray-600 ml-auto">{c.commitment}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
