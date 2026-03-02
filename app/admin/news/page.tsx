"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import {
  Bold, Italic, Underline, Link as LinkIcon, List, ListOrdered,
  ImagePlus, Eye, ArrowLeft, AlignLeft, AlignCenter, AlignRight,
  Quote, Code, Heading1, Heading2, Minus, Clock, Globe,
  Mail, UserPlus, Check, X, Send, MessageCircle, ChevronRight,
  FileText, AlertCircle, RotateCcw,
} from "lucide-react";
import { AdminPillTabs, StatusBadge, UserAvatar, AdminModal } from "../admin-components";
import { generateAdminNews, generateAuthors, generateEditorialQueue } from "../admin-data";
import type { ArticleWorkflowStatus } from "../admin-data";

const workflowSteps: { key: ArticleWorkflowStatus; label: string; color: string }[] = [
  { key: "draft", label: "Draft", color: "#525252" },
  { key: "submitted", label: "Submitted", color: "#3B82F6" },
  { key: "under_review", label: "Under Review", color: "#F59E0B" },
  { key: "revision_requested", label: "Revision Requested", color: "#F44444" },
  { key: "approved", label: "Approved", color: "#22c55e" },
  { key: "published", label: "Published", color: "#22c55e" },
];

function WorkflowBadge({ status }: { status: ArticleWorkflowStatus }) {
  const step = workflowSteps.find(s => s.key === status);
  const label = status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-semibold capitalize"
      style={{ backgroundColor: `${step?.color || "#525252"}15`, color: step?.color || "#525252" }}
    >
      {label}
    </span>
  );
}

