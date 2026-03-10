import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "TenderChain — Transparent Government Procurement",
    description:
        "Permissioned blockchain platform for government procurement. Eliminates bid tampering, ensures transparency, and provides immutable audit trails.",
    keywords: ["procurement", "blockchain", "government", "transparency", "tender"],
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="dark">
            <body className="min-h-screen">
                {children}
            </body>
        </html>
    );
}
