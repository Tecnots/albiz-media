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
    console.log('Available Prisma models:', Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$')));
    
    // Extract form fields
    const fullName = formData.get('fullName') as string;
    const professionalTitle = formData.get('professionalTitle') as string;
    const company = formData.get('company') as string;
    const city = formData.get('city') as string;
    const district = formData.get('district') as string;
    const country = formData.get('country') as string;
    const pincode = formData.get('pincode') as string;
    const website = formData.get('website') as string;
    const linkedin = formData.get('linkedin') as string;
    const bio = formData.get('bio') as string;
    const reason = formData.get('reason') as string;
    const accountType = 'company' as AccountType; // Company only
    const userId = formData.get('userId') as string;
    
    console.log('Extracted fields:', { fullName, professionalTitle, company, city, accountType, userId });
    
    // Extract company verification fields - multiple registration entries
    const registrationTypes: CompanyRegistrationType[] = [];
    const registrationNumbers: string[] = [];
    const allDocumentFiles: File[][] = [];

    // Parse registration entries
    let regIndex = 0;
    while (true) {
      const regType = formData.get(`registrationType[${regIndex}]`) as CompanyRegistrationType;
      const regNumber = formData.get(`registrationNumber[${regIndex}]`) as string;

      if (!regType && !regNumber) break;

      registrationTypes[regIndex] = regType;
      registrationNumbers[regIndex] = regNumber;

      // Extract documents for this registration
      const regDocuments: File[] = [];
      let docIndex = 0;
      while (true) {
        const docKey = `verificationDocuments[${regIndex}][${docIndex}]`;
        const docFile = formData.get(docKey) as File;
        if (!docFile) break;
        regDocuments.push(docFile);
        docIndex++;
      }
      allDocumentFiles[regIndex] = regDocuments;

      regIndex++;
    }

    // Validate at least one registration entry
    if (registrationTypes.length === 0 || registrationTypes.every((t, i) => !t && !registrationNumbers[i]?.trim())) {
      return NextResponse.json({
        success: false,
        message: 'At least one registration entry is required'
      } as CircleUpgradeResponse, { status: 400 });
    }

    // Validate each registration entry has required fields
    for (let i = 0; i < registrationTypes.length; i++) {
      if (!registrationTypes[i] || !registrationNumbers[i]?.trim() || !allDocumentFiles[i] || allDocumentFiles[i].length === 0) {
        return NextResponse.json({
          success: false,
          message: `Registration entry ${i + 1} is missing required fields (type, number, or documents)`
        } as CircleUpgradeResponse, { status: 400 });
      }
    }
    
    // Validate required fields
    if (!fullName?.trim() || !professionalTitle?.trim() || !company?.trim() || !city?.trim() || !reason?.trim()) {
      return NextResponse.json({
        success: false,
        message: 'All required fields must be filled'
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
    console.log('Checking existing requests for user:', userId, 'as Number:', Number(userId));
    const existingRequest = await prisma.circleUpgradeRequest.findFirst({
      where: {
        userId: Number(userId),
        status: {
          in: ['PENDING', 'APPROVED'] as CircleUpgradeStatus[]
        }
      },
      select: {
        id: true,
        status: true
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
    
    // Save uploaded files for all registration entries
    const allDocumentUrls: string[][] = [];
    try {
      for (let regIdx = 0; regIdx < allDocumentFiles.length; regIdx++) {
        const regUrls: string[] = [];
        for (const file of allDocumentFiles[regIdx]) {
          const documentUrl = await saveUploadedFile(file);
          regUrls.push(documentUrl);
        }
        allDocumentUrls[regIdx] = regUrls;
      }
    } catch (error) {
      console.error('File upload error:', error);
      return NextResponse.json({
        success: false,
        message: 'Failed to upload documents'
      } as CircleUpgradeResponse, { status: 500 });
    }

    // Create Circle upgrade request (without specific document info since we have multiple registrations)
    const requestData: any = {
      accountType: convertAccountType(accountType),
      documentType: null, // No single document type anymore
      documentNumber: null, // No single document number anymore
      documentUrl: null, // No single document URL anymore
      status: 'PENDING',
      fullName: fullName.trim(),
      professionalTitle: professionalTitle.trim(),
      company: company.trim(),
      city: city.trim(),
      district: district?.trim() || null,
      country: country?.trim() || null,
      pincode: pincode?.trim() || null,
      reason: reason.trim(),
      user: {
        connect: {
          id: Number(userId)
        }
      }
    };

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

    // Save all registration entries and their documents
    for (let regIdx = 0; regIdx < registrationTypes.length; regIdx++) {
      const convertedDocType = convertDocumentType(registrationTypes[regIdx]);

      // Create registration entry
      const registration = await prisma.circleUpgradeRegistration.create({
        data: {
          requestId: upgradeRequest.id,
          registrationType: convertedDocType,
          registrationNumber: registrationNumbers[regIdx].trim()
        }
      });

      // Save documents for this registration
      for (const documentUrl of allDocumentUrls[regIdx]) {
        await prisma.circleUpgradeDocument.create({
          data: {
            requestId: upgradeRequest.id,
            registrationId: registration.id,
            documentUrl: documentUrl,
            documentType: convertedDocType
          }
        });
      }
    }

    console.log(`Saved ${registrationTypes.length} registration entries with ${allDocumentUrls.flat().length} total documents for request ${upgradeRequest.id}`);

    // TODO: Send email notification to user
    // await sendUpgradeRequestEmail(user.email, upgradeRequest);
    
    // Create pending notification for the user
    await prisma.notification.create({
      data: {
        type: 'CIRCLE_PENDING',
        userId: 13, // Admin/System account as sender
        recipientId: Number(userId),
        time: new Date().toISOString(),
        group: 'TODAY',
        unread: true
      }
    });

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
    
    // Fetch requests with user information, registrations, and documents
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
        },
        registrations: {
          include: {
            documents: {
              select: {
                id: true,
                documentUrl: true,
                documentType: true
              }
            }
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
