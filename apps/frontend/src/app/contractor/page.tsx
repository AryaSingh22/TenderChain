"use client";
import Link from "next/link";
import { useState } from "react";

const publishedTenders = [
    { id: 1, title: "Highway Bridge Construction", authority: "Ministry of Transport", deadline: "2024-12-15", value: "5,000,000", minBid: "1,000,000", status: "PUBLISHED" },
    { id: 5, title: "Solar Panel Installation", authority: "Energy Department", deadline: "2024-12-20", value: "3,200,000", minBid: "500,000", status: "PUBLISHED" },
    { id: 6, title: "Hospital Equipment Supply", authority: "Health Ministry", deadline: "2025-01-10", value: "8,000,000", minBid: "2,000,000", status: "PUBLISHED" },
    { id: 7, title: "Public Park Development", authority: "Municipal Corp", deadline: "2025-01-25", value: "1,500,000", minBid: "300,000", status: "PUBLISHED" },
];

const myBids = [
    { tenderId: 1, title: "Highway Bridge Construction", status: "COMMITTED", commitment: "0x7a3f..b29c", timestamp: "2024-11-28" },
    { tenderId: 3, title: "Water Treatment Plant", status: "REVEALED", commitment: "0x1e8c..4d7a", timestamp: "2024-11-25" },
    { tenderId: 4, title: "Municipal IT Infrastructure", status: "WON", commitment: "0x9b2d..8f1e", timestamp: "2024-10-10" },
];

const bidStatusColors: Record<string, string> = {
    COMMITTED: "bg-yellow-500/20 text-yellow-400",
    REVEALED: "bg-authority-500/20 text-authority-500",
    WON: "bg-contractor-500/20 text-contractor-500",
    LOST: "bg-red-500/20 text-red-400",
    FORFEITED: "bg-gray-500/20 text-gray-400",
};

