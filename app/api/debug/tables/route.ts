import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/debug/tables - Check what tables exist in the database
export async function GET(request: NextRequest) {
  try {
    console.log("Debug: Checking database tables...");
    
    // Try to get table information
    const tables = await prisma.$queryRaw<any[]>`
      SELECT table_name, table_schema 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log("Debug: Tables found:", tables);
    
    // Check if SavedPost table exists specifically
    const savedPostTable = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'SavedPost' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    console.log("Debug: SavedPost columns:", savedPostTable);
    
    // Check if UserCollection table exists
    const userCollectionTable = await prisma.$queryRaw<any[]>`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'UserCollection' AND table_schema = 'public'
      ORDER BY ordinal_position
    `;
    
    console.log("Debug: UserCollection columns:", userCollectionTable);

    return NextResponse.json({ 
      success: true,
      tables,
      savedPostTable,
      userCollectionTable
    });

  } catch (error) {
    console.error("Debug: Error checking tables:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to check tables",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}
