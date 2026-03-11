"use client";

import { useState } from "react";
import { AdminPillTabs, UserAvatar, StatusBadge } from "../admin-components";
import { generateCircleRequests, generateVerificationRequests, generateFlaggedContent } from "../admin-data";

const tabs = ["Circle Requests", "Verification", "Flagged Content"];

export default function AdminApprovals() {
  const [activeTab, setActiveTab] = useState(0);
  const [circleRequests, setCircleRequests] = useState(generateCircleRequests());
  const [verifyRequests, setVerifyRequests] = useState(generateVerificationRequests());
  const [flaggedContent, setFlaggedContent] = useState(generateFlaggedContent());

  const approveCircle = (id: number) => {
    setCircleRequests(prev => prev.filter(r => r.id !== id));
    fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, action: "promote_circle" }) }).catch(() => {});
  };
  const declineCircle = (id: number) => setCircleRequests(prev => prev.filter(r => r.id !== id));
  const approveVerify = (id: number) => {
    setVerifyRequests(prev => prev.filter(r => r.id !== id));
    fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: id, action: "verify" }) }).catch(() => {});
  };
  const declineVerify = (id: number) => setVerifyRequests(prev => prev.filter(r => r.id !== id));
  const dismissFlagged = (id: number) => setFlaggedContent(prev => prev.filter(r => r.id !== id));
  const removeFlagged = (id: number) => {
    setFlaggedContent(prev => prev.filter(r => r.id !== id));
    fetch("/api/admin/posts", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: id }) }).catch(() => {});
  };

  const pendingCount = circleRequests.length + verifyRequests.length + flaggedContent.length;

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

      {/* Circle Requests */}
      {activeTab === 0 && (
        <div className="space-y-2">
          {circleRequests.map(req => (
            <div key={req.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
              <div className="flex items-start gap-3">
                <UserAvatar src={req.avatar} alt={req.name} size={44} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-medium text-sm text-[#0a0a0a]">{req.name}</span>
                    <span className="text-xs text-[#737373]">@{req.handle}</span>
                  </div>
                  <span className="text-xs text-[#737373] block mb-2">{req.title} &middot; {req.followers} followers</span>
                  <p className="text-sm text-[#525252] mb-3">{req.reason}</p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => approveCircle(req.id)} className="px-4 py-1.5 rounded-full bg-[#F44444] text-white text-xs font-medium hover:bg-[#d64d3c] transition-colors">Approve</button>
                    <button onClick={() => declineCircle(req.id)} className="px-4 py-1.5 rounded-full border border-[#e5e5e5] text-[#525252] text-xs font-medium hover:bg-[#fafafa] transition-colors">Decline</button>
                  </div>
                </div>
                <span className="text-xs text-[#a3a3a3] flex-shrink-0">{req.requestDate}</span>
              </div>
            </div>
          ))}
          {circleRequests.length === 0 && (
            <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
              <p className="text-sm text-[#737373]">No pending Circle requests.</p>
            </div>
          )}
        </div>
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
    </div>
  );
}
