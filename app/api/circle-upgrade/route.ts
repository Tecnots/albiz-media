import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  CircleUpgradeFormData, 
  CircleUpgradeResponse, 
  AccountType,
  CompanyRegistrationType,
  CircleAccountType,
  CircleDocumentType
} from '@/types/circle-upgrade';

// Helper function to convert account types (company only)
const convertAccountType = (type: AccountType): CircleAccountType => {
  return 'COMPANY';
};

// Helper function to convert document types (company only)
const convertDocumentType = (
  documentType: CompanyRegistrationType
): CircleDocumentType => {
  const typeMap: Record<string, CircleDocumentType> = {
    'GST': 'GST',
    'CERTIFICATE_OF_INCORPORATION': 'CERTIFICATE_OF_INCORPORATION',
    'PAN': 'COMPANY_PAN',
    'MSME': 'MSME',
  };
  
  return typeMap[documentType] || 'COMPANY_PAN';
};

// Helper function to save uploaded file
async function saveUploadedFile(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Create uploads directory if it doesn't exist
  const uploadsDir = join(process.cwd(), 'public', 'uploads', 'circle-upgrade');
  try {
    await mkdir(uploadsDir, { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
  
  // Generate unique filename
  const fileExtension = file.name.split('.').pop();
  const uniqueFilename = `${uuidv4()}.${fileExtension}`;
  const filePath = join(uploadsDir, uniqueFilename);
  
  // Save file
  await writeFile(filePath, buffer);
  
  // Return public URL
  return `/uploads/circle-upgrade/${uniqueFilename}`;
}

export async function POST(request: NextRequest) {
  try {
    console.log('Circle upgrade request received');
    
    // Dynamic import of Prisma client
    const { prisma } = await import('@/lib/prisma');
    
    // Check if Prisma client is properly initialized
    if (!prisma) {
      console.error('Prisma client is not initialized');
      return NextResponse.json({
        success: false,
        message: 'Database connection error'
      } as CircleUpgradeResponse, { status: 500 });
    }
    
    const formData = await request.formData();
    console.log('Form data entries:', Array.from(formData.keys()));
    
    // Extract form fields
    const fullName = formData.get('fullName') as string;
    const professionalTitle = formData.get('professionalTitle') as string;
    const company = formData.get('company') as string;
    const location = formData.get('location') as string;
    const website = formData.get('website') as string;
    const linkedin = formData.get('linkedin') as string;
    const bio = formData.get('bio') as string;
    const reason = formData.get('reason') as string;
    const accountType = 'company' as AccountType; // Company only
    const userId = formData.get('userId') as string;
    
    console.log('Extracted fields:', { fullName, professionalTitle, company, location, accountType, userId });
    
    // Extract company verification fields
    const registrationType = formData.get('registrationType') as CompanyRegistrationType;
    const registrationNumber = formData.get('registrationNumber') as string;
    
    // Extract multiple documents
    const documentFiles: File[] = [];
    const documentEntries = Array.from(formData.entries())
      .filter(([key]) => key.startsWith('verificationDocuments['))
      .map(([, value]) => value as File);
    
    documentFiles.push(...documentEntries);
    
    // Validate required fields
    if (!fullName?.trim() || !professionalTitle?.trim() || !company?.trim() || !location?.trim() || !reason?.trim()) {
      return NextResponse.json({
        success: false,
        message: 'All required fields must be filled'
      } as CircleUpgradeResponse, { status: 400 });
    }
    
    if (!registrationType || !registrationNumber?.trim() || documentFiles.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'All verification fields are required and at least one document must be uploaded'
      } as CircleUpgradeResponse, { status: 400 });
    }
    
    if (!userId || isNaN(Number(userId))) {
      return NextResponse.json({
        success: false,
        message: 'Valid user ID is required'
      } as CircleUpgradeResponse, { status: 400 });
    }
    
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: Number(userId) }
    });
    
    if (!user) {
      return NextResponse.json({
        success: false,
        message: 'User not found'
      } as CircleUpgradeResponse, { status: 404 });
    }
    
    // Check if user already has a pending or approved request
    console.log('Checking existing requests for user:', userId);
    const existingRequest = await prisma.circleUpgradeRequest.findFirst({
      where: {
        userId: Number(userId),
        status: {
          in: ['PENDING', 'APPROVED']
        }
      }
    });
    console.log('Existing request found:', existingRequest);
    
    if (existingRequest) {
      if (existingRequest.status === 'PENDING') {
        return NextResponse.json({
          success: false,
          message: 'You already have a pending Circle upgrade request'
        } as CircleUpgradeResponse, { status: 409 });
      } else {
        return NextResponse.json({
          success: false,
          message: 'You are already a Circle member'
        } as CircleUpgradeResponse, { status: 409 });
      }
    }
    
    // Save uploaded files
    const documentUrls: string[] = [];
    try {
      for (const file of documentFiles) {
        const documentUrl = await saveUploadedFile(file);
        documentUrls.push(documentUrl);
      }
    } catch (error) {
      console.error('File upload error:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to upload documents'
      } as CircleUpgradeResponse, { status: 500 });
    }
    
    // Create Circle upgrade request
    const requestData: any = {
      accountType: convertAccountType(accountType),
      documentType: convertDocumentType(registrationType),
      documentNumber: registrationNumber.trim(),
      documentUrl: documentUrls[0], // Primary document (for now, we only store one in DB)
      status: 'PENDING',
      fullName: fullName.trim(),
      professionalTitle: professionalTitle.trim(),
      company: company.trim(), // Company is now required
      location: location.trim(),
      reason: reason.trim(),
      user: {
        connect: {
          id: Number(userId)
        }
      }
    };

    // TODO: For future implementation - store additional documents in a separate table
    // For now, we only save the primary document to the database
    if (documentUrls.length > 1) {
      console.log(`Note: ${documentUrls.length - 1} additional documents were uploaded but only the primary document is stored in database. Additional documents:`, documentUrls.slice(1));
    }

    // Add optional fields only if they have values
    if (website?.trim()) {
      requestData.website = website.trim();
    }
    if (linkedin?.trim()) {
      requestData.linkedin = linkedin.trim();
    }
    if (bio?.trim()) {
      requestData.bio = bio.trim();
    }

    const upgradeRequest = await prisma.circleUpgradeRequest.create({
      data: requestData
    });
    
    // TODO: Send email notification to user
    // await sendUpgradeRequestEmail(user.email, upgradeRequest);
    
    return NextResponse.json({
      success: true,
      message: 'Circle upgrade request submitted successfully',
      request: upgradeRequest
    } as CircleUpgradeResponse);
    
  } catch (error) {
    console.error('Circle upgrade request error:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error'
    } as CircleUpgradeResponse, { status: 500 });
  }
}

// GET endpoint for admin to fetch all requests
export async function GET(request: NextRequest) {
  try {
    // Dynamic import of Prisma client
    const { prisma } = await import('@/lib/prisma');
    
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;
    
    const where = status ? { status: status.toUpperCase() as any } : {};
    
    // Fetch requests with user information
    const requests = await prisma.circleUpgradeRequest.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            handle: true,
            avatar: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit
    });
    
    // Get total count for pagination
    const total = await prisma.circleUpgradeRequest.count({ where });
    
    return NextResponse.json({
      success: true,
      data: requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
    
  } catch (error) {
    console.error('Fetch circle upgrade requests error:', error);
    return NextResponse.json({
      success: false,
      message: 'Internal server error'
    }, { status: 500 });
  }
}
