import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser, unauthorized } from "@/app/lib/auth";

// GET /api/user/saved - Fetch user's saved posts and collections
export async function GET(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) return unauthorized();
    
    // Additional security check
    if (!authUser.id) {
      return unauthorized();
    }
    
    const userId = authUser.id;
    
    // Get saved posts - use correct quoted table name
    let savedPosts = [];
    try {
      savedPosts = await prisma.$queryRaw<any[]>`
        SELECT "postId", "collectionId" FROM "SavedPost" 
        WHERE "userId" = ${userId}
      `;
      } catch (error) {
      // Try alternative query
      try {
        savedPosts = await prisma.$queryRaw<any[]>`
          SELECT postId, collectionId FROM "SavedPost" 
          WHERE userId = ${userId}
        `;
      } catch (altError) {
        savedPosts = [];
      }
    }

    const posts = savedPosts.map((r: any) => ({ 
      postId: r.postId, 
      collectionId: r.collectionId 
    }));
    
    
    // Get collections - use correct quoted table name
    let collections = [];
    try {
      collections = await prisma.$queryRaw<any[]>`
        SELECT id, name, image, createdAt FROM "UserCollection" 
        WHERE "userId" = ${userId}
        ORDER BY createdAt DESC
      `;
      } catch (error) {
      // Try alternative query
      try {
        collections = await prisma.$queryRaw<any[]>`
          SELECT id, name, image, createdAt FROM "UserCollection" 
          WHERE userId = ${userId}
          ORDER BY createdAt DESC
        `;
      } catch (altError) {
        collections = [];
      }
    }

    
    return NextResponse.json({ 
      success: true,
      collections, 
      posts,
      totalSaved: posts.length
    });

  } catch (error) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to fetch saved data",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// POST /api/user/saved - Add a post to saved items