// ─── Authors Tab ───
function AuthorsTab() {
  const [authors, setAuthors] = useState(generateAuthors());
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteOrg, setInviteOrg] = useState("");
  const [filter, setFilter] = useState(0);

  const filterTabs = ["All", "Active", "Invited", "Inactive"];

  const filtered = authors.filter(a => {
    if (filter === 1) return a.status === "active";
    if (filter === 2) return a.status === "invited";
    if (filter === 3) return a.status === "inactive";
    return true;
  });

  const handleInvite = () => {
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setAuthors(prev => [...prev, {
      id: prev.length + 1,
      name: inviteName,
      email: inviteEmail,
      avatar: `https://picsum.photos/seed/author-new-${Date.now()}/200`,
      role: inviteRole || "Contributing Writer",
      org: inviteOrg || "Freelance",
      status: "invited" as const,
      articles: 0,
      published: 0,
      joinedDate: "Mar 2, 2026",
      bio: "",
    }]);
    setInviteName(""); setInviteEmail(""); setInviteRole(""); setInviteOrg("");
    setShowInvite(false);
  };

  const resendInvite = (id: number) => {
    // demo: just flash the row or show a toast
  };

  const deactivateAuthor = (id: number) => {
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, status: "inactive" as const } : a));
  };

  const activateAuthor = (id: number) => {
    setAuthors(prev => prev.map(a => a.id === id ? { ...a, status: "active" as const } : a));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <AdminPillTabs tabs={filterTabs} activeTab={filter} onTabChange={setFilter} />
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer"
        >
          <UserPlus className="w-4 h-4" />
          Invite Author
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map(author => (
          <div key={author.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
            <div className="flex items-center gap-4">
              <UserAvatar src={author.avatar} alt={author.name} size={44} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-medium text-sm text-[#0a0a0a]">{author.name}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    author.status === "active" ? "bg-[#22c55e]/10 text-[#22c55e]" :
                    author.status === "invited" ? "bg-[#3B82F6]/10 text-[#3B82F6]" :
                    "bg-[#525252]/10 text-[#525252]"
                  }`}>
                    {author.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-[#737373]">
                  <span>{author.role}</span>
                  <span className="text-[#e5e5e5]">|</span>
                  <span>{author.org}</span>
                  <span className="text-[#e5e5e5]">|</span>
                  <span>{author.email}</span>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#737373] flex-shrink-0 hidden sm:flex">
                <div className="text-center">
                  <span className="text-sm font-semibold text-[#0a0a0a] block">{author.articles}</span>
                  <span>articles</span>
                </div>
                <div className="text-center">
                  <span className="text-sm font-semibold text-[#22c55e] block">{author.published}</span>
                  <span>published</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {author.status === "invited" && (
                  <button
                    onClick={() => resendInvite(author.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" /> Resend
                  </button>
                )}
                {author.status === "active" && (
                  <button
                    onClick={() => deactivateAuthor(author.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full text-[#F44444] hover:bg-[#FFF5F5] transition-colors"
                  >
                    Deactivate
                  </button>
                )}
                {author.status === "inactive" && (
                  <button
                    onClick={() => activateAuthor(author.id)}
                    className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
            {author.bio && (
              <p className="text-xs text-[#737373] mt-2 pl-[60px]">{author.bio}</p>
            )}
          </div>
        ))}
      </div>

      {/* Invite Modal */}
      <AdminModal isOpen={showInvite} onClose={() => setShowInvite(false)} title="Invite Author">
        <div className="space-y-4">
          <p className="text-sm text-[#737373]">Send an invitation to an external author or journalist to write for Albiz Media.</p>
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">Full Name</label>
            <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Author's name" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" autoFocus />
          </div>
          <div>
            <label className="text-xs font-medium text-[#525252] block mb-1.5">Email</label>
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="author@publication.com" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Role</label>
              <input type="text" value={inviteRole} onChange={e => setInviteRole(e.target.value)} placeholder="Contributing Writer" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Organization</label>
              <input type="text" value={inviteOrg} onChange={e => setInviteOrg(e.target.value)} placeholder="Publication name" className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
            </div>
          </div>
          <div className="rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] p-3">
            <p className="text-xs text-[#737373]">The author will receive an email invitation with a link to set up their account. They can then submit articles through the author portal.</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={() => setShowInvite(false)} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
            <button onClick={handleInvite} className="px-5 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer flex items-center gap-2">
              <Mail className="w-4 h-4" /> Send Invitation
            </button>
          </div>
        </div>
      </AdminModal>
    </div>
  );
}

// ─── Editorial Queue Tab ───
function EditorialQueueTab() {
  const [queue, setQueue] = useState(generateEditorialQueue());
  const [filter, setFilter] = useState(0);
  const [selectedArticle, setSelectedArticle] = useState<typeof queue[0] | null>(null);
  const [revisionNote, setRevisionNote] = useState("");

  const filterTabs = ["All", "Submitted", "Under Review", "Revision Req.", "Approved"];

  const statusMap: Record<number, ArticleWorkflowStatus | "all"> = {
    0: "all", 1: "submitted", 2: "under_review", 3: "revision_requested", 4: "approved",
  };

  const filtered = queue.filter(a => {
    const f = statusMap[filter];
    if (f === "all") return a.status !== "published";
    return a.status === f;
  });

  const moveToReview = (id: number) => {
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status: "under_review" as const, reviewer: "Jessin Sam S" } : a));
  };

  const requestRevision = (id: number) => {
    if (!revisionNote.trim()) return;
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status: "revision_requested" as const, revisionNote } : a));
    setRevisionNote("");
    setSelectedArticle(null);
  };

  const approve = (id: number) => {
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status: "approved" as const } : a));
    setSelectedArticle(null);
  };

  const publish = (id: number) => {
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status: "published" as const } : a));
    setSelectedArticle(null);
  };

  const reject = (id: number) => {
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status: "rejected" as const } : a));
    setSelectedArticle(null);
  };

  const skipToPublish = (id: number) => {
    setQueue(prev => prev.map(a => a.id === id ? { ...a, status: "published" as const } : a));
  };

  return (
    <div>
      <div className="mb-4">
        <AdminPillTabs tabs={filterTabs} activeTab={filter} onTabChange={setFilter} />
      </div>

      {/* Workflow diagram */}
      <div className="rounded-xl border border-[#e5e5e5] bg-white p-4 mb-4">
        <div className="flex items-center justify-between gap-1">
          {workflowSteps.filter(s => s.key !== "revision_requested").map((step, i, arr) => (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold" style={{ backgroundColor: step.color }}>
                  {i + 1}
                </div>
                <span className="text-[10px] text-[#737373] mt-1 text-center">{step.label}</span>
              </div>
              {i < arr.length - 1 && <ChevronRight className="w-4 h-4 text-[#d5d5d5] flex-shrink-0 mt-[-14px]" />}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-[#a3a3a3] text-center mt-2">Articles flow through this pipeline. Admins can skip steps at any point.</p>
      </div>

      {/* Queue list */}
      <div className="space-y-2">
        {filtered.map(article => (
          <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white p-4 hover:border-[#d5d5d5] transition-colors">
            <div className="flex items-start gap-4">
              <UserAvatar src={article.authorAvatar} alt={article.authorName} size={40} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-sm text-[#0a0a0a] truncate">{article.title}</h3>
                  <WorkflowBadge status={article.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-[#737373] mb-2">
                  <span>{article.authorName}</span>
                  <span className="text-[#e5e5e5]">|</span>
                  <span>{article.submittedAt}</span>
                  <span className="text-[#e5e5e5]">|</span>
                  <span>{article.wordCount} words</span>
                  {article.reviewer && (
                    <>
                      <span className="text-[#e5e5e5]">|</span>
                      <span className="text-[#F59E0B]">Reviewing: {article.reviewer}</span>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mb-2">
                  {article.tags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#f5f5f5] text-[#525252]">{tag}</span>
                  ))}
                </div>
                {article.revisionNote && article.status === "revision_requested" && (
                  <div className="px-3 py-2 rounded-lg bg-[#FFF5F5] border border-[#FFD4D4] mb-2">
                    <span className="text-xs text-[#F44444] flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {article.revisionNote}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {/* Action buttons based on status */}
                {article.status === "submitted" && (
                  <>
                    <button onClick={() => moveToReview(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors">
                      Start Review
                    </button>
                    <button onClick={() => skipToPublish(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#e5e5e5] text-[#525252] hover:bg-[#fafafa] transition-colors">
                      Skip to Publish
                    </button>
                  </>
                )}
                {article.status === "under_review" && (
                  <>
                    <button onClick={() => approve(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#22c55e] text-white hover:bg-[#16a34a] transition-colors flex items-center gap-1">
                      <Check className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => { setSelectedArticle(article); setRevisionNote(article.revisionNote || ""); }} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F59E0B] text-white hover:bg-[#D97706] transition-colors flex items-center gap-1">
                      <RotateCcw className="w-3 h-3" /> Revision
                    </button>
                    <button onClick={() => reject(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full text-[#F44444] hover:bg-[#FFF5F5] transition-colors">
                      Reject
                    </button>
                  </>
                )}
                {article.status === "approved" && (
                  <button onClick={() => publish(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full bg-[#F44444] text-white hover:bg-[#d64d3c] transition-colors flex items-center gap-1">
                    Publish Now
                  </button>
                )}
                {article.status === "revision_requested" && (
                  <span className="text-xs text-[#a3a3a3]">Waiting for author...</span>
                )}
                {article.status === "draft" && (
                  <span className="text-xs text-[#a3a3a3]">Author is writing...</span>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-[#e5e5e5] bg-white px-5 py-12 text-center">
            <p className="text-sm text-[#737373]">No articles in this stage.</p>
          </div>
        )}
      </div>

      {/* Revision Request Modal */}
      <AdminModal isOpen={!!selectedArticle} onClose={() => setSelectedArticle(null)} title="Request Revision">
        {selectedArticle && (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <UserAvatar src={selectedArticle.authorAvatar} alt={selectedArticle.authorName} size={36} />
              <div>
                <span className="text-sm font-medium text-[#0a0a0a] block">{selectedArticle.title}</span>
                <span className="text-xs text-[#737373]">by {selectedArticle.authorName}</span>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[#525252] block mb-1.5">Revision Notes</label>
              <textarea
                value={revisionNote}
                onChange={e => setRevisionNote(e.target.value)}
                placeholder="Describe what changes the author needs to make..."
                className="w-full px-4 py-2.5 rounded-xl bg-[#f5f5f5] border border-[#e5e5e5] text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all resize-none min-h-[100px]"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setSelectedArticle(null)} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Cancel</button>
              <button onClick={() => requestRevision(selectedArticle.id)} className="px-5 py-2 rounded-full bg-[#F59E0B] text-white text-sm font-medium hover:bg-[#D97706] transition-colors cursor-pointer flex items-center gap-2">
                <RotateCcw className="w-4 h-4" /> Send Revision Request
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}

// ─── Published Articles Tab (existing) ───
function PublishedTab() {
  const [articles, setArticles] = useState(generateAdminNews());

  const deleteArticle = (id: number) => setArticles(prev => prev.filter(a => a.id !== id));

  return (
    <div className="space-y-2">
      {articles.map(article => (
        <div key={article.id} className="rounded-xl border border-[#e5e5e5] bg-white hover:border-[#d5d5d5] transition-colors">
          <div className="flex items-center gap-4 p-4">
            {article.image && (
              <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block">
                <Image src={article.image} alt={article.title} width={80} height={56} className="object-cover w-full h-full" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-[#0a0a0a] truncate mb-0.5">{article.title}</h3>
              <div className="flex items-center gap-3 text-xs text-[#737373]">
                <span>{article.date}</span>
                {article.status === "published" && (
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {article.views}</span>
                )}
              </div>
            </div>
            <StatusBadge status={article.status} />
            <button onClick={() => deleteArticle(article.id)} className="px-3 py-1.5 text-xs font-medium rounded-full text-[#F44444] hover:bg-[#FFF5F5] transition-colors">
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Page ───
export default function AdminNews() {
  const [activeTab, setActiveTab] = useState(0);
  const [view, setView] = useState<"list" | "editor">("list");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [assignedAuthor, setAssignedAuthor] = useState("");
  const contentRef = useRef<HTMLTextAreaElement>(null);

  const tabs = ["Editorial Queue", "Authors", "Published", "Write Article"];
  const tagOptions = ["News", "Technology", "Business", "AI", "Policy", "Update", "Startups", "Finance", "Space", "Health"];
  const authors = generateAuthors().filter(a => a.status === "active");

  const resetEditor = () => {
    setTitle(""); setSubtitle(""); setContent(""); setTags([]); setCoverImage("");
    setSeoDescription(""); setSlug(""); setScheduledDate(""); setAssignedAuthor(""); setEditingId(null);
  };

  const autoSlug = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));

  const handlePublish = () => {
    if (!title.trim()) return;
    resetEditor();
    setView("list");
    setActiveTab(2); // go to Published
  };

  const handleSaveDraft = () => {
    if (!title.trim()) return;
    resetEditor();
    setView("list");
    setActiveTab(0); // go to Editorial Queue
  };

  const handleSubmitForReview = () => {
    if (!title.trim()) return;
    resetEditor();
    setView("list");
    setActiveTab(0);
  };

  // ─── EDITOR VIEW ───
  if (view === "editor") {
    return (
      <div className="min-h-screen bg-white">
        <div className="sticky top-0 z-20 bg-white border-b border-[#e5e5e5] px-6 py-3">
          <div className="flex items-center justify-between max-w-[1200px]">
            <div className="flex items-center gap-3">
              <button onClick={() => { resetEditor(); setView("list"); }} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5 text-[#525252]" />
              </button>
              <span className="text-sm font-medium text-[#0a0a0a]">Write Article</span>
              {title && <span className="text-xs text-[#a3a3a3] hidden sm:block">— {title.substring(0, 40)}{title.length > 40 ? "..." : ""}</span>}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleSaveDraft} className="px-4 py-2 rounded-full border border-[#e5e5e5] text-[#525252] text-sm font-medium hover:bg-[#fafafa] transition-colors cursor-pointer">Save Draft</button>
              <button onClick={handleSubmitForReview} className="px-4 py-2 rounded-full bg-[#3B82F6] text-white text-sm font-medium hover:bg-[#2563EB] transition-colors cursor-pointer">Submit for Review</button>
              <button onClick={handlePublish} className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer">Publish</button>
            </div>
          </div>
        </div>

        <div className="flex max-w-[1200px] mx-auto">
          <div className="flex-1 min-w-0 px-6 lg:px-12 py-8">
            {/* Cover Image */}
            <div className="mb-6">
              {coverImage ? (
                <div className="relative rounded-xl overflow-hidden h-48 sm:h-64">
                  <Image src={coverImage} alt="Cover" width={800} height={400} className="object-cover w-full h-full" />
                  <button onClick={() => setCoverImage("")} className="absolute top-3 right-3 px-3 py-1.5 bg-white/90 backdrop-blur-sm text-[#0a0a0a] text-xs font-medium rounded-lg hover:bg-white transition-colors">Remove</button>
                </div>
              ) : (
                <button onClick={() => setCoverImage(`https://picsum.photos/seed/cover-${Date.now()}/800/400`)} className="w-full h-36 rounded-xl border-2 border-dashed border-[#e5e5e5] hover:border-[#d5d5d5] transition-colors flex flex-col items-center justify-center gap-2 text-[#737373] cursor-pointer">
                  <ImagePlus className="w-6 h-6" />
                  <span className="text-sm">Add cover image</span>
                </button>
              )}
            </div>

            <input type="text" value={title} onChange={e => { setTitle(e.target.value); if (!editingId) setSlug(autoSlug(e.target.value)); }} placeholder="Article title" className="w-full text-3xl font-bold text-[#0a0a0a] placeholder-[#d5d5d5] outline-none mb-3" autoFocus />
            <input type="text" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Add a subtitle..." className="w-full text-lg text-[#525252] placeholder-[#d5d5d5] outline-none mb-6" />

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 border-y border-[#e5e5e5] py-2 mb-6 overflow-x-auto">
              {[Heading1, Heading2, Bold, Italic, Underline].map((Icon, i) => (
                <button key={i} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]"><Icon className="w-4 h-4" /></button>
              ))}
              <div className="w-px h-5 bg-[#e5e5e5] mx-1" />
              {[LinkIcon, Quote, Code, Minus].map((Icon, i) => (
                <button key={i} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]"><Icon className="w-4 h-4" /></button>
              ))}
              <div className="w-px h-5 bg-[#e5e5e5] mx-1" />
              {[List, ListOrdered, AlignLeft, AlignCenter, AlignRight].map((Icon, i) => (
                <button key={i} className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]"><Icon className="w-4 h-4" /></button>
              ))}
              <div className="w-px h-5 bg-[#e5e5e5] mx-1" />
              <button className="p-2 hover:bg-[#f5f5f5] rounded-lg transition-colors text-[#525252]"><ImagePlus className="w-4 h-4" /></button>
            </div>

            <textarea ref={contentRef} value={content} onChange={e => setContent(e.target.value)} placeholder="Start writing your article..." className="w-full text-[#262626] text-base leading-7 outline-none resize-none min-h-[400px] placeholder-[#d5d5d5]" />

            <div className="flex items-center gap-4 py-3 border-t border-[#e5e5e5] mt-8 text-xs text-[#a3a3a3]">
              <span>{wordCount} words</span>
              <span>{charCount} characters</span>
              <span>{readTime} min read</span>
            </div>
          </div>

          {/* Right Settings Panel */}
          <div className="hidden lg:block w-72 border-l border-[#e5e5e5] p-5 space-y-6 sticky top-[57px] h-[calc(100vh-57px)] overflow-y-auto">
            <div>
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider block mb-3">Assign Author</span>
              <select
                value={assignedAuthor}
                onChange={e => setAssignedAuthor(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none"
              >
                <option value="">Admin (self)</option>
                {authors.map(a => <option key={a.id} value={a.name}>{a.name} — {a.org}</option>)}
              </select>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider block mb-3">Schedule</span>
              <div className="flex items-center gap-2 bg-[#f5f5f5] rounded-lg px-3 py-2 border border-[#e5e5e5]">
                <Clock className="w-3.5 h-3.5 text-[#737373]" />
                <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="text-xs text-[#0a0a0a] bg-transparent outline-none flex-1" />
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider block mb-3">Tags</span>
              <div className="flex flex-wrap gap-1.5">
                {tagOptions.map(tag => (
                  <button key={tag} onClick={() => setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])} className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${tags.includes(tag) ? "bg-[#F44444] text-white" : "bg-[#f5f5f5] text-[#525252] border border-[#e5e5e5] hover:bg-[#ebebeb]"}`}>{tag}</button>
                ))}
              </div>
            </div>
            <div>
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider block mb-3">SEO</span>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-[#737373] block mb-1">URL Slug</label>
                  <input type="text" value={slug} onChange={e => setSlug(e.target.value)} placeholder="article-url-slug" className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                </div>
                <div>
                  <label className="text-xs text-[#737373] block mb-1">Meta Description</label>
                  <textarea value={seoDescription} onChange={e => setSeoDescription(e.target.value)} placeholder="Brief description for search engines..." className="w-full px-3 py-2 rounded-lg bg-[#f5f5f5] border border-[#e5e5e5] text-xs outline-none resize-none min-h-[60px] focus:ring-2 focus:ring-[#F44444]/20 transition-all" />
                  <span className="text-[10px] text-[#a3a3a3] mt-1 block">{seoDescription.length}/160</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── LIST VIEW ───
  return (
    <div className="p-6 lg:p-8 max-w-[1200px]">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-[#0a0a0a]">News & Editorial</h1>
        <button
          onClick={() => { resetEditor(); setView("editor"); }}
          className="px-4 py-2 rounded-full bg-[#F44444] text-white text-sm font-medium hover:bg-[#d64d3c] transition-colors cursor-pointer flex items-center gap-2"
        >
          <FileText className="w-4 h-4" />
          Write Article
        </button>
      </div>

      <div className="mb-6">
        <AdminPillTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {activeTab === 0 && <EditorialQueueTab />}
      {activeTab === 1 && <AuthorsTab />}
      {activeTab === 2 && <PublishedTab />}
      {activeTab === 3 && (() => { setView("editor"); return null; })()}
    </div>
  );
}
