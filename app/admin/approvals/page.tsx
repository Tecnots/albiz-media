"use client";

import React, { useState, useEffect, useCallback } from "react";
import { LayoutList, Table2, LayoutGrid, X, ExternalLink, ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { AdminPillTabs, UserAvatar, AdminModal } from "../admin-components";
import { AnimatePresence, motion } from "framer-motion";
import type { CircleUpgradeRequestWithUser } from "@/types/circle-upgrade";

const tabs = ["Circle Requests", "Verification", "Flagged Content"];
const circleSubTabs = ["Pending", "Rejected", "Approved"];
const statusMap = ["PENDING", "REJECTED", "APPROVED"];

const CIRCLE_LIMIT = 10;
const VERIFY_LIMIT = 20;
const FLAGGED_LIMIT = 15;

interface VerificationRequest {
  id: number;
  userId: number;
  reason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  user: {
    id: number;
    name: string;
    handle: string;
    email: string;
    avatar: string;
    followers: string;
    joinedDate: string | null;
    verified: boolean;
  };
}

interface FlaggedPost {
  postId: number;
  post: {
    id: number;
    title: string | null;
    content: string | null;
    image: string | null;
    type: string;
    status: string;
    flagged: boolean;
    user: { id: number; name: string; handle: string; avatar: string };
  } | null;
  reportCount: number;
  reasons: string[];
  reports: Array<{
    id: number;
    reason: string;
    description: string | null;
    status: string;
    createdAt: string;
    reporter: { id: number; name: string; handle: string; avatar: string };
    resolver: { id: number; name: string; handle: string } | null;
  }>;
  latestReportedAt: string | null;
}

function PaginationBar({ page, total, limit, onPrev, onNext }: {
  page: number; total: number; limit: number;
  onPrev: () => void; onNext: () => void;
}) {
  const pages = Math.ceil(total / limit);
  if (pages <= 1) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  return (
    <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#f0f0f0]">
      <span className="text-xs text-[#a3a3a3]">{start}–{end} of {total}</span>
      <div className="flex items-center gap-2">
        <button onClick={onPrev} disabled={page === 1} className="px-3 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#fafafa] transition-colors">Previous</button>
        <span className="text-xs text-[#a3a3a3]">{page} / {pages}</span>
        <button onClick={onNext} disabled={page >= pages} className="px-3 py-1 rounded-lg border border-[#e5e5e5] text-xs text-[#525252] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#fafafa] transition-colors">Next</button>
      </div>
    </div>
  );
}

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);

  const showError = (msg: string) => {
    setActionError(msg);
    setTimeout(() => setActionError(null), 5000);
  };

  // ─── Circle Requests ────────────────────────────────────────────────────────
  const [circleActiveSubTab, setCircleActiveSubTab] = useState(0);
  const [circleRequests, setCircleRequests] = useState<CircleUpgradeRequestWithUser[]>([]);
  const [circleLoading, setCircleLoading] = useState(true);
  const [circlePage, setCirclePage] = useState(1);
  const [circleTotal, setCircleTotal] = useState(0);
  const [pendingCircleCount, setPendingCircleCount] = useState(0);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<"list" | "table" | "card">("list");
  const [docModal, setDocModal] = useState<{ open: boolean; url: string; title: string }>({ open: false, url: "", title: "" });
  const [zoom, setZoom] = useState(1.0);
  const [declineModal, setDeclineModal] = useState<{ open: boolean; requestId: number | null; requestName: string; reason: string; submitting: boolean; error: string }>({
    open: false, requestId: null, requestName: "", reason: "", submitting: false, error: "",
  });
  const [approveModal, setApproveModal] = useState<{ open: boolean; requestId: number | null; requestName: string; submitting: boolean; error: string }>({
    open: false, requestId: null, requestName: "", submitting: false, error: "",
  });

  // ─── Verification Requests ───────────────────────────────────────────────────
  const [verifyRequests, setVerifyRequests] = useState<VerificationRequest[]>([]);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifySubTab, setVerifySubTab] = useState(0);
  const [verifyPage, setVerifyPage] = useState(1);
  const [verifyTotal, setVerifyTotal] = useState(0);
  const verifyStatusMap = ["PENDING", "APPROVED", "REJECTED"];
  const verifySubTabs = ["Pending", "Approved", "Rejected"];
  const [pendingVerifyCount, setPendingVerifyCount] = useState(0);
  const [rejectVerifyModal, setRejectVerifyModal] = useState<{ open: boolean; id: number | null; name: string; note: string; submitting: boolean; error: string }>({
    open: false, id: null, name: "", note: "", submitting: false, error: "",
  });

  // ─── Flagged Content ─────────────────────────────────────────────────────────
  const [flaggedPosts, setFlaggedPosts] = useState<FlaggedPost[]>([]);
  const [flaggedLoading, setFlaggedLoading] = useState(false);
  const [flaggedSubTab, setFlaggedSubTab] = useState(0);
  const [flaggedPage, setFlaggedPage] = useState(1);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const flaggedStatusMap = ["PENDING", "DISMISSED", "ACTION_TAKEN"];
  const flaggedSubTabs = ["Pending", "Dismissed", "Resolved"];
  const [pendingFlaggedCount, setPendingFlaggedCount] = useState(0);
  const [removeModal, setRemoveModal] = useState<{ open: boolean; postId: number | null; postTitle: string; reason: string; submitting: boolean; error: string }>({
    open: false, postId: null, postTitle: "", reason: "", submitting: false, error: "",
  });

  // ─── Utils ───────────────────────────────────────────────────────────────────

  useEffect(() => { if (!docModal.open) setZoom(1.0); }, [docModal.open]);
  useEffect(() => { setCirclePage(1); }, [circleActiveSubTab]);
  useEffect(() => { setVerifyPage(1); }, [verifySubTab]);
  useEffect(() => { setFlaggedPage(1); }, [flaggedSubTab]);

  const changeViewMode = (mode: "list" | "table" | "card") => { setExpandedRequests(new Set()); setViewMode(mode); };
  const toggleExpand = (id: number) => {
    setExpandedRequests(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const pendingCount = pendingCircleCount + pendingVerifyCount + pendingFlaggedCount;

  // ─── Circle: fetch ────────────────────────────────────────────────────────────

  const fetchCircleRequests = useCallback(async () => {
    setCircleLoading(true);
    try {
      const status = statusMap[circleActiveSubTab];
      const res = await fetch(`/api/circle-upgrade?status=${status}&page=${circlePage}&limit=${CIRCLE_LIMIT}`);
      const data = await res.json();
      if (data.success) {
        setCircleRequests(data.data);
        setCircleTotal(data.pagination.total);
        if (circleActiveSubTab === 0) setPendingCircleCount(data.pagination.total);
      }
    } finally {
      setCircleLoading(false);
    }
  }, [circleActiveSubTab, circlePage]);

  useEffect(() => {
    if (activeTab === 0) {
      fetchCircleRequests();
    } else {
      fetch("/api/circle-upgrade?status=PENDING&limit=1").then(r => r.json()).then(d => { if (d.success) setPendingCircleCount(d.pagination.total); }).catch(() => {});
    }
  }, [circleActiveSubTab, activeTab, fetchCircleRequests]);

  // ─── Circle: actions ─────────────────────────────────────────────────────────

  const openApproveModal = (id: number, name: string) => setApproveModal({ open: true, requestId: id, requestName: name, submitting: false, error: "" });
  const closeApproveModal = () => setApproveModal(prev => ({ ...prev, open: false }));

  const submitApprove = async () => {
    if (!approveModal.requestId) return;
    setApproveModal(prev => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await fetch(`/api/circle-upgrade/${approveModal.requestId}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        closeApproveModal();
        fetchCircleRequests();
        if (circleActiveSubTab !== 0) {
          const pc = await fetch("/api/circle-upgrade?status=PENDING&limit=1").then(r => r.json()).catch(() => null);
          if (pc?.success) setPendingCircleCount(pc.pagination.total);
        }
      } else {
        setApproveModal(prev => ({ ...prev, submitting: false, error: data.message || "Failed to approve." }));
      }
    } catch {
      setApproveModal(prev => ({ ...prev, submitting: false, error: "Something went wrong." }));
    }
  };

  const openDeclineModal = (id: number, name: string) => setDeclineModal({ open: true, requestId: id, requestName: name, reason: "", submitting: false, error: "" });
  const closeDeclineModal = () => setDeclineModal(prev => ({ ...prev, open: false }));

  const submitDecline = async () => {
    if (!declineModal.requestId) return;
    setDeclineModal(prev => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await fetch(`/api/circle-upgrade/${declineModal.requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineModal.reason.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        closeDeclineModal();
        fetchCircleRequests();
        if (circleActiveSubTab !== 0) {
          const pc = await fetch("/api/circle-upgrade?status=PENDING&limit=1").then(r => r.json()).catch(() => null);
          if (pc?.success) setPendingCircleCount(pc.pagination.total);
        }
      } else {
        setDeclineModal(prev => ({ ...prev, submitting: false, error: data.message || "Failed to decline." }));
      }
    } catch {
      setDeclineModal(prev => ({ ...prev, submitting: false, error: "Something went wrong." }));
    }
  };

  // ─── Verification: fetch ──────────────────────────────────────────────────────

  const fetchVerifyRequests = useCallback(async () => {
    setVerifyLoading(true);
    try {
      const status = verifyStatusMap[verifySubTab];
      const res = await fetch(`/api/admin/verification-requests?status=${status}&page=${verifyPage}&limit=${VERIFY_LIMIT}`);
      const data = await res.json();
      if (data.success) {
        setVerifyRequests(data.data);
        setVerifyTotal(data.pagination.total);
        if (verifySubTab === 0) setPendingVerifyCount(data.pagination.total);
      }
    } finally {
      setVerifyLoading(false);
    }
  }, [verifySubTab, verifyPage]);

  useEffect(() => {
    if (activeTab === 1) {
      fetchVerifyRequests();
    } else {
      fetch("/api/admin/verification-requests?status=PENDING&limit=1").then(r => r.json()).then(d => { if (d.success) setPendingVerifyCount(d.pagination.total); }).catch(() => {});
    }
  }, [verifySubTab, activeTab, fetchVerifyRequests]);

  // ─── Verification: actions ────────────────────────────────────────────────────

  const approveVerification = async (id: number) => {
    try {
      const res = await fetch("/api/admin/verification-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "approve" }),
      });
      if (res.ok) {
        setVerifyRequests(prev => prev.filter(r => r.id !== id));
        setPendingVerifyCount(prev => Math.max(0, prev - 1));
      } else {
        const data = await res.json().catch(() => ({}));
        showError((data as any).error || "Failed to approve verification.");
      }
    } catch {
      showError("Something went wrong. Please try again.");
    }
  };

  const openRejectVerifyModal = (id: number, name: string) =>
    setRejectVerifyModal({ open: true, id, name, note: "", submitting: false, error: "" });
  const closeRejectVerifyModal = () => setRejectVerifyModal(prev => ({ ...prev, open: false }));

  const submitRejectVerification = async () => {
    if (!rejectVerifyModal.id) return;
    setRejectVerifyModal(prev => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await fetch("/api/admin/verification-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: rejectVerifyModal.id, action: "reject", note: rejectVerifyModal.note.trim() }),
      });
      if (res.ok) {
        closeRejectVerifyModal();
        setVerifyRequests(prev => prev.filter(r => r.id !== rejectVerifyModal.id));
        setPendingVerifyCount(prev => Math.max(0, prev - 1));
      } else {
        setRejectVerifyModal(prev => ({ ...prev, submitting: false, error: "Failed to reject." }));
      }
    } catch {
      setRejectVerifyModal(prev => ({ ...prev, submitting: false, error: "Something went wrong." }));
    }
  };

  // ─── Flagged Content: fetch ───────────────────────────────────────────────────

  const fetchFlaggedReports = useCallback(async () => {
    setFlaggedLoading(true);
    try {
      const status = flaggedStatusMap[flaggedSubTab];
      const res = await fetch(`/api/admin/content-reports?status=${status}&page=${flaggedPage}&limit=${FLAGGED_LIMIT}`);
      const data = await res.json();
      if (data.success) {
        setFlaggedPosts(data.data);
        setFlaggedTotal(data.pagination.total);
        if (flaggedSubTab === 0) setPendingFlaggedCount(data.pagination.total);
      }
    } finally {
      setFlaggedLoading(false);
    }
  }, [flaggedSubTab, flaggedPage]);

  useEffect(() => {
    if (activeTab === 2) {
      fetchFlaggedReports();
    } else {
      fetch("/api/admin/content-reports?status=PENDING&limit=1").then(r => r.json()).then(d => { if (d.success) setPendingFlaggedCount(d.pagination.total); }).catch(() => {});
    }
  }, [flaggedSubTab, activeTab, fetchFlaggedReports]);

  // ─── Flagged Content: actions ─────────────────────────────────────────────────

  const dismissReport = async (postId: number) => {
    try {
      const res = await fetch("/api/admin/content-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, action: "dismiss" }),
      });
      if (res.ok) {
        setFlaggedPosts(prev => prev.filter(p => p.postId !== postId));
        if (flaggedSubTab === 0) setPendingFlaggedCount(prev => Math.max(0, prev - 1));
      } else {
        const data = await res.json().catch(() => ({}));
        showError((data as any).error || "Failed to dismiss report.");
      }
    } catch {
      showError("Something went wrong. Please try again.");
    }
  };

  const openRemoveModal = (postId: number, postTitle: string) =>
    setRemoveModal({ open: true, postId, postTitle, reason: "", submitting: false, error: "" });
  const closeRemoveModal = () => setRemoveModal(prev => ({ ...prev, open: false }));

  const submitRemoveContent = async () => {
    if (!removeModal.postId) return;
    setRemoveModal(prev => ({ ...prev, submitting: true, error: "" }));
    try {
      const res = await fetch("/api/admin/content-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId: removeModal.postId, action: "remove", reason: removeModal.reason.trim() || undefined }),
      });
      if (res.ok) {
        const removedPostId = removeModal.postId;
        closeRemoveModal();
        setFlaggedPosts(prev => prev.filter(p => p.postId !== removedPostId));
        if (flaggedSubTab === 0) setPendingFlaggedCount(prev => Math.max(0, prev - 1));
      } else {
        const data = await res.json().catch(() => ({}));
        setRemoveModal(prev => ({ ...prev, submitting: false, error: (data as any).error || "Failed to remove content." }));
      }
    } catch {
      setRemoveModal(prev => ({ ...prev, submitting: false, error: "Something went wrong." }));
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">Approvals</h1>
        {pendingCount > 0 && (
          <span className="px-2.5 py-0.5 rounded-full bg-[#F44444] text-white text-xs font-semibold">{pendingCount}</span>
        )}
      </div>

      <div className="mb-4">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {actionError && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-[#FFD4D4] bg-[#FFF9F9] text-xs text-[#F44444]">
          {actionError}
        </div>
      )}

      {/* ─── Tab 0: Circle Requests ─────────────────────────────────────────── */}
      {activeTab === 0 && (
        <>
          <div className="mb-6 flex items-center justify-between gap-3">
            <AdminPillTabs tabs={circleSubTabs} activeTab={circleActiveSubTab} onTabChange={setCircleActiveSubTab} />
            <div className="flex items-center gap-1 border border-[#e5e5e5] rounded-lg p-1 shrink-0">
              {([{ mode: "list", Icon: LayoutList }, { mode: "table", Icon: Table2 }, { mode: "card", Icon: LayoutGrid }] as const).map(({ mode, Icon }) => (
                <button key={mode} onClick={() => changeViewMode(mode)} className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? "bg-[#f5f5f5] text-[#0a0a0a]" : "text-[#a3a3a3] hover:text-[#525252]"}`}>
                  <Icon size={15} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </div>

          {circleLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-5 animate-pulse">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-[#ebebeb]" />
                    <div className="flex-1 space-y-2.5">
                      <div className="h-3.5 bg-[#ebebeb] rounded w-32" />
                      <div className="grid grid-cols-2 gap-2">{Array.from({ length: 4 }).map((_, j) => <div key={j} className="h-3 bg-[#ebebeb] rounded" />)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : circleRequests.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No {circleSubTabs[circleActiveSubTab].toLowerCase()} Circle requests.</p>
            </div>
          ) : viewMode === "list" ? (
            <>
              <div className="space-y-2">
                {circleRequests.map(req => {
                  const isExpanded = expandedRequests.has(req.id);
                  return (
                    <div key={req.id} className="rounded-xl border border-[#e5e5e5] bg-white p-5 hover:border-[#d5d5d5] transition-colors">
                      <div className="flex items-start gap-4">
                        <UserAvatar src={req.user.avatar} alt={req.user.name} size={48} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-sm text-[#0a0a0a]">{req.fullName}</span>
                            <span className="text-xs text-[#737373]">@{req.user.handle}</span>
                            <span className="text-xs text-[#737373]">· {req.user.email}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                            <div><span className="text-xs text-[#a3a3a3]">Title:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.professionalTitle}</span></div>
                            <div><span className="text-xs text-[#a3a3a3]">Country:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.country}</span></div>
                            <div><span className="text-xs text-[#a3a3a3]">District:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.district}</span></div>
                            <div><span className="text-xs text-[#a3a3a3]">City:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.city}</span></div>
                            {req.pincode && <div><span className="text-xs text-[#a3a3a3]">Pincode:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.pincode}</span></div>}
                            {req.company && <div><span className="text-xs text-[#a3a3a3]">Company:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.company}</span></div>}
                          </div>
                          {isExpanded && (
                            <>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                                {req.website && <div><span className="text-xs text-[#a3a3a3]">Website:</span><a href={req.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] ml-1 hover:underline">{req.website}</a></div>}
                                {req.linkedin && <div><span className="text-xs text-[#a3a3a3]">LinkedIn:</span><a href={req.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] ml-1 hover:underline">Profile</a></div>}
                                <div><span className="text-xs text-[#a3a3a3]">Type:</span><span className="text-xs text-[#0a0a0a] ml-1">{req.accountType === "INDIVIDUAL" ? "Individual" : "Company"}</span></div>
                              </div>
                              {req.registrations && req.registrations.length > 0 && (
                                <div className="mb-3">
                                  <span className="text-xs text-[#a3a3a3] block mb-2">Documents:</span>
                                  <div className="space-y-2">
                                    {req.registrations.map((reg, regIdx) => (
                                      <div key={reg.id} className="p-3 rounded-lg bg-[#fafafa] border border-[#e5e5e5]">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-medium text-[#0a0a0a]">Document {regIdx + 1}</span>
                                          <span className="text-xs text-[#a3a3a3]">{reg.registrationType.replace(/_/g, " ")}</span>
                                        </div>
                                        <div className="mb-2"><span className="text-xs text-[#a3a3a3]">Number:</span><span className="text-xs text-[#0a0a0a] ml-1">{reg.registrationNumber}</span></div>
                                        {reg.documents && reg.documents.length > 0 && (
                                          <div className="flex items-center gap-1 flex-wrap">
                                            {reg.documents.map((doc, docIdx) => (
                                              <button key={doc.id} onClick={e => { e.stopPropagation(); setDocModal({ open: true, url: doc.documentUrl, title: (reg.documents?.length ?? 0) > 1 ? `Document ${docIdx + 1}` : "Document" }); }} className="px-2 py-1 rounded-md border border-[#e5e5e5] text-[#F44444] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                                                {(reg.documents?.length ?? 0) > 1 ? `Doc ${docIdx + 1}` : "View Document"}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {req.bio && <div className="mb-3"><span className="text-xs text-[#a3a3a3] block mb-1">Bio:</span><p className="text-xs text-[#525252]">{req.bio}</p></div>}
                              <div className="mb-3"><span className="text-xs text-[#a3a3a3] block mb-1">Reason:</span><p className="text-sm text-[#525252]">{req.reason}</p></div>
                            </>
                          )}
                          <div className="flex items-center gap-2">
                            {req.status === "PENDING" && (
                              <>
                                <button onClick={() => openApproveModal(req.id, req.fullName)} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Approve</button>
                                <button onClick={() => openDeclineModal(req.id, req.fullName)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                              </>
                            )}
                            <button onClick={() => toggleExpand(req.id)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                              {isExpanded ? "View Less" : "View All"}
                            </button>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs text-[#a3a3a3] block">{new Date(req.createdAt).toLocaleDateString()}</span>
                          <span className="text-xs text-[#a3a3a3] block">{new Date(req.createdAt).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <PaginationBar page={circlePage} total={circleTotal} limit={CIRCLE_LIMIT} onPrev={() => setCirclePage(p => p - 1)} onNext={() => setCirclePage(p => p + 1)} />
            </>
          ) : viewMode === "table" ? (
            <>
              <div className="rounded-xl border border-[#e5e5e5] bg-white overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#e5e5e5]">
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#a3a3a3] w-[220px]">User</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#a3a3a3]">Title</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#a3a3a3]">Location</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#a3a3a3]">Type</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-[#a3a3a3]">Date</th>
                      {circleActiveSubTab === 0 && <th className="text-right px-4 py-3 text-xs font-medium text-[#a3a3a3]">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f0f0f0]">
                    {circleRequests.map(req => {
                      const isExpanded = expandedRequests.has(req.id);
                      return (
                        <React.Fragment key={req.id}>
                          <tr className="hover:bg-[#fafafa] transition-colors cursor-pointer" onClick={() => toggleExpand(req.id)}>
                            <td className="px-4 py-3"><div className="flex items-center gap-2.5"><UserAvatar src={req.user.avatar} alt={req.user.name} size={32} /><div className="min-w-0"><p className="text-xs font-medium text-[#0a0a0a] truncate">{req.fullName}</p><p className="text-xs text-[#a3a3a3] truncate">@{req.user.handle}</p></div></div></td>
                            <td className="px-4 py-3"><span className="text-xs text-[#525252]">{req.professionalTitle}</span></td>
                            <td className="px-4 py-3"><span className="text-xs text-[#525252]">{[req.city, req.country].filter(Boolean).join(", ")}</span></td>
                            <td className="px-4 py-3"><span className="text-xs text-[#525252]">{req.accountType === "INDIVIDUAL" ? "Individual" : "Company"}</span></td>
                            <td className="px-4 py-3"><span className="text-xs text-[#a3a3a3]">{new Date(req.createdAt).toLocaleDateString()}</span></td>
                            {circleActiveSubTab === 0 && (
                              <td className="px-4 py-3">
                                <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                  <button onClick={() => openApproveModal(req.id, req.fullName)} className="px-3 py-1 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Approve</button>
                                  <button onClick={() => openDeclineModal(req.id, req.fullName)} className="px-3 py-1 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                                </div>
                              </td>
                            )}
                          </tr>
                          {isExpanded && (
                            <tr className="bg-[#fafafa]">
                              <td colSpan={circleActiveSubTab === 0 ? 6 : 5} className="px-4 py-4 border-b border-[#f0f0f0]">
                                <div className="grid grid-cols-3 gap-x-8 gap-y-3 mb-4">
                                  {req.user.email && <div><p className="text-xs text-[#a3a3a3] mb-0.5">Email</p><p className="text-xs text-[#0a0a0a]">{req.user.email}</p></div>}
                                  {req.district && <div><p className="text-xs text-[#a3a3a3] mb-0.5">District</p><p className="text-xs text-[#0a0a0a]">{req.district}</p></div>}
                                  {req.pincode && <div><p className="text-xs text-[#a3a3a3] mb-0.5">Pincode</p><p className="text-xs text-[#0a0a0a]">{req.pincode}</p></div>}
                                  {req.company && <div><p className="text-xs text-[#a3a3a3] mb-0.5">Company</p><p className="text-xs text-[#0a0a0a]">{req.company}</p></div>}
                                  {req.website && <div><p className="text-xs text-[#a3a3a3] mb-0.5">Website</p><a href={req.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] hover:underline">{req.website}</a></div>}
                                  {req.linkedin && <div><p className="text-xs text-[#a3a3a3] mb-0.5">LinkedIn</p><a href={req.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] hover:underline">View Profile</a></div>}
                                </div>
                                {req.bio && <div className="mb-4"><p className="text-xs text-[#a3a3a3] mb-1">Bio</p><p className="text-xs text-[#525252] leading-relaxed">{req.bio}</p></div>}
                                {req.reason && <div className="mb-4"><p className="text-xs text-[#a3a3a3] mb-1">Reason for Upgrade</p><p className="text-xs text-[#525252] leading-relaxed">{req.reason}</p></div>}
                                {req.registrations && req.registrations.length > 0 && (
                                  <div>
                                    <p className="text-xs text-[#a3a3a3] mb-2">Documents</p>
                                    <div className="space-y-2">
                                      {req.registrations.map((reg, regIdx) => (
                                        <div key={reg.id} className="p-3 rounded-lg bg-white border border-[#e5e5e5]">
                                          <div className="flex items-center justify-between mb-1.5"><span className="text-xs font-medium text-[#0a0a0a]">Document {regIdx + 1}</span><span className="text-xs text-[#a3a3a3]">{reg.registrationType.replace(/_/g, " ")}</span></div>
                                          <p className="text-xs text-[#525252] mb-2">#{reg.registrationNumber}</p>
                                          {reg.documents && reg.documents.length > 0 && (
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                              {reg.documents.map((doc, docIdx) => (
                                                <button key={doc.id} onClick={e => { e.stopPropagation(); setDocModal({ open: true, url: doc.documentUrl, title: (reg.documents?.length ?? 0) > 1 ? `Document ${docIdx + 1}` : "Document" }); }} className="px-2.5 py-1 rounded-md border border-[#e5e5e5] text-[#F44444] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                                                  {(reg.documents?.length ?? 0) > 1 ? `Doc ${docIdx + 1}` : "View Document"}
                                                </button>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <PaginationBar page={circlePage} total={circleTotal} limit={CIRCLE_LIMIT} onPrev={() => setCirclePage(p => p - 1)} onNext={() => setCirclePage(p => p + 1)} />
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-3 items-start">
                {circleRequests.map(req => {
                  const isExpanded = expandedRequests.has(req.id);
                  return (
                    <div key={req.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 flex flex-col gap-3 hover:border-[#d5d5d5] transition-colors">
                      <div className="flex items-start gap-3">
                        <UserAvatar src={req.user.avatar} alt={req.user.name} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-[#0a0a0a] truncate">{req.fullName}</p>
                          <p className="text-xs text-[#737373] truncate">@{req.user.handle}</p>
                          <p className="text-xs text-[#a3a3a3] truncate">{req.user.email}</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div><span className="text-xs text-[#a3a3a3]">Title</span><p className="text-xs text-[#0a0a0a] truncate">{req.professionalTitle}</p></div>
                        <div className="flex gap-4">
                          <div><span className="text-xs text-[#a3a3a3]">Country</span><p className="text-xs text-[#0a0a0a]">{req.country}</p></div>
                          <div><span className="text-xs text-[#a3a3a3]">City</span><p className="text-xs text-[#0a0a0a]">{req.city}</p></div>
                        </div>
                        <div><span className="text-xs text-[#a3a3a3]">Type</span><p className="text-xs text-[#0a0a0a]">{req.accountType === "INDIVIDUAL" ? "Individual" : "Company"}</p></div>
                      </div>
                      {isExpanded && (
                        <div className="space-y-3 border-t border-[#f0f0f0] pt-3">
                          {req.district && <div><span className="text-xs text-[#a3a3a3]">District</span><p className="text-xs text-[#0a0a0a]">{req.district}</p></div>}
                          {req.company && <div><span className="text-xs text-[#a3a3a3]">Company</span><p className="text-xs text-[#0a0a0a]">{req.company}</p></div>}
                          {req.website && <div><span className="text-xs text-[#a3a3a3]">Website</span><a href={req.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] block hover:underline truncate">{req.website}</a></div>}
                          {req.bio && <div><span className="text-xs text-[#a3a3a3]">Bio</span><p className="text-xs text-[#525252] leading-relaxed mt-0.5">{req.bio}</p></div>}
                          {req.reason && <div><span className="text-xs text-[#a3a3a3]">Reason</span><p className="text-xs text-[#525252] leading-relaxed mt-0.5">{req.reason}</p></div>}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-auto pt-1 border-t border-[#f0f0f0]">
                        {req.status === "PENDING" && (
                          <>
                            <button onClick={() => openApproveModal(req.id, req.fullName)} className="flex-1 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Approve</button>
                            <button onClick={() => openDeclineModal(req.id, req.fullName)} className="py-1.5 px-3 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                          </>
                        )}
                        <button onClick={() => toggleExpand(req.id)} className="py-1.5 px-3 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                          {isExpanded ? "View Less" : "View All"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <PaginationBar page={circlePage} total={circleTotal} limit={CIRCLE_LIMIT} onPrev={() => setCirclePage(p => p - 1)} onNext={() => setCirclePage(p => p + 1)} />
            </>
          )}
        </>
      )}

      {/* ─── Tab 1: Verification Requests ──────────────────────────────────── */}
      {activeTab === 1 && (
        <>
          <div className="mb-4">
            <AdminPillTabs tabs={verifySubTabs} activeTab={verifySubTab} onTabChange={setVerifySubTab} />
          </div>

          {verifyLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-[#ebebeb]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-[#ebebeb] rounded w-32" />
                      <div className="h-3 bg-[#ebebeb] rounded w-48" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : verifyRequests.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No {verifySubTabs[verifySubTab].toLowerCase()} verification requests.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {verifyRequests.map(req => (
                  <div key={req.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
                    <div className="flex items-start gap-3">
                      <UserAvatar src={req.user.avatar} alt={req.user.name} size={44} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-medium text-sm text-[#0a0a0a]">{req.user.name}</span>
                          <span className="text-xs text-[#737373]">@{req.user.handle}</span>
                          {req.user.verified && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-[#3B82F6]/10 text-[#3B82F6]">Verified</span>
                          )}
                        </div>
                        <span className="text-xs text-[#737373] block mb-1">
                          {req.user.email} · {req.user.followers} followers
                          {req.user.joinedDate ? ` · Joined ${req.user.joinedDate}` : ""}
                        </span>
                        {req.reason && (
                          <p className="text-xs text-[#525252] mb-3 leading-relaxed">{req.reason}</p>
                        )}
                        {req.reviewNote && req.status !== "PENDING" && (
                          <p className="text-xs text-[#737373] mb-2 italic">{req.reviewNote}</p>
                        )}
                        {req.status === "PENDING" && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => approveVerification(req.id)} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Verify</button>
                            <button onClick={() => openRejectVerifyModal(req.id, req.user.name)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                          </div>
                        )}
                        {req.status === "APPROVED" && <span className="text-xs text-[#22c55e] font-medium">Approved</span>}
                        {req.status === "REJECTED" && <span className="text-xs text-[#F44444] font-medium">Declined</span>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="text-xs text-[#a3a3a3] block">{new Date(req.createdAt).toLocaleDateString()}</span>
                        <span className="text-xs text-[#a3a3a3] block">{new Date(req.createdAt).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <PaginationBar page={verifyPage} total={verifyTotal} limit={VERIFY_LIMIT} onPrev={() => setVerifyPage(p => p - 1)} onNext={() => setVerifyPage(p => p + 1)} />
            </>
          )}
        </>
      )}

      {/* ─── Tab 2: Flagged Content ─────────────────────────────────────────── */}
      {activeTab === 2 && (
        <>
          <div className="mb-4">
            <AdminPillTabs tabs={flaggedSubTabs} activeTab={flaggedSubTab} onTabChange={setFlaggedSubTab} />
          </div>

          {flaggedLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-[#e5e5e5] bg-white p-4 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-[#ebebeb]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-[#ebebeb] rounded w-40" />
                      <div className="h-3 bg-[#ebebeb] rounded w-56" />
                      <div className="h-3 bg-[#ebebeb] rounded w-36" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : flaggedPosts.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No {flaggedSubTabs[flaggedSubTab].toLowerCase()} reports.</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {flaggedPosts.map(item => (
                  <div key={item.postId} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
                    <div className="flex items-start gap-3">
                      <UserAvatar src={item.post?.user.avatar || ""} alt={item.post?.user.name || "Unknown"} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-medium text-sm text-[#0a0a0a]">{item.post?.user.name ?? "Unknown author"}</span>
                          {item.post?.user.handle && <span className="text-xs text-[#737373]">@{item.post.user.handle}</span>}
                          <span className="text-xs text-[#a3a3a3]">·</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[#f5f5f5] text-[#525252]">{item.post?.type ?? "POST"}</span>
                          <span className="ml-auto text-xs text-[#F44444] font-medium">{item.reportCount} {item.reportCount === 1 ? "report" : "reports"}</span>
                        </div>

                        {(item.post?.title || item.post?.content) && (
                          <p className="text-sm text-[#525252] mb-2 line-clamp-2">{item.post?.title || item.post?.content}</p>
                        )}

                        <div className="flex flex-wrap gap-1 mb-2">
                          {item.reasons.map(r => (
                            <span key={r} className="text-[11px] px-1.5 py-0.5 rounded bg-[#FFF0F0] border border-[#FFD4D4] text-[#F44444]">{r}</span>
                          ))}
                        </div>

                        <div className="space-y-1 mb-3">
                          {item.reports.slice(0, 3).map(report => (
                            <div key={report.id} className="flex items-center gap-1.5">
                              <UserAvatar src={report.reporter.avatar} alt={report.reporter.name} size={18} />
                              <span className="text-xs text-[#737373]">@{report.reporter.handle}</span>
                              <span className="text-xs text-[#a3a3a3]">·</span>
                              <span className="text-xs text-[#525252]">{report.reason}</span>
                              {report.description && (
                                <span className="text-xs text-[#a3a3a3] truncate max-w-[160px]">— {report.description}</span>
                              )}
                            </div>
                          ))}
                          {item.reports.length > 3 && (
                            <p className="text-xs text-[#a3a3a3]">+{item.reports.length - 3} more</p>
                          )}
                        </div>

                        {flaggedSubTab === 0 && (
                          <div className="flex items-center gap-2">
                            <button onClick={() => openRemoveModal(item.postId, item.post?.title || item.post?.content?.slice(0, 40) || "this post")} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Remove content</button>
                            <button onClick={() => dismissReport(item.postId)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Dismiss</button>
                          </div>
                        )}
                        {flaggedSubTab === 1 && <span className="text-xs text-[#22c55e] font-medium">Dismissed</span>}
                        {flaggedSubTab === 2 && <span className="text-xs text-[#F44444] font-medium">Content removed</span>}
                      </div>
                      {item.latestReportedAt && (
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs text-[#a3a3a3] block">{new Date(item.latestReportedAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <PaginationBar page={flaggedPage} total={flaggedTotal} limit={FLAGGED_LIMIT} onPrev={() => setFlaggedPage(p => p - 1)} onNext={() => setFlaggedPage(p => p + 1)} />
            </>
          )}
        </>
      )}

      {/* ─── Circle: Approve modal ──────────────────────────────────────────── */}
      <AdminModal isOpen={approveModal.open} onClose={closeApproveModal} title="Approve request">
        <p className="text-sm text-[#525252] mb-1">You're about to approve <span className="font-medium text-[#0a0a0a]">{approveModal.requestName}</span>'s Circle request.</p>
        <p className="text-sm text-[#737373]">Their account will be upgraded to Circle and they'll receive a welcome email.</p>
        {approveModal.error && <p className="mt-3 text-xs text-[#F44444]">{approveModal.error}</p>}
        <div className="flex items-center justify-end gap-2 mt-6">
          <button onClick={closeApproveModal} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] font-medium hover:bg-[#fafafa] transition-colors">Cancel</button>
          <button onClick={submitApprove} disabled={approveModal.submitting} className="px-4 py-2 rounded-full bg-[#F44444] text-sm text-white font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {approveModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {approveModal.submitting ? "Approving…" : "Approve & notify"}
          </button>
        </div>
      </AdminModal>

      {/* ─── Circle: Decline modal ──────────────────────────────────────────── */}
      <AdminModal isOpen={declineModal.open} onClose={closeDeclineModal} title="Decline request">
        <p className="text-sm text-[#525252] mb-4">Let <span className="font-medium text-[#0a0a0a]">{declineModal.requestName}</span> know why their request was declined.</p>
        <textarea value={declineModal.reason} onChange={e => setDeclineModal(prev => ({ ...prev, reason: e.target.value }))} placeholder="e.g. The documents provided were incomplete or unclear." rows={4} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] resize-none focus:outline-none focus:border-[#d5d5d5] bg-[#fafafa]" />
        {declineModal.error && <p className="mt-3 text-xs text-[#F44444]">{declineModal.error}</p>}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={closeDeclineModal} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] font-medium hover:bg-[#fafafa] transition-colors">Cancel</button>
          <button onClick={submitDecline} disabled={declineModal.submitting || !declineModal.reason.trim()} className="px-4 py-2 rounded-full bg-[#F44444] text-sm text-white font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {declineModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {declineModal.submitting ? "Sending…" : "Decline & notify"}
          </button>
        </div>
      </AdminModal>

      {/* ─── Verification: Reject modal ─────────────────────────────────────── */}
      <AdminModal isOpen={rejectVerifyModal.open} onClose={closeRejectVerifyModal} title="Decline verification">
        <p className="text-sm text-[#525252] mb-4">Optionally explain to <span className="font-medium text-[#0a0a0a]">{rejectVerifyModal.name}</span> why their verification request was declined.</p>
        <textarea value={rejectVerifyModal.note} onChange={e => setRejectVerifyModal(prev => ({ ...prev, note: e.target.value }))} placeholder="e.g. Your account doesn't yet meet the follower threshold for verification." rows={3} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] resize-none focus:outline-none focus:border-[#d5d5d5] bg-[#fafafa]" />
        {rejectVerifyModal.error && <p className="mt-3 text-xs text-[#F44444]">{rejectVerifyModal.error}</p>}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={closeRejectVerifyModal} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] font-medium hover:bg-[#fafafa] transition-colors">Cancel</button>
          <button onClick={submitRejectVerification} disabled={rejectVerifyModal.submitting} className="px-4 py-2 rounded-full bg-[#0a0a0a] text-sm text-white font-medium hover:bg-[#1a1a1a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {rejectVerifyModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {rejectVerifyModal.submitting ? "Declining…" : "Decline"}
          </button>
        </div>
      </AdminModal>

      {/* ─── Flagged: Remove modal ──────────────────────────────────────────── */}
      <AdminModal isOpen={removeModal.open} onClose={closeRemoveModal} title="Remove content">
        <p className="text-sm text-[#525252] mb-4">You're about to permanently remove <span className="font-medium text-[#0a0a0a]">"{removeModal.postTitle}"</span>. The author will be notified.</p>
        <textarea value={removeModal.reason} onChange={e => setRemoveModal(prev => ({ ...prev, reason: e.target.value }))} placeholder="e.g. Content removed for violating community guidelines on hate speech." rows={3} className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] resize-none focus:outline-none focus:border-[#d5d5d5] bg-[#fafafa]" />
        {removeModal.error && <p className="mt-3 text-xs text-[#F44444]">{removeModal.error}</p>}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={closeRemoveModal} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] font-medium hover:bg-[#fafafa] transition-colors">Cancel</button>
          <button onClick={submitRemoveContent} disabled={removeModal.submitting} className="px-4 py-2 rounded-full bg-[#F44444] text-sm text-white font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2">
            {removeModal.submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {removeModal.submitting ? "Removing…" : "Remove content"}
          </button>
        </div>
      </AdminModal>

      {/* ─── Document viewer ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {docModal.open && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-12">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setDocModal(prev => ({ ...prev, open: false }))} />
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 10 }} transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.15 }} className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 flex-shrink-0">
                <h3 className="font-medium text-white/90 text-sm tracking-wide">{docModal.title}</h3>
                <div className="flex items-center gap-3">
                  <a href={docModal.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-medium"><span>Open in new tab</span><ExternalLink size={14} /></a>
                  <button onClick={() => setDocModal(prev => ({ ...prev, open: false }))} className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 transition-colors text-white/70 hover:text-white"><X size={16} /></button>
                </div>
              </div>
              <div className="flex-1 bg-white/5 overflow-hidden relative">
                <div className="absolute top-0 left-0 -right-[24px] -bottom-[24px]" style={{ width: "calc(100% + 24px)", height: "calc(100% + 24px)" }}>
                  <iframe src={docModal.url} className="w-full h-full border-0 bg-transparent" style={{ transform: `scale(${zoom})`, transformOrigin: "top left", width: `${100 / zoom}%`, height: `${100 / zoom}%` }} />
                </div>
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3.5 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-lg z-50 text-white select-none">
                  <button onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))} disabled={zoom <= 0.25} className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"><ZoomOut size={15} /></button>
                  <button onClick={() => setZoom(1.0)} className="text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded hover:bg-white/10 hover:text-white/90 transition-all active:scale-95">{Math.round(zoom * 100)}%</button>
                  <button onClick={() => setZoom(prev => Math.min(2.0, prev + 0.25))} disabled={zoom >= 2.0} className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"><ZoomIn size={15} /></button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}