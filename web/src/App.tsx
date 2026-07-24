import { useAccount } from "wagmi";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { EntrancePage } from "@/pages/Entrance";
import { DashboardPage } from "@/pages/Dashboard";
import { JobsPage } from "@/pages/Jobs";
import { CreateJobPage } from "@/pages/CreateJob";
import { JobDetailPage } from "@/pages/JobDetail";
import { AgentsPage } from "@/pages/Agents";
import { AgentDetailPage } from "@/pages/AgentDetail";
import { MyJobsPage } from "@/pages/MyJobs";
import { RewardsPage } from "@/pages/Rewards";
import { MyActivityPage } from "@/pages/MyActivity";
import { FaqPage } from "@/pages/Faq";

export default function App() {
  const { isConnected, isReconnecting } = useAccount();

  return (
    <BrowserRouter>
      {!isConnected && !isReconnecting ? (
        <EntrancePage />
      ) : (
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="jobs" element={<JobsPage />} />
            <Route path="jobs/new" element={<CreateJobPage />} />
            <Route path="jobs/:id" element={<JobDetailPage />} />
            <Route path="agents" element={<AgentsPage />} />
            <Route path="agents/:id" element={<AgentDetailPage />} />
            <Route path="my-jobs" element={<MyJobsPage />} />
            <Route path="rewards" element={<RewardsPage />} />
            <Route path="my-activity" element={<MyActivityPage />} />
            <Route path="faq" element={<FaqPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
    </BrowserRouter>
  );
}
