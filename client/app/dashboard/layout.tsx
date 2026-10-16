import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex flex-col lg:flex-row w-full h-screen max-w-[1920px] mx-auto relative z-10 fade-in overflow-hidden">
            <Sidebar />
            <main className="flex-1 h-full flex flex-col pt-4 lg:pt-8 pr-4 lg:pr-8 pb-4 lg:pb-8 pl-4 lg:pl-8 min-w-0 overflow-hidden">
                {children}
            </main>
        </div>
    );
}
