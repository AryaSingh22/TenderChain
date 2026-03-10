"use client";
import Link from "next/link";

export default function HomePage() {
    return (
        <div className="min-h-screen bg-gray-950 relative overflow-hidden">
            {/* Animated background */}
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-authority-600/20 rounded-full blur-3xl animate-pulse-slow" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-contractor-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "1s" }} />
                <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-audit-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: "2s" }} />
            </div>

            {/* Navigation */}
            <nav className="relative z-10 flex items-center justify-between px-8 py-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-authority-500 via-contractor-500 to-audit-500 rounded-xl flex items-center justify-center">
                        <span className="text-white font-bold text-lg">TC</span>
                    </div>
                    <span className="text-xl font-bold text-white">TenderChain</span>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/authority" className="nav-link">Authority Portal</Link>
                    <Link href="/contractor" className="nav-link">Contractor Portal</Link>
                    <Link href="/audit" className="nav-link">Public Audit</Link>
                </div>
            </nav>

            {/* Hero */}
            <main className="relative z-10 flex flex-col items-center justify-center min-h-[80vh] px-8">
                <div className="text-center max-w-4xl animate-fade-in">
                    <div className="inline-flex items-center gap-2 px-4 py-2 mb-8 rounded-full bg-white/5 border border-white/10 text-sm text-gray-400">
                        <span className="w-2 h-2 bg-contractor-500 rounded-full animate-pulse" />
                        Powered by Permissioned Blockchain
                    </div>
                    <h1 className="text-6xl font-extrabold mb-6 bg-gradient-to-r from-authority-500 via-contractor-500 to-audit-500 bg-clip-text text-transparent leading-tight">
                        Transparent Government
                        <br />Procurement Platform
                    </h1>
                    <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto leading-relaxed">
                        Eliminating bid tampering through cryptographic commit-reveal schemes,
                        immutable audit trails, and verifiable on-chain records. Every procurement action is transparent and accountable.
                    </p>

                    {/* Portal cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <Link href="/authority" className="glass-card p-8 group hover:border-authority-500/50 transition-all duration-300">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-authority-700 to-authority-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="text-2xl">🏛️</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Authority Portal</h3>
                            <p className="text-sm text-gray-400">Create tenders, manage evaluations, and award contracts with full audit visibility.</p>
                        </Link>

                        <Link href="/contractor" className="glass-card p-8 group hover:border-contractor-500/50 transition-all duration-300">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-contractor-700 to-contractor-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="text-2xl">🏗️</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Contractor Portal</h3>
                            <p className="text-sm text-gray-400">Discover tenders, submit sealed bids, and track your commitments securely.</p>
                        </Link>

                        <Link href="/audit" className="glass-card p-8 group hover:border-audit-500/50 transition-all duration-300">
                            <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-audit-700 to-audit-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="text-2xl">🔍</span>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">Public Audit</h3>
                            <p className="text-sm text-gray-400">Verify commitments, explore tenders, and monitor real-time blockchain events.</p>
                        </Link>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-16 w-full max-w-4xl animate-slide-up">
                    {[
                        { label: "Immutable Audit", value: "100%", icon: "🔒" },
                        { label: "Block Finality", value: "2 sec", icon: "⚡" },
                        { label: "Bid Encryption", value: "ECIES", icon: "🔐" },
                        { label: "Consensus", value: "IBFT 2.0", icon: "🤝" },
                    ].map((stat) => (
                        <div key={stat.label} className="stat-card text-center">
                            <span className="text-2xl mb-1">{stat.icon}</span>
                            <span className="text-2xl font-bold text-white">{stat.value}</span>
                            <span className="text-xs text-gray-500 uppercase tracking-wider">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 text-center py-8 text-gray-600 text-sm">
                <p>TenderChain — Ensuring transparency in government procurement through blockchain technology</p>
            </footer>
        </div>
    );
}
