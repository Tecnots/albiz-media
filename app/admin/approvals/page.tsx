"use client";

import React, { useState, useEffect } from "react";
import { LayoutList, Table2, LayoutGrid, X, ExternalLink, ZoomIn, ZoomOut } from "lucide-react";
import { AdminPillTabs, UserAvatar, StatusBadge, AdminModal } from "../admin-components";
import { AnimatePresence, motion } from "framer-motion";
import { generateVerificationRequests, generateFlaggedContent } from "../admin-data";
import { CircleUpgradeRequestWithUser } from "@/types/circle-upgrade";

const tabs = ["Circle Requests", "Verification", "Flagged Content"];
const circleSubTabs = ["Pending", "Rejected", "Approved"];
const statusMap = ["PENDING", "REJECTED", "APPROVED"];

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState(0);
  const [circleActiveSubTab, setCircleActiveSubTab] = useState(0);
  const [circleRequests, setCircleRequests] = useState<CircleUpgradeRequestWithUser[]>([]);
  const [circleLoading, setCircleLoading] = useState(true);
  const [pendingCircleCount, setPendingCircleCount] = useState(0);
  const [verifyRequests, setVerifyRequests] = useState<any[]>([]);
  const [flaggedContent, setFlaggedContent] = useState<any[]>([]);
  const [expandedRequests, setExpandedRequests] = useState<Set<number>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'table' | 'card'>('list');
  const [declineModal, setDeclineModal] = useState<{ open: boolean; requestId: number | null; requestName: string; reason: string; submitting: boolean; error: string }>({
    open: false, requestId: null, requestName: '', reason: '', submitting: false, error: '',
  });
  const [approveModal, setApproveModal] = useState<{ open: boolean; requestId: number | null; requestName: string; submitting: boolean; error: string }>({
    open: false, requestId: null, requestName: '', submitting: false, error: '',
  });
  const [docModal, setDocModal] = useState<{ open: boolean; url: string; title: string }>({ open: false, url: '', title: '' });
  const [zoom, setZoom] = useState(1.0);

  useEffect(() => {
    if (!docModal.open) {
      setZoom(1.0);
    }
  }, [docModal.open]);

  const changeViewMode = (mode: 'list' | 'table' | 'card') => {
    setExpandedRequests(new Set());
    setViewMode(mode);
  };

  const toggleExpand = (id: number) => {
    setExpandedRequests(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const openApproveModal = (id: number, name: string) => {
    setApproveModal({ open: true, requestId: id, requestName: name, submitting: false, error: '' });
  };

  const closeApproveModal = () => {
    setApproveModal(prev => ({ ...prev, open: false, submitting: false, error: '' }));
  };

  const submitApprove = async () => {
    if (!approveModal.requestId) return;
    setApproveModal(prev => ({ ...prev, submitting: true, error: '' }));
    try {
      const response = await fetch(`/api/circle-upgrade/${approveModal.requestId}/approve`, { method: "POST" });
      const data = await response.json();

      if (data.success) {
        closeApproveModal();
        const status = statusMap[circleActiveSubTab];
        const fetchResponse = await fetch(`/api/circle-upgrade?status=${status}`);
        const fetchData = await fetchResponse.json();
        if (fetchData.success) {
          setCircleRequests(fetchData.data);
          if (circleActiveSubTab === 0) {
            setPendingCircleCount(fetchData.pagination.total);
          } else {
            const pcRes = await fetch('/api/circle-upgrade?status=PENDING&limit=1');
            const pcData = await pcRes.json();
            if (pcData.success) setPendingCircleCount(pcData.pagination.total);
          }
        }
      } else {
        setApproveModal(prev => ({ ...prev, submitting: false, error: data.message || 'Failed to approve request.' }));
      }
    } catch (error) {
      console.error('Error approving request:', error);
      setApproveModal(prev => ({ ...prev, submitting: false, error: 'Something went wrong. Please try again.' }));
    }
  };

  const openDeclineModal = (id: number, name: string) => {
    setDeclineModal({ open: true, requestId: id, requestName: name, reason: '', submitting: false, error: '' });
  };

  const closeDeclineModal = () => {
    setDeclineModal(prev => ({ ...prev, open: false, submitting: false, error: '' }));
  };

  const submitDecline = async () => {
    if (!declineModal.requestId) return;
    setDeclineModal(prev => ({ ...prev, submitting: true, error: '' }));
    try {
      const response = await fetch(`/api/circle-upgrade/${declineModal.requestId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: declineModal.reason.trim() }),
      });
      const data = await response.json();

      if (data.success) {
        closeDeclineModal();
        const status = statusMap[circleActiveSubTab];
        const fetchResponse = await fetch(`/api/circle-upgrade?status=${status}`);
        const fetchData = await fetchResponse.json();
        if (fetchData.success) {
          setCircleRequests(fetchData.data);
          if (circleActiveSubTab === 0) {
            setPendingCircleCount(fetchData.pagination.total);
          } else {
            const pcRes = await fetch('/api/circle-upgrade?status=PENDING&limit=1');
            const pcData = await pcRes.json();
            if (pcData.success) setPendingCircleCount(pcData.pagination.total);
          }
        }
      } else {
        setDeclineModal(prev => ({ ...prev, submitting: false, error: data.message || 'Failed to decline request.' }));
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      setDeclineModal(prev => ({ ...prev, submitting: false, error: 'Something went wrong. Please try again.' }));
    }
  };
  const approveVerify = (id: number) => {
    setVerifyRequests(prev => prev.filter(r => r.id !== id));
    fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, action: "verify" }) }).catch(() => { });
  };
  const declineVerify = (id: number) => setVerifyRequests(prev => prev.filter(r => r.id !== id));
  const dismissFlagged = (id: number) => setFlaggedContent(prev => prev.filter(r => r.id !== id));
  const removeFlagged = (id: number) => {
    setFlaggedContent(prev => prev.filter(r => r.id !== id));
    fetch("/api/admin/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: id }) }).catch(() => { });
  };

  // Fetch Circle upgrade requests
  useEffect(() => {
    const fetchCircleRequests = async () => {
      try {
        setCircleLoading(true);
        const status = statusMap[circleActiveSubTab];
        const response = await fetch(`/api/circle-upgrade?status=${status}`);
        const data = await response.json();

        if (data.success) {
          setCircleRequests(data.data);
          if (circleActiveSubTab === 0) {
            setPendingCircleCount(data.pagination.total);
          }
        }
      } catch (error) {
        console.error('Failed to fetch Circle requests:', error);
      } finally {
        setCircleLoading(false);
      }
    };

    if (activeTab === 0) {
      fetchCircleRequests();
    } else {
      // Fetch pending count even if not on Circle tab
      const fetchPC = async () => {
        const res = await fetch('/api/circle-upgrade?status=PENDING&limit=1');
        const d = await res.json();
        if (d.success) setPendingCircleCount(d.pagination.total);
      };
      fetchPC();
    }
  }, [circleActiveSubTab, activeTab]);

  // Fetch verification requests and flagged content
  useEffect(() => {
    const fetchOtherRequests = async () => {
      try {
        // Fetch verification requests from API if available
        // For now, using empty arrays since no API exists
        setVerifyRequests([]);
        setFlaggedContent([]);
      } catch (error) {
        console.error('Failed to fetch other requests:', error);
      }
    };

    fetchOtherRequests();
  }, []);

  const pendingCount = pendingCircleCount + verifyRequests.length + flaggedContent.length;

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

      {activeTab === 0 && (
        <div className="mb-6 flex items-center justify-between gap-3">
          <AdminPillTabs
            tabs={circleSubTabs}
            activeTab={circleActiveSubTab}
            onTabChange={setCircleActiveSubTab}
          />
          <div className="flex items-center gap-1 border border-[#e5e5e5] rounded-lg p-1 shrink-0">
            {([
              { mode: 'list', Icon: LayoutList },
              { mode: 'table', Icon: Table2 },
              { mode: 'card', Icon: LayoutGrid },
            ] as const).map(({ mode, Icon }) => (
              <button
                key={mode}
                onClick={() => changeViewMode(mode)}
                className={`p-1.5 rounded-md transition-colors ${viewMode === mode ? 'bg-[#f5f5f5] text-[#0a0a0a]' : 'text-[#a3a3a3] hover:text-[#525252]'}`}
              >
                <Icon size={15} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Circle Requests */}
      {activeTab === 0 && (
        <>
          {circleLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 border-2 border-[#F44444] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : circleRequests.length === 0 ? (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No {circleSubTabs[circleActiveSubTab].toLowerCase()} Circle requests found.</p>
            </div>
          ) : viewMode === 'list' ? (
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
                          <span className="text-xs text-[#737373]">• {req.user.email}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                          <div>
                            <span className="text-xs text-[#a3a3a3]">Professional Title:</span>
                            <span className="text-xs text-[#0a0a0a] ml-1">{req.professionalTitle}</span>
                          </div>
                          <div>
                            <span className="text-xs text-[#a3a3a3]">Country:</span>
                            <span className="text-xs text-[#0a0a0a] ml-1">{req.country}</span>
                          </div>
                          <div>
                            <span className="text-xs text-[#a3a3a3]">District:</span>
                            <span className="text-xs text-[#0a0a0a] ml-1">{req.district}</span>
                          </div>
                          <div>
                            <span className="text-xs text-[#a3a3a3]">City:</span>
                            <span className="text-xs text-[#0a0a0a] ml-1">{req.city}</span>
                          </div>
                          {req.pincode && (
                            <div>
                              <span className="text-xs text-[#a3a3a3]">Pincode:</span>
                              <span className="text-xs text-[#0a0a0a] ml-1">{req.pincode}</span>
                            </div>
                          )}
                          {req.company && (
                            <div>
                              <span className="text-xs text-[#a3a3a3]">Company:</span>
                              <span className="text-xs text-[#0a0a0a] ml-1">{req.company}</span>
                            </div>
                          )}
                        </div>
                        {isExpanded && (
                          <>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                              {req.website && (
                                <div>
                                  <span className="text-xs text-[#a3a3a3]">Website:</span>
                                  <a href={req.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] ml-1 hover:underline">{req.website}</a>
                                </div>
                              )}
                              {req.linkedin && (
                                <div>
                                  <span className="text-xs text-[#a3a3a3]">LinkedIn:</span>
                                  <a href={req.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] ml-1 hover:underline">Profile</a>
                                </div>
                              )}
                              <div>
                                <span className="text-xs text-[#a3a3a3]">Account Type:</span>
                                <span className="text-xs text-[#0a0a0a] ml-1">{req.accountType === 'INDIVIDUAL' ? 'Individual' : 'Company'}</span>
                              </div>
                              <div>
                                <span className="text-xs text-[#a3a3a3]">Status:</span>
                                <span className="text-xs text-[#0a0a0a] ml-1">{req.status}</span>
                              </div>
                            </div>
                            {req.registrations && req.registrations.length > 0 && (
                              <div className="mb-3">
                                <span className="text-xs text-[#a3a3a3] block mb-2">Documents:</span>
                                <div className="space-y-2">
                                  {req.registrations.map((reg, regIdx) => (
                                    <div key={reg.id} className="p-3 rounded-lg bg-[#fafafa] border border-[#e5e5e5]">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-[#0a0a0a]">Document {regIdx + 1}</span>
                                        <span className="text-xs text-[#a3a3a3]">{reg.registrationType.replace(/_/g, ' ')}</span>
                                      </div>
                                      <div className="mb-2">
                                        <span className="text-xs text-[#a3a3a3]">Number:</span>
                                        <span className="text-xs text-[#0a0a0a] ml-1">{reg.registrationNumber}</span>
                                      </div>
                                      {reg.documents && reg.documents.length > 0 && (
                                        <div className="flex items-center gap-1 flex-wrap">
                                          {reg.documents.map((doc, docIdx) => (
                                            <button key={doc.id} onClick={(e) => { e.stopPropagation(); setDocModal({ open: true, url: doc.documentUrl, title: (reg.documents?.length ?? 0) > 1 ? `Document ${docIdx + 1}` : 'Document' }); }} className="px-2 py-1 rounded-md border border-[#e5e5e5] text-[#F44444] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                                              {(reg.documents?.length ?? 0) > 1 ? `Doc ${docIdx + 1}` : 'View Document'}
                                            </button>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {req.bio && (
                              <div className="mb-3">
                                <span className="text-xs text-[#a3a3a3] block mb-1">Bio:</span>
                                <p className="text-xs text-[#525252]">{req.bio}</p>
                              </div>
                            )}
                            <div className="mb-3">
                              <span className="text-xs text-[#a3a3a3] block mb-1">Reason for Upgrade:</span>
                              <p className="text-sm text-[#525252]">{req.reason}</p>
                            </div>
                          </>
                        )}
                        <div className="flex items-center gap-2">
                          {req.status === 'PENDING' && (
                            <>
                              <button onClick={() => openApproveModal(req.id, req.fullName)} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Approve</button>
                              <button onClick={() => openDeclineModal(req.id, req.fullName)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                            </>
                          )}
                          <button onClick={() => toggleExpand(req.id)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                            {isExpanded ? 'View Less' : 'View All'}
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
          ) : viewMode === 'table' ? (
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
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar src={req.user.avatar} alt={req.user.name} size={32} />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-[#0a0a0a] truncate">{req.fullName}</p>
                                <p className="text-xs text-[#a3a3a3] truncate">@{req.user.handle}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#525252]">{req.professionalTitle}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#525252]">{[req.city, req.country].filter(Boolean).join(', ')}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#525252]">{req.accountType === 'INDIVIDUAL' ? 'Individual' : 'Company'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-[#a3a3a3]">{new Date(req.createdAt).toLocaleDateString()}</span>
                          </td>
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
                                {req.user.email && (
                                  <div><p className="text-xs text-[#a3a3a3] mb-0.5">Email</p><p className="text-xs text-[#0a0a0a]">{req.user.email}</p></div>
                                )}
                                {req.district && (
                                  <div><p className="text-xs text-[#a3a3a3] mb-0.5">District</p><p className="text-xs text-[#0a0a0a]">{req.district}</p></div>
                                )}
                                {req.pincode && (
                                  <div><p className="text-xs text-[#a3a3a3] mb-0.5">Pincode</p><p className="text-xs text-[#0a0a0a]">{req.pincode}</p></div>
                                )}
                                {req.company && (
                                  <div><p className="text-xs text-[#a3a3a3] mb-0.5">Company</p><p className="text-xs text-[#0a0a0a]">{req.company}</p></div>
                                )}
                                {req.website && (
                                  <div><p className="text-xs text-[#a3a3a3] mb-0.5">Website</p><a href={req.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] hover:underline">{req.website}</a></div>
                                )}
                                {req.linkedin && (
                                  <div><p className="text-xs text-[#a3a3a3] mb-0.5">LinkedIn</p><a href={req.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] hover:underline">View Profile</a></div>
                                )}
                              </div>
                              {req.bio && (
                                <div className="mb-4">
                                  <p className="text-xs text-[#a3a3a3] mb-1">Bio</p>
                                  <p className="text-xs text-[#525252] leading-relaxed">{req.bio}</p>
                                </div>
                              )}
                              {req.reason && (
                                <div className="mb-4">
                                  <p className="text-xs text-[#a3a3a3] mb-1">Reason for Upgrade</p>
                                  <p className="text-xs text-[#525252] leading-relaxed">{req.reason}</p>
                                </div>
                              )}
                              {req.registrations && req.registrations.length > 0 && (
                                <div>
                                  <p className="text-xs text-[#a3a3a3] mb-2">Documents</p>
                                  <div className="space-y-2">
                                    {req.registrations.map((reg, regIdx) => (
                                      <div key={reg.id} className="p-3 rounded-lg bg-white border border-[#e5e5e5]">
                                        <div className="flex items-center justify-between mb-1.5">
                                          <span className="text-xs font-medium text-[#0a0a0a]">Document {regIdx + 1}</span>
                                          <span className="text-xs text-[#a3a3a3]">{reg.registrationType.replace(/_/g, ' ')}</span>
                                        </div>
                                        <p className="text-xs text-[#525252] mb-2">#{reg.registrationNumber}</p>
                                        {reg.documents && reg.documents.length > 0 && (
                                          <div className="flex items-center gap-1.5 flex-wrap">
                                            {reg.documents.map((doc, docIdx) => (
                                              <button key={doc.id} onClick={(e) => { e.stopPropagation(); setDocModal({ open: true, url: doc.documentUrl, title: (reg.documents?.length ?? 0) > 1 ? `Document ${docIdx + 1}` : 'Document' }); }} className="px-2.5 py-1 rounded-md border border-[#e5e5e5] text-[#F44444] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                                                {(reg.documents?.length ?? 0) > 1 ? `Doc ${docIdx + 1}` : 'View Document'}
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
          ) : (
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
                      <div>
                        <span className="text-xs text-[#a3a3a3]">Title</span>
                        <p className="text-xs text-[#0a0a0a] truncate">{req.professionalTitle}</p>
                      </div>
                      <div className="flex gap-4">
                        <div>
                          <span className="text-xs text-[#a3a3a3]">Country</span>
                          <p className="text-xs text-[#0a0a0a]">{req.country}</p>
                        </div>
                        <div>
                          <span className="text-xs text-[#a3a3a3]">City</span>
                          <p className="text-xs text-[#0a0a0a]">{req.city}</p>
                        </div>
                      </div>
                      <div>
                        <span className="text-xs text-[#a3a3a3]">Type</span>
                        <p className="text-xs text-[#0a0a0a]">{req.accountType === 'INDIVIDUAL' ? 'Individual' : 'Company'}</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-3 border-t border-[#f0f0f0] pt-3">
                        {req.district && (
                          <div><span className="text-xs text-[#a3a3a3]">District</span><p className="text-xs text-[#0a0a0a]">{req.district}</p></div>
                        )}
                        {req.pincode && (
                          <div><span className="text-xs text-[#a3a3a3]">Pincode</span><p className="text-xs text-[#0a0a0a]">{req.pincode}</p></div>
                        )}
                        {req.company && (
                          <div><span className="text-xs text-[#a3a3a3]">Company</span><p className="text-xs text-[#0a0a0a]">{req.company}</p></div>
                        )}
                        {req.website && (
                          <div><span className="text-xs text-[#a3a3a3]">Website</span><a href={req.website} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] block hover:underline truncate">{req.website}</a></div>
                        )}
                        {req.linkedin && (
                          <div><span className="text-xs text-[#a3a3a3]">LinkedIn</span><a href={req.linkedin} target="_blank" rel="noopener noreferrer" className="text-xs text-[#F44444] block hover:underline">View Profile</a></div>
                        )}
                        {req.bio && (
                          <div><span className="text-xs text-[#a3a3a3]">Bio</span><p className="text-xs text-[#525252] leading-relaxed mt-0.5">{req.bio}</p></div>
                        )}
                        {req.reason && (
                          <div><span className="text-xs text-[#a3a3a3]">Reason for Upgrade</span><p className="text-xs text-[#525252] leading-relaxed mt-0.5">{req.reason}</p></div>
                        )}
                        {req.registrations && req.registrations.length > 0 && (
                          <div>
                            <span className="text-xs text-[#a3a3a3]">Documents</span>
                            <div className="mt-1.5 space-y-1.5">
                              {req.registrations.map((reg, regIdx) => (
                                <div key={reg.id} className="p-2.5 rounded-lg bg-[#fafafa] border border-[#e5e5e5]">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-[#0a0a0a]">Document {regIdx + 1}</span>
                                    <span className="text-xs text-[#a3a3a3]">{reg.registrationType.replace(/_/g, ' ')}</span>
                                  </div>
                                  <p className="text-xs text-[#525252] mb-1.5">#{reg.registrationNumber}</p>
                                  {reg.documents && reg.documents.length > 0 && (
                                    <div className="flex items-center gap-1 flex-wrap">
                                      {reg.documents.map((doc, docIdx) => (
                                        <button key={doc.id} onClick={(e) => { e.stopPropagation(); setDocModal({ open: true, url: doc.documentUrl, title: (reg.documents?.length ?? 0) > 1 ? `Document ${docIdx + 1}` : 'Document' }); }} className="px-2 py-0.5 rounded-md border border-[#e5e5e5] text-[#F44444] text-xs font-medium hover:bg-white transition-colors bg-white">
                                          {(reg.documents?.length ?? 0) > 1 ? `Doc ${docIdx + 1}` : 'View Document'}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 mt-auto pt-1 border-t border-[#f0f0f0]">
                      {req.status === 'PENDING' && (
                        <>
                          <button onClick={() => openApproveModal(req.id, req.fullName)} className="flex-1 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Approve</button>
                          <button onClick={() => openDeclineModal(req.id, req.fullName)} className="py-1.5 px-3 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                        </>
                      )}
                      <button onClick={() => toggleExpand(req.id)} className="py-1.5 px-3 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">
                        {isExpanded ? 'View Less' : 'View All'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Verification */}
      {activeTab === 1 && (
        <div className="space-y-2">
          {verifyRequests.map(req => (
            <div key={req.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
              <div className="flex items-start gap-3">
                <UserAvatar src={req.avatar} alt={req.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-[#0a0a0a]">{req.name}</span>
                    <span className="text-xs text-[#737373]">@{req.handle}</span>
                  </div>
                  <span className="text-xs text-[#737373] block mb-2">{req.title} &middot; {req.followers} followers &middot; Account age: {req.accountAge}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => approveVerify(req.id)} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Verify</button>
                    <button onClick={() => declineVerify(req.id)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                  </div>
                </div>
                <span className="text-xs text-[#a3a3a3] flex-shrink-0">{req.requestDate}</span>
              </div>
            </div>
          ))}
          {verifyRequests.length === 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No pending verification requests.</p>
            </div>
          )}
        </div>
      )}

      {/* Flagged Content */}
      {activeTab === 2 && (
        <div className="space-y-2">
          {flaggedContent.map(item => (
            <div key={item.id} className="rounded-xl border border-[#FFD4D4] bg-[#FFF5F5] p-4">
              <div className="flex items-start gap-3">
                <UserAvatar src={item.avatar} alt={item.userName} size={40} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm text-[#0a0a0a]">{item.userName}</span>
                    <StatusBadge status={item.type} />
                  </div>
                  <p className="text-sm text-[#525252] mb-2 line-clamp-2">{item.content}</p>
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xs text-[#F44444] font-medium">{item.reason}</span>
                    <span className="text-xs text-[#a3a3a3]">{item.reportCount} reports</span>
                    <span className="text-xs text-[#a3a3a3]">{item.reportedAt}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => removeFlagged(item.id)} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Remove Content</button>
                    <button onClick={() => dismissFlagged(item.id)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-white transition-colors">Dismiss</button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {flaggedContent.length === 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No flagged content.</p>
            </div>
          )}
        </div>
      )}

      <AdminModal
        isOpen={approveModal.open}
        onClose={closeApproveModal}
        title="Approve request"
      >
        <p className="text-sm text-[#525252] mb-1">
          You're about to approve <span className="font-medium text-[#0a0a0a]">{approveModal.requestName}</span>'s Circle request.
        </p>
        <p className="text-sm text-[#737373]">
          Their account will be upgraded to Circle and they'll receive a welcome email.
        </p>
        {approveModal.error && (
          <p className="mt-3 text-xs text-[#F44444]">{approveModal.error}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={closeApproveModal}
            className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] font-medium hover:bg-[#fafafa] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitApprove}
            disabled={approveModal.submitting}
            className="px-4 py-2 rounded-full bg-[#F44444] text-sm text-white font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {approveModal.submitting ? 'Approving…' : 'Approve & notify'}
          </button>
        </div>
      </AdminModal>

      <AdminModal
        isOpen={declineModal.open}
        onClose={closeDeclineModal}
        title="Decline request"
      >
        <p className="text-sm text-[#525252] mb-4">
          Let <span className="font-medium text-[#0a0a0a]">{declineModal.requestName}</span> know why their Circle request was declined. This will be included in the notification email sent to them.
        </p>
        <textarea
          value={declineModal.reason}
          onChange={e => setDeclineModal(prev => ({ ...prev, reason: e.target.value }))}
          placeholder="e.g. The documents provided were incomplete or unclear. Please reapply with valid registration documents."
          rows={4}
          className="w-full px-3 py-2.5 rounded-xl border border-[#e5e5e5] text-sm text-[#0a0a0a] placeholder:text-[#a3a3a3] resize-none focus:outline-none focus:border-[#d5d5d5] bg-[#fafafa]"
        />
        {declineModal.error && (
          <p className="mt-3 text-xs text-[#F44444]">{declineModal.error}</p>
        )}
        <div className="flex items-center justify-end gap-2 mt-4">
          <button
            onClick={closeDeclineModal}
            className="px-4 py-2 rounded-full border border-[#e5e5e5] text-sm text-[#525252] font-medium hover:bg-[#fafafa] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitDecline}
            disabled={declineModal.submitting || !declineModal.reason.trim()}
            className="px-4 py-2 rounded-full bg-[#F44444] text-sm text-white font-medium hover:bg-[#d64d3c] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {declineModal.submitting ? 'Sending…' : 'Decline & notify'}
          </button>
        </div>
      </AdminModal>

      <AnimatePresence>
        {docModal.open && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6 md:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => setDocModal(prev => ({ ...prev, open: false }))}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 300, damping: 30, duration: 0.15 }}
              className="relative w-full h-full max-w-6xl max-h-[90vh] bg-white/10 backdrop-blur-2xl border border-white/20 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5 flex-shrink-0">
                <h3 className="font-medium text-white/90 text-sm tracking-wide">{docModal.title}</h3>
                <div className="flex items-center gap-3">
                  <a
                    href={docModal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-xs font-medium"
                  >
                    <span>Open in new tab</span>
                    <ExternalLink size={14} />
                  </a>
                  <button
                    onClick={() => setDocModal(prev => ({ ...prev, open: false }))}
                    className="p-1.5 rounded-full bg-white/5 hover:bg-white/15 transition-colors text-white/70 hover:text-white"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-white/5 overflow-hidden relative">
                <div
                  className="absolute top-0 left-0 -right-[24px] -bottom-[24px]"
                  style={{
                    width: 'calc(100% + 24px)',
                    height: 'calc(100% + 24px)',
                  }}
                >
                  <iframe
                    src={docModal.url}
                    className="w-full h-full border-0 bg-transparent"
                    style={{
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                      width: `${100 / zoom}%`,
                      height: `${100 / zoom}%`,
                    }}
                  />
                </div>
                {/* Floating zoom toolbar */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-3.5 py-1.5 bg-white/10 backdrop-blur-md border border-white/20 rounded-full shadow-lg z-50 text-white select-none">
                  <button
                    onClick={() => setZoom(prev => Math.max(0.25, prev - 0.25))}
                    disabled={zoom <= 0.25}
                    className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ZoomOut size={15} />
                  </button>
                  <button
                    onClick={() => setZoom(1.0)}
                    className="text-xs font-semibold tracking-wide px-1.5 py-0.5 rounded hover:bg-white/10 hover:text-white/90 transition-all active:scale-95"
                    title="Reset zoom to 100%"
                  >
                    {Math.round(zoom * 100)}%
                  </button>
                  <button
                    onClick={() => setZoom(prev => Math.min(2.0, prev + 0.25))}
                    disabled={zoom >= 2.0}
                    className="p-1 rounded-full hover:bg-white/10 active:bg-white/20 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                  >
                    <ZoomIn size={15} />
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
