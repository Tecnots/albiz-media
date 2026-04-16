import { NextRequest, NextResponse } from 'next/server';
import { AdminActionResponse } from '@/types/circle-upgrade';
import { sendCircleUpgradeRejectedEmail } from '@/lib/circle-email-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      data: { 
        status: 'REJECTED',
        // Store rejection reason in bio field or add a new field to schema
        bio: `${upgradeRequest.bio || ''}\n\n[REJECTED] Reason: ${reason}`.trim()
      }
    });

    // Send rejection email to user
    try {
      await sendCircleUpgradeRejectedEmail(upgradeRequest, reason);
      console.log('Rejection email sent to user');
    } catch (emailError) {
      console.error('Failed to send rejection email:', emailError);
      // Don't fail the request if email fails
    }

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