export default function ContractorPortal() {
    const [activeTab, setActiveTab] = useState("discover");
    const [selectedTender, setSelectedTender] = useState<number | null>(null);
    const [bidAmount, setBidAmount] = useState("");

    return (
        <div className="min-h-screen bg-gray-950">
            {/* Header */}
            <header className="border-b border-white/10" style={{ background: "var(--gradient-contractor)" }}>
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                                <span className="text-white font-bold">TC</span>
                            </div>
                        </Link>
                        <div>
                            <h1 className="text-lg font-bold text-white">Contractor Portal</h1>
                            <p className="text-xs text-white/60">Bid on Government Tenders</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-sm text-white/60">🔔 2 notifications</span>
                        <button className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-white transition-all">
                            🔗 Connect Wallet
                        </button>
                    </div>
                </div>
            </header>

            {/* Navigation */}
            <nav className="border-b border-white/10 bg-gray-900/50">
                <div className="max-w-7xl mx-auto px-6 flex gap-1 py-2">
                    {["discover", "submit-bid", "my-bids", "notifications"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${activeTab === tab ? "bg-contractor-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                                }`}
                        >
                            {tab.replace("-", " ")}
                        </button>
                    ))}
                </div>
            </nav>

            <main className="max-w-7xl mx-auto px-6 py-8">
                {activeTab === "discover" && (
                    <div className="animate-fade-in">
                        <div className="flex items-center gap-4 mb-6">
                            <input className="input-field focus:ring-contractor-500 max-w-md" placeholder="🔍 Search tenders..." />
                            <select className="input-field focus:ring-contractor-500 max-w-xs">
                                <option>All Categories</option>
                                <option>Construction</option>
                                <option>IT</option>
                                <option>Healthcare</option>
                                <option>Energy</option>
                            </select>
                        </div>

                        <div className="grid gap-4">
                            {publishedTenders.map((tender) => (
                                <div key={tender.id} className="glass-card p-6 hover:border-contractor-500/30 transition-all cursor-pointer"
                                    onClick={() => { setSelectedTender(tender.id); setActiveTab("submit-bid"); }}>
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h3 className="text-lg font-semibold text-white">{tender.title}</h3>
                                            <p className="text-sm text-gray-400 mt-1">{tender.authority}</p>
                                        </div>
                                        <span className="badge bg-contractor-500/20 text-contractor-500">Open</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-4 mt-4">
                                        <div>
                                            <p className="text-xs text-gray-500">Deadline</p>
                                            <p className="text-sm text-white font-medium">{tender.deadline}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Est. Value</p>
                                            <p className="text-sm text-white font-medium">₹{tender.value}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500">Min. Bid</p>
                                            <p className="text-sm text-white font-medium">₹{tender.minBid}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {activeTab === "submit-bid" && (
                    <div className="animate-fade-in max-w-2xl mx-auto">
                        <h2 className="text-2xl font-bold text-white mb-6">Submit Sealed Bid</h2>
                        <div className="glass-card p-8 space-y-6">
                            <div className="bg-contractor-500/10 border border-contractor-500/20 rounded-xl p-4">
                                <p className="text-sm text-contractor-400">
                                    🔐 Your bid will be encrypted using ECIES with the authority&apos;s public key.
                                    Only the commitment hash is stored on-chain. Your bid amount remains sealed until the reveal phase.
                                </p>
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Bid Amount (₹)</label>
                                <input type="number" className="input-field focus:ring-contractor-500" placeholder="Enter your bid amount"
                                    value={bidAmount} onChange={(e) => setBidAmount(e.target.value)} />
                            </div>
                            <div>
                                <label className="text-sm text-gray-400 mb-2 block">Technical Proposal</label>
                                <div className="border-2 border-dashed border-white/10 rounded-xl p-6 text-center hover:border-contractor-500/50 transition-colors cursor-pointer">
                                    <span className="text-2xl mb-2 block">📄</span>
                                    <p className="text-gray-400 text-sm">Upload technical proposal (PDF)</p>
                                </div>
                            </div>
                            {bidAmount && (
                                <div className="glass-card p-4 space-y-2 border-contractor-500/20">
                                    <h4 className="text-sm font-semibold text-white">Commitment Preview</h4>
                                    <div className="font-mono text-xs text-gray-400 break-all">
                                        <p>Commitment Hash: 0x{Array(64).fill("0").map(() => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("")}</p>
                                        <p className="mt-1 text-yellow-400">⚠️ Save your salt — you need it to reveal your bid!</p>
                                    </div>
                                </div>
                            )}
                            <button className="btn-contractor w-full" disabled={!bidAmount}>
                                🔒 Submit Encrypted Bid
                            </button>
                        </div>
                    </div>
                )}

                {activeTab === "my-bids" && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-white mb-6">My Bids</h2>
                        <div className="glass-card overflow-hidden">
                            <div className="divide-y divide-white/5">
                                {myBids.map((bid) => (
                                    <div key={bid.tenderId} className="px-6 py-4 flex items-center justify-between hover:bg-white/5">
                                        <div>
                                            <h3 className="text-white font-medium">{bid.title}</h3>
                                            <p className="text-xs text-gray-500">Commitment: {bid.commitment} • {bid.timestamp}</p>
                                        </div>
                                        <span className={`badge ${bidStatusColors[bid.status]}`}>{bid.status}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "notifications" && (
                    <div className="animate-fade-in">
                        <h2 className="text-2xl font-bold text-white mb-6">Notifications</h2>
                        <div className="space-y-3">
                            {[
                                { icon: "⏰", text: "Submission deadline for Highway Bridge Construction in 48 hours", time: "2 hours ago", type: "warning" },
                                { icon: "🔓", text: "Reveal phase opened for Water Treatment Plant tender", time: "1 day ago", type: "info" },
                                { icon: "🏆", text: "You won the Municipal IT Infrastructure tender!", time: "5 days ago", type: "success" },
                            ].map((notif, i) => (
                                <div key={i} className="glass-card p-4 flex items-start gap-4">
                                    <span className="text-2xl">{notif.icon}</span>
                                    <div className="flex-1">
                                        <p className="text-white text-sm">{notif.text}</p>
                                        <p className="text-xs text-gray-500 mt-1">{notif.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
