import { NextRequest, NextResponse } from 'next/server';
import { AdminActionResponse } from '@/types/circle-upgrade';
import { sendCircleUpgradeRejectedEmail } from '@/lib/circle-email-service';
import { logActivity } from '@/lib/activity-logger';
import { getAuthUser, unauthorized } from '@/app/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  if (authUser.role !== 'ADMIN') return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });

  try {
    // Dynamic import of Prisma client
    const { prisma } = await import('@/lib/prisma');
    
    // Await params in Next.js App Router
    const resolvedParams = await params;
    const requestId = parseInt(resolvedParams.id);
    
    if (isNaN(requestId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request ID'
      } as AdminActionResponse, { status: 400 });
    }

    // Get rejection reason from request body
    const body = await request.json();
    const reason = body.reason || '';

    // Find the upgrade request
    const upgradeRequest = await prisma.circleUpgradeRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });

    if (!upgradeRequest) {
      return NextResponse.json({
        success: false,
        message: 'Upgrade request not found'
      } as AdminActionResponse, { status: 404 });
    }

    if (upgradeRequest.status !== 'PENDING') {
      return NextResponse.json({
        success: false,
        message: 'Request has already been processed'
      } as AdminActionResponse, { status: 400 });
    }

    // Update request status to REJECTED
    const updatedRequest = await prisma.circleUpgradeRequest.update({
      where: { id: requestId },
      data: { status: 'REJECTED' }
    });

    // Create rejection notification for the user
    await prisma.notification.create({
      data: {
        type: 'CIRCLE_REJECTED',
        userId: upgradeRequest.userId,
        recipientId: upgradeRequest.userId,
        time: new Date().toISOString(),
        group: 'TODAY',
        unread: true,
        message: reason || undefined,
      }
    });

    // Send rejection email only if user has that preference enabled (default: true)
    try {
      const userPrefs = await prisma.user.findUnique({
        where: { id: upgradeRequest.userId },
        select: { notificationPrefs: true },
      });
      const emailEnabled = (userPrefs?.notificationPrefs as any)?.email?.circleDeclined ?? true;
      if (emailEnabled) {
        await sendCircleUpgradeRejectedEmail(upgradeRequest as any, reason);
        console.log('Rejection email sent to user');
      }
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
    }

    // Log activity
    logActivity({
      eventType: 'CIRCLE_REJECTED',
      userId: upgradeRequest.user.id,
      userName: upgradeRequest.user.name,
      handle: upgradeRequest.user.handle,
      avatar: upgradeRequest.user.avatar || undefined,
      meta: reason || undefined,
    });

    return NextResponse.json({
      success: true,
      message: 'Request rejected successfully.',
      request: updatedRequest
    } as AdminActionResponse);

  } catch (error) {
    console.error('Rejection error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    } as AdminActionResponse, { status: 500 });
  }
}
