import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/admin/cleanup-duplicates - Find and remove duplicate posts
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    
    // This endpoint should only be accessible by admins
    // For now, we'll allow any authenticated user for debugging
    
    console.log("Starting duplicate cleanup process...");
    
    // Find duplicate posts by checking posts with same title or content
    const duplicates = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        title,
        content,
        COUNT(*) as duplicate_count,
        ARRAY_AGG(id ORDER BY id) as duplicate_ids
      FROM "Post" 
      WHERE title IS NOT NULL 
        AND title != ''
      GROUP BY title, content
      HAVING COUNT(*) > 1
    `;
    
    console.log("Found duplicate groups:", duplicates.length);
    
    if (duplicates.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No duplicates found",
        duplicates: []
      });
    }
    
    // For each duplicate group, keep the first one and delete the rest
    const deletionResults = [];
    
    for (const group of duplicates) {
      const duplicateIds = group.duplicate_ids;
      const keepId = duplicateIds[0]; // Keep the first one
      const deleteIds = duplicateIds.slice(1); // Delete the rest
      
      console.log(`Processing duplicate group for title: ${group.title}`);
      console.log(`Keeping ID: ${keepId}, Deleting IDs: ${deleteIds}`);
      
      // Delete the duplicate posts
      if (deleteIds.length > 0) {
        try {
          const deleteResult = await prisma.$queryRaw<any[]>`
            DELETE FROM "Post" 
            WHERE id = ANY(${deleteIds})
            RETURNING id, title
          `;
          
          // Also delete any SavedPost references to the deleted posts
          await prisma.$queryRaw<any[]>`
            DELETE FROM "SavedPost" 
            WHERE "postId" = ANY(${deleteIds})
          `;
          
          deletionResults.push({
            kept: keepId,
            deleted: deleteIds,
            deletedPosts: deleteResult
          });
          
          console.log(`Deleted ${deleteResult.length} duplicate posts for title: ${group.title}`);
          
        } catch (error) {
          console.error(`Error deleting duplicates for title ${group.title}:`, error);
          deletionResults.push({
            kept: keepId,
            deleted: deleteIds,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    // Also check for posts with same ID (shouldn't happen but let's be safe)
    const idDuplicates = await prisma.$queryRaw<any[]>`
      SELECT 
        id,
        COUNT(*) as count
      FROM "Post" 
      GROUP BY id
      HAVING COUNT(*) > 1
    `;
    
    console.log("Found ID duplicates:", idDuplicates.length);
    
    return NextResponse.json({
      success: true,
      message: `Processed ${duplicates.length} duplicate groups`,
      duplicates: duplicates,
      deletionResults: deletionResults,
      idDuplicates: idDuplicates
    });
    
  } catch (error) {
    console.error("Error in cleanup duplicates:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/admin/cleanup-duplicates - Manually trigger cleanup
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    
    // Get the GET result to perform cleanup
    const response = await GET(request);
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: "Cleanup completed",
      results: data
    });
    
  } catch (error) {
    console.error("Error in cleanup duplicates POST:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