export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthUser(request);
    if (!authUser) {
      return unauthorized();
    }
    
    // Additional security check
    if (!authUser.id) {
      return unauthorized();
    }
    const { postId, collectionId } = await request.json();
    const userId = authUser.id;
    
    if (!postId) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing postId" 
      }, { status: 400 });
    }

    // Check if post is already saved
    let existing = [];
    try {
      existing = await prisma.$queryRaw<any[]>`
        SELECT id, "collectionId" FROM "SavedPost" 
        WHERE "userId" = ${userId} AND "postId" = ${postId}
      `;
      console.log("Save API - Checking existing saved posts:", { userId, postId, existing });
    } catch (error) {
      console.error("Save API - Error checking existing posts:", error);
      existing = [];
    }

    if (existing.length > 0) {
      console.log("Save API - Post already saved:", { userId, postId, existing });
      return NextResponse.json({ 
        success: false, 
        error: "Post already saved",
        existing: existing
      }, { status: 409 });
    }

    // Save the post - use correct quoted table name
    try {
      
      // First check if the post exists in the Post table
      const postCheck = await prisma.$queryRaw<any[]>`
        SELECT id FROM "Post" WHERE id = ${postId}
      `;
      console.log("POST Saved API - Post exists check:", postCheck);
      
      if (postCheck.length === 0) {
        console.log("POST Saved API - Post does not exist in Post table, checking if it's a sponsored post");
        
        // Check if this is a sponsored post (ID >= 900) and create it if needed
        if (postId >= 900) {
          console.log("POST Saved API - This appears to be a sponsored post, creating it in database");
          
          // Import the sponsored posts data and content generator
          const { sponsoredPosts, generateSponsoredArticleContent } = await import("@/app/lib/data");
          const sponsoredPost = sponsoredPosts.find(p => p.id === postId);
          
          if (sponsoredPost) {
            console.log("POST Saved API - Found sponsored post data:", sponsoredPost);
            
            try {
              // Map frontend type to database enum value
              const postType = sponsoredPost.type === 'article' ? 'ARTICLE' : 
                              sponsoredPost.type === 'post' ? 'POST' : 'ARTICLE';
              
              console.log("POST Saved API - Mapped post type:", { frontend: sponsoredPost.type, database: postType });
              
              // Get content for sponsored article
              const articleContent = generateSponsoredArticleContent(postId);
              const content = articleContent ? articleContent.join('\n\n') : sponsoredPost.description || '';
              
              // Handle date field - it's a String in database, not DateTime
              const dateValue = sponsoredPost.date || new Date().toISOString().split('T')[0];
              console.log("POST Saved API - Date value:", { original: sponsoredPost.date, stored: dateValue });
              
              console.log("POST Saved API - Prepared post data:", {
                id: sponsoredPost.id,
                type: postType,
                title: sponsoredPost.title,
                date: dateValue,
                contentLength: content.length
              });
              
              // Prepare tags as PostgreSQL array format
              const tagsArray = sponsoredPost.tags || [];
              const tagsSql = tagsArray.length > 0 ? `{${tagsArray.map(tag => `"${tag}"`).join(',')}}` : '{}';
              
              console.log("POST Saved API - Tags array:", { frontend: tagsArray, sql: tagsSql });
              
              // Insert the sponsored post into the Post table
              await prisma.$executeRaw`
                INSERT INTO "Post" (id, "userId", type, title, description, content, date, image, tags, views, likes, comments, shares, status)
                VALUES (
                  ${sponsoredPost.id}, 
                  ${sponsoredPost.authorId || 1}, 
                  ${postType}, 
                  ${sponsoredPost.title}, 
                  ${sponsoredPost.description || ''}, 
                  ${content}, 
                  ${dateValue}, 
                  ${sponsoredPost.image || ''}, 
                  ${tagsSql}::text[], 
                  ${sponsoredPost.stats?.views || '0'}, 
                  ${sponsoredPost.stats?.likes || '0'}, 
                  ${sponsoredPost.stats?.comments || '0'}, 
                  ${sponsoredPost.stats?.shares || '0'}, 
                  'published'
                )
              `;
              console.log("POST Saved API - Sponsored post created successfully in database");
            } catch (insertError) {
              console.error("POST Saved API - Failed to create sponsored post:", insertError);
              return NextResponse.json({ 
                success: false, 
                error: "Failed to create sponsored post in database",
                details: insertError instanceof Error ? insertError.message : String(insertError)
              }, { status: 500 });
            }
          } else {
            return NextResponse.json({ 
              success: false, 
              error: "Sponsored post not found",
              details: `Sponsored post with ID ${postId} not found in frontend data`
            }, { status: 404 });
          }
        } else if (postId >= 100 && postId < 900) {
          // Handle news articles (IDs 100-899)
          console.log("POST Saved API - This appears to be a news article, creating it in database");
          
          // Import the news articles data and content generator
          const { newsArticles, generateNewsArticleContent } = await import("@/app/lib/data");
          const newsArticle = newsArticles.find(p => p.id === postId);
          
          if (newsArticle) {
            console.log("POST Saved API - Found news article data:", newsArticle);
            
            try {
              // Map frontend type to database enum value
              const postType = newsArticle.type === 'article' ? 'ARTICLE' : 
                              newsArticle.type === 'post' ? 'POST' : 'ARTICLE';
              
              console.log("POST Saved API - Mapped post type:", { frontend: newsArticle.type, database: postType });
              
              // Get content for news article
              const articleContent = generateNewsArticleContent(postId);
              const content = articleContent ? articleContent.join('\n\n') : newsArticle.description || '';
              
              // Handle date field - it's a String in database, not DateTime
              const dateValue = newsArticle.date || new Date().toISOString().split('T')[0];
              console.log("POST Saved API - Date value:", { original: newsArticle.date, stored: dateValue });
              
              console.log("POST Saved API - Prepared news article data:", {
                id: newsArticle.id,
                type: postType,
                title: newsArticle.title,
                date: dateValue,
                contentLength: content.length
              });
              
              // Prepare tags as PostgreSQL array format
              const tagsArray = newsArticle.tags || [];
              const tagsSql = tagsArray.length > 0 ? `{${tagsArray.map(tag => `"${tag}"`).join(',')}}` : '{}';
              
              console.log("POST Saved API - News tags array:", { frontend: tagsArray, sql: tagsSql });
              
              // Insert the news article into the Post table
              await prisma.$executeRaw`
                INSERT INTO "Post" (id, "userId", type, title, description, content, date, image, tags, views, likes, comments, shares, status)
                VALUES (
                  ${newsArticle.id}, 
                  ${newsArticle.authorId || 1}, 
                  ${postType}, 
                  ${newsArticle.title}, 
                  ${newsArticle.description || ''}, 
                  ${content}, 
                  ${dateValue}, 
                  ${newsArticle.image || ''}, 
                  ${tagsSql}::text[], 
                  ${newsArticle.stats?.views || '0'}, 
                  ${newsArticle.stats?.likes || '0'}, 
                  ${newsArticle.stats?.comments || '0'}, 
                  ${newsArticle.stats?.shares || '0'}, 
                  'published'
                )
              `;
              console.log("POST Saved API - News article created successfully in database");
            } catch (insertError) {
              console.error("POST Saved API - Failed to create news article:", insertError);
              return NextResponse.json({ 
                success: false, 
                error: "Failed to create news article in database",
                details: insertError instanceof Error ? insertError.message : String(insertError)
              }, { status: 500 });
            }
          } else {
            return NextResponse.json({ 
              success: false, 
              error: "News article not found",
              details: `News article with ID ${postId} not found in frontend data`
            }, { status: 404 });
          }
        } else {
          // Show some available posts for debugging
          const availablePosts = await prisma.$queryRaw<any[]>`
            SELECT id, title, type FROM "Post" ORDER BY id DESC LIMIT 5
          `;
          console.log("POST Saved API - Available posts in database:", availablePosts);
          
          return NextResponse.json({ 
            success: false, 
            error: "Post not found",
            details: `PostId ${postId} does not exist in Post table. Available posts: ${availablePosts.map(p => p.id).join(', ')}`
          }, { status: 404 });
        }
      }
      
      console.log("Save API - Inserting saved post:", { userId, postId, collectionId });
      
      if (collectionId) {
        await prisma.$executeRaw`
          INSERT INTO "SavedPost" ("userId", "postId", "collectionId")
          VALUES (${userId}, ${postId}, ${collectionId})
        `;
        console.log("Save API - Inserted with collectionId:", collectionId);
      } else {
        await prisma.$executeRaw`
          INSERT INTO "SavedPost" ("userId", "postId")
          VALUES (${userId}, ${postId})
        `;
        console.log("Save API - Inserted without collectionId");
      }
    } catch (error) {
      console.error("Save operation failed:", error);
      throw error;
    }

    console.log("User Saved API - Post saved successfully");

    return NextResponse.json({ 
      success: true, 
      message: "Post saved successfully" 
    });

  } catch (error) {
    console.error("User Saved API - Error saving post:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to save post",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// DELETE /api/user/saved - Remove a post from saved items
export async function DELETE(request: NextRequest) {
  const authUser = await getAuthUser(request);
  if (!authUser) return unauthorized();
  
  try {
    const { postId } = await request.json();
    const userId = authUser.id;
    
    if (!postId) {
      return NextResponse.json({ 
        success: false, 
        error: "Missing postId" 
      }, { status: 400 });
    }

    console.log("User Saved API - Unsaving post:", { userId, postId });

    // Remove the saved post
    const result = await prisma.$executeRaw`
      DELETE FROM "SavedPost" 
      WHERE "userId" = ${userId} AND "postId" = ${postId}
    `;

    console.log("User Saved API - Post unsaved successfully, rows affected:", result);

    return NextResponse.json({ 
      success: true, 
      message: "Post unsaved successfully" 
    });

  } catch (error) {
    console.error("User Saved API - Error unsaving post:", error);
    return NextResponse.json({ 
      success: false, 
      error: "Failed to unsave post" 
    }, { status: 500 });
  }
}
