import { NextRequest, NextResponse } from 'next/server';
import { AdminActionResponse } from '@/types/circle-upgrade';
import { sendCircleUpgradeApprovedEmail } from '@/lib/circle-email-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Dynamic import of Prisma client
    const { prisma } = await import('@/lib/prisma');
    
    // Await params in Next.js App Router
    const resolvedParams = await params;
    console.log('Approve request called with params:', resolvedParams);
    console.log('Raw ID:', resolvedParams.id);
    console.log('Params type:', typeof resolvedParams);
    console.log('Params keys:', Object.keys(resolvedParams));
    
    if (!resolvedParams || !resolvedParams.id) {
      console.log('No params.id found');
      return NextResponse.json({
        success: false,
        message: 'Missing request ID'
      } as AdminActionResponse, { status: 400 });
    }
    
    const requestId = parseInt(resolvedParams.id);
    console.log('Parsed requestId:', requestId);
    
    if (isNaN(requestId)) {
      console.log('Invalid request ID - isNaN check failed');
      return NextResponse.json({
        success: false,
        message: 'Invalid request ID'
      } as AdminActionResponse, { status: 400 });
    }

    // Find the upgrade request
    console.log('Looking for request with ID:', requestId);
    const upgradeRequest = await prisma.circleUpgradeRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });

    console.log('Found upgrade request:', upgradeRequest);

    if (!upgradeRequest) {
      console.log('Upgrade request not found');
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

    // Update user role to CIRCLE and copy upgrade data to profile
    await prisma.user.update({
      where: { id: upgradeRequest.userId },
      data: {
        role: 'CIRCLE',
        name: upgradeRequest.fullName || undefined,
        title: upgradeRequest.professionalTitle || undefined,
        location: upgradeRequest.location || undefined,
        website: upgradeRequest.website || undefined,
        bio: upgradeRequest.bio || undefined,
      }
    });

    // Send approval email to user
    try {
      await sendCircleUpgradeApprovedEmail(upgradeRequest as any);
      console.log('Approval email sent to user');
    } catch (emailError) {
      console.error('Failed to send approval email:', emailError);
      // Don't fail the request if email fails
    }

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
