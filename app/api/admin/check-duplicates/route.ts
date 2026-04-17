import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/admin/check-duplicates - Check for duplicate posts without deleting
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    
    console.log("Checking for duplicate posts...");
    
    // Check for posts with duplicate titles
    const titleDuplicates = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        title,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id ORDER BY id) as duplicate_ids,
        ARRAY_AGG(COALESCE(userId, 0) ORDER BY id) as user_ids,
        ARRAY_AGG(type ORDER BY id) as types
      FROM "Post" 
      WHERE title IS NOT NULL 
        AND title != ''
      GROUP BY title
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
    `;
    
    // Check for posts with duplicate content
    const contentDuplicates = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        LEFT(content, 100) as content_preview,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id ORDER BY id) as duplicate_ids
      FROM "Post" 
      WHERE content IS NOT NULL 
        AND content != ''
        AND LENGTH(content) > 50
      GROUP BY LEFT(content, 100)
      HAVING COUNT(*) > 1
      ORDER BY duplicate_count DESC
      LIMIT 20
    `;
    
    // Check for posts with duplicate IDs (shouldn't happen)
    const idDuplicates = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        COUNT(*) as count
      FROM "Post" 
      GROUP BY id
      HAVING COUNT(*) > 1
    `;
    
    // Get total post count
    const totalPosts = await prisma.$queryRaw<any[]>`
      SELECT COUNT(*) as count FROM "Post"
    `;
    
    // Get sample of posts to see structure
    const samplePosts = await prisma.$queryRaw<any[]>`
      SELECT id, title, type, "userId", createdAt 
      FROM "Post" 
      ORDER BY id 
      LIMIT 10
    `;
    
    console.log(`Found ${titleDuplicates.length} title duplicates`);
    console.log(`Found ${contentDuplicates.length} content duplicates`);
    console.log(`Found ${idDuplicates.length} ID duplicates`);
    console.log(`Total posts: ${totalPosts[0]?.count || 0}`);
    
    return NextResponse.json({
      success: true,
      summary: {
        totalPosts: totalPosts[0]?.count || 0,
        titleDuplicates: titleDuplicates.length,
        contentDuplicates: contentDuplicates.length,
        idDuplicates: idDuplicates.length
      },
      titleDuplicates: titleDuplicates,
      contentDuplicates: contentDuplicates,
      idDuplicates: idDuplicates,
      samplePosts: samplePosts
    });
    
  } catch (error) {
    console.error("Error checking duplicates:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
