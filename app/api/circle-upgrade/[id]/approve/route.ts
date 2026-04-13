import { NextRequest, NextResponse } from 'next/server';
import { AdminActionResponse } from '@/types/circle-upgrade';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Dynamic import of Prisma client
    const { prisma } = await import('@/lib/prisma');
    
    const requestId = parseInt(params.id);
    
    if (isNaN(requestId)) {
      return NextResponse.json({
        success: false,
        message: 'Invalid request ID'
      } as AdminActionResponse, { status: 400 });
    }

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

    // Update request status to APPROVED
    const updatedRequest = await prisma.circleUpgradeRequest.update({
      where: { id: requestId },
      data: { status: 'APPROVED' }
    });

    // Update user role to CIRCLE
    await prisma.user.update({
      where: { id: upgradeRequest.userId },
      data: { role: 'CIRCLE' }
    });

    // TODO: Send approval email to user
    // await sendApprovalEmail(upgradeRequest.user.email, upgradeRequest);

    return NextResponse.json({
      success: true,
      message: 'Request approved successfully. User has been upgraded to Circle.',
      request: updatedRequest
    } as AdminActionResponse);

  } catch (error) {
    console.error('Approval error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    } as AdminActionResponse, { status: 500 });
  }
}
