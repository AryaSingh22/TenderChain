"use client";
import Link from "next/link";
import { useState } from "react";

const sampleTenders = [
    { id: 1, title: "Highway Bridge Construction", status: "PUBLISHED", deadline: "2024-12-15", value: "5,000,000", bids: 12 },
    { id: 2, title: "School Building Renovation", status: "EVALUATION", deadline: "2024-11-30", value: "2,500,000", bids: 8 },
    { id: 3, title: "Water Treatment Plant", status: "DRAFT", deadline: "2025-01-20", value: "10,000,000", bids: 0 },
    { id: 4, title: "Municipal IT Infrastructure", status: "AWARDED", deadline: "2024-10-15", value: "1,200,000", bids: 15 },
];

const statusColors: Record<string, string> = {
    DRAFT: "bg-gray-500/20 text-gray-400",
    PUBLISHED: "bg-authority-500/20 text-authority-500",
    CLOSED: "bg-yellow-500/20 text-yellow-400",
    EVALUATION: "bg-orange-500/20 text-orange-400",
    AWARDED: "bg-contractor-500/20 text-contractor-500",
    CANCELLED: "bg-red-500/20 text-red-400",
};

export default function AuthorityDashboard() {
    const [activeTab, setActiveTab] = useState("dashboard");

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="border-b border-white/10" style={{ background: "var(--gradient-authority)" }}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">TC</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white">Authority Portal</h1>
                            <p className="text-xs text-white/60">Government Procurement Management</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-all">
                            🔗 Connect Wallet
                        </button>
                    </div>
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="border-b border-white/10 bg-gray-900/50">
                <div className="max-w-7xl mx-auto px-6 flex gap-1 py-2">
                    {["dashboard", "create", "manage", "evaluate", "audit-trail"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-authority-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tab.replace("-", " ")}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === "dashboard" && (
                    <div className="animate-fade-in">
                        {/* Stats */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            {[
                                { label: "Active Tenders", value: "24", change: "+3 this week", icon: "📋" },
                                { label: "Pending Evaluation", value: "5", change: "2 urgent", icon: "⏳" },
                                { label: "Total Bids Received", value: "147", change: "+12 today", icon: "📨" },
                                { label: "Audit Flags", value: "0", change: "All clear", icon: "✅" },
                            ].map((stat) => (
                                <div key={stat.label} className="stat-card">
                                    <div className="flex items-center justify-between">
                                        <span className="text-2xl">{stat.icon}</span>
                                        <span className="text-xs text-gray-500">{stat.change}</span>
                                    </div>
                                    <span className="text-3xl font-bold text-white">{stat.value}</span>
                                    <span className="text-sm text-gray-400">{stat.label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Tender List */}
                        <div className="glass-card overflow-hidden">
                            <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                                <h2 className="text-lg font-semibold text-white">Recent Tenders</h2>
                                <button className="btn-authority text-sm !py-2 !px-4" onClick={() => setActiveTab("create")}>
                                    + Create Tender
                                </button>
                            </div>
                            <div className="divide-y divide-white/5">
                                {sampleTenders.map((tender) => (
                                    <div key={tender.id} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-500 font-mono">#{tender.id}</span>
                                            <div>
                                                <h3 className="text-white font-medium">{tender.title}</h3>
                                                <p className="text-xs text-gray-500">Deadline: {tender.deadline}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-400">{tender.bids} bids</span>
                                            <span className="text-sm text-gray-400">₹{tender.value}</span>
                                            <span className={`badge ${statusColors[tender.status]}`}>{tender.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "create" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-6">Create New Tender</h2>
                        <div className="glass-card p-8 space-y-6">
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Tender Title</label>
                                <input className="input-field focus:ring-authority-500" placeholder="e.g., Highway Bridge Construction Project" />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Description</label>
                                <textarea className="input-field focus:ring-authority-500 h-32 resize-none" placeholder="Detailed description of the procurement..." />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">Submission Deadline</label>
                                    <input type="datetime-local" className="input-field focus:ring-authority-500" />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">Reveal Deadline</label>
                                    <input type="datetime-local" className="input-field focus:ring-authority-500" />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">Minimum Bid Amount (₹)</label>
                                    <input type="number" className="input-field focus:ring-authority-500" placeholder="1000000" />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-400 mb-2 block">Estimated Project Value (₹)</label>
                                    <input type="number" className="input-field focus:ring-authority-500" placeholder="5000000" />
                                </div>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Upload Tender Document (PDF/DOCX)</label>
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center hover:border-authority-500/50 transition-colors cursor-pointer">
                                    <span className="text-3xl mb-2 block">📄</span>
                                    <p className="text-gray-400 text-sm">Drag & drop or click to upload</p>
                                    <p className="text-gray-600 text-xs mt-1">File will be stored on IPFS</p>
                                </div>
                            </div>
                            <button className="btn-authority w-full">
                                Create Tender as Draft
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "evaluate" && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-white mb-6">Evaluation Panel</h2>
                        <div className="glass-card p-6">
                            <p className="text-gray-400 mb-4">Select a tender in EVALUATION status to compare revealed bids:</p>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="glass-card p-4 border-authority-500/30 cursor-pointer hover:bg-white/5">
                                    <h4 className="font-medium text-white">School Building Renovation</h4>
                                    <p className="text-xs text-gray-500">8 revealed bids • Ready for scoring</p>
                                </div>
                            </div>
                            <div className="mt-6">
                                <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white text-sm hover:opacity-90">
                                    🤖 Request AI Evaluation
                                </button>
                                <p className="text-xs text-gray-600 mt-2">AI scoring is advisory only — final decision is always human.</p>
                            </div>
                        </div>
                    </div>
                )}

                {(activeTab === "manage" || activeTab === "audit-trail") && (
                    <div className="animate-fade-in text-center py-16">
                        <span className="text-4xl mb-4 block">🚧</span>
                        <h2 className="text-xl font-bold text-white mb-2 capitalize">{activeTab.replace("-", " ")}</h2>
                        <p className="text-gray-400">Full interactive view with blockchain integration</p>
                    </div>
                )}
            </main>
        </div>
    );
}
