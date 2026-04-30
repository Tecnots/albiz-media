'use client';

import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Check, 
  X, 
  Download, 
  Eye, 
  Calendar, 
  Mail, 
  MapPin, 
  Globe, 
  Linkedin,
  FileText,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { 
  CircleUpgradeRequestWithUser, 
  CircleUpgradeStatus,
  AdminActionResponse 
} from '@/types/circle-upgrade';

export default function CircleUpgradeAdmin() {
  const [requests, setRequests] = useState<CircleUpgradeRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<CircleUpgradeRequestWithUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<CircleUpgradeStatus | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '10',
        ...(statusFilter !== 'ALL' && { status: statusFilter })
      });
      
      const response = await fetch(`/api/circle-upgrade?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setRequests(data.data);
        setTotalPages(data.pagination.pages);
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [currentPage, statusFilter]);

  const handleApprove = async (requestId: number) => {
    try {
      setActionLoading(requestId);
      const response = await fetch(`/api/circle-upgrade/${requestId}/approve`, {
        method: 'POST'
      });
      
      const data: AdminActionResponse = await response.json();
      
      if (data.success) {
        // Update the request in the list
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'APPROVED' as CircleUpgradeStatus }
              : req
          )
        );
        
        // Show success message
        alert('Request approved successfully! User has been upgraded to Circle.');
      } else {
        alert(data.message || 'Failed to approve request');
      }
    } catch (error) {
      console.error('Approval error:', error);
      alert('Failed to approve request');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: number) => {
    const reason = prompt('Please provide a reason for rejection (optional):');
    
    try {
      setActionLoading(requestId);
      const response = await fetch(`/api/circle-upgrade/${requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || '' })
      });
      
      const data: AdminActionResponse = await response.json();
      
      if (data.success) {
        // Update the request in the list
        setRequests(prev => 
          prev.map(req => 
            req.id === requestId 
              ? { ...req, status: 'REJECTED' as CircleUpgradeStatus }
              : req
          )
        );
        
        alert('Request rejected successfully.');
      } else {
        alert(data.message || 'Failed to reject request');
      }
    } catch (error) {
      console.error('Rejection error:', error);
      alert('Failed to reject request');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusColor = (status: CircleUpgradeStatus) => {
    switch (status) {
      case 'PENDING': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'APPROVED': return 'bg-green-100 text-green-800 border-green-200';
      case 'REJECTED': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: CircleUpgradeStatus) => {
    switch (status) {
      case 'PENDING': return <Calendar className="w-3 h-3" />;
      case 'APPROVED': return <Check className="w-3 h-3" />;
      case 'REJECTED': return <X className="w-3 h-3" />;
      default: return null;
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'ALL' || request.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const RequestCard = ({ request }: { request: CircleUpgradeRequestWithUser }) => (
    <div className="bg-white border border-[#e5e5e5] rounded-xl p-6 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#F44444]/10 rounded-full flex items-center justify-center">
            {request.user.avatar ? (
              <img 
                src={request.user.avatar} 
                alt={request.user.name} 
                className="w-12 h-12 rounded-full object-cover"
              />
            ) : (
              <User className="w-6 h-6 text-[#F44444]" />
            )}
          </div>
          <div>
            <h3 className="font-semibold text-[#0a0a0a]">{request.user.name}</h3>
            <p className="text-sm text-[#737373]">{request.user.email}</p>
            <p className="text-xs text-[#a3a3a3]">@{request.user.handle}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded-full text-xs font-medium border flex items-center gap-1 ${getStatusColor(request.status)}`}>
            {getStatusIcon(request.status)}
            {request.status}
          </span>
        </div>
      </div>

      {/* Application Details */}
      <div className="space-y-3 mb-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <span className="text-[#a3a3a3]">Full Name</span>
            <p className="text-[#0a0a0a] font-medium">{request.fullName}</p>
          </div>
          <div>
            <span className="text-[#a3a3a3]">Title</span>
            <p className="text-[#0a0a0a] font-medium">{request.professionalTitle}</p>
          </div>
          <div>
            <span className="text-[#a3a3a3]">Company</span>
            <p className="text-[#0a0a0a] font-medium">{request.company || '—'}</p>
          </div>
          <div>
            <span className="text-[#a3a3a3]">Location</span>
            <p className="text-[#0a0a0a] font-medium">{request.location}</p>
          </div>
        </div>

        {(request.website || request.linkedin) && (
          <div className="flex items-center gap-4 text-sm">
            {request.website && (
              <a 
                href={request.website.startsWith('http') ? request.website : `https://${request.website}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#F44444] hover:text-[#d64d3c]"
              >
                <Globe className="w-4 h-4" />
                {request.website}
              </a>
            )}
            {request.linkedin && (
              <a 
                href={request.linkedin.startsWith('http') ? request.linkedin : `https://${request.linkedin}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[#F44444] hover:text-[#d64d3c]"
              >
                <Linkedin className="w-4 h-4" />
                {request.linkedin}
              </a>
            )}
          </div>
        )}

        {request.bio && (
          <div className="text-sm">
            <span className="text-[#a3a3a3]">Bio</span>
            <p className="text-[#737373] mt-0.5">{request.bio}</p>
          </div>
        )}

        <div className="text-sm">
          <span className="text-[#a3a3a3]">Reason for joining</span>
          <p className="text-[#737373] mt-0.5">{request.reason}</p>
        </div>

        <div className="text-xs text-[#a3a3a3]">
          Submitted {new Date(request.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Verification Details */}
      <div className="border-t border-[#e5e5e5] pt-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="w-4 h-4 text-[#a3a3a3]" />
          <span className="text-sm font-medium text-[#0a0a0a]">
            Company Verification Documents
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm mb-4">
          <div>
            <span className="text-[#737373]">Registration Type:</span>
            <p className="text-[#0a0a0a] font-medium">{request.documentType.replace(/_/g, ' ')}</p>
          </div>
          <div>
            <span className="text-[#737373]">Registration Number:</span>
            <p className="text-[#0a0a0a] font-medium">{request.documentNumber}</p>
          </div>
        </div>

        {/* Documents List */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-[#0a0a0a]">Uploaded Documents:</div>
          
          {/* Primary Document */}
          <div className="flex items-center justify-between p-3 bg-[#fafafa] rounded-lg">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#F44444]" />
              <span className="text-sm text-[#0a0a0a]">Primary Document</span>
            </div>
            <div className="flex items-center gap-2">
              <a 
                href={request.documentUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-[#F44444] hover:text-[#d64d3c]"
              >
                <Eye className="w-4 h-4" />
                View
              </a>
              <a 
                href={request.documentUrl} 
                download
                className="flex items-center gap-1 text-sm text-[#F44444] hover:text-[#d64d3c]"
              >
                <Download className="w-4 h-4" />
                Download
              </a>
            </div>
          </div>

          {/* Additional Documents - if they exist in the database */}
          {/* Note: This would require adding additionalDocumentUrls field to the database schema */}
          {/* For now, showing placeholder for future implementation */}
        </div>
      </div>

      {/* Actions */}
      {request.status === 'PENDING' && (
        <div className="flex gap-2">
          <button
            onClick={() => handleApprove(request.id)}
            disabled={actionLoading === request.id}
            className="flex-1 px-4 py-2 bg-[#22c55e] text-white rounded-lg hover:bg-[#16a34a] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {actionLoading === request.id ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            Approve
          </button>
          <button
            onClick={() => handleReject(request.id)}
            disabled={actionLoading === request.id}
            className="flex-1 px-4 py-2 bg-[#ef4444] text-white rounded-lg hover:bg-[#dc2626] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {actionLoading === request.id ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            Reject
          </button>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="bg-white border-b border-[#e5e5e5]">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#0a0a0a]">Circle Upgrade Requests</h1>
              <p className="text-[#737373] mt-1">Review and manage Circle membership applications</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-[#e5e5e5]">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#a3a3a3]" />
              <input
                type="text"
                placeholder="Search by name, email, or application name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-[#e5e5e5] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20"
              />
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-[#a3a3a3]" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as CircleUpgradeStatus | 'ALL')}
                className="px-4 py-2 border border-[#e5e5e5] rounded-lg text-sm outline-none focus:ring-2 focus:ring-[#F44444]/20"
              >
                <option value="ALL">All Status</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#F44444] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredRequests.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-[#a3a3a3] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[#0a0a0a] mb-2">No requests found</h3>
            <p className="text-[#737373]">
              {searchTerm || statusFilter !== 'ALL' 
                ? 'Try adjusting your search or filters'
                : 'No Circle upgrade requests have been submitted yet'
              }
            </p>
          </div>
        ) : (
          <>
            {/* Results Count */}
            <div className="mb-4 text-sm text-[#737373]">
              Showing {filteredRequests.length} request{filteredRequests.length !== 1 ? 's' : ''}
            </div>

            {/* Requests Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredRequests.map(request => (
                <RequestCard key={request.id} request={request} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-[#e5e5e5] hover:bg-[#fafafa] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <span className="px-4 py-2 text-sm text-[#737373]">
                  Page {currentPage} of {totalPages}
                </span>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-[#e5e5e5] hover:bg-[#fafafa] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
