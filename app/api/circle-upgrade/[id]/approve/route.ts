import { NextRequest, NextResponse } from 'next/server';
import { AdminActionResponse } from '@/types/circle-upgrade';
import { sendCircleUpgradeApprovedEmail } from '@/lib/circle-email-service';
import { logActivity } from '@/lib/activity-logger';
import { getAuthUser, unauthorized } from '@/app/lib/auth';
import { writeAuditLog, extractIp } from '@/lib/audit';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== 'ADMIN') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });

  try {
    const { prisma } = await import('@/lib/prisma');
    const resolvedParams = await params;
    const requestId = parseInt(resolvedParams.id);

    if (!resolvedParams?.id || isNaN(requestId)) {
      return NextResponse.json({ success: false, message: 'Invalid request ID' } as AdminActionResponse, { status: 400 });
    }

    const upgradeRequest = await prisma.circleUpgradeRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });

    if (!upgradeRequest) {
      return NextResponse.json({ success: false, message: 'Upgrade request not found' } as AdminActionResponse, { status: 404 });
    }

    if (upgradeRequest.status !== 'PENDING') {
      return NextResponse.json({ success: false, message: 'Request has already been processed' } as AdminActionResponse, { status: 400 });
    }

    // Atomic: update request, upgrade user role, create notification
    const [updatedRequest] = await prisma.$transaction([
      prisma.circleUpgradeRequest.update({
        where: { id: requestId },
        data: { status: 'APPROVED' }
      }),
      prisma.user.update({
        where: { id: upgradeRequest.userId },
        data: {
          role: 'CIRCLE',
          circleWelcomeSeen: false,
          name: upgradeRequest.fullName || undefined,
          title: upgradeRequest.professionalTitle || undefined,
          location: upgradeRequest.location || undefined,
          country: upgradeRequest.country || undefined,
          district: upgradeRequest.district || undefined,
          city: upgradeRequest.city || undefined,
          pincode: upgradeRequest.pincode || undefined,
          website: upgradeRequest.website || undefined,
          bio: upgradeRequest.bio || undefined,
        }
      }),
      prisma.notification.create({
        data: {
          type: 'CIRCLE_WELCOME',
          userId: upgradeRequest.userId,
          recipientId: upgradeRequest.userId,
          time: new Date().toISOString(),
          group: 'TODAY',
          unread: true
        }
      }),
    ]);

    // Send approval email — best effort, non-transactional
    try {
      const userPrefs = await prisma.user.findUnique({
        where: { id: upgradeRequest.userId },
        select: { notificationPrefs: true },
      });
      const emailEnabled = (userPrefs?.notificationPrefs as any)?.email?.circleApproved ?? true;
      if (emailEnabled) {
        await sendCircleUpgradeApprovedEmail(upgradeRequest as any);
      }
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
    }

    logActivity({
      eventType: 'CIRCLE_APPROVED',
      userId: upgradeRequest.user.id,
      userName: upgradeRequest.user.name,
      handle: upgradeRequest.user.handle,
      avatar: upgradeRequest.user.avatar || undefined,
    });

    writeAuditLog({
      action: 'CIRCLE_REQUEST_APPROVE',
      actorId: authUser.id,
      targetId: upgradeRequest.userId,
      targetType: 'circle_upgrade_request',
      meta: { requestId },
      ip: extractIp(request),
    });

    return NextResponse.json({
      success: true,
      message: 'Request approved successfully. User has been upgraded to Circle.',
      request: updatedRequest
    } as AdminActionResponse);

  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({ success: false, message: 'Internal server error' } as AdminActionResponse, { status: 500 });
  }
}